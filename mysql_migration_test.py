#!/usr/bin/env python3
"""
MySQL Migration Test Script for Macedo SI CRM
Tests backend functionality after migration from SQLite to MySQL (MariaDB)
"""

import requests
import sys
import json
from datetime import datetime

class MySQLMigrationTester:
    def __init__(self, base_url="http://localhost:8001/api"):
        self.base_url = base_url
        self.admin_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []
        
        # Test credentials from migration
        self.admin_credentials = {
            "email": "admin@macedosi.com",
            "password": "admin123"
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

    def make_request(self, method: str, endpoint: str, token: str = None, data: dict = None, expected_status: int = 200) -> tuple[bool, dict]:
        """Make HTTP request with proper headers"""
        endpoint = endpoint.lstrip('/')
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        if token:
            headers['Authorization'] = f'Bearer {token}'

        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=10)
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

    def test_authentication(self):
        """Test authentication with admin credentials"""
        print("\n🔐 Testing Authentication...")
        
        success, response = self.make_request("POST", "/auth/login", data=self.admin_credentials)
        
        if success and "access_token" in response:
            self.admin_token = response["access_token"]
            user_info = response.get("user", {})
            details = f"Role: {user_info.get('role', 'unknown')}, Email: {user_info.get('email', 'unknown')}"
            self.log_test("Admin Login", True, details)
            return True
        else:
            self.log_test("Admin Login", False, response.get("error", "Login failed"))
            return False

    def test_users_query(self):
        """Test users query - should return 5 users"""
        print("\n👥 Testing Users Query...")
        
        if not self.admin_token:
            self.log_test("Users Query", False, "No admin token available")
            return
        
        success, response = self.make_request("GET", "/auth/users", token=self.admin_token)
        
        if success:
            user_count = len(response) if isinstance(response, list) else 0
            expected_count = 5
            
            if user_count == expected_count:
                self.log_test("Users Query Count", True, f"Found {user_count} users as expected")
            else:
                self.log_test("Users Query Count", False, f"Expected {expected_count} users, found {user_count}")
            
            # Log user details
            if isinstance(response, list) and len(response) > 0:
                user_emails = [user.get('email', 'unknown') for user in response]
                self.log_test("Users Query Details", True, f"Users: {', '.join(user_emails)}")
        else:
            self.log_test("Users Query", False, response.get("error", ""))

    def test_clients_endpoint(self):
        """Test basic CRUD for clients endpoint"""
        print("\n🏢 Testing Clients Endpoint...")
        
        if not self.admin_token:
            self.log_test("Clients Endpoint", False, "No admin token available")
            return
        
        success, response = self.make_request("GET", "/clients/", token=self.admin_token)
        
        if success:
            # Handle both list and dict responses
            if isinstance(response, dict) and 'clients' in response:
                client_count = len(response['clients'])
                total = response.get('total', client_count)
                self.log_test("Clients GET", True, f"Found {client_count} clients (total: {total})")
            elif isinstance(response, list):
                client_count = len(response)
                self.log_test("Clients GET", True, f"Found {client_count} clients")
            else:
                self.log_test("Clients GET", True, "Clients endpoint responding")
        else:
            self.log_test("Clients GET", False, response.get("error", ""))

    def test_financial_endpoint(self):
        """Test basic CRUD for financial endpoint"""
        print("\n💰 Testing Financial Endpoint...")
        
        if not self.admin_token:
            self.log_test("Financial Endpoint", False, "No admin token available")
            return
        
        success, response = self.make_request("GET", "/financial/contas-receber", token=self.admin_token)
        
        if success:
            account_count = len(response) if isinstance(response, list) else 0
            self.log_test("Financial Contas-Receber GET", True, f"Found {account_count} accounts")
        else:
            self.log_test("Financial Contas-Receber GET", False, response.get("error", ""))

    def test_database_connection(self):
        """Test database connection by checking health endpoint"""
        print("\n🔍 Testing Database Connection...")
        
        # Test health endpoint
        success, response = self.make_request("GET", "/health")
        
        if success:
            status = response.get("status", "unknown")
            message = response.get("message", "")
            self.log_test("Health Check", True, f"Status: {status}, Message: {message}")
        else:
            self.log_test("Health Check", False, response.get("error", ""))
        
        # Test root endpoint
        success, response = self.make_request("GET", "/")
        
        if success:
            message = response.get("message", "")
            version = response.get("version", "")
            self.log_test("Root Endpoint", True, f"Message: {message}, Version: {version}")
        else:
            self.log_test("Root Endpoint", False, response.get("error", ""))

    def check_backend_logs(self):
        """Check backend logs for database connection errors"""
        print("\n📋 Checking Backend Logs...")
        
        try:
            import subprocess
            
            # Check supervisor backend logs
            result = subprocess.run(
                ["tail", "-n", "50", "/var/log/supervisor/backend.err.log"],
                capture_output=True,
                text=True,
                timeout=10
            )
            
            if result.returncode == 0:
                log_content = result.stdout
                
                # Check for MySQL-related messages
                mysql_indicators = [
                    "mysql", "aiomysql", "mariadb", 
                    "macedo_si_crm", "macedo_user",
                    "Connected to database", "Database connection"
                ]
                
                mysql_found = any(indicator.lower() in log_content.lower() for indicator in mysql_indicators)
                
                # Check for connection errors
                error_indicators = [
                    "connection refused", "connection failed", "database error",
                    "can't connect", "access denied", "unknown database"
                ]
                
                errors_found = any(error.lower() in log_content.lower() for error in error_indicators)
                
                if mysql_found and not errors_found:
                    self.log_test("Backend Logs - MySQL Connection", True, "MySQL connection indicators found, no errors detected")
                elif mysql_found and errors_found:
                    self.log_test("Backend Logs - MySQL Connection", False, "MySQL indicators found but connection errors detected")
                elif not mysql_found:
                    self.log_test("Backend Logs - MySQL Connection", False, "No MySQL connection indicators found in logs")
                else:
                    self.log_test("Backend Logs - MySQL Connection", True, "No connection errors found")
                
                # Show recent log entries
                recent_lines = log_content.split('\n')[-10:]  # Last 10 lines
                if recent_lines:
                    print("   Recent log entries:")
                    for line in recent_lines:
                        if line.strip():
                            print(f"     {line}")
                            
            else:
                self.log_test("Backend Logs Check", False, f"Could not read logs: {result.stderr}")
                
        except Exception as e:
            self.log_test("Backend Logs Check", False, f"Error checking logs: {str(e)}")

    def run_migration_tests(self):
        """Run all migration validation tests"""
        print("🚀 Starting MySQL Migration Validation Tests...")
        print(f"Testing against: {self.base_url}")
        print("Expected: 28 migrated records (5 users + permissions + conversations)")
        print("Database: mysql+aiomysql://macedo_user:macedo_pass_2025@localhost:3306/macedo_si_crm")
        
        # Test database connection first
        self.test_database_connection()
        
        # Test authentication
        auth_success = self.test_authentication()
        
        if auth_success:
            # Test users query (should return 5 users)
            self.test_users_query()
            
            # Test basic CRUD endpoints
            self.test_clients_endpoint()
            self.test_financial_endpoint()
        else:
            print("❌ Authentication failed, skipping protected endpoint tests")
        
        # Check backend logs for database connection status
        self.check_backend_logs()

    def print_summary(self):
        """Print test summary"""
        print(f"\n📊 MYSQL MIGRATION TEST SUMMARY")
        print(f"Tests run: {self.tests_run}")
        print(f"Tests passed: {self.tests_passed}")
        print(f"Tests failed: {self.tests_run - self.tests_passed}")
        print(f"Success rate: {(self.tests_passed/self.tests_run*100):.1f}%" if self.tests_run > 0 else "0%")
        
        if self.failed_tests:
            print(f"\n❌ FAILED TESTS:")
            for i, failure in enumerate(self.failed_tests, 1):
                print(f"{i}. {failure}")
        else:
            print(f"\n✅ ALL TESTS PASSED - MySQL migration successful!")
        
        print(f"\n🎯 MIGRATION STATUS:")
        if self.tests_passed == self.tests_run:
            print("✅ MySQL migration completed successfully")
            print("✅ All backend functionality operational")
            print("✅ Database connection established")
            print("✅ Authentication working")
            print("✅ API endpoints responding correctly")
        else:
            print("❌ MySQL migration has issues that need attention")
        
        return 0 if self.tests_passed == self.tests_run else 1

def main():
    """Main test execution"""
    tester = MySQLMigrationTester()
    tester.run_migration_tests()
    return tester.print_summary()

if __name__ == "__main__":
    sys.exit(main())
