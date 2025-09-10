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
    get_atendimento_collection, get_configuracoes_collection, get_chats_collection
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

async def init_trabalhista_data():
    """Initialize trabalhista data"""
    trabalhista_collection = await get_trabalhista_collection()
    
    # Check if trabalhista data already exists
    count = await trabalhista_collection.count_documents({})
    if count > 0:
        print("Trabalhista data already exists, skipping initialization")
        return
    
    solicitacoes = [
        SolicitacaoTrabalhista(
            empresa_id="1",
            empresa="Padaria São João Ltda",
            tipo="admissao",
            descricao="Admissão de novo funcionário - Auxiliar de Padaria",
            data_solicitacao=date(2025, 1, 15),
            prazo=date(2025, 1, 20),
            responsavel="João Silva",
            status="em_andamento",
            observacoes="Documentos recebidos, aguardando processamento",
            funcionario=FuncionarioData(
                nome="Maria da Silva",
                cpf="123.456.789-00",
                funcao="Auxiliar de Padaria",
                salario=1500.00,
                data_admissao=date(2025, 1, 18)
            )
        ),
        SolicitacaoTrabalhista(
            empresa_id="2",
            empresa="Auto Peças Norte Ltda", 
            tipo="folha",
            descricao="Processamento da folha de pagamento - Janeiro/2025",
            data_solicitacao=date(2025, 1, 20),
            prazo=date(2025, 1, 25),
            responsavel="Maria Santos",
            status="concluido",
            observacoes="Folha processada e enviada",
            detalhes=DetalheFolha(
                total_funcionarios=8,
                total_proventos=24000.00,
                total_descontos=4800.00,
                total_liquido=19200.00
            )
        )
    ]
    
    for solicitacao in solicitacoes:
        await trabalhista_collection.insert_one(solicitacao.model_dump(mode='json'))
    
    print(f"Initialized {len(solicitacoes)} trabalhista requests")

async def init_fiscal_data():
    """Initialize fiscal data"""
    fiscal_collection = await get_fiscal_collection()
    
    # Check if fiscal data already exists
    count = await fiscal_collection.count_documents({})
    if count > 0:
        print("Fiscal data already exists, skipping initialization")
        return
    
    obrigacoes = [
        ObrigacaoFiscal(
            empresa_id="1",
            empresa="Padaria São João Ltda",
            tipo="pgdas",
            nome="PGDAS - Simples Nacional Janeiro/2025",
            periodicidade="mensal",
            vencimento=date(2025, 2, 20),
            responsavel="Maria Santos",
            status="entregue",
            valor=450.00,
            data_entrega=date(2025, 2, 18),
            observacoes="Entregue dentro do prazo"
        ),
        ObrigacaoFiscal(
            empresa_id="2",
            empresa="Auto Peças Norte Ltda",
            tipo="sped",
            nome="SPED Fiscal Janeiro/2025",
            periodicidade="mensal",
            vencimento=date(2025, 2, 15),
            responsavel="Carlos Oliveira",
            status="em_andamento",
            observacoes="Em processo de validação"
        )
    ]
    
    for obrigacao in obrigacoes:
        await fiscal_collection.insert_one(obrigacao.model_dump(mode='json'))
    
    print(f"Initialized {len(obrigacoes)} fiscal obligations")

async def init_atendimento_data():
    """Initialize atendimento data"""
    atendimento_collection = await get_atendimento_collection()
    
    # Check if atendimento data already exists
    count = await atendimento_collection.count_documents({})
    if count > 0:
        print("Atendimento data already exists, skipping initialization")
        return
    
    tickets = [
        Ticket(
            empresa_id="1",
            empresa="Padaria São João Ltda",
            titulo="Dúvida sobre PGDAS",
            descricao="Cliente precisa de esclarecimentos sobre o valor do PGDAS",
            prioridade="media",
            status="resolvido",
            responsavel="João Silva",
            canal="whatsapp",
            data_abertura=date(2025, 1, 10),
            sla=datetime(2025, 1, 11, 18, 0, 0),
            conversas=[
                Conversa(
                    data=datetime(2025, 1, 10, 14, 30, 0),
                    usuario="Cliente",
                    mensagem="Preciso entender por que o valor do PGDAS aumentou"
                ),
                Conversa(
                    data=datetime(2025, 1, 10, 15, 0, 0),
                    usuario="João Silva",
                    mensagem="O aumento foi devido ao faturamento superior ao mês anterior"
                )
            ]
        ),
        Ticket(
            empresa_id="2",
            empresa="Auto Peças Norte Ltda",
            titulo="Solicitação de Certidões",
            descricao="Cliente precisa de certidões negativas atualizadas",
            prioridade="alta",
            status="em_andamento",
            responsavel="Maria Santos",
            canal="email",
            data_abertura=date(2025, 1, 22),
            sla=datetime(2025, 1, 23, 18, 0, 0),
            observacoes="Aguardando retorno da Receita Federal"
        )
    ]
    
    for ticket in tickets:
        await atendimento_collection.insert_one(ticket.model_dump(mode='json'))
    
    print(f"Initialized {len(tickets)} tickets")

async def init_chat_data():
    """Initialize chat data"""
    from models.chat import Chat, Message
    chats_collection = await get_chats_collection()
    
    # Check if chat data already exists
    count = await chats_collection.count_documents({})
    if count > 0:
        print("Chat data already exists, skipping initialization")
        return
    
    chats = [
        Chat(
            nome="Equipe Geral",
            descricao="Chat geral da equipe",
            tipo="grupo",
            participantes=["admin-id", "colab-id", "fiscal-id"],
            admin_id="admin-id",
            mensagens=[
                Message(
                    usuario_id="admin-id",
                    usuario_nome="Administrador",
                    mensagem="Bem-vindos ao sistema Macedo SI!",
                    timestamp=datetime(2025, 1, 10, 9, 0, 0)
                ),
                Message(
                    usuario_id="colab-id",
                    usuario_nome="João Silva",
                    mensagem="Obrigado! Sistema está funcionando perfeitamente.",
                    timestamp=datetime(2025, 1, 10, 9, 30, 0)
                )
            ]
        ),
        Chat(
            nome="Suporte Técnico",
            descricao="Canal para questões técnicas",
            tipo="suporte",
            participantes=["admin-id"],
            admin_id="admin-id",
            mensagens=[
                Message(
                    usuario_id="admin-id",
                    usuario_nome="Administrador",
                    mensagem="Canal de suporte técnico ativo",
                    timestamp=datetime(2025, 1, 10, 8, 0, 0)
                )
            ]
        )
    ]
    
    for chat in chats:
        await chats_collection.insert_one(chat.model_dump())
    
    print(f"Initialized {len(chats)} chats")

async def init_configuracoes_data():
    """Initialize configuracoes data"""
    configuracoes_collection = await get_configuracoes_collection()
    
    # Check if configuracoes data already exists
    count = await configuracoes_collection.count_documents({})
    if count > 0:
        print("Configuracoes data already exists, skipping initialization")
        return
    
    configs = [
        Configuracoes(
            setor="financeiro",
            nome="Configurações Financeiras",
            configuracoes={
                "moeda_padrao": "BRL",
                "taxa_juros": 1.0,
                "dias_vencimento": 30,
                "envio_automatico_boletos": True
            },
            updated_by="Administrador"
        ),
        Configuracoes(
            setor="fiscal",
            nome="Configurações Fiscais",
            configuracoes={
                "regime_tributario": "simples_nacional",
                "aliquota_iss": 5.0,
                "envio_automatico_sped": True,
                "prazo_entrega": 15
            },
            updated_by="Administrador"
        )
    ]
    
    for config in configs:
        await configuracoes_collection.insert_one(config.model_dump())
    
    print(f"Initialized {len(configs)} configurations")

async def main():
    """Initialize all database collections"""
    print("🚀 Starting database initialization...")
    
    await connect_to_mongo()
    
    try:
        await init_users()
        await init_clients()
        await init_financial_data()
        await init_trabalhista_data()
        await init_fiscal_data()
        await init_atendimento_data()
        await init_chat_data()
        await init_configuracoes_data()
        print("✅ Database initialization completed successfully!")
    except Exception as e:
        print(f"❌ Error during initialization: {e}")
        raise
    finally:
        await close_mongo_connection()

if __name__ == "__main__":
    asyncio.run(main())