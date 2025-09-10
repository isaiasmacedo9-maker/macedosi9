#!/usr/bin/env python3
"""
Initialize database with default data for Macedo SI
"""

import asyncio
from datetime import datetime, date
from models.user import User
from models.client import Client, Address
from models.financial import FinancialClient, ContaReceber, HistoricoAction
from models.trabalhista import SolicitacaoTrabalhista, FuncionarioData, DetalheFolha
from models.fiscal import ObrigacaoFiscal
from models.atendimento import Ticket, Conversa
from models.configuracoes import Configuracoes

from auth import get_password_hash
from database import (
    connect_to_mongo, close_mongo_connection,
    get_users_collection, get_clients_collection, get_financial_clients_collection,
    get_contas_receber_collection, get_trabalhista_collection, get_fiscal_collection,
    get_atendimento_collection, get_configuracoes_collection
)

async def init_users():
    """Initialize default users"""
    users_collection = await get_users_collection()
    
    # Check if users already exist
    user_count = await users_collection.count_documents({})
    if user_count > 0:
        print("Users already exist, skipping user initialization")
        return
    
    users = [
        User(
            email="admin@macedo.com.br",
            name="Administrador",
            password_hash=get_password_hash("admin123"),
            role="admin",
            allowed_cities=["jacobina", "ourolandia", "umburanas", "uberlandia"],
            allowed_sectors=["comercial", "trabalhista", "fiscal", "financeiro", "contabil", "atendimento"]
        ),
        User(
            email="colaborador@macedo.com.br",
            name="João Silva",
            password_hash=get_password_hash("colab123"),
            role="colaborador",
            allowed_cities=["jacobina"],
            allowed_sectors=["financeiro", "contabil"]
        ),
        User(
            email="fiscal@macedo.com.br",
            name="Maria Santos",
            password_hash=get_password_hash("fiscal123"),
            role="colaborador",
            allowed_cities=["ourolandia"],
            allowed_sectors=["fiscal", "contabil"]
        )
    ]
    
    for user in users:
        await users_collection.insert_one(user.model_dump())
    
    print(f"Initialized {len(users)} users")

async def init_clients():
    """Initialize default clients"""
    clients_collection = await get_clients_collection()
    
    # Check if clients already exist
    client_count = await clients_collection.count_documents({})
    if client_count > 0:
        print("Clients already exist, skipping client initialization")
        return
    
    clients = [
        Client(
            nome_empresa="Padaria São João Ltda",
            nome_fantasia="Padaria São João",
            status="ativa",
            cidade="jacobina",
            telefone="(74) 3621-1234",
            whatsapp="(74) 98765-4321",
            email="contato@padariasaojoao.com.br",
            responsavel="João Santos",
            cnpj="12.345.678/0001-90",
            forma_envio="whatsapp",
            codigo_iob="IOB001",
            novo_cliente=False,
            tipo_empresa="matriz",
            endereco=Address(
                logradouro="Rua das Flores, 123",
                bairro="Centro",
                cep="44700-000",
                cidade="Jacobina",
                estado="BA"
            ),
            tipo_regime="simples"
        ),
        Client(
            nome_empresa="Auto Peças Norte Ltda",
            nome_fantasia="Auto Peças Norte",
            status="ativa",
            cidade="ourolandia",
            telefone="(74) 3633-5678",
            whatsapp="(74) 99876-5432",
            email="vendas@autopecasnorte.com.br",
            responsavel="Maria Silva",
            cnpj="23.456.789/0001-12",
            forma_envio="email",
            codigo_iob="IOB002",
            novo_cliente=True,
            tipo_empresa="matriz",
            endereco=Address(
                logradouro="Av. Principal, 456",
                bairro="Industrial",
                cep="44755-000",
                cidade="Ourolândia",
                estado="BA"
            ),
            tipo_regime="lucro_presumido"
        ),
        Client(
            nome_empresa="Clínica Saúde & Vida ME",
            nome_fantasia="Clínica Saúde & Vida",
            status="ativa",
            cidade="umburanas",
            telefone="(74) 3644-9999",
            whatsapp="(74) 97654-3210",
            email="clinica@saudevida.com.br",
            responsavel="Dr. Carlos Oliveira",
            cnpj="34.567.890/0001-34",
            forma_envio="whatsapp",
            codigo_iob="IOB003",
            novo_cliente=False,
            tipo_empresa="matriz",
            endereco=Address(
                logradouro="Rua da Saúde, 789",
                bairro="Centro",
                cep="44760-000",
                cidade="Umburanas",
                estado="BA"
            ),
            tipo_regime="mei"
        )
    ]
    
    for client in clients:
        await clients_collection.insert_one(client.model_dump())
    
    print(f"Initialized {len(clients)} clients")

async def init_financial_data():
    """Initialize financial data"""
    financial_clients_collection = await get_financial_clients_collection()
    contas_collection = await get_contas_receber_collection()
    
    # Financial clients
    financial_client_count = await financial_clients_collection.count_documents({})
    if financial_client_count == 0:
        financial_clients = [
            FinancialClient(
                empresa_id="1",
                empresa="Padaria São João Ltda",
                valor_com_desconto=850.00,
                valor_boleto=900.00,
                dia_vencimento=15,
                tipo_honorario="mensal",
                empresa_individual_grupo="individual",
                contas_pagamento=["conta_corrente"],
                tipo_pagamento="recorrente",
                tipo_empresa="simples",
                ultimo_pagamento=date(2025, 1, 15),
                status_pagamento="em_dia"
            ),
            FinancialClient(
                empresa_id="2",
                empresa="Auto Peças Norte Ltda",
                valor_com_desconto=1200.00,
                valor_boleto=1350.00,
                dia_vencimento=10,
                tipo_honorario="mensal",
                empresa_individual_grupo="grupo",
                contas_pagamento=["conta_corrente", "pix"],
                tipo_pagamento="recorrente",
                forma_pagamento_especial="desconto_anual",
                tipo_empresa="lucro_presumido",
                ultimo_pagamento=date(2025, 1, 10),
                status_pagamento="em_dia"
            )
        ]
        
        for fc in financial_clients:
            await financial_clients_collection.insert_one(fc.model_dump(mode='json'))
        
        print(f"Initialized {len(financial_clients)} financial clients")
    
    # Contas a receber
    conta_count = await contas_collection.count_documents({})
    if conta_count == 0:
        contas = [
            ContaReceber(
                empresa_id="1",
                empresa="Padaria São João Ltda",
                situacao="em_aberto",
                descricao="Honorários contábeis - Janeiro/2025",
                documento="NF-001234",
                forma_pagamento="boleto",
                conta="Banco do Brasil - CC 1234-5",
                centro_custo="Honorários Mensais",
                plano_custo="Receitas de Serviços",
                data_emissao=date(2025, 1, 1),
                data_vencimento=date(2025, 1, 15),
                valor_original=900.00,
                observacao="Cliente em dia com pagamentos",
                cidade_atendimento="jacobina",
                total_bruto=900.00,
                total_liquido=900.00,
                usuario_responsavel="João Silva"
            ),
            ContaReceber(
                empresa_id="2",
                empresa="Auto Peças Norte Ltda",
                situacao="pago",
                descricao="Honorários contábeis - Janeiro/2025",
                documento="NF-001235",
                forma_pagamento="pix",
                conta="Banco do Brasil - CC 1234-5",
                centro_custo="Honorários Mensais",
                plano_custo="Receitas de Serviços",
                data_emissao=date(2025, 1, 1),
                data_vencimento=date(2025, 1, 10),
                valor_original=1350.00,
                observacao="Pagamento via PIX recebido",
                cidade_atendimento="ourolandia",
                data_recebimento=date(2025, 1, 8),
                valor_quitado=1350.00,
                total_bruto=1350.00,
                total_liquido=1350.00,
                usuario_responsavel="Maria Santos",
                historico=[
                    HistoricoAction(
                        data=datetime(2025, 1, 8, 10, 0, 0),
                        acao="Pagamento recebido via PIX",
                        usuario="Sistema",
                        valor=1350.00
                    )
                ]
            )
        ]
        
        for conta in contas:
            await contas_collection.insert_one(conta.model_dump(mode='json'))
        
        print(f"Initialized {len(contas)} contas a receber")

async def main():
    """Initialize all database collections"""
    print("🚀 Starting database initialization...")
    
    await connect_to_mongo()
    
    try:
        await init_users()
        await init_clients()
        await init_financial_data()
        print("✅ Database initialization completed successfully!")
    except Exception as e:
        print(f"❌ Error during initialization: {e}")
        raise
    finally:
        await close_mongo_connection()

if __name__ == "__main__":
    asyncio.run(main())