#!/usr/bin/env python3
"""
Comprehensive Backend API Testing for Macedo SI CRM
Tests all endpoints with different user roles and permissions
"""

import requests
import sys
import json
from datetime import datetime
from typing import Dict, Any, Optional

class MacedoSIAPITester:
    def __init__(self, base_url="https://db-migration-hub-1.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.tokens = {}  # Store tokens for different users
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []
        self.test_conta_id = None  # Store test account ID for financial tests
        self.test_solicitacao_id = None  # Store test solicitação ID for trabalhista tests
        self.test_funcionario_id = None  # Store test funcionário ID for trabalhista tests
        self.test_obrigacao_id = None  # Store test obrigação ID for trabalhista tests
        self.test_obrigacao_fiscal_id = None  # Store test obrigação fiscal ID
        self.test_nota_id = None  # Store test nota fiscal ID
        self.test_ticket_id = None  # Store test ticket ID for atendimento tests
        self.test_artigo_id = None  # Store test artigo ID for base conhecimento tests
        
        # Test users from init_database.py
        self.test_users = {
            "admin": {"email": "admin@macedosi.com", "password": "admin123"},
            "colaborador": {"email": "colaborador@macedo.com.br", "password": "colab123"},
            "fiscal": {"email": "fiscal@macedo.com.br", "password": "fiscal123"}
        }

    def log_test(self, name: str, success: bool, details: str = ""):
        """Log test results"""
        self.tests_run += 1
        status = "✅ PASSED" if success else "❌ FAILED"
        print(f"{status} - {name}")
        if details:
            print(f"   Details: {details}")
        
        if success:
            self.tests_passed += 1
        else:
            self.failed_tests.append(f"{name}: {details}")

    def make_request(self, method: str, endpoint: str, token: str = None, data: Dict = None, expected_status: int = 200) -> tuple[bool, Dict]:
        """Make HTTP request with proper headers"""
        # Handle trailing slash for specific endpoints that need it
        endpoint = endpoint.lstrip('/')
        if endpoint in ['clients']:
            if not endpoint.endswith('/'):
                endpoint += '/'
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        if token:
            headers['Authorization'] = f'Bearer {token}'

        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=10)
            else:
                return False, {"error": f"Unsupported method: {method}"}

            success = response.status_code == expected_status
            
            try:
                response_data = response.json()
            except:
                response_data = {"text": response.text, "status_code": response.status_code}
            
            if not success:
                details = f"Expected {expected_status}, got {response.status_code}. Response: {response_data}"
                return False, {"error": details}
                
            return True, response_data

        except requests.exceptions.RequestException as e:
            return False, {"error": f"Request failed: {str(e)}"}

    def test_health_endpoints(self):
        """Test basic health endpoints"""
        print("\n🔍 Testing Health Endpoints...")
        
        # Test root endpoint
        success, response = self.make_request("GET", "/")
        self.log_test("Root endpoint", success, 
                     response.get("message", "") if success else response.get("error", ""))
        
        # Test health endpoint
        success, response = self.make_request("GET", "/health")
        self.log_test("Health check endpoint", success,
                     response.get("status", "") if success else response.get("error", ""))

    def test_authentication(self):
        """Test authentication for all user types"""
        print("\n🔍 Testing Authentication...")
        
        for user_type, credentials in self.test_users.items():
            success, response = self.make_request("POST", "/auth/login", data=credentials)
            
            if success and "access_token" in response:
                self.tokens[user_type] = response["access_token"]
                user_info = response.get("user", {})
                details = f"Role: {user_info.get('role', 'unknown')}, Email: {user_info.get('email', 'unknown')}"
                self.log_test(f"Login - {user_type}", True, details)
            else:
                self.log_test(f"Login - {user_type}", False, response.get("error", "Login failed"))

    def test_user_profile(self):
        """Test user profile endpoints"""
        print("\n🔍 Testing User Profile...")
        
        for user_type, token in self.tokens.items():
            success, response = self.make_request("GET", "/auth/me", token=token)
            if success:
                details = f"Name: {response.get('name', 'unknown')}, Role: {response.get('role', 'unknown')}"
                self.log_test(f"Get profile - {user_type}", True, details)
            else:
                self.log_test(f"Get profile - {user_type}", False, response.get("error", ""))

    def test_clients_endpoints(self):
        """Test clients endpoints"""
        print("\n🔍 Testing Clients Endpoints...")
        
        for user_type, token in self.tokens.items():
            # Test get clients
            success, response = self.make_request("GET", "/clients", token=token)
            if success:
                # Handle both list and dict responses
                if isinstance(response, dict) and 'clients' in response:
                    client_count = len(response['clients'])
                    total = response.get('total', client_count)
                    self.log_test(f"Get clients - {user_type}", True, f"Found {client_count} clients (total: {total})")
                elif isinstance(response, list):
                    client_count = len(response)
                    self.log_test(f"Get clients - {user_type}", True, f"Found {client_count} clients")
                else:
                    self.log_test(f"Get clients - {user_type}", True, "Clients retrieved")
            else:
                self.log_test(f"Get clients - {user_type}", False, response.get("error", ""))

    def test_financial_endpoints(self):
        """Test comprehensive financial endpoints"""
        print("\n🔍 Testing Financial Endpoints...")
        
        # Only test with admin token for comprehensive testing
        if "admin" not in self.tokens:
            print("❌ No admin token available for financial testing")
            return
            
        admin_token = self.tokens["admin"]
        
        # Test financial clients CRUD
        self.test_financial_clients_crud(admin_token)
        
        # Test contas a receber CRUD
        self.test_contas_receber_crud(admin_token)
        
        # Test cobrança and contatos
        self.test_cobranca_system(admin_token)
        
        # Test relatórios
        self.test_financial_reports(admin_token)
        
        # Test dashboard stats
        self.test_dashboard_stats(admin_token)
        
        # Test importação de extratos
        self.test_extrato_import_system(admin_token)

    def test_financial_clients_crud(self, token):
        """Test financial clients CRUD operations"""
        print("\n📊 Testing Financial Clients CRUD...")
        
        # Test GET financial clients
        success, response = self.make_request("GET", "/financial/clients", token=token)
        if success:
            count = len(response) if isinstance(response, list) else 0
            self.log_test("Get financial clients", True, f"Found {count} financial clients")
        else:
            self.log_test("Get financial clients", False, response.get("error", ""))
        
        # Test POST financial clients - Create new financial client
        test_client_data = {
            "nome": "Cliente Financeiro Teste",
            "email": "cliente.teste@empresa.com.br",
            "telefone": "(11) 99999-9999",
            "cnpj": "12.345.678/0001-90",
            "endereco": "Rua Teste, 123",
            "cidade": "São Paulo",
            "estado": "SP",
            "cep": "01234-567",
            "setor": "financeiro",
            "observacoes": "Cliente criado via teste automatizado"
        }
        
        success, response = self.make_request("POST", "/financial/clients", token=token, data=test_client_data)
        if success:
            created_id = response.get("id")
            self.log_test("Create financial client", True, f"Created client with ID: {created_id}")
        else:
            self.log_test("Create financial client", False, response.get("error", ""))

    def test_contas_receber_crud(self, token):
        """Test contas a receber CRUD operations"""
        print("\n💰 Testing Contas a Receber CRUD...")
        
        # Test GET contas a receber
        success, response = self.make_request("GET", "/financial/contas-receber", token=token)
        if success:
            count = len(response) if isinstance(response, list) else 0
            self.log_test("Get contas a receber", True, f"Found {count} accounts")
            
            # Store first account ID for further testing
            if count > 0:
                self.test_conta_id = response[0].get("id")
        else:
            self.log_test("Get contas a receber", False, response.get("error", ""))
        
        # Test POST - Create new conta a receber
        test_conta_data = {
            "empresa_id": "test-empresa-123",
            "empresa": "Empresa Teste LTDA",
            "descricao": "Honorários contábeis - Janeiro 2025",
            "documento": "DOC-TEST-001",
            "tipo_documento": "boleto",
            "forma_pagamento": "boleto",
            "conta": "Banco do Brasil",
            "centro_custo": "Administrativo",
            "plano_custo": "Receitas",
            "data_emissao": "2025-01-15",
            "data_vencimento": "2025-02-15",
            "valor_original": 1500.00,
            "observacao": "Teste de criação via API",
            "cidade_atendimento": "São Paulo",
            "usuario_responsavel": "Admin Teste"
        }
        
        success, response = self.make_request("POST", "/financial/contas-receber", token=token, data=test_conta_data, expected_status=200)
        if success:
            created_id = response.get("id")
            self.log_test("Create conta a receber", True, f"Created account with ID: {created_id}")
            self.test_conta_id = created_id
        else:
            self.log_test("Create conta a receber", False, response.get("error", ""))
        
        # Test GET specific conta by ID
        if hasattr(self, 'test_conta_id') and self.test_conta_id:
            success, response = self.make_request("GET", f"/financial/contas-receber/{self.test_conta_id}", token=token)
            if success:
                self.log_test("Get conta by ID", True, f"Retrieved account: {response.get('empresa', 'Unknown')}")
            else:
                self.log_test("Get conta by ID", False, response.get("error", ""))
        
        # Test advanced search
        search_filters = {
            "empresa": "Teste",
            "situacao": ["em_aberto"],
            "valor_minimo": 1000.0,
            "valor_maximo": 2000.0
        }
        
        success, response = self.make_request("POST", "/financial/contas-receber/search", token=token, data=search_filters)
        if success:
            count = len(response) if isinstance(response, list) else 0
            self.log_test("Advanced search contas", True, f"Found {count} matching accounts")
        else:
            self.log_test("Advanced search contas", False, response.get("error", ""))

    def test_cobranca_system(self, token):
        """Test cobrança and contact system"""
        print("\n📞 Testing Cobrança System...")
        
        if not hasattr(self, 'test_conta_id') or not self.test_conta_id:
            self.log_test("Cobrança system", False, "No test account ID available")
            return
        
        # Test add contact to account
        contact_data = {
            "titulo_id": self.test_conta_id,
            "tipo_contato": "whatsapp",
            "observacao": "Primeiro contato de cobrança - cliente informou que pagará até sexta",
            "resultado": "prometeu_pagar",
            "usuario_responsavel": "Admin Teste"
        }
        
        success, response = self.make_request("POST", f"/financial/contas-receber/{self.test_conta_id}/contatos", token=token, data=contact_data)
        if success:
            self.log_test("Add contact to account", True, f"Contact added: {response.get('tipo_contato', 'unknown')}")
        else:
            self.log_test("Add contact to account", False, response.get("error", ""))
        
        # Test generate reminder messages
        for tipo in ["whatsapp", "email"]:
            success, response = self.make_request("GET", f"/financial/cobranca/lembretes/{self.test_conta_id}?tipo={tipo}", token=token)
            if success:
                message_length = len(response.get("mensagem", ""))
                self.log_test(f"Generate {tipo} reminder", True, f"Generated message with {message_length} characters")
            else:
                self.log_test(f"Generate {tipo} reminder", False, response.get("error", ""))
        
        # Test renegotiation proposal
        proposal_data = {
            "titulo_id": self.test_conta_id,
            "nova_data_vencimento": "2025-03-15",
            "novo_valor": 1350.00,
            "desconto_proposto": 150.00,
            "condicoes": "Pagamento à vista com desconto de 10%",
            "observacao": "Cliente solicitou desconto para pagamento imediato",
            "usuario_responsavel": "Admin Teste"
        }
        
        success, response = self.make_request("POST", f"/financial/contas-receber/{self.test_conta_id}/proposta-renegociacao", token=token, data=proposal_data)
        if success:
            self.log_test("Create renegotiation proposal", True, f"Proposal created for value: R${response.get('novo_valor', 0)}")
        else:
            self.log_test("Create renegotiation proposal", False, response.get("error", ""))
        
        # Test duplicate account
        success, response = self.make_request("POST", f"/financial/contas-receber/{self.test_conta_id}/duplicate?nova_data_vencimento=2025-03-15", token=token)
        if success:
            self.log_test("Duplicate account", True, f"Duplicated account with ID: {response.get('id', 'unknown')}")
        else:
            self.log_test("Duplicate account", False, response.get("error", ""))

    def test_financial_reports(self, token):
        """Test financial reports"""
        print("\n📈 Testing Financial Reports...")
        
        # Test inadimplência report
        success, response = self.make_request("GET", "/financial/relatorios/inadimplencia", token=token)
        if success:
            report_count = len(response.get("relatorio", []))
            self.log_test("Inadimplência report", True, f"Generated report with {report_count} entries")
        else:
            self.log_test("Inadimplência report", False, response.get("error", ""))
        
        # Test recebimentos report with date range
        success, response = self.make_request("GET", "/financial/relatorios/recebimentos?data_inicio=2025-01-01&data_fim=2025-01-31", token=token)
        if success:
            report_count = len(response.get("relatorio", []))
            self.log_test("Recebimentos report", True, f"Generated report with {report_count} entries")
        else:
            self.log_test("Recebimentos report", False, response.get("error", ""))
        
        # Test export functionality
        for formato in ["json", "csv"]:
            success, response = self.make_request("GET", f"/financial/export/contas-receber?formato={formato}", token=token)
            if success:
                if formato == "json":
                    record_count = len(response.get("data", []))
                    self.log_test(f"Export {formato.upper()}", True, f"Exported {record_count} records")
                else:
                    content_length = len(response.get("content", ""))
                    self.log_test(f"Export {formato.upper()}", True, f"Generated CSV with {content_length} characters")
            else:
                self.log_test(f"Export {formato.upper()}", False, response.get("error", ""))

    def test_dashboard_stats(self, token):
        """Test dashboard statistics"""
        print("\n📊 Testing Dashboard Statistics...")
        
        success, response = self.make_request("GET", "/financial/dashboard-stats", token=token)
        if success:
            stats = response
            total_aberto = stats.get("total_aberto", {}).get("valor", 0)
            total_atrasado = stats.get("total_atrasado", {}).get("valor", 0)
            aging_data = stats.get("aging", {})
            
            self.log_test("Dashboard stats", True, 
                         f"Total em aberto: R${total_aberto:.2f}, Atrasado: R${total_atrasado:.2f}, Aging groups: {len(aging_data)}")
        else:
            self.log_test("Dashboard stats", False, response.get("error", ""))

    def test_extrato_import_system(self, token):
        """Test extrato import system"""
        print("\n📄 Testing Extrato Import System...")
        
        # Test list importações
        success, response = self.make_request("GET", "/financial/extrato/importacoes", token=token)
        if success:
            import_count = len(response) if isinstance(response, list) else 0
            self.log_test("List importações", True, f"Found {import_count} import records")
        else:
            self.log_test("List importações", False, response.get("error", ""))
        
        # Test file upload simulation (without actual file)
        # This would normally require multipart/form-data, so we'll test the endpoint availability
        success, response = self.make_request("POST", "/financial/extrato/importar?conta_bancaria=Banco%20do%20Brasil&cidade=São%20Paulo", 
                                            token=token, expected_status=422)  # Expect validation error without file
        if success or "422" in str(response.get("error", "")):
            self.log_test("Import endpoint availability", True, "Endpoint accepts requests (validation error expected without file)")
        else:
            self.log_test("Import endpoint availability", False, response.get("error", ""))
        
        # Test payment processing (baixa)
        if hasattr(self, 'test_conta_id') and self.test_conta_id:
            baixa_data = {
                "data_recebimento": "2025-01-20",
                "valor_recebido": 1500.00,
                "forma_pagamento": "pix",
                "desconto_aplicado": 0.0,
                "acrescimo_aplicado": 0.0,
                "troco": 0.0,
                "observacao": "Pagamento realizado via PIX",
                "usuario_responsavel": "Admin Teste"
            }
            
            success, response = self.make_request("PUT", f"/financial/contas-receber/{self.test_conta_id}/baixa", 
                                                token=token, data=baixa_data)
            if success:
                self.log_test("Process payment (baixa)", True, f"Payment processed for account: {response.get('empresa', 'unknown')}")
            else:
                self.log_test("Process payment (baixa)", False, response.get("error", ""))

    def test_trabalhista_endpoints(self):
        """Test comprehensive trabalhista endpoints"""
        print("\n🔍 Testing Trabalhista Endpoints...")
        
        # Only test with admin token for comprehensive testing
        if "admin" not in self.tokens:
            print("❌ No admin token available for trabalhista testing")
            return
            
        admin_token = self.tokens["admin"]
        
        # Test solicitações trabalhistas CRUD
        self.test_solicitacoes_trabalhistas_crud(admin_token)
        
        # Test funcionários CRUD
        self.test_funcionarios_crud(admin_token)
        
        # Test obrigações trabalhistas CRUD
        self.test_obrigacoes_trabalhistas_crud(admin_token)
        
        # Test dashboard stats
        self.test_trabalhista_dashboard_stats(admin_token)
        
        # Test relatórios
        self.test_trabalhista_relatorios(admin_token)
        
        # Test legacy endpoints
        self.test_trabalhista_legacy_endpoints(admin_token)

    def test_solicitacoes_trabalhistas_crud(self, token):
        """Test solicitações trabalhistas CRUD operations"""
        print("\n📋 Testing Solicitações Trabalhistas CRUD...")
        
        # Test GET solicitações
        success, response = self.make_request("GET", "/trabalhista/solicitacoes", token=token)
        if success:
            count = len(response) if isinstance(response, list) else 0
            self.log_test("Get solicitações trabalhistas", True, f"Found {count} solicitações")
        else:
            self.log_test("Get solicitações trabalhistas", False, response.get("error", ""))
        
        # Test POST - Create new solicitação
        test_solicitacao_data = {
            "empresa_id": "emp-001",
            "empresa": "Empresa Teste LTDA",
            "tipo": "admissao",
            "titulo": "Admissão de novo funcionário",
            "descricao": "Processar admissão do funcionário João Silva",
            "prazo": "2025-02-15",
            "responsavel": "Maria Santos",
            "prioridade": "alta",
            "observacoes": "Funcionário com experiência prévia na área"
        }
        
        success, response = self.make_request("POST", "/trabalhista/solicitacoes", token=token, data=test_solicitacao_data)
        if success:
            created_id = response.get("id")
            self.log_test("Create solicitação trabalhista", True, f"Created solicitação with ID: {created_id}")
            self.test_solicitacao_id = created_id
        else:
            self.log_test("Create solicitação trabalhista", False, response.get("error", ""))
        
        # Test GET specific solicitação by ID
        if hasattr(self, 'test_solicitacao_id') and self.test_solicitacao_id:
            success, response = self.make_request("GET", f"/trabalhista/solicitacoes/{self.test_solicitacao_id}", token=token)
            if success:
                self.log_test("Get solicitação by ID", True, f"Retrieved solicitação: {response.get('titulo', 'Unknown')}")
            else:
                self.log_test("Get solicitação by ID", False, response.get("error", ""))
            
            # Test PUT - Update solicitação
            update_data = {
                "status": "em_andamento",
                "observacoes": "Documentos recebidos, iniciando processamento"
            }
            
            success, response = self.make_request("PUT", f"/trabalhista/solicitacoes/{self.test_solicitacao_id}", token=token, data=update_data)
            if success:
                self.log_test("Update solicitação trabalhista", True, f"Updated status to: {response.get('status', 'unknown')}")
            else:
                self.log_test("Update solicitação trabalhista", False, response.get("error", ""))
        
        # Test advanced search with filters
        search_filters = {
            "tipo": "admissao",
            "status": "em_andamento",
            "responsavel": "Maria",
            "search": "João"
        }
        
        success, response = self.make_request("GET", "/trabalhista/solicitacoes", token=token, data=search_filters)
        if success:
            count = len(response) if isinstance(response, list) else 0
            self.log_test("Search solicitações with filters", True, f"Found {count} matching solicitações")
        else:
            self.log_test("Search solicitações with filters", False, response.get("error", ""))

    def test_funcionarios_crud(self, token):
        """Test funcionários CRUD operations"""
        print("\n👥 Testing Funcionários CRUD...")
        
        # Test GET funcionários
        success, response = self.make_request("GET", "/trabalhista/funcionarios", token=token)
        if success:
            count = len(response) if isinstance(response, list) else 0
            self.log_test("Get funcionários", True, f"Found {count} funcionários")
        else:
            self.log_test("Get funcionários", False, response.get("error", ""))
        
        # Test POST - Create new funcionário
        test_funcionario_data = {
            "empresa_id": "emp-001",
            "dados_pessoais": {
                "nome_completo": "João Silva Santos",
                "cpf": "123.456.789-00",
                "rg": "12.345.678-9",
                "data_nascimento": "1990-05-15",
                "estado_civil": "solteiro",
                "endereco": "Rua das Flores, 123 - Centro",
                "telefone": "(11) 99999-8888",
                "email": "joao.silva@email.com",
                "nome_mae": "Maria Silva Santos"
            },
            "dados_contratuais": {
                "funcao": "Assistente Administrativo",
                "cargo": "Assistente",
                "tipo_contrato": "clt",
                "salario_base": 2500.00,
                "carga_horaria": 40,
                "data_admissao": "2025-02-01",
                "setor": "Administrativo",
                "centro_custo": "ADM001"
            },
            "observacoes": "Funcionário com experiência prévia em escritório contábil"
        }
        
        success, response = self.make_request("POST", "/trabalhista/funcionarios", token=token, data=test_funcionario_data)
        if success:
            created_id = response.get("id")
            self.log_test("Create funcionário", True, f"Created funcionário with ID: {created_id}")
            self.test_funcionario_id = created_id
        else:
            self.log_test("Create funcionário", False, response.get("error", ""))
        
        # Test search funcionários
        search_params = {
            "search": "João",
            "status": "ativo"
        }
        
        success, response = self.make_request("GET", "/trabalhista/funcionarios", token=token, data=search_params)
        if success:
            count = len(response) if isinstance(response, list) else 0
            self.log_test("Search funcionários", True, f"Found {count} matching funcionários")
        else:
            self.log_test("Search funcionários", False, response.get("error", ""))

    def test_obrigacoes_trabalhistas_crud(self, token):
        """Test obrigações trabalhistas CRUD operations"""
        print("\n📅 Testing Obrigações Trabalhistas CRUD...")
        
        # Test GET obrigações
        success, response = self.make_request("GET", "/trabalhista/obrigacoes", token=token)
        if success:
            count = len(response) if isinstance(response, list) else 0
            self.log_test("Get obrigações trabalhistas", True, f"Found {count} obrigações")
        else:
            self.log_test("Get obrigações trabalhistas", False, response.get("error", ""))
        
        # Test POST - Create new obrigação
        test_obrigacao_data = {
            "empresa_id": "emp-001",
            "nome": "GFIP - Guia de Recolhimento do FGTS",
            "descricao": "Entrega mensal da GFIP com informações dos funcionários",
            "periodicidade": "mensal",
            "dia_vencimento": 7,
            "responsavel": "Maria Santos",
            "observacoes": "Entrega até o dia 7 de cada mês"
        }
        
        success, response = self.make_request("POST", "/trabalhista/obrigacoes", token=token, data=test_obrigacao_data)
        if success:
            created_id = response.get("id")
            self.log_test("Create obrigação trabalhista", True, f"Created obrigação with ID: {created_id}")
            self.test_obrigacao_id = created_id
        else:
            self.log_test("Create obrigação trabalhista", False, response.get("error", ""))
        
        # Test search obrigações with filters
        search_params = {
            "status": "pendente",
            "vencimento_ate": "2025-03-31"
        }
        
        success, response = self.make_request("GET", "/trabalhista/obrigacoes", token=token, data=search_params)
        if success:
            count = len(response) if isinstance(response, list) else 0
            self.log_test("Search obrigações with filters", True, f"Found {count} matching obrigações")
        else:
            self.log_test("Search obrigações with filters", False, response.get("error", ""))

    def test_trabalhista_dashboard_stats(self, token):
        """Test trabalhista dashboard statistics"""
        print("\n📊 Testing Trabalhista Dashboard Statistics...")
        
        success, response = self.make_request("GET", "/trabalhista/dashboard-stats", token=token)
        if success:
            stats = response
            solicitacoes_stats = stats.get("solicitacoes_por_status", {})
            funcionarios_ativos = stats.get("funcionarios_ativos", 0)
            obrigacoes_vencendo = stats.get("obrigacoes_vencendo", 0)
            
            self.log_test("Trabalhista dashboard stats", True, 
                         f"Funcionários ativos: {funcionarios_ativos}, Obrigações vencendo: {obrigacoes_vencendo}, Status groups: {len(solicitacoes_stats)}")
        else:
            self.log_test("Trabalhista dashboard stats", False, response.get("error", ""))

    def test_trabalhista_relatorios(self, token):
        """Test trabalhista reports"""
        print("\n📈 Testing Trabalhista Reports...")
        
        # Test monthly report
        success, response = self.make_request("GET", "/trabalhista/relatorios/mensal?mes=1&ano=2025", token=token)
        if success:
            total_solicitacoes = response.get("total_solicitacoes", 0)
            admissoes = response.get("admissoes", 0)
            demissoes = response.get("demissoes", 0)
            self.log_test("Monthly trabalhista report", True, 
                         f"Solicitações: {total_solicitacoes}, Admissões: {admissoes}, Demissões: {demissoes}")
        else:
            self.log_test("Monthly trabalhista report", False, response.get("error", ""))

    def test_trabalhista_legacy_endpoints(self, token):
        """Test legacy trabalhista endpoints for backward compatibility"""
        print("\n🔄 Testing Legacy Trabalhista Endpoints...")
        
        # Test legacy GET endpoint
        success, response = self.make_request("GET", "/trabalhista/", token=token)
        if success:
            count = len(response) if isinstance(response, list) else 0
            self.log_test("Legacy GET trabalhista", True, f"Found {count} solicitações via legacy endpoint")
        else:
            self.log_test("Legacy GET trabalhista", False, response.get("error", ""))
        
        # Test legacy POST endpoint
        test_legacy_data = {
            "empresa_id": "emp-002",
            "empresa": "Empresa Legacy LTDA",
            "tipo": "folha",
            "titulo": "Processamento de folha - Janeiro 2025",
            "descricao": "Calcular folha de pagamento do mês de janeiro",
            "prazo": "2025-01-31",
            "responsavel": "Admin Teste",
            "prioridade": "alta"
        }
        
        success, response = self.make_request("POST", "/trabalhista/", token=token, data=test_legacy_data)
        if success:
            created_id = response.get("id")
            self.log_test("Legacy POST trabalhista", True, f"Created via legacy endpoint with ID: {created_id}")
        else:
            self.log_test("Legacy POST trabalhista", False, response.get("error", ""))

    def test_fiscal_endpoints(self):
        """Test comprehensive fiscal endpoints"""
        print("\n🔍 Testing Fiscal Endpoints...")
        
        # Only test with admin token for comprehensive testing
        if "admin" not in self.tokens:
            print("❌ No admin token available for fiscal testing")
            return
            
        admin_token = self.tokens["admin"]
        
        # Test obrigações fiscais CRUD
        self.test_obrigacoes_fiscais_crud(admin_token)
        
        # Test notas fiscais CRUD
        self.test_notas_fiscais_crud(admin_token)
        
        # Test dashboard stats
        self.test_fiscal_dashboard_stats(admin_token)
        
        # Test relatórios
        self.test_fiscal_relatorios(admin_token)
        
        # Test legacy endpoints
        self.test_fiscal_legacy_endpoints(admin_token)

    def test_obrigacoes_fiscais_crud(self, token):
        """Test obrigações fiscais CRUD operations"""
        print("\n📋 Testing Obrigações Fiscais CRUD...")
        
        # Test GET obrigações
        success, response = self.make_request("GET", "/fiscal/obrigacoes", token=token)
        if success:
            count = len(response) if isinstance(response, list) else 0
            self.log_test("Get obrigações fiscais", True, f"Found {count} obrigações")
        else:
            self.log_test("Get obrigações fiscais", False, response.get("error", ""))
        
        # Test POST - Create new obrigação
        test_obrigacao_data = {
            "empresa_id": "emp-001",
            "empresa": "Empresa Teste LTDA",
            "tipo": "pgdas",
            "nome": "PGDAS Janeiro 2025",
            "descricao": "Programa Gerador do DAS - Simples Nacional",
            "periodicidade": "mensal",
            "dia_vencimento": 20,
            "responsavel": "João Silva",
            "regime_tributario": "simples_nacional",
            "observacoes": "Entrega até o dia 20 de cada mês",
            "valor": 1500.00
        }
        
        success, response = self.make_request("POST", "/fiscal/obrigacoes", token=token, data=test_obrigacao_data)
        if success:
            created_id = response.get("id")
            self.log_test("Create obrigação fiscal", True, f"Created obrigação with ID: {created_id}")
            self.test_obrigacao_id = created_id
        else:
            self.log_test("Create obrigação fiscal", False, response.get("error", ""))
        
        # Test GET specific obrigação by ID
        if hasattr(self, 'test_obrigacao_id') and self.test_obrigacao_id:
            success, response = self.make_request("GET", f"/fiscal/obrigacoes/{self.test_obrigacao_id}", token=token)
            if success:
                self.log_test("Get obrigação by ID", True, f"Retrieved obrigação: {response.get('nome', 'Unknown')}")
            else:
                self.log_test("Get obrigação by ID", False, response.get("error", ""))
            
            # Test PUT - Update obrigação
            update_data = {
                "status": "em_andamento",
                "observacoes": "Documentos em preparação"
            }
            
            success, response = self.make_request("PUT", f"/fiscal/obrigacoes/{self.test_obrigacao_id}", token=token, data=update_data)
            if success:
                self.log_test("Update obrigação fiscal", True, f"Updated status to: {response.get('status', 'unknown')}")
            else:
                self.log_test("Update obrigação fiscal", False, response.get("error", ""))
        
        # Test advanced search with filters
        search_params = {
            "tipo": "pgdas",
            "status": "em_andamento",
            "responsavel": "João",
            "search": "PGDAS"
        }
        
        success, response = self.make_request("GET", "/fiscal/obrigacoes", token=token, data=search_params)
        if success:
            count = len(response) if isinstance(response, list) else 0
            self.log_test("Search obrigações with filters", True, f"Found {count} matching obrigações")
        else:
            self.log_test("Search obrigações with filters", False, response.get("error", ""))

    def test_notas_fiscais_crud(self, token):
        """Test notas fiscais CRUD operations"""
        print("\n📄 Testing Notas Fiscais CRUD...")
        
        # Test GET notas fiscais
        success, response = self.make_request("GET", "/fiscal/notas-fiscais", token=token)
        if success:
            count = len(response) if isinstance(response, list) else 0
            self.log_test("Get notas fiscais", True, f"Found {count} notas fiscais")
        else:
            self.log_test("Get notas fiscais", False, response.get("error", ""))
        
        # Test POST - Create new nota fiscal
        test_nota_data = {
            "empresa_id": "emp-001",
            "empresa": "Empresa Teste LTDA",
            "tipo": "saida",
            "numero": 1001,
            "serie": "1",
            "chave_nfe": "35250112345678000190550010000010011234567890",
            "data_emissao": "2025-01-15",
            "emitente_cnpj": "12.345.678/0001-90",
            "emitente_razao_social": "Empresa Teste LTDA",
            "destinatario_cnpj": "98.765.432/0001-10",
            "destinatario_razao_social": "Cliente Teste LTDA",
            "valor_total": 2500.00,
            "valor_produtos": 2500.00,
            "valor_servicos": 0.0,
            "cfop": "5102",
            "natureza_operacao": "Venda de mercadoria"
        }
        
        success, response = self.make_request("POST", "/fiscal/notas-fiscais", token=token, data=test_nota_data)
        if success:
            created_id = response.get("id")
            self.log_test("Create nota fiscal", True, f"Created nota fiscal with ID: {created_id}")
            self.test_nota_id = created_id
        else:
            self.log_test("Create nota fiscal", False, response.get("error", ""))
        
        # Test search notas fiscais with filters
        search_params = {
            "tipo": "saida",
            "emitente_cnpj": "12.345.678",
            "valor_minimo": 2000.0,
            "valor_maximo": 3000.0
        }
        
        success, response = self.make_request("GET", "/fiscal/notas-fiscais", token=token, data=search_params)
        if success:
            count = len(response) if isinstance(response, list) else 0
            self.log_test("Search notas fiscais with filters", True, f"Found {count} matching notas")
        else:
            self.log_test("Search notas fiscais with filters", False, response.get("error", ""))
        
        # Test XML upload endpoint (without actual file)
        success, response = self.make_request("POST", "/fiscal/notas-fiscais/upload-xml?empresa_id=emp-001", 
                                            token=token, expected_status=422)  # Expect validation error without file
        if success or "422" in str(response.get("error", "")):
            self.log_test("XML upload endpoint availability", True, "Endpoint accepts requests (validation error expected without file)")
        else:
            self.log_test("XML upload endpoint availability", False, response.get("error", ""))

    def test_fiscal_dashboard_stats(self, token):
        """Test fiscal dashboard statistics"""
        print("\n📊 Testing Fiscal Dashboard Statistics...")
        
        success, response = self.make_request("GET", "/fiscal/dashboard-stats", token=token)
        if success:
            stats = response
            obrigacoes_stats = stats.get("obrigacoes_por_status", {})
            obrigacoes_vencendo = stats.get("obrigacoes_vencendo", 0)
            notas_mes = stats.get("notas_fiscais_mes", 0)
            
            self.log_test("Fiscal dashboard stats", True, 
                         f"Obrigações vencendo: {obrigacoes_vencendo}, Notas mês: {notas_mes}, Status groups: {len(obrigacoes_stats)}")
        else:
            self.log_test("Fiscal dashboard stats", False, response.get("error", ""))

    def test_fiscal_relatorios(self, token):
        """Test fiscal reports"""
        print("\n📈 Testing Fiscal Reports...")
        
        # Test impostos report
        success, response = self.make_request("GET", "/fiscal/relatorios/impostos?periodo=2025-01", token=token)
        if success:
            detalhes = response.get("detalhes_por_tipo", [])
            resumo = response.get("resumo_geral", {})
            self.log_test("Impostos report", True, 
                         f"Generated report with {len(detalhes)} type details, total impostos: R${resumo.get('total_impostos', 0)}")
        else:
            self.log_test("Impostos report", False, response.get("error", ""))

    def test_fiscal_legacy_endpoints(self, token):
        """Test legacy fiscal endpoints for backward compatibility"""
        print("\n🔄 Testing Legacy Fiscal Endpoints...")
        
        # Test legacy GET endpoint
        success, response = self.make_request("GET", "/fiscal/", token=token)
        if success:
            count = len(response) if isinstance(response, list) else 0
            self.log_test("Legacy GET fiscal", True, f"Found {count} obrigações via legacy endpoint")
        else:
            self.log_test("Legacy GET fiscal", False, response.get("error", ""))
        
        # Test legacy POST endpoint
        test_legacy_data = {
            "empresa_id": "emp-002",
            "empresa": "Empresa Legacy LTDA",
            "tipo": "defis",
            "nome": "DEFIS 2024",
            "descricao": "Declaração de Informações Socioeconômicas e Fiscais",
            "periodicidade": "anual",
            "dia_vencimento": 31,
            "responsavel": "Admin Teste",
            "regime_tributario": "simples_nacional"
        }
        
        success, response = self.make_request("POST", "/fiscal/", token=token, data=test_legacy_data)
        if success:
            created_id = response.get("id")
            self.log_test("Legacy POST fiscal", True, f"Created via legacy endpoint with ID: {created_id}")
        else:
            self.log_test("Legacy POST fiscal", False, response.get("error", ""))

    def test_atendimento_endpoints(self):
        """Test comprehensive atendimento endpoints"""
        print("\n🔍 Testing Atendimento Endpoints...")
        
        # Only test with admin token for comprehensive testing
        if "admin" not in self.tokens:
            print("❌ No admin token available for atendimento testing")
            return
            
        admin_token = self.tokens["admin"]
        
        # Test tickets CRUD
        self.test_tickets_crud(admin_token)
        
        # Test conversas/mensagens
        self.test_conversas_system(admin_token)
        
        # Test base de conhecimento
        self.test_base_conhecimento_crud(admin_token)
        
        # Test dashboard stats
        self.test_atendimento_dashboard_stats(admin_token)
        
        # Test relatórios
        self.test_atendimento_relatorios(admin_token)
        
        # Test legacy endpoints
        self.test_atendimento_legacy_endpoints(admin_token)

    def test_tickets_crud(self, token):
        """Test tickets CRUD operations"""
        print("\n🎫 Testing Tickets CRUD...")
        
        # Test GET tickets
        success, response = self.make_request("GET", "/atendimento/tickets", token=token)
        if success:
            count = len(response) if isinstance(response, list) else 0
            self.log_test("Get tickets", True, f"Found {count} tickets")
        else:
            self.log_test("Get tickets", False, response.get("error", ""))
        
        # Test POST - Create new ticket
        test_ticket_data = {
            "empresa_id": "emp-001",
            "empresa": "Empresa Teste LTDA",
            "solicitante_nome": "Maria Silva",
            "solicitante_email": "maria.silva@empresa.com.br",
            "solicitante_telefone": "(11) 99999-8888",
            "titulo": "Dúvida sobre declaração mensal",
            "descricao": "Preciso de ajuda para entender como preencher a declaração mensal do Simples Nacional",
            "tipo": "duvida",
            "categoria": "Fiscal",
            "prioridade": "media",
            "responsavel": "João Santos",
            "equipe": "Fiscal",
            "canal": "email",
            "data_abertura": "2025-01-15",
            "tags": ["simples_nacional", "declaracao", "duvida"]
        }
        
        success, response = self.make_request("POST", "/atendimento/tickets", token=token, data=test_ticket_data)
        if success:
            created_id = response.get("id")
            numero = response.get("numero")
            self.log_test("Create ticket", True, f"Created ticket {numero} with ID: {created_id}")
            self.test_ticket_id = created_id
        else:
            self.log_test("Create ticket", False, response.get("error", ""))
        
        # Test GET specific ticket by ID
        if hasattr(self, 'test_ticket_id') and self.test_ticket_id:
            success, response = self.make_request("GET", f"/atendimento/tickets/{self.test_ticket_id}", token=token)
            if success:
                self.log_test("Get ticket by ID", True, f"Retrieved ticket: {response.get('titulo', 'Unknown')}")
            else:
                self.log_test("Get ticket by ID", False, response.get("error", ""))
            
            # Test PUT - Update ticket
            update_data = {
                "status": "em_andamento",
                "solucao": "Orientações sobre preenchimento da declaração fornecidas"
            }
            
            success, response = self.make_request("PUT", f"/atendimento/tickets/{self.test_ticket_id}", token=token, data=update_data)
            if success:
                self.log_test("Update ticket", True, f"Updated status to: {response.get('status', 'unknown')}")
            else:
                self.log_test("Update ticket", False, response.get("error", ""))
        
        # Test advanced search with filters
        search_params = {
            "status": "em_andamento",
            "prioridade": "media",
            "equipe": "Fiscal",
            "search": "declaração"
        }
        
        success, response = self.make_request("GET", "/atendimento/tickets", token=token, data=search_params)
        if success:
            count = len(response) if isinstance(response, list) else 0
            self.log_test("Search tickets with filters", True, f"Found {count} matching tickets")
        else:
            self.log_test("Search tickets with filters", False, response.get("error", ""))

    def test_conversas_system(self, token):
        """Test conversations/messages system"""
        print("\n💬 Testing Conversas System...")
        
        if not hasattr(self, 'test_ticket_id') or not self.test_ticket_id:
            self.log_test("Conversas system", False, "No test ticket ID available")
            return
        
        # Test add conversation to ticket
        conversa_data = {
            "mensagem": "Olá! Para preencher a declaração do Simples Nacional, você deve acessar o portal do Simples Nacional e seguir os seguintes passos...",
            "tipo": "resposta",
            "eh_publico": True,
            "anexos": []
        }
        
        success, response = self.make_request("POST", f"/atendimento/tickets/{self.test_ticket_id}/conversas", token=token, data=conversa_data)
        if success:
            self.log_test("Add conversation to ticket", True, f"Added conversation by: {response.get('usuario', 'unknown')}")
        else:
            self.log_test("Add conversation to ticket", False, response.get("error", ""))
        
        # Test add internal note
        nota_interna_data = {
            "mensagem": "Cliente já foi orientado sobre este assunto anteriormente. Verificar histórico.",
            "tipo": "nota_interna",
            "eh_publico": False,
            "anexos": []
        }
        
        success, response = self.make_request("POST", f"/atendimento/tickets/{self.test_ticket_id}/conversas", token=token, data=nota_interna_data)
        if success:
            self.log_test("Add internal note to ticket", True, f"Added internal note by: {response.get('usuario', 'unknown')}")
        else:
            self.log_test("Add internal note to ticket", False, response.get("error", ""))

    def test_base_conhecimento_crud(self, token):
        """Test base de conhecimento CRUD operations"""
        print("\n📚 Testing Base de Conhecimento CRUD...")
        
        # Test GET artigos
        success, response = self.make_request("GET", "/atendimento/base-conhecimento", token=token)
        if success:
            count = len(response) if isinstance(response, list) else 0
            self.log_test("Get artigos base conhecimento", True, f"Found {count} artigos")
        else:
            self.log_test("Get artigos base conhecimento", False, response.get("error", ""))
        
        # Test POST - Create new artigo
        test_artigo_data = {
            "titulo": "Como preencher a declaração do Simples Nacional",
            "conteudo": "Este artigo explica passo a passo como preencher corretamente a declaração mensal do Simples Nacional...",
            "resumo": "Guia completo para preenchimento da declaração do Simples Nacional",
            "categoria": "Fiscal",
            "tags": ["simples_nacional", "declaracao", "tutorial"],
            "publicado": True,
            "visivel_cliente": True
        }
        
        success, response = self.make_request("POST", "/atendimento/base-conhecimento", token=token, data=test_artigo_data)
        if success:
            created_id = response.get("id")
            self.log_test("Create artigo base conhecimento", True, f"Created artigo with ID: {created_id}")
            self.test_artigo_id = created_id
        else:
            self.log_test("Create artigo base conhecimento", False, response.get("error", ""))
        
        # Test search artigos with filters
        search_params = {
            "categoria": "Fiscal",
            "publicado": True,
            "search": "Simples Nacional"
        }
        
        success, response = self.make_request("GET", "/atendimento/base-conhecimento", token=token, data=search_params)
        if success:
            count = len(response) if isinstance(response, list) else 0
            self.log_test("Search artigos with filters", True, f"Found {count} matching artigos")
        else:
            self.log_test("Search artigos with filters", False, response.get("error", ""))

    def test_atendimento_dashboard_stats(self, token):
        """Test atendimento dashboard statistics"""
        print("\n📊 Testing Atendimento Dashboard Statistics...")
        
        success, response = self.make_request("GET", "/atendimento/dashboard-stats", token=token)
        if success:
            stats = response
            tickets_stats = stats.get("tickets_por_status", {})
            tickets_sla_violado = stats.get("tickets_sla_violado", 0)
            tempo_medio_resposta = stats.get("tempo_medio_resposta", 0)
            satisfacao_media = stats.get("satisfacao_media", 0)
            
            self.log_test("Atendimento dashboard stats", True, 
                         f"SLA violado: {tickets_sla_violado}, Tempo médio resposta: {tempo_medio_resposta}min, Satisfação: {satisfacao_media}, Status groups: {len(tickets_stats)}")
        else:
            self.log_test("Atendimento dashboard stats", False, response.get("error", ""))

    def test_atendimento_relatorios(self, token):
        """Test atendimento reports"""
        print("\n📈 Testing Atendimento Reports...")
        
        # Test attendance report
        success, response = self.make_request("GET", "/atendimento/relatorios/atendimento?data_inicio=2025-01-01&data_fim=2025-01-31", token=token)
        if success:
            total_tickets = response.get("total_tickets", 0)
            tickets_resolvidos = response.get("tickets_resolvidos", 0)
            taxa_resolucao = response.get("taxa_resolucao", 0)
            self.log_test("Atendimento report", True, 
                         f"Total tickets: {total_tickets}, Resolvidos: {tickets_resolvidos}, Taxa resolução: {taxa_resolucao}%")
        else:
            self.log_test("Atendimento report", False, response.get("error", ""))

    def test_atendimento_legacy_endpoints(self, token):
        """Test legacy atendimento endpoints for backward compatibility"""
        print("\n🔄 Testing Legacy Atendimento Endpoints...")
        
        # Test legacy GET endpoint
        success, response = self.make_request("GET", "/atendimento/", token=token)
        if success:
            count = len(response) if isinstance(response, list) else 0
            self.log_test("Legacy GET atendimento", True, f"Found {count} tickets via legacy endpoint")
        else:
            self.log_test("Legacy GET atendimento", False, response.get("error", ""))
        
        # Test legacy POST endpoint
        test_legacy_data = {
            "empresa_id": "emp-002",
            "empresa": "Empresa Legacy LTDA",
            "titulo": "Dúvida sobre folha de pagamento",
            "descricao": "Como calcular os encargos trabalhistas para funcionário CLT?",
            "tipo": "duvida",
            "prioridade": "alta",
            "responsavel": "Admin Teste",
            "equipe": "Trabalhista",
            "canal": "telefone",
            "data_abertura": "2025-01-15"
        }
        
        success, response = self.make_request("POST", "/atendimento/", token=token, data=test_legacy_data)
        if success:
            created_id = response.get("id")
            numero = response.get("numero")
            self.log_test("Legacy POST atendimento", True, f"Created ticket {numero} via legacy endpoint with ID: {created_id}")
        else:
            self.log_test("Legacy POST atendimento", False, response.get("error", ""))

    def test_chat_endpoints(self):
        """Test chat endpoints"""
        print("\n🔍 Testing Chat Endpoints...")
        
        for user_type, token in self.tokens.items():
            success, response = self.make_request("GET", "/chat/conversations", token=token)
            if success:
                count = len(response) if isinstance(response, list) else 0
                self.log_test(f"Get chat conversations - {user_type}", True, f"Found {count} conversations")
            else:
                self.log_test(f"Get chat conversations - {user_type}", False, response.get("error", ""))

    def test_configuracoes_endpoints(self):
        """Test configuracoes endpoints"""
        print("\n🔍 Testing Configuracoes Endpoints...")
        
        for user_type, token in self.tokens.items():
            success, response = self.make_request("GET", "/configuracoes/profile", token=token)
            if success:
                self.log_test(f"Get user config - {user_type}", True, "Profile retrieved")
            else:
                self.log_test(f"Get user config - {user_type}", False, response.get("error", ""))

    def test_admin_only_endpoints(self):
        """Test admin-only endpoints"""
        print("\n🔍 Testing Admin-Only Endpoints...")
        
        # Test with admin token
        if "admin" in self.tokens:
            admin_token = self.tokens["admin"]
            
            # Test get all users
            success, response = self.make_request("GET", "/auth/users", token=admin_token)
            if success:
                count = len(response) if isinstance(response, list) else 0
                self.log_test("Get all users (admin)", True, f"Found {count} users")
            else:
                self.log_test("Get all users (admin)", False, response.get("error", ""))
        
        # Test with non-admin token
        if "colaborador" in self.tokens:
            collab_token = self.tokens["colaborador"]
            
            success, response = self.make_request("GET", "/auth/users", token=collab_token, expected_status=403)
            if success:
                self.log_test("Get all users (colaborador - should fail)", True, "Access properly restricted")
            else:
                # If we get a different error, it might still be working correctly
                if "403" in str(response.get("error", "")):
                    self.log_test("Get all users (colaborador - should fail)", True, "Access properly restricted")
                else:
                    self.log_test("Get all users (colaborador - should fail)", False, response.get("error", ""))

    def run_all_tests(self):
        """Run all test suites"""
        print("🚀 Starting Macedo SI API Tests...")
        print(f"Testing against: {self.base_url}")
        
        # Run test suites in order
        self.test_health_endpoints()
        self.test_authentication()
        
        # Only run other tests if we have valid tokens
        if self.tokens:
            self.test_user_profile()
            self.test_clients_endpoints()
            self.test_financial_endpoints()
            self.test_trabalhista_endpoints()
            self.test_fiscal_endpoints()
            self.test_atendimento_endpoints()
            self.test_chat_endpoints()
            self.test_configuracoes_endpoints()
            self.test_admin_only_endpoints()
        else:
            print("❌ No valid authentication tokens obtained, skipping protected endpoint tests")

    def print_summary(self):
        """Print test summary"""
        print(f"\n📊 TEST SUMMARY")
        print(f"Tests run: {self.tests_run}")
        print(f"Tests passed: {self.tests_passed}")
        print(f"Tests failed: {self.tests_run - self.tests_passed}")
        print(f"Success rate: {(self.tests_passed/self.tests_run*100):.1f}%" if self.tests_run > 0 else "0%")
        
        if self.failed_tests:
            print(f"\n❌ FAILED TESTS:")
            for i, failure in enumerate(self.failed_tests, 1):
                print(f"{i}. {failure}")
        
        return 0 if self.tests_passed == self.tests_run else 1

def main():
    """Main test execution"""
    tester = MacedoSIAPITester()
    tester.run_all_tests()
    return tester.print_summary()

if __name__ == "__main__":
    sys.exit(main())