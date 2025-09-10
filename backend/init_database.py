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
    get_atendimento_collection, get_configuracoes_collection, get_chats_collection,
    get_tasks_collection
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
        ),
        Client(
            nome_empresa="Supermercado Bom Preço Ltda",
            nome_fantasia="Supermercado Bom Preço",
            status="ativa",
            cidade="jacobina",
            telefone="(74) 3621-5678",
            whatsapp="(74) 98888-7777",
            email="gerencia@bompreco.com.br",
            responsavel="Ana Costa",
            cnpj="45.678.901/0001-23",
            forma_envio="email",
            codigo_iob="IOB004",
            novo_cliente=False,
            tipo_empresa="matriz",
            endereco=Address(
                logradouro="Av. Comercial, 890",
                bairro="Centro",
                cep="44700-100",
                cidade="Jacobina",
                estado="BA"
            ),
            tipo_regime="lucro_presumido"
        ),
        Client(
            nome_empresa="Oficina Mecânica do Zé Ltda",
            nome_fantasia="Oficina do Zé",
            status="ativa",
            cidade="ourolandia",
            telefone="(74) 3633-9999",
            whatsapp="(74) 99999-1111",
            email="oficina@oficinadoze.com.br",
            responsavel="José Ferreira",
            cnpj="56.789.012/0001-45",
            forma_envio="whatsapp",
            codigo_iob="IOB005",
            novo_cliente=True,
            tipo_empresa="matriz",
            endereco=Address(
                logradouro="Rua das Oficinas, 234",
                bairro="Industrial",
                cep="44755-200",
                cidade="Ourolândia",
                estado="BA"
            ),
            tipo_regime="simples"
        ),
        Client(
            nome_empresa="Farmácia Vida & Saúde Ltda",
            nome_fantasia="Farmácia Vida & Saúde",
            status="ativa",
            cidade="umburanas",
            telefone="(74) 3644-5555",
            whatsapp="(74) 97777-8888",
            email="atendimento@vidasaude.com.br",
            responsavel="Dra. Paula Lima",
            cnpj="67.890.123/0001-67",
            forma_envio="email",
            codigo_iob="IOB006",
            novo_cliente=False,
            tipo_empresa="matriz",
            endereco=Address(
                logradouro="Praça Central, 45",
                bairro="Centro",
                cep="44760-300",
                cidade="Umburanas",
                estado="BA"
            ),
            tipo_regime="simples"
        ),
        Client(
            nome_empresa="Restaurante Sabor Caseiro Ltda",
            nome_fantasia="Sabor Caseiro",
            status="ativa",
            cidade="jacobina",
            telefone="(74) 3621-7777",
            whatsapp="(74) 98555-4444",
            email="pedidos@saborcaseiro.com.br",
            responsavel="Chef Roberto",
            cnpj="78.901.234/0001-89",
            forma_envio="whatsapp",
            codigo_iob="IOB007",
            novo_cliente=True,
            tipo_empresa="matriz",
            endereco=Address(
                logradouro="Rua dos Restaurantes, 567",
                bairro="Centro",
                cep="44700-400",
                cidade="Jacobina",
                estado="BA"
            ),
            tipo_regime="simples"
        ),
        Client(
            nome_empresa="Loja de Roupas Fashion Store Ltda",
            nome_fantasia="Fashion Store",
            status="ativa",
            cidade="ourolandia",
            telefone="(74) 3633-3333",
            whatsapp="(74) 99666-2222",
            email="vendas@fashionstore.com.br",
            responsavel="Isabella Santos",
            cnpj="89.012.345/0001-01",
            forma_envio="email",
            codigo_iob="IOB008",
            novo_cliente=False,
            tipo_empresa="matriz",
            endereco=Address(
                logradouro="Rua da Moda, 678",
                bairro="Centro",
                cep="44755-500",
                cidade="Ourolândia",
                estado="BA"
            ),
            tipo_regime="lucro_presumido"
        ),
        Client(
            nome_empresa="Escola Técnica Futuro Ltda",
            nome_fantasia="Escola Futuro",
            status="ativa",
            cidade="umburanas",
            telefone="(74) 3644-1111",
            whatsapp="(74) 97333-5555",
            email="secretaria@escolafuturo.com.br",
            responsavel="Prof. Marcus Vinícius",
            cnpj="90.123.456/0001-12",
            forma_envio="email",
            codigo_iob="IOB009",
            novo_cliente=True,
            tipo_empresa="matriz",
            endereco=Address(
                logradouro="Av. da Educação, 789",
                bairro="Educacional",
                cep="44760-600",
                cidade="Umburanas",
                estado="BA"
            ),
            tipo_regime="lucro_presumido"
        ),
        Client(
            nome_empresa="Petshop Amigo Fiel ME",
            nome_fantasia="Amigo Fiel Petshop",
            status="ativa",
            cidade="jacobina",
            telefone="(74) 3621-2222",
            whatsapp="(74) 98222-9999",
            email="cuidados@amigofiel.com.br",
            responsavel="Veterinária Dra. Carla",
            cnpj="01.234.567/0001-90",
            forma_envio="whatsapp",
            codigo_iob="IOB010",
            novo_cliente=False,
            tipo_empresa="matriz",
            endereco=Address(
                logradouro="Rua dos Pets, 321",
                bairro="Residencial",
                cep="44700-700",
                cidade="Jacobina",
                estado="BA"
            ),
            tipo_regime="mei"
        ),
        Client(
            nome_empresa="Transportadora Rápida Ltda",
            nome_fantasia="Rápida Transportes",
            status="ativa",
            cidade="uberlandia",
            telefone="(34) 3333-4444",
            whatsapp="(34) 99888-7777",
            email="logistica@rapidatransportes.com.br",
            responsavel="Sr. Antonio Carlos",
            cnpj="11.222.333/0001-44",
            forma_envio="email",
            codigo_iob="IOB011",
            novo_cliente=True,
            tipo_empresa="matriz",
            endereco=Address(
                logradouro="Rod. BR-050, Km 15",
                bairro="Distrito Industrial",
                cep="38400-000",
                cidade="Uberlândia",
                estado="MG"
            ),
            tipo_regime="lucro_real"
        ),
        Client(
            nome_empresa="Consultório Odontológico Sorriso Ltda",
            nome_fantasia="Clínica Sorriso",
            status="suspensa",
            cidade="jacobina",
            telefone="(74) 3621-8888",
            whatsapp="(74) 98111-2222",
            email="agendamento@clinicasorriso.com.br",
            responsavel="Dr. Fernando Alves",
            cnpj="22.333.444/0001-55",
            forma_envio="whatsapp",
            codigo_iob="IOB012",
            novo_cliente=False,
            tipo_empresa="matriz",
            endereco=Address(
                logradouro="Rua da Saúde, 456",
                bairro="Centro",
                cep="44700-800",
                cidade="Jacobina",
                estado="BA"
            ),
            tipo_regime="simples"
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
            ),
            FinancialClient(
                empresa_id="4",
                empresa="Supermercado Bom Preço Ltda",
                valor_com_desconto=1800.00,
                valor_boleto=2000.00,
                dia_vencimento=5,
                tipo_honorario="mensal",
                empresa_individual_grupo="individual",
                contas_pagamento=["conta_corrente", "pix", "cartao"],
                tipo_pagamento="recorrente",
                tipo_empresa="lucro_presumido",
                ultimo_pagamento=date(2025, 1, 5),
                status_pagamento="em_dia"
            ),
            FinancialClient(
                empresa_id="7",
                empresa="Restaurante Sabor Caseiro Ltda",
                valor_com_desconto=650.00,
                valor_boleto=750.00,
                dia_vencimento=20,
                tipo_honorario="mensal",
                empresa_individual_grupo="individual",
                contas_pagamento=["conta_corrente"],
                tipo_pagamento="recorrente",
                tipo_empresa="simples",
                ultimo_pagamento=date(2024, 12, 20),
                status_pagamento="atrasado"
            ),
            FinancialClient(
                empresa_id="8",
                empresa="Loja de Roupas Fashion Store Ltda",
                valor_com_desconto=1100.00,
                valor_boleto=1250.00,
                dia_vencimento=25,
                tipo_honorario="mensal",
                empresa_individual_grupo="grupo",
                contas_pagamento=["pix"],
                tipo_pagamento="recorrente",
                tipo_empresa="lucro_presumido",
                ultimo_pagamento=date(2025, 1, 25),
                status_pagamento="em_dia"
            ),
            FinancialClient(
                empresa_id="11",
                empresa="Transportadora Rápida Ltda",
                valor_com_desconto=2500.00,
                valor_boleto=2800.00,
                dia_vencimento=30,
                tipo_honorario="mensal",
                empresa_individual_grupo="individual",
                contas_pagamento=["conta_corrente", "ted"],
                tipo_pagamento="recorrente",
                tipo_empresa="lucro_real",
                ultimo_pagamento=date(2024, 12, 30),
                status_pagamento="renegociado"
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
            ),
            ContaReceber(
                empresa_id="4",
                empresa="Supermercado Bom Preço Ltda",
                situacao="pago",
                descricao="Honorários contábeis - Janeiro/2025",
                documento="NF-001236",
                forma_pagamento="transferencia",
                conta="Banco do Brasil - CC 1234-5",
                centro_custo="Honorários Mensais",
                plano_custo="Receitas de Serviços",
                data_emissao=date(2025, 1, 1),
                data_vencimento=date(2025, 1, 5),
                valor_original=2000.00,
                observacao="Pagamento realizado via transferência",
                cidade_atendimento="jacobina",
                data_recebimento=date(2025, 1, 4),
                valor_quitado=1800.00,
                desconto_aplicado=200.00,
                total_bruto=2000.00,
                total_liquido=1800.00,
                usuario_responsavel="Ana Costa",
                historico=[
                    HistoricoAction(
                        data=datetime(2025, 1, 4, 14, 30, 0),
                        acao="Desconto aplicado por pagamento antecipado",
                        usuario="João Silva",
                        valor=200.00
                    ),
                    HistoricoAction(
                        data=datetime(2025, 1, 4, 15, 0, 0),
                        acao="Pagamento recebido",
                        usuario="Sistema",
                        valor=1800.00
                    )
                ]
            ),
            ContaReceber(
                empresa_id="7",
                empresa="Restaurante Sabor Caseiro Ltda",
                situacao="atrasado",
                descricao="Honorários contábeis - Dezembro/2024",
                documento="NF-001200",
                forma_pagamento="boleto",
                conta="Banco do Brasil - CC 1234-5",
                centro_custo="Honorários Mensais",
                plano_custo="Receitas de Serviços",
                data_emissao=date(2024, 12, 1),
                data_vencimento=date(2024, 12, 20),
                valor_original=750.00,
                observacao="Cliente com dificuldades financeiras",
                cidade_atendimento="jacobina",
                total_bruto=750.00,
                total_liquido=750.00,
                usuario_responsavel="Chef Roberto"
            ),
            ContaReceber(
                empresa_id="8",
                empresa="Loja de Roupas Fashion Store Ltda",
                situacao="em_aberto",
                descricao="Honorários contábeis - Janeiro/2025",
                documento="NF-001237",
                forma_pagamento="pix",
                conta="Banco do Brasil - CC 1234-5",
                centro_custo="Honorários Mensais",
                plano_custo="Receitas de Serviços",
                data_emissao=date(2025, 1, 1),
                data_vencimento=date(2025, 1, 25),
                valor_original=1250.00,
                observacao="Aguardando vencimento",
                cidade_atendimento="ourolandia",
                total_bruto=1250.00,
                total_liquido=1250.00,
                usuario_responsavel="Isabella Santos"
            ),
            ContaReceber(
                empresa_id="11",
                empresa="Transportadora Rápida Ltda",
                situacao="renegociado",
                descricao="Honorários contábeis - Dezembro/2024",
                documento="NF-001201",
                forma_pagamento="transferencia",
                conta="Banco do Brasil - CC 1234-5",
                centro_custo="Honorários Mensais",
                plano_custo="Receitas de Serviços",
                data_emissao=date(2024, 12, 1),
                data_vencimento=date(2024, 12, 30),
                valor_original=2800.00,
                observacao="Renegociado para pagamento parcelado",
                cidade_atendimento="uberlandia",
                total_bruto=2800.00,
                total_liquido=2800.00,
                usuario_responsavel="Sr. Antonio Carlos",
                historico=[
                    HistoricoAction(
                        data=datetime(2025, 1, 5, 9, 0, 0),
                        acao="Conta renegociada para 3x sem juros",
                        usuario="Administrador",
                        observacao="Cliente solicitou parcelamento"
                    )
                ]
            ),
            ContaReceber(
                empresa_id="3",
                empresa="Clínica Saúde & Vida ME",
                situacao="em_aberto",
                descricao="Honorários contábeis - Janeiro/2025",
                documento="NF-001238",
                forma_pagamento="boleto",
                conta="Banco do Brasil - CC 1234-5",
                centro_custo="Honorários Mensais",
                plano_custo="Receitas de Serviços",
                data_emissao=date(2025, 1, 1),
                data_vencimento=date(2025, 2, 5),
                valor_original=400.00,
                observacao="MEI - valor reduzido",
                cidade_atendimento="umburanas",
                total_bruto=400.00,
                total_liquido=400.00,
                usuario_responsavel="Dr. Carlos Oliveira"
            ),
            ContaReceber(
                empresa_id="10",
                empresa="Petshop Amigo Fiel ME",
                situacao="pago",
                descricao="Honorários contábeis - Janeiro/2025",
                documento="NF-001239",
                forma_pagamento="pix",
                conta="Banco do Brasil - CC 1234-5",
                centro_custo="Honorários Mensais",
                plano_custo="Receitas de Serviços",
                data_emissao=date(2025, 1, 1),
                data_vencimento=date(2025, 1, 15),
                valor_original=350.00,
                observacao="MEI - pagamento pontual",
                cidade_atendimento="jacobina",
                data_recebimento=date(2025, 1, 12),
                valor_quitado=350.00,
                total_bruto=350.00,
                total_liquido=350.00,
                usuario_responsavel="Dra. Carla",
                historico=[
                    HistoricoAction(
                        data=datetime(2025, 1, 12, 16, 30, 0),
                        acao="Pagamento via PIX recebido",
                        usuario="Sistema",
                        valor=350.00
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
        ),
        SolicitacaoTrabalhista(
            empresa_id="4",
            empresa="Supermercado Bom Preço Ltda",
            tipo="demissao",
            descricao="Demissão de funcionário - Operador de Caixa",
            data_solicitacao=date(2025, 1, 10),
            prazo=date(2025, 1, 15),
            responsavel="Ana Costa",
            status="concluido",
            observacoes="Demissão por justa causa processada",
            funcionario=FuncionarioData(
                nome="Carlos Eduardo Santos",
                cpf="987.654.321-00",
                funcao="Operador de Caixa",
                salario=1800.00,
                motivo_demissao="Justa causa - abandono de emprego"
            )
        ),
        SolicitacaoTrabalhista(
            empresa_id="7",
            empresa="Restaurante Sabor Caseiro Ltda",
            tipo="admissao",
            descricao="Admissão de cozinheiro experiente",
            data_solicitacao=date(2025, 1, 25),
            prazo=date(2025, 1, 30),
            responsavel="Chef Roberto",
            status="pendente",
            observacoes="Aguardando entrega dos documentos pelo funcionário",
            funcionario=FuncionarioData(
                nome="José da Cozinha",
                cpf="456.789.123-00",
                funcao="Cozinheiro",
                salario=2200.00,
                data_admissao=date(2025, 2, 1)
            )
        ),
        SolicitacaoTrabalhista(
            empresa_id="8",
            empresa="Loja de Roupas Fashion Store Ltda",
            tipo="folha",
            descricao="Folha de pagamento - Janeiro/2025",
            data_solicitacao=date(2025, 1, 22),
            prazo=date(2025, 1, 28),
            responsavel="Isabella Santos",
            status="em_andamento",
            observacoes="Aguardando confirmação de horas extras",
            detalhes=DetalheFolha(
                total_funcionarios=5,
                total_proventos=12000.00,
                total_descontos=2400.00,
                total_liquido=9600.00
            )
        ),
        SolicitacaoTrabalhista(
            empresa_id="11",
            empresa="Transportadora Rápida Ltda",
            tipo="afastamento",
            descricao="Afastamento por doença ocupacional - Motorista",
            data_solicitacao=date(2025, 1, 12),
            prazo=date(2025, 1, 17),
            responsavel="Sr. Antonio Carlos",
            status="concluido",
            observacoes="CAT emitida e protocolo no INSS realizado",
            funcionario=FuncionarioData(
                nome="Pedro Caminhoneiro",
                cpf="321.654.987-00",
                funcao="Motorista",
                salario=3200.00
            )
        ),
        SolicitacaoTrabalhista(
            empresa_id="6",
            empresa="Farmácia Vida & Saúde Ltda",
            tipo="reclamacao",
            descricao="Reclamação trabalhista - Ex-funcionário",
            data_solicitacao=date(2025, 1, 8),
            prazo=date(2025, 2, 8),
            responsavel="Dra. Paula Lima",
            status="atrasado",
            observacoes="Aguardando parecer jurídico - prazo vencido",
            funcionario=FuncionarioData(
                nome="Funcionário Reclamante",
                cpf="147.258.369-00",
                funcao="Balconista",
                salario=1600.00,
                motivo_demissao="Demissão sem justa causa"
            )
        ),
        SolicitacaoTrabalhista(
            empresa_id="9",
            empresa="Escola Técnica Futuro Ltda",
            tipo="folha",
            descricao="Folha de pagamento professores - Janeiro/2025",
            data_solicitacao=date(2025, 1, 18),
            prazo=date(2025, 1, 25),
            responsavel="Prof. Marcus Vinícius",
            status="em_andamento",
            observacoes="Calculando adicional noturno dos professores",
            detalhes=DetalheFolha(
                total_funcionarios=15,
                total_proventos=45000.00,
                total_descontos=9000.00,
                total_liquido=36000.00
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
        ),
        ObrigacaoFiscal(
            empresa_id="4",
            empresa="Supermercado Bom Preço Ltda",
            tipo="pgdas",
            nome="PGDAS - Lucro Presumido Janeiro/2025",
            periodicidade="mensal",
            vencimento=date(2025, 2, 15),
            responsavel="Ana Costa",
            status="entregue",
            valor=1200.00,
            data_entrega=date(2025, 2, 10),
            observacoes="Entregue antecipadamente"
        ),
        ObrigacaoFiscal(
            empresa_id="8",
            empresa="Loja de Roupas Fashion Store Ltda",
            tipo="dctf",
            nome="DCTF - Declaração Janeiro/2025",
            periodicidade="mensal",
            vencimento=date(2025, 2, 25),
            responsavel="Isabella Santos",
            status="pendente",
            valor=800.00,
            observacoes="Aguardando documentação do cliente"
        ),
        ObrigacaoFiscal(
            empresa_id="9",
            empresa="Escola Técnica Futuro Ltda",
            tipo="sped",
            nome="SPED Fiscal Janeiro/2025",
            periodicidade="mensal",
            vencimento=date(2025, 2, 15),
            responsavel="Prof. Marcus Vinícius",
            status="atrasado",
            observacoes="Empresa não enviou documentos a tempo"
        ),
        ObrigacaoFiscal(
            empresa_id="11",
            empresa="Transportadora Rápida Ltda",
            tipo="defis",
            nome="DEFIS - Declaração Anual 2024",
            periodicidade="anual",
            vencimento=date(2025, 3, 31),
            responsavel="Sr. Antonio Carlos",
            status="em_andamento",
            valor=2500.00,
            observacoes="Preparando documentação para lucro real"
        ),
        ObrigacaoFiscal(
            empresa_id="7",
            empresa="Restaurante Sabor Caseiro Ltda",
            tipo="pgdas",
            nome="PGDAS - Simples Nacional Janeiro/2025",
            periodicidade="mensal",
            vencimento=date(2025, 2, 20),
            responsavel="Chef Roberto",
            status="pendente",
            valor=320.00,
            observacoes="Cliente solicitou extensão de prazo"
        ),
        ObrigacaoFiscal(
            empresa_id="6",
            empresa="Farmácia Vida & Saúde Ltda",
            tipo="darf",
            nome="DARF - Recolhimento ISS Janeiro/2025",
            periodicidade="mensal",
            vencimento=date(2025, 2, 10),
            responsavel="Dra. Paula Lima",
            status="entregue",
            valor=180.00,
            data_entrega=date(2025, 2, 8),
            observacoes="Recolhimento municipal efetuado"
        ),
        ObrigacaoFiscal(
            empresa_id="5",
            empresa="Oficina Mecânica do Zé Ltda",
            tipo="pgdas",
            nome="PGDAS - Simples Nacional Janeiro/2025",
            periodicidade="mensal",
            vencimento=date(2025, 2, 20),
            responsavel="José Ferreira",
            status="atrasado",
            valor=290.00,
            observacoes="Cliente com dificuldades de pagamento"
        ),
        ObrigacaoFiscal(
            empresa_id="12",
            empresa="Consultório Odontológico Sorriso Ltda",
            tipo="pgdas",
            nome="PGDAS - Simples Nacional Dezembro/2024",
            periodicidade="mensal",
            vencimento=date(2025, 1, 20),
            responsavel="Dr. Fernando Alves",
            status="atrasado",
            valor=150.00,
            observacoes="Empresa suspensa - regularização pendente"
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
        ),
        Ticket(
            empresa_id="4",
            empresa="Supermercado Bom Preço Ltda",
            titulo="Problema no Sistema Fiscal",
            descricao="Sistema não está emitindo NFCe corretamente",
            prioridade="urgente",
            status="em_andamento",
            responsavel="Carlos Oliveira",
            canal="telefone",
            data_abertura=date(2025, 1, 25),
            sla=datetime(2025, 1, 25, 20, 0, 0),
            conversas=[
                Conversa(
                    data=datetime(2025, 1, 25, 9, 0, 0),
                    usuario="Ana Costa",
                    mensagem="Sistema travando ao emitir NFCe desde ontem"
                ),
                Conversa(
                    data=datetime(2025, 1, 25, 9, 30, 0),
                    usuario="Carlos Oliveira",
                    mensagem="Vou verificar a configuração do sistema fiscal"
                )
            ],
            observacoes="Cliente com alta demanda de vendas, prioridade máxima"
        ),
        Ticket(
            empresa_id="7",
            empresa="Restaurante Sabor Caseiro Ltda",
            titulo="Treinamento sobre Nota Fiscal",
            descricao="Funcionários precisam de treinamento para emissão de NF",
            prioridade="baixa",
            status="aberto",
            responsavel="Isabella Santos",
            canal="presencial",
            data_abertura=date(2025, 1, 28),
            sla=datetime(2025, 1, 30, 17, 0, 0),
            observacoes="Agendar visita para treinamento da equipe"
        ),
        Ticket(
            empresa_id="8",
            empresa="Loja de Roupas Fashion Store Ltda",
            titulo="Consultoria sobre Regime Tributário",
            descricao="Análise para possível mudança de regime tributário",
            prioridade="media",
            status="aguardando_cliente",
            responsavel="Maria Santos",
            canal="email",
            data_abertura=date(2025, 1, 20),
            sla=datetime(2025, 1, 22, 18, 0, 0),
            conversas=[
                Conversa(
                    data=datetime(2025, 1, 20, 10, 0, 0),
                    usuario="Isabella Santos",
                    mensagem="Gostaria de avaliar se vale a pena mudar para Lucro Real"
                ),
                Conversa(
                    data=datetime(2025, 1, 20, 14, 0, 0),
                    usuario="Maria Santos",
                    mensagem="Preciso dos dados de faturamento dos últimos 12 meses"
                ),
                Conversa(
                    data=datetime(2025, 1, 21, 16, 0, 0),
                    usuario="Maria Santos",
                    mensagem="Aguardando envio da documentação solicitada"
                )
            ]
        ),
        Ticket(
            empresa_id="11",
            empresa="Transportadora Rápida Ltda",
            titulo="Regularização Fiscal Urgente",
            descricao="Empresa com pendências na Receita Federal",
            prioridade="urgente",
            status="em_andamento",
            responsavel="Carlos Oliveira",
            canal="telefone",
            data_abertura=date(2025, 1, 15),
            sla=datetime(2025, 1, 16, 12, 0, 0),
            observacoes="Pendências podem impactar operação da empresa",
            conversas=[
                Conversa(
                    data=datetime(2025, 1, 15, 8, 0, 0),
                    usuario="Sr. Antonio Carlos",
                    mensagem="Recebi notificação da Receita sobre irregularidades"
                ),
                Conversa(
                    data=datetime(2025, 1, 15, 10, 0, 0),
                    usuario="Carlos Oliveira",
                    mensagem="Já estou providenciando a regularização. Enviei a documentação."
                )
            ]
        ),
        Ticket(
            empresa_id="6",
            empresa="Farmácia Vida & Saúde Ltda",
            titulo="Dúvida sobre Medicamentos Controlados",
            descricao="Esclarecimentos sobre escrituração de medicamentos controlados",
            prioridade="media",
            status="resolvido",
            responsavel="Dra. Paula Lima",
            canal="whatsapp",
            data_abertura=date(2025, 1, 18),
            sla=datetime(2025, 1, 19, 18, 0, 0),
            conversas=[
                Conversa(
                    data=datetime(2025, 1, 18, 14, 0, 0),
                    usuario="Dra. Paula Lima",
                    mensagem="Como devo escriturar a venda de medicamentos controlados?"
                ),
                Conversa(
                    data=datetime(2025, 1, 18, 15, 30, 0),
                    usuario="Maria Santos",
                    mensagem="Enviei por email o manual completo de escrituração"
                )
            ]
        ),
        Ticket(
            empresa_id="9",
            empresa="Escola Técnica Futuro Ltda",
            titulo="Orientação sobre INSS Educação",
            descricao="Dúvidas sobre recolhimento de INSS para instituição de ensino",
            prioridade="alta",
            status="fechado",
            responsavel="Prof. Marcus Vinícius",
            canal="email",
            data_abertura=date(2025, 1, 12),
            sla=datetime(2025, 1, 14, 18, 0, 0),
            observacoes="Caso resolvido com sucesso, orientações implementadas"
        ),
        Ticket(
            empresa_id="5",
            empresa="Oficina Mecânica do Zé Ltda",
            titulo="Problema com Alvará de Funcionamento",
            descricao="Alvará vencido, precisa de renovação urgente",
            prioridade="alta",
            status="aberto",
            responsavel="José Ferreira",
            canal="presencial",
            data_abertura=date(2025, 1, 29),
            sla=datetime(2025, 1, 31, 17, 0, 0),
            observacoes="Cliente veio pessoalmente solicitar urgência na renovação"
        ),
        Ticket(
            empresa_id="10",
            empresa="Petshop Amigo Fiel ME",
            titulo="Orientação MEI",
            descricao="Esclarecimentos sobre limites e obrigações do MEI",
            prioridade="baixa",
            status="resolvido",
            responsavel="Dra. Carla",
            canal="whatsapp",
            data_abertura=date(2025, 1, 16),
            sla=datetime(2025, 1, 18, 18, 0, 0),
            conversas=[
                Conversa(
                    data=datetime(2025, 1, 16, 11, 0, 0),
                    usuario="Dra. Carla",
                    mensagem="Posso prestar serviços veterinários sendo MEI?"
                ),
                Conversa(
                    data=datetime(2025, 1, 16, 14, 0, 0),
                    usuario="João Silva",
                    mensagem="Sim, desde que não ultrapasse o limite de faturamento anual"
                )
            ]
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
                ),
                Message(
                    usuario_id="fiscal-id",
                    usuario_nome="Maria Santos",
                    mensagem="Pessoal, lembrem de atualizar os dados das obrigações fiscais",
                    timestamp=datetime(2025, 1, 22, 14, 15, 0)
                ),
                Message(
                    usuario_id="admin-id",
                    usuario_nome="Administrador",
                    mensagem="Relatório mensal será enviado amanhã para todos os clientes",
                    timestamp=datetime(2025, 1, 28, 16, 45, 0)
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
        ),
        Chat(
            nome="Financeiro",
            descricao="Discussões sobre questões financeiras",
            tipo="grupo",
            participantes=["admin-id", "colab-id"],
            admin_id="admin-id",
            mensagens=[
                Message(
                    usuario_id="admin-id",
                    usuario_nome="Administrador",
                    mensagem="Vamos revisar as contas em atraso esta semana",
                    timestamp=datetime(2025, 1, 20, 10, 0, 0)
                ),
                Message(
                    usuario_id="colab-id",
                    usuario_nome="João Silva",
                    mensagem="Já identifiquei 3 clientes com pagamentos atrasados. Vou entrar em contato.",
                    timestamp=datetime(2025, 1, 20, 10, 30, 0)
                ),
                Message(
                    usuario_id="admin-id",
                    usuario_nome="Administrador",
                    mensagem="Perfeito! O Restaurante Sabor Caseiro precisa de atenção especial.",
                    timestamp=datetime(2025, 1, 20, 11, 0, 0)
                )
            ]
        ),
        Chat(
            nome="Fiscal & Trabalhista",
            descricao="Coordenação entre setores fiscal e trabalhista",
            tipo="grupo",
            participantes=["admin-id", "fiscal-id"],
            admin_id="admin-id",
            mensagens=[
                Message(
                    usuario_id="fiscal-id",
                    usuario_nome="Maria Santos",
                    mensagem="Temos várias obrigações vencendo na próxima semana",
                    timestamp=datetime(2025, 1, 25, 9, 0, 0)
                ),
                Message(
                    usuario_id="admin-id",
                    usuario_nome="Administrador",
                    mensagem="Priorize as empresas com regime de Lucro Real primeiro",
                    timestamp=datetime(2025, 1, 25, 9, 15, 0)
                )
            ]
        ),
        Chat(
            nome="Plantão de Dúvidas",
            descricao="Canal para dúvidas rápidas dos clientes",
            tipo="suporte",
            participantes=["admin-id", "colab-id", "fiscal-id"],
            admin_id="admin-id",
            mensagens=[
                Message(
                    usuario_id="colab-id",
                    usuario_nome="João Silva",
                    mensagem="Cliente da Padaria São João perguntou sobre prazo do PGDAS",
                    timestamp=datetime(2025, 1, 29, 14, 0, 0)
                ),
                Message(
                    usuario_id="fiscal-id",
                    usuario_nome="Maria Santos",
                    mensagem="Prazo é até dia 20 do mês seguinte. Já orientei o cliente.",
                    timestamp=datetime(2025, 1, 29, 14, 30, 0)
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