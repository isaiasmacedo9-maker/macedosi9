"""
Backend API Tests for Macedo SI CRM System
Tests authentication, clients, financial, trabalhista, fiscal, and tasks modules
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://fastapi-mysql-test.preview.emergentagent.com')

# Test credentials
ADMIN_EMAIL = "admin@macedosi.com"
ADMIN_PASSWORD = "admin123"

class TestAuthentication:
    """Authentication endpoint tests"""
    
    def test_login_success(self):
        """Test successful login with admin credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        
        data = response.json()
        assert "access_token" in data, "No access_token in response"
        assert "user" in data, "No user in response"
        assert data["user"]["email"] == ADMIN_EMAIL
        assert data["user"]["role"] == "admin"
        print(f"✅ Login successful for {ADMIN_EMAIL}")
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "wrong@example.com",
            "password": "wrongpass"
        })
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✅ Invalid credentials correctly rejected")


class TestHealthCheck:
    """Health check tests"""
    
    def test_api_health(self):
        """Test API health endpoint"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        print("✅ API health check passed")


@pytest.fixture(scope="class")
def auth_token():
    """Get authentication token for tests"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code == 200:
        return response.json()["access_token"]
    pytest.skip("Authentication failed - skipping authenticated tests")


@pytest.fixture(scope="class")
def auth_headers(auth_token):
    """Get headers with auth token"""
    return {"Authorization": f"Bearer {auth_token}"}


class TestClientsAPI:
    """Clients module tests"""
    
    def test_get_clients(self, auth_headers):
        """Test GET /api/clients/"""
        response = requests.get(f"{BASE_URL}/api/clients/", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert "clients" in data, "No clients key in response"
        assert "total" in data, "No total key in response"
        print(f"✅ GET /api/clients/ returned {data['total']} clients")
    
    def test_get_clients_with_limit(self, auth_headers):
        """Test GET /api/clients/ with limit parameter"""
        response = requests.get(f"{BASE_URL}/api/clients/?limit=5", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert len(data["clients"]) <= 5
        print(f"✅ GET /api/clients/?limit=5 returned {len(data['clients'])} clients")


class TestFinancialAPI:
    """Financial module tests"""
    
    def test_get_dashboard_stats(self, auth_headers):
        """Test GET /api/financial/dashboard-stats"""
        response = requests.get(f"{BASE_URL}/api/financial/dashboard-stats", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert "total_aberto" in data, "No total_aberto in response"
        assert "total_atrasado" in data, "No total_atrasado in response"
        assert "total_recebido_mes" in data, "No total_recebido_mes in response"
        
        # Verify data structure
        total_aberto = data["total_aberto"]
        assert "valor" in total_aberto, "No valor in total_aberto"
        assert "count" in total_aberto, "No count in total_aberto"
        
        print(f"✅ Financial dashboard: R$ {total_aberto['valor']:.2f} em aberto ({total_aberto['count']} títulos)")
    
    def test_get_contas_receber(self, auth_headers):
        """Test GET /api/financial/contas-receber"""
        response = requests.get(f"{BASE_URL}/api/financial/contas-receber", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✅ GET /api/financial/contas-receber returned {len(data)} records")


class TestTasksAPI:
    """Tasks module tests"""
    
    def test_get_tasks_stats(self, auth_headers):
        """Test GET /api/tasks/stats/dashboard"""
        response = requests.get(f"{BASE_URL}/api/tasks/stats/dashboard", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert "status_stats" in data, "No status_stats in response"
        assert "priority_stats" in data, "No priority_stats in response"
        
        status_stats = data["status_stats"]
        assert "pendente" in status_stats
        assert "em_andamento" in status_stats
        assert "concluida" in status_stats
        
        print(f"✅ Tasks stats: {status_stats['pendente']} pendentes, {status_stats['concluida']} concluídas")


class TestTrabalhistaAPI:
    """Trabalhista module tests"""
    
    def test_get_solicitacoes(self, auth_headers):
        """Test GET /api/trabalhista/solicitacoes"""
        response = requests.get(f"{BASE_URL}/api/trabalhista/solicitacoes", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✅ GET /api/trabalhista/solicitacoes returned {len(data)} records")


class TestFiscalAPI:
    """Fiscal module tests"""
    
    def test_get_dashboard_stats(self, auth_headers):
        """Test GET /api/fiscal/dashboard-stats"""
        response = requests.get(f"{BASE_URL}/api/fiscal/dashboard-stats", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert "obrigacoes_por_status" in data
        assert "obrigacoes_vencendo_30_dias" in data
        assert "notas_fiscais_mes" in data
        
        print(f"✅ Fiscal dashboard: {data['obrigacoes_vencendo_30_dias']} obrigações vencendo em 30 dias")
    
    def test_get_obrigacoes(self, auth_headers):
        """Test GET /api/fiscal/obrigacoes"""
        response = requests.get(f"{BASE_URL}/api/fiscal/obrigacoes", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✅ GET /api/fiscal/obrigacoes returned {len(data)} records")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
