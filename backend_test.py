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
    def __init__(self, base_url="https://setor-hub.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.tokens = {}  # Store tokens for different users
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []
        self.test_conta_id = None  # Store test account ID for financial tests
        
        # Test users from init_database.py
        self.test_users = {
            "admin": {"email": "admin@macedo.com.br", "password": "admin123"},
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
            "nova_data_vencimento": "2025-03-15",
            "novo_valor": 1350.00,
            "desconto_proposto": 150.00,
            "condicoes": "Pagamento à vista com desconto de 10%",
            "observacao": "Cliente solicitou desconto para pagamento imediato"
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
                "valor_recebido": 1500.00,
                "data_recebimento": "2025-01-20",
                "desconto": 0.0,
                "acrescimo": 0.0,
                "observacao": "Pagamento realizado via PIX"
            }
            
            success, response = self.make_request("PUT", f"/financial/contas-receber/{self.test_conta_id}/baixa", 
                                                token=token, data=baixa_data)
            if success:
                self.log_test("Process payment (baixa)", True, f"Payment processed for account: {response.get('empresa', 'unknown')}")
            else:
                self.log_test("Process payment (baixa)", False, response.get("error", ""))

    def test_trabalhista_endpoints(self):
        """Test trabalhista endpoints"""
        print("\n🔍 Testing Trabalhista Endpoints...")
        
        for user_type, token in self.tokens.items():
            success, response = self.make_request("GET", "/trabalhista/solicitacoes", token=token)
            if success:
                count = len(response) if isinstance(response, list) else 0
                self.log_test(f"Get trabalhista - {user_type}", True, f"Found {count} requests")
            else:
                if "403" in str(response.get("error", "")):
                    self.log_test(f"Get trabalhista - {user_type}", True, "Access restricted (expected for non-trabalhista users)")
                else:
                    self.log_test(f"Get trabalhista - {user_type}", False, response.get("error", ""))

    def test_fiscal_endpoints(self):
        """Test fiscal endpoints"""
        print("\n🔍 Testing Fiscal Endpoints...")
        
        for user_type, token in self.tokens.items():
            success, response = self.make_request("GET", "/fiscal/obrigacoes", token=token)
            if success:
                count = len(response) if isinstance(response, list) else 0
                self.log_test(f"Get fiscal obligations - {user_type}", True, f"Found {count} obligations")
            else:
                if "403" in str(response.get("error", "")):
                    self.log_test(f"Get fiscal obligations - {user_type}", True, "Access restricted (expected for non-fiscal users)")
                else:
                    self.log_test(f"Get fiscal obligations - {user_type}", False, response.get("error", ""))

    def test_atendimento_endpoints(self):
        """Test atendimento endpoints"""
        print("\n🔍 Testing Atendimento Endpoints...")
        
        for user_type, token in self.tokens.items():
            success, response = self.make_request("GET", "/atendimento/tickets", token=token)
            if success:
                count = len(response) if isinstance(response, list) else 0
                self.log_test(f"Get tickets - {user_type}", True, f"Found {count} tickets")
            else:
                if "403" in str(response.get("error", "")):
                    self.log_test(f"Get tickets - {user_type}", True, "Access restricted (expected for non-atendimento users)")
                else:
                    self.log_test(f"Get tickets - {user_type}", False, response.get("error", ""))

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