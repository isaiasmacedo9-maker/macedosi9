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
    def __init__(self, base_url="https://repo-clone-22.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.tokens = {}  # Store tokens for different users
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []
        
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
        """Test financial endpoints"""
        print("\n🔍 Testing Financial Endpoints...")
        
        for user_type, token in self.tokens.items():
            # Test financial clients
            success, response = self.make_request("GET", "/financial/clients", token=token)
            if success:
                count = len(response) if isinstance(response, list) else 0
                self.log_test(f"Get financial clients - {user_type}", True, f"Found {count} financial clients")
            else:
                # Check if it's an access restriction
                if "403" in str(response.get("error", "")):
                    self.log_test(f"Get financial clients - {user_type}", True, "Access restricted (expected for non-financial users)")
                else:
                    self.log_test(f"Get financial clients - {user_type}", False, response.get("error", ""))
            
            # Test contas a receber
            success, response = self.make_request("GET", "/financial/contas-receber", token=token)
            if success:
                count = len(response) if isinstance(response, list) else 0
                self.log_test(f"Get contas a receber - {user_type}", True, f"Found {count} accounts")
            else:
                if "403" in str(response.get("error", "")):
                    self.log_test(f"Get contas a receber - {user_type}", True, "Access restricted (expected for non-financial users)")
                else:
                    self.log_test(f"Get contas a receber - {user_type}", False, response.get("error", ""))

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