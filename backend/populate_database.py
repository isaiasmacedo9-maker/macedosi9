"""
Script para popular o banco de dados com dados de exemplo
"""
import asyncio
import sys
from datetime import datetime, timedelta
from database import get_clients_collection, get_database
import uuid

async def populate_database():
    print("🚀 Iniciando população do banco de dados...")
    
    database = await get_database()
    
    # Limpar dados existentes (opcional - comentar se não quiser limpar)
    # await clear_all_data(db)
    
    # 1. CRIAR CLIENTES
    print("\n📋 Criando clientes de exemplo...")
    clientes = [
        {
            "id": str(uuid.uuid4()),
            "nome_empresa": "Tech Solutions Brasil Ltda",
            "nome_fantasia": "Tech Solutions",
            "cnpj": "12.345.678/0001-90",
            "inscricao_estadual": "123.456.789.012",
            "email": "contato@techsolutions.com.br",
            "telefone": "(11) 3456-7890",
            "celular": "(11) 98765-4321",
            "cep": "01310-100",
            "logradouro": "Av. Paulista",
            "numero": "1000",
            "bairro": "Bela Vista",
            "cidade": "São Paulo",
            "estado": "SP",
            "setor": "contabilidade",
            "status": "ativo",
            "responsavel": "Admin",
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        },
        {
            "id": str(uuid.uuid4()),
            "nome_empresa": "Comercial ABC Produtos Ltda",
            "nome_fantasia": "ABC Comércio",
            "cnpj": "98.765.432/0001-10",
            "inscricao_estadual": "987.654.321.098",
            "email": "financeiro@abccomercio.com.br",
            "telefone": "(11) 2345-6789",
            "celular": "(11) 97654-3210",
            "cep": "04567-000",
            "logradouro": "Rua Vergueiro",
            "numero": "2500",
            "bairro": "Vila Mariana",
            "cidade": "São Paulo",
            "estado": "SP",
            "setor": "fiscal",
            "status": "ativo",
            "responsavel": "Admin",
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        },
        {
            "id": str(uuid.uuid4()),
            "nome_empresa": "Indústria XYZ S/A",
            "nome_fantasia": "XYZ Indústria",
            "cnpj": "11.222.333/0001-44",
            "inscricao_estadual": "111.222.333.444",
            "email": "contato@xyzindustria.com.br",
            "telefone": "(11) 4567-8901",
            "celular": "(11) 96543-2109",
            "cep": "08200-000",
            "logradouro": "Av. Industrial",
            "numero": "500",
            "bairro": "Centro",
            "cidade": "São Paulo",
            "estado": "SP",
            "setor": "trabalhista",
            "status": "ativo",
            "responsavel": "Admin",
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        },
        {
            "id": str(uuid.uuid4()),
            "nome_empresa": "Serviços RJ Prestadora Ltda",
            "nome_fantasia": "Serviços RJ",
            "cnpj": "22.333.444/0001-55",
            "email": "contato@servicosrj.com.br",
            "telefone": "(21) 3456-7890",
            "cidade": "Rio de Janeiro",
            "estado": "RJ",
            "setor": "financeiro",
            "status": "ativo",
            "responsavel": "Admin",
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        },
        {
            "id": str(uuid.uuid4()),
            "nome_empresa": "MEI João Silva",
            "nome_fantasia": "João Consultoria",
            "cnpj": "33.444.555/0001-66",
            "email": "joao@consultoria.com.br",
            "telefone": "(11) 99999-8888",
            "cidade": "São Paulo",
            "estado": "SP",
            "setor": "contabilidade",
            "status": "ativo",
            "responsavel": "Admin",
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
    ]
    
    for cliente in clientes:
        await database.clients.insert_one(cliente)
    print(f"✅ {len(clientes)} clientes criados!")
    
    # 2. CRIAR CONTAS A RECEBER (FINANCEIRO)
    print("\n💰 Criando contas a receber...")
    contas_receber = []
    for i, cliente in enumerate(clientes[:3]):
        # Contas em aberto
        contas_receber.append({
            "id": str(uuid.uuid4()),
            "empresa_id": cliente['id'],
            "empresa": cliente['nome_empresa'],
            "descricao": f"Honorários {datetime.now().strftime('%m/%Y')}",
            "tipo_documento": "boleto" if i % 2 == 0 else "fatura",
            "documento": f"FAT{str(i+1).zfill(6)}",
            "valor_original": 1500.00 + (i * 500),
            "total_liquido": 1500.00 + (i * 500),
            "data_vencimento": (datetime.now() + timedelta(days=15 + i*5)).isoformat(),
            "situacao": "em_aberto",
            "cidade_atendimento": cliente['cidade'],
            "usuario_responsavel": "Admin",
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        })
        
        # Conta atrasada
        if i == 0:
            contas_receber.append({
                "id": str(uuid.uuid4()),
                "empresa_id": cliente['id'],
                "empresa": cliente['nome_empresa'],
                "descricao": "Honorários mês anterior",
                "tipo_documento": "boleto",
                "documento": f"BOL{str(100+i).zfill(6)}",
                "valor_original": 2000.00,
                "total_liquido": 2000.00,
                "data_vencimento": (datetime.now() - timedelta(days=10)).isoformat(),
                "situacao": "atrasado",
                "cidade_atendimento": cliente['cidade'],
                "usuario_responsavel": "Admin",
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            })
    
    for conta in contas_receber:
        await database.contas_receber.insert_one(conta)
    print(f"✅ {len(contas_receber)} contas a receber criadas!")
    
    # 3. CRIAR OBRIGAÇÕES FISCAIS
    print("\n📄 Criando obrigações fiscais...")
    obrigacoes_fiscais = []
    for i, cliente in enumerate(clientes[:3]):
        obrigacoes_fiscais.append({
            "id": str(uuid.uuid4()),
            "numero": f"OBF{str(i+1).zfill(6)}",
            "empresa_id": cliente['id'],
            "empresa": cliente['nome_empresa'],
            "tipo": ["pgdas", "sped_fiscal", "ecf"][i % 3],
            "nome": f"Obrigação {['PGDAS', 'SPED Fiscal', 'ECF'][i % 3]} - {cliente['nome_fantasia']}",
            "periodicidade": "mensal",
            "dia_vencimento": 20,
            "proximo_vencimento": (datetime.now() + timedelta(days=10 + i*3)).isoformat(),
            "regime_tributario": "simples_nacional",
            "status": "pendente",
            "responsavel": "Admin",
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        })
    
    for obrigacao in obrigacoes_fiscais:
        await database.obrigacoes_fiscais.insert_one(obrigacao)
    print(f"✅ {len(obrigacoes_fiscais)} obrigações fiscais criadas!")
    
    # 4. CRIAR NOTAS FISCAIS
    print("\n📝 Criando notas fiscais...")
    notas_fiscais = []
    for i, cliente in enumerate(clientes[:2]):
        notas_fiscais.append({
            "id": str(uuid.uuid4()),
            "empresa_id": cliente['id'],
            "cnpj_emitente": cliente['cnpj'],
            "nome_emitente": cliente['nome_empresa'],
            "numero_nota": str(1000 + i),
            "serie": "1",
            "tipo_nota": "saida",
            "data_emissao": datetime.now().isoformat(),
            "valor_total": 5000.00 + (i * 1000),
            "valor_icms": 500.00,
            "valor_pis": 165.00,
            "valor_cofins": 760.00,
            "status_conciliacao": "nao_conciliado",
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        })
    
    for nota in notas_fiscais:
        await database.notas_fiscais.insert_one(nota)
    print(f"✅ {len(notas_fiscais)} notas fiscais criadas!")
    
    # 5. CRIAR SOLICITAÇÕES TRABALHISTAS
    print("\n👥 Criando solicitações trabalhistas...")
    solicitacoes = []
    for i, cliente in enumerate(clientes[:3]):
        solicitacoes.append({
            "id": str(uuid.uuid4()),
            "numero": f"SOL{str(i+1).zfill(6)}",
            "empresa_id": cliente['id'],
            "empresa": cliente['nome_empresa'],
            "tipo": ["admissao", "demissao", "recalculo"][i % 3],
            "titulo": f"Solicitação de {['Admissão', 'Demissão', 'Recalculo'][i % 3]} - {cliente['nome_fantasia']}",
            "descricao": f"Processar {['admissão de novo funcionário', 'demissão de funcionário', 'recalculo de folha'][i % 3]}",
            "status": ["pendente", "em_andamento", "concluido"][i % 3],
            "prazo": (datetime.now() + timedelta(days=5 + i*2)).isoformat(),
            "responsavel": "Admin",
            "prioridade": "media",
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        })
    
    for sol in solicitacoes:
        await database.'solicitacoes_trabalhistas', sol)
    print(f"✅ {len(solicitacoes)} solicitações trabalhistas criadas!")
    
    # 6. CRIAR ADMISSÕES
    print("\n➕ Criando admissões...")
    admissoes = []
    for i, cliente in enumerate(clientes[:2]):
        admissoes.append({
            "id": str(uuid.uuid4()),
            "numero": f"ADM{str(i+1).zfill(6)}",
            "empresa_id": cliente['id'],
            "empresa": cliente['nome_empresa'],
            "funcionario_nome": ["João Silva Santos", "Maria Oliveira Costa"][i],
            "cpf": ["123.456.789-00", "987.654.321-00"][i],
            "data_nascimento": "1990-05-15",
            "cargo": ["Assistente Administrativo", "Analista Financeiro"][i],
            "salario": [2500.00, 4500.00][i],
            "data_admissao": (datetime.now() + timedelta(days=7)).isoformat(),
            "tipo_contrato": "clt",
            "jornada_trabalho": "44h semanais",
            "status": "pendente",
            "responsavel": "Admin",
            "checklist": [
                {"item": "Documentos pessoais recebidos", "concluido": False},
                {"item": "Exame admissional realizado", "concluido": False},
                {"item": "Contrato assinado", "concluido": False},
                {"item": "Cadastro no eSocial", "concluido": False},
                {"item": "Registro em carteira", "concluido": False},
                {"item": "Cadastro no sistema de folha", "concluido": False},
                {"item": "Vale transporte solicitado", "concluido": False},
                {"item": "Crachá emitido", "concluido": False}
            ],
            "documentos_recebidos": [],
            "contrato_assinado": False,
            "integrado_folha": False,
            "historico": [],
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        })
    
    for adm in admissoes:
        await database.'admissoes_trabalhistas', adm)
    print(f"✅ {len(admissoes)} admissões criadas!")
    
    # 7. CRIAR DEMISSÕES
    print("\n➖ Criando demissões...")
    demissoes = []
    demissoes.append({
        "id": str(uuid.uuid4()),
        "numero": "DEM000001",
        "empresa_id": clientes[0]['id'],
        "empresa": clientes[0]['nome_empresa'],
        "funcionario_id": str(uuid.uuid4()),
        "funcionario_nome": "Carlos Alberto Souza",
        "data_demissao": (datetime.now() + timedelta(days=30)).isoformat(),
        "tipo_demissao": "sem_justa_causa",
        "aviso_previo": "trabalhado",
        "motivo": "Redução de quadro",
        "status": "pendente",
        "responsavel": "Admin",
        "checklist": [
            {"item": "Aviso prévio comunicado", "concluido": False},
            {"item": "Cálculo de rescisão realizado", "concluido": False},
            {"item": "TRCT gerado", "concluido": False},
            {"item": "Termo de homologação", "concluido": False},
            {"item": "Guias de FGTS e INSS", "concluido": False},
            {"item": "Seguro desemprego", "concluido": False},
            {"item": "Exame demissional", "concluido": False},
            {"item": "Baixa no eSocial", "concluido": False},
            {"item": "Devolução de uniformes/equipamentos", "concluido": False}
        ],
        "documentos_gerados": [],
        "historico": [],
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    })
    
    for dem in demissoes:
        await database.'demissoes_trabalhistas', dem)
    print(f"✅ {len(demissoes)} demissões criadas!")
    
    # 8. CRIAR RECALCULOS
    print("\n🧮 Criando recalculos...")
    recalculos = []
    recalculos.append({
        "id": str(uuid.uuid4()),
        "numero": "REC000001",
        "empresa_id": clientes[0]['id'],
        "empresa": clientes[0]['nome_empresa'],
        "tipo_recalculo": "rescisao",
        "funcionario_nome": "Pedro Santos Lima",
        "periodo_referencia": "12/2024",
        "valor_original": 3500.00,
        "motivo": "Erro no cálculo de férias proporcionais",
        "status": "pendente",
        "responsavel": "Admin",
        "data_solicitacao": datetime.utcnow(),
        "documentos_anexos": [],
        "historico": [{
            "data": datetime.utcnow(),
            "acao": "Solicitação criada",
            "usuario": "Admin",
            "observacao": "Recalculo solicitado"
        }],
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    })
    
    for rec in recalculos:
        await database.'recalculos_trabalhistas', rec)
    print(f"✅ {len(recalculos)} recalculos criados!")
    
    # 9. CRIAR OBRIGAÇÕES TRABALHISTAS
    print("\n📋 Criando obrigações trabalhistas...")
    obrigacoes_trab = []
    for i, cliente in enumerate(clientes[:2]):
        obrigacoes_trab.append({
            "id": str(uuid.uuid4()),
            "numero": f"OBT{str(i+1).zfill(6)}",
            "empresa_id": cliente['id'],
            "empresa": cliente['nome_empresa'],
            "tipo": ["esocial", "dctfweb"][i % 2],
            "nome": f"{['eSocial', 'DCTFWEB'][i % 2]} - {cliente['nome_fantasia']}",
            "periodicidade": "mensal",
            "dia_vencimento": 15,
            "proximo_vencimento": (datetime.now() + timedelta(days=12 + i*2)).isoformat(),
            "status": "pendente",
            "responsavel": "Admin",
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        })
    
    for obr in obrigacoes_trab:
        await database.'obrigacoes_trabalhistas', obr)
    print(f"✅ {len(obrigacoes_trab)} obrigações trabalhistas criadas!")
    
    # 10. CRIAR AGENDAMENTOS
    print("\n📅 Criando agendamentos...")
    agendamentos = []
    for i, cliente in enumerate(clientes[:2]):
        agendamentos.append({
            "id": str(uuid.uuid4()),
            "numero": f"AGD{str(i+1).zfill(6)}",
            "empresa_id": cliente['id'],
            "empresa_nome": cliente['nome_empresa'],
            "cliente_nome": ["Sr. José Almeida", "Sra. Ana Paula"][i],
            "cliente_telefone": ["(11) 99999-1111", "(11) 99999-2222"][i],
            "cliente_email": ["jose@email.com", "ana@email.com"][i],
            "data_agendamento": (datetime.now() + timedelta(days=3 + i)).isoformat(),
            "hora_inicio": ["09:00", "14:00"][i],
            "hora_fim": ["10:00", "15:00"][i],
            "tipo_atendimento": "presencial",
            "motivo_atendimento": f"Reunião sobre {['planejamento tributário', 'prestação de contas'][i]}",
            "status": "pendente",
            "setor_responsavel": "atendimento",
            "solicitante_id": "admin",
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        })
    
    for agd in agendamentos:
        await database.'agendamentos', agd)
    print(f"✅ {len(agendamentos)} agendamentos criados!")
    
    # 11. CRIAR SERVIÇOS
    print("\n🔧 Criando serviços...")
    servicos = []
    for i, cliente in enumerate(clientes[:3]):
        servicos.append({
            "id": str(uuid.uuid4()),
            "numero": f"SRV{str(i+1).zfill(6)}",
            "empresa_id": cliente['id'],
            "empresa": cliente['nome_empresa'],
            "tipo": ["contabilidade", "fiscal", "trabalhista"][i % 3],
            "titulo": f"Serviço de {['Contabilidade', 'Fiscal', 'Trabalhista'][i % 3]} - {cliente['nome_fantasia']}",
            "descricao": f"Processamento mensal de {['escrituração contábil', 'apuração de impostos', 'folha de pagamento'][i % 3]}",
            "status": ["pendente", "em_andamento", "concluido"][i % 3],
            "prioridade": ["alta", "media", "baixa"][i % 3],
            "setor_responsavel": ["contabilidade", "fiscal", "trabalhista"][i % 3],
            "cidade": cliente['cidade'],
            "usuario_responsavel": "Admin",
            "prazo": (datetime.now() + timedelta(days=7 + i*3)).isoformat(),
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        })
    
    for srv in servicos:
        await database.'services', srv)
    print(f"✅ {len(servicos)} serviços criados!")
    
    # 12. CRIAR CONTRATOS (COMERCIAL)
    print("\n📜 Criando contratos...")
    contratos = []
    for i, cliente in enumerate(clientes[:2]):
        contratos.append({
            "id": str(uuid.uuid4()),
            "numero": f"CTR{str(i+1).zfill(6)}",
            "empresa_id": cliente['id'],
            "empresa": cliente['nome_empresa'],
            "servico": ["Contabilidade Completa", "Assessoria Fiscal"][i],
            "valor_mensal": [1500.00, 2000.00][i],
            "data_inicio": datetime.now().isoformat(),
            "data_vencimento": (datetime.now() + timedelta(days=365)).isoformat(),
            "status": "ativo",
            "observacoes": "Contrato padrão com renovação automática",
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        })
    
    for ctr in contratos:
        await database.'contratos', ctr)
    print(f"✅ {len(contratos)} contratos criados!")
    
    print("\n" + "="*60)
    print("🎉 BANCO DE DADOS POPULADO COM SUCESSO!")
    print("="*60)
    print("\n📊 RESUMO:")
    print(f"   • {len(clientes)} Clientes")
    print(f"   • {len(contas_receber)} Contas a Receber")
    print(f"   • {len(obrigacoes_fiscais)} Obrigações Fiscais")
    print(f"   • {len(notas_fiscais)} Notas Fiscais")
    print(f"   • {len(solicitacoes)} Solicitações Trabalhistas")
    print(f"   • {len(admissoes)} Admissões")
    print(f"   • {len(demissoes)} Demissões")
    print(f"   • {len(recalculos)} Recalculos")
    print(f"   • {len(obrigacoes_trab)} Obrigações Trabalhistas")
    print(f"   • {len(agendamentos)} Agendamentos")
    print(f"   • {len(servicos)} Serviços")
    print(f"   • {len(contratos)} Contratos")
    print("\n✅ Todos os módulos agora têm dados de exemplo!")
    print("="*60)

if __name__ == "__main__":
    asyncio.run(populate_database())
