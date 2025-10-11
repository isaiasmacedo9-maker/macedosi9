"""
Script simples para adicionar dados de exemplo via API
"""
import requests
import json
from datetime import datetime, timedelta

BASE_URL = "http://localhost:8001/api"

# Login para obter token
def login():
    response = requests.post(
        f"{BASE_URL}/auth/login",
        json={"email": "admin@macedosi.com", "password": "admin123"}
    )
    return response.json()["access_token"]

def create_clients(token):
    headers = {"Authorization": f"Bearer {token}"}
    clientes = [
        {
            "nome_empresa": "Tech Solutions Brasil Ltda",
            "nome_fantasia": "Tech Solutions",
            "cnpj": "12345678000190",
            "email": "contato@techsolutions.com.br",
            "telefone": "(11) 3456-7890",
            "whatsapp": "(11) 98765-4321",
            "cidade_atendimento": "São Paulo",
            "tipo_regime": "simples",
            "status_empresa": "ativa",
            "endereco": {
                "logradouro": "Av. Paulista",
                "numero": "1000",
                "bairro": "Bela Vista",
                "cep": "01310-100",
                "cidade": "São Paulo",
                "estado": "SP"
            }
        },
        {
            "nome_empresa": "Comercial ABC Produtos Ltda",
            "nome_fantasia": "ABC Comércio",
            "cnpj": "98765432000110",
            "email": "financeiro@abccomercio.com.br",
            "telefone": "(11) 2345-6789",
            "whatsapp": "(11) 97654-3210",
            "cidade_atendimento": "São Paulo",
            "tipo_regime": "lucro_presumido",
            "status_empresa": "ativa",
            "endereco": {
                "logradouro": "Rua Vergueiro",
                "numero": "2500",
                "bairro": "Vila Mariana",
                "cep": "04567-000",
                "cidade": "São Paulo",
                "estado": "SP"
            }
        },
        {
            "nome_empresa": "Indústria XYZ S/A",
            "nome_fantasia": "XYZ Indústria",
            "cnpj": "11222333000144",
            "email": "contato@xyzindustria.com.br",
            "telefone": "(11) 4567-8901",
            "whatsapp": "(11) 96543-2109",
            "cidade_atendimento": "São Paulo",
            "tipo_regime": "lucro_real",
            "status_empresa": "ativa",
            "endereco": {
                "logradouro": "Av. Industrial",
                "numero": "500",
                "bairro": "Centro",
                "cep": "08200-000",
                "cidade": "São Paulo",
                "estado": "SP"
            }
        }
    ]
    
    created_clients = []
    for cliente in clientes:
        try:
            response = requests.post(f"{BASE_URL}/clients", json=cliente, headers=headers)
            if response.status_code == 200:
                created_clients.append(response.json())
                print(f"✅ Cliente criado: {cliente['nome_empresa']}")
            else:
                print(f"❌ Erro ao criar {cliente['nome_empresa']}: {response.text}")
        except Exception as e:
            print(f"❌ Exceção ao criar {cliente['nome_empresa']}: {str(e)}")
    
    return created_clients

def main():
    print("🚀 Iniciando população do banco de dados...")
    
    try:
        print("\n🔐 Fazendo login...")
        token = login()
        print("✅ Login realizado!")
        
        print("\n📋 Criando clientes...")
        clients = create_clients(token)
        print(f"\n✅ {len(clients)} clientes criados com sucesso!")
        
        print("\n🎉 Dados de exemplo adicionados!")
        print("="*60)
        print("Agora você pode acessar o sistema e ver os dados de exemplo.")
        
    except Exception as e:
        print(f"\n❌ Erro: {str(e)}")

if __name__ == "__main__":
    main()
