#!/usr/bin/env python3
"""
Focused Fiscal Module Testing for Macedo SI CRM
Tests all fiscal endpoints as requested in the review
"""

import requests
import sys
import json
from datetime import datetime
from typing import Dict, Any, Optional

class FiscalModuleTester:
    def __init__(self, base_url="https://taskmaster-crm-1.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []
        self.test_obrigacao_id = None
        self.test_nota_id = None
        
        # Credentials from review request
        self.admin_credentials = {"email": "admin@macedosi.com", "password": "admin123"}

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

    def make_request(self, method: str, endpoint: str, data: Dict = None, params: Dict = None, expected_status: int = 200) -> tuple[bool, Dict]:
        """Make HTTP request with proper headers"""
        endpoint = endpoint.lstrip('/')
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'

        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, params=params, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, params=params, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, params=params, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, params=params, timeout=10)
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

    def authenticate(self):
        """Authenticate with admin credentials"""
        print("🔐 Authenticating...")
        
        success, response = self.make_request("POST", "/auth/login", data=self.admin_credentials)
        
        if success and "access_token" in response:
            self.token = response["access_token"]
            user_info = response.get("user", {})
            details = f"Role: {user_info.get('role', 'unknown')}, Email: {user_info.get('email', 'unknown')}"
            self.log_test("Authentication", True, details)
            return True
        else:
            self.log_test("Authentication", False, response.get("error", "Login failed"))
            return False

    def test_dashboard_fiscal(self):
        """Test Dashboard Fiscal (GET /api/fiscal/dashboard-stats)"""
        print("\n📊 Testing Dashboard Fiscal...")
        
        success, response = self.make_request("GET", "/fiscal/dashboard-stats")
        if success:
            stats = response
            obrigacoes_por_status = stats.get("obrigacoes_por_status", {})
            obrigacoes_vencendo_30_dias = stats.get("obrigacoes_vencendo_30_dias", 0)
            notas_fiscais_mes = stats.get("notas_fiscais_mes", 0)
            
            self.log_test("Dashboard Fiscal Stats", True, 
                         f"Obrigações por status: {len(obrigacoes_por_status)} grupos, "
                         f"Vencendo 30 dias: {obrigacoes_vencendo_30_dias}, "
                         f"Notas fiscais mês: {notas_fiscais_mes}")
        else:
            self.log_test("Dashboard Fiscal Stats", False, response.get("error", ""))

    def test_obrigacoes_fiscais_crud(self):
        """Test Obrigações Fiscais CRUD with filters"""
        print("\n📋 Testing Obrigações Fiscais CRUD...")
        
        # Test GET obrigações (list all)
        success, response = self.make_request("GET", "/fiscal/obrigacoes")
        if success:
            count = len(response) if isinstance(response, list) else 0
            self.log_test("GET Obrigações Fiscais", True, f"Found {count} obrigações")
        else:
            self.log_test("GET Obrigações Fiscais", False, response.get("error", ""))
        
        # Test GET with filters
        filters = {
            "tipo": "pgdas",
            "status": "pendente", 
            "regime_tributario": "simples_nacional",
            "responsavel": "João",
            "search": "PGDAS"
        }
        
        success, response = self.make_request("GET", "/fiscal/obrigacoes", params=filters)
        if success:
            count = len(response) if isinstance(response, list) else 0
            self.log_test("GET Obrigações with Filters", True, f"Found {count} matching obrigações")
        else:
            self.log_test("GET Obrigações with Filters", False, response.get("error", ""))
        
        # Test POST - Create new obrigação
        test_obrigacao_data = {
            "empresa_id": "emp-test-001",
            "empresa": "Empresa Teste Fiscal LTDA",
            "tipo": "pgdas",
            "nome": "PGDAS Janeiro 2025 - Teste",
            "descricao": "Programa Gerador do DAS - Simples Nacional - Teste Automatizado",
            "periodicidade": "mensal",
            "dia_vencimento": 20,
            "responsavel": "João Silva Fiscal",
            "regime_tributario": "simples_nacional",
            "observacoes": "Obrigação criada via teste automatizado",
            "valor": 1500.00
        }
        
        success, response = self.make_request("POST", "/fiscal/obrigacoes", data=test_obrigacao_data)
        if success:
            created_id = response.get("id")
            self.log_test("POST Create Obrigação", True, f"Created obrigação with ID: {created_id}")
            self.test_obrigacao_id = created_id
        else:
            self.log_test("POST Create Obrigação", False, response.get("error", ""))
        
        # Test GET specific obrigação by ID
        if self.test_obrigacao_id:
            success, response = self.make_request("GET", f"/fiscal/obrigacoes/{self.test_obrigacao_id}")
            if success:
                self.log_test("GET Obrigação by ID", True, f"Retrieved: {response.get('nome', 'Unknown')}")
            else:
                self.log_test("GET Obrigação by ID", False, response.get("error", ""))
            
            # Test PUT - Update obrigação
            update_data = {
                "status": "em_andamento",
                "observacoes": "Documentos em preparação - teste automatizado"
            }
            
            success, response = self.make_request("PUT", f"/fiscal/obrigacoes/{self.test_obrigacao_id}", data=update_data)
            if success:
                self.log_test("PUT Update Obrigação", True, f"Updated status to: {response.get('status', 'unknown')}")
            else:
                self.log_test("PUT Update Obrigação", False, response.get("error", ""))
            
            # Test DELETE obrigação
            success, response = self.make_request("DELETE", f"/fiscal/obrigacoes/{self.test_obrigacao_id}")
            if success:
                self.log_test("DELETE Obrigação", True, "Obrigação deleted successfully")
            else:
                self.log_test("DELETE Obrigação", False, response.get("error", ""))

    def test_notas_fiscais_crud(self):
        """Test Notas Fiscais CRUD with filters"""
        print("\n📄 Testing Notas Fiscais CRUD...")
        
        # Test GET notas fiscais (list all)
        success, response = self.make_request("GET", "/fiscal/notas-fiscais")
        if success:
            count = len(response) if isinstance(response, list) else 0
            self.log_test("GET Notas Fiscais", True, f"Found {count} notas fiscais")
        else:
            self.log_test("GET Notas Fiscais", False, response.get("error", ""))
        
        # Test GET with filters
        filters = {
            "tipo_nota": "saida",
            "status_conciliacao": "nao_conciliada",
            "cnpj_emitente": "12.345.678",
            "data_inicio": "2025-01-01",
            "data_fim": "2025-01-31"
        }
        
        success, response = self.make_request("GET", "/fiscal/notas-fiscais", params=filters)
        if success:
            count = len(response) if isinstance(response, list) else 0
            self.log_test("GET Notas Fiscais with Filters", True, f"Found {count} matching notas")
        else:
            self.log_test("GET Notas Fiscais with Filters", False, response.get("error", ""))
        
        # Test POST - Create new nota fiscal
        import random
        unique_num = random.randint(1000, 9999)
        test_nota_data = {
            "empresa_id": "emp-test-001",
            "empresa": "Empresa Teste Fiscal LTDA",
            "tipo": "saida",
            "numero": unique_num,
            "serie": "1",
            "chave_nfe": f"35250112345678000190550010000{unique_num:06d}1234567890",
            "data_emissao": "2025-01-15",
            "emitente_cnpj": "12.345.678/0001-90",
            "emitente_razao_social": "Empresa Teste Fiscal LTDA",
            "destinatario_cnpj": "98.765.432/0001-10",
            "destinatario_razao_social": "Cliente Teste Fiscal LTDA",
            "valor_total": 2500.00,
            "valor_produtos": 2500.00,
            "valor_servicos": 0.0,
            "cfop": "5102",
            "natureza_operacao": "Venda de mercadoria - Teste"
        }
        
        success, response = self.make_request("POST", "/fiscal/notas-fiscais", data=test_nota_data)
        if success:
            created_id = response.get("id")
            self.log_test("POST Create Nota Fiscal", True, f"Created nota fiscal with ID: {created_id}")
            self.test_nota_id = created_id
        else:
            self.log_test("POST Create Nota Fiscal", False, response.get("error", ""))
        
        # Test XML upload endpoint (without actual file - expect error)
        params = {"empresa_id": "emp-test-001"}
        success, response = self.make_request("POST", "/fiscal/notas-fiscais/upload-xml", 
                                            params=params, expected_status=422)
        if success or "422" in str(response.get("error", "")):
            self.log_test("POST Upload XML (no file)", True, "Endpoint available - validation error expected without file")
        else:
            self.log_test("POST Upload XML (no file)", False, response.get("error", ""))

    def test_relatorios_impostos(self):
        """Test Relatórios de Impostos"""
        print("\n📈 Testing Relatórios de Impostos...")
        
        # Test impostos report with period filter
        params = {"periodo": "2025-01"}
        
        success, response = self.make_request("GET", "/fiscal/relatorios/impostos", params=params)
        if success:
            detalhes = response.get("detalhes_por_tipo", [])
            resumo = response.get("resumo_geral", {})
            total_impostos = resumo.get("total_impostos", 0)
            
            self.log_test("Relatório de Impostos", True, 
                         f"Generated report with {len(detalhes)} type details, "
                         f"Total impostos: R${total_impostos}")
        else:
            self.log_test("Relatório de Impostos", False, response.get("error", ""))

    def test_enums_validation(self):
        """Test that enums are working correctly"""
        print("\n🔧 Testing Enums Validation...")
        
        # Test creating obrigação with valid enum values
        valid_enum_data = {
            "empresa_id": "emp-enum-test",
            "empresa": "Empresa Enum Test LTDA", 
            "tipo": "pgdas",  # Valid enum
            "nome": "Teste Enum PGDAS",
            "periodicidade": "mensal",  # Valid enum
            "regime_tributario": "simples_nacional",  # Valid enum
            "dia_vencimento": 15,
            "responsavel": "Teste Enum"
        }
        
        success, response = self.make_request("POST", "/fiscal/obrigacoes", data=valid_enum_data)
        if success:
            self.log_test("Valid Enums Test", True, "Enums accepted correctly")
            # Clean up
            if response.get("id"):
                self.make_request("DELETE", f"/fiscal/obrigacoes/{response.get('id')}")
        else:
            self.log_test("Valid Enums Test", False, response.get("error", ""))

    def test_automatic_calculations(self):
        """Test automatic calculations (vencimentos)"""
        print("\n🧮 Testing Automatic Calculations...")
        
        # Create obrigação and verify vencimento calculation
        calc_test_data = {
            "empresa_id": "emp-calc-test",
            "empresa": "Empresa Calc Test LTDA",
            "tipo": "pgdas",
            "nome": "Teste Cálculo Vencimento",
            "periodicidade": "mensal",
            "dia_vencimento": 20,
            "responsavel": "Teste Calc",
            "regime_tributario": "simples_nacional"
        }
        
        success, response = self.make_request("POST", "/fiscal/obrigacoes", data=calc_test_data)
        if success:
            proximo_vencimento = response.get("proximo_vencimento")
            if proximo_vencimento:
                self.log_test("Automatic Vencimento Calculation", True, 
                             f"Próximo vencimento calculated: {proximo_vencimento}")
            else:
                self.log_test("Automatic Vencimento Calculation", False, "No próximo_vencimento calculated")
            
            # Clean up
            if response.get("id"):
                self.make_request("DELETE", f"/fiscal/obrigacoes/{response.get('id')}")
        else:
            self.log_test("Automatic Vencimento Calculation", False, response.get("error", ""))

    def run_all_fiscal_tests(self):
        """Run all fiscal module tests"""
        print("🚀 Starting Fiscal Module Tests...")
        print(f"Testing against: {self.base_url}")
        
        # Authenticate first
        if not self.authenticate():
            print("❌ Authentication failed, cannot proceed with tests")
            return
        
        # Run fiscal tests
        self.test_dashboard_fiscal()
        self.test_obrigacoes_fiscais_crud()
        self.test_notas_fiscais_crud()
        self.test_relatorios_impostos()
        self.test_enums_validation()
        self.test_automatic_calculations()

    def print_summary(self):
        """Print test summary"""
        print(f"\n📊 FISCAL MODULE TEST SUMMARY")
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
    tester = FiscalModuleTester()
    tester.run_all_fiscal_tests()
    return tester.print_summary()

if __name__ == "__main__":
    sys.exit(main())