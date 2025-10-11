"""
Script para popular banco MySQL com dados de exemplo
Adiciona dados em todos os módulos do sistema
"""
import asyncio
from datetime import datetime, date, timedelta
from database_adapter import DatabaseAdapter
import uuid
import random

# Dados de exemplo
CIDADES = ["São Paulo", "Rio de Janeiro", "Belo Horizonte", "Curitiba", "Porto Alegre"]
EMPRESAS_EXEMPLO = [
    {"nome": "Padaria Pão Quente Ltda", "fantasia": "Pão Quente", "cnpj": "12.345.678/0001-90", "regime": "simples_nacional"},
    {"nome": "Restaurante Sabor Mineiro ME", "fantasia": "Sabor Mineiro", "cnpj": "23.456.789/0001-01", "regime": "simples_nacional"},
    {"nome": "Loja de Roupas Fashion Style", "fantasia": "Fashion Style", "cnpj": "34.567.890/0001-12", "regime": "lucro_presumido"},
    {"nome": "Auto Peças Silva & Cia", "fantasia": "Auto Peças Silva", "cnpj": "45.678.901/0001-23", "regime": "lucro_presumido"},
    {"nome": "Consultoria Tech Solutions SA", "fantasia": "Tech Solutions", "cnpj": "56.789.012/0001-34", "regime": "lucro_real"},
    {"nome": "Mercadinho Bom Preço Ltda", "fantasia": "Bom Preço", "cnpj": "67.890.123/0001-45", "regime": "simples_nacional"},
    {"nome": "Farmácia Saúde Total", "fantasia": "Saúde Total", "cnpj": "78.901.234/0001-56", "regime": "simples_nacional"},
    {"nome": "Clínica Odontológica Sorriso", "fantasia": "Clínica Sorriso", "cnpj": "89.012.345/0001-67", "regime": "lucro_presumido"},
    {"nome": "Academia Corpo em Forma", "fantasia": "Corpo em Forma", "cnpj": "90.123.456/0001-78", "regime": "simples_nacional"},
    {"nome": "Transportadora Rápida Ltda", "fantasia": "Rápida Transportes", "cnpj": "01.234.567/0001-89", "regime": "lucro_presumido"},
]

async def criar_clientes():
    """Criar clientes de exemplo"""
    print("\n📋 Criando clientes...")
    
    async with DatabaseAdapter() as db:
        clientes_criados = 0
        
        for i, emp in enumerate(EMPRESAS_EXEMPLO):
            cidade = random.choice(CIDADES)
            cliente = {
                "id": str(uuid.uuid4()),
                "nome_empresa": emp["nome"],
                "nome_fantasia": emp["fantasia"],
                "cnpj": emp["cnpj"],
                "status_empresa": "ativa" if i < 8 else "inativa",
                "cidade_atendimento": cidade,
                "telefone": f"(11) 9{random.randint(1000,9999)}-{random.randint(1000,9999)}",
                "whatsapp": f"(11) 9{random.randint(1000,9999)}-{random.randint(1000,9999)}",
                "email": f"contato@{emp['fantasia'].lower().replace(' ', '')}.com.br",
                "responsavel_empresa": f"Responsável {i+1}",
                "tipo_regime": emp["regime"],
                "tipo_empresa": "matriz",
                "novo_cliente": i >= 7,
                "forma_envio": random.choice(["email", "whatsapp", "impresso"]),
                "endereco_logradouro": f"Rua Exemplo, {random.randint(100, 999)}",
                "endereco_bairro": "Centro",
                "endereco_cidade": cidade,
                "endereco_estado": "SP",
                "endereco_cep": f"{random.randint(10000,99999)}-{random.randint(100,999)}",
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }
            
            await db.insert_one("clients", cliente)
            clientes_criados += 1
        
        print(f"   ✅ {clientes_criados} clientes criados")
        return EMPRESAS_EXEMPLO

async def criar_contas_receber(empresas):
    """Criar contas a receber de exemplo"""
    print("\n💰 Criando contas a receber...")
    
    async with DatabaseAdapter() as db:
        contas_criadas = 0
        situacoes = ["em_aberto", "pago", "atrasado", "atrasado", "em_aberto"]
        
        for i, emp in enumerate(empresas):
            # Criar 2-3 contas por empresa
            num_contas = random.randint(2, 3)
            
            for j in range(num_contas):
                dias_venc = random.randint(-30, 60)
                data_venc = date.today() + timedelta(days=dias_venc)
                data_emissao = data_venc - timedelta(days=random.randint(5, 15))
                
                situacao = situacoes[random.randint(0, len(situacoes)-1)]
                if dias_venc < -5:
                    situacao = "atrasado"
                elif dias_venc < 0 and random.random() > 0.5:
                    situacao = "pago"
                
                valor = random.choice([500.00, 750.00, 1000.00, 1500.00, 2000.00, 2500.00, 3000.00])
                
                conta = {
                    "id": str(uuid.uuid4()),
                    "empresa_id": str(uuid.uuid4()),
                    "empresa": emp["nome"],
                    "situacao": situacao,
                    "descricao": f"Honorários Contábeis - {data_venc.strftime('%m/%Y')}",
                    "documento": f"BOL-{random.randint(10000, 99999)}",
                    "tipo_documento": "boleto",
                    "forma_pagamento": random.choice(["boleto", "pix", "transferencia"]),
                    "conta": "Banco do Brasil - CC 12345-6",
                    "centro_custo": "Serviços Contábeis",
                    "plano_custo": "Receita de Serviços",
                    "data_emissao": datetime.combine(data_emissao, datetime.min.time()),
                    "data_vencimento": datetime.combine(data_venc, datetime.min.time()),
                    "data_recebimento": datetime.combine(data_venc + timedelta(days=random.randint(0, 5)), datetime.min.time()) if situacao == "pago" else None,
                    "valor_original": valor,
                    "desconto_aplicado": 0.0,
                    "acrescimo_aplicado": 0.0 if situacao != "atrasado" else valor * 0.02,
                    "valor_quitado": valor if situacao == "pago" else 0.0,
                    "troco": 0.0,
                    "total_bruto": valor,
                    "total_liquido": valor if situacao != "atrasado" else valor * 1.02,
                    "cidade_atendimento": random.choice(CIDADES),
                    "usuario_responsavel": "Administrador",
                    "observacao": f"Conta {j+1} da empresa {emp['fantasia']}",
                    "created_at": datetime.utcnow(),
                    "updated_at": datetime.utcnow()
                }
                
                await db.insert_one("contas_receber", conta)
                contas_criadas += 1
        
        print(f"   ✅ {contas_criadas} contas a receber criadas")

async def criar_obrigacoes_fiscais(empresas):
    """Criar obrigações fiscais de exemplo"""
    print("\n📊 Criando obrigações fiscais...")
    
    async with DatabaseAdapter() as db:
        obrigacoes_criadas = 0
        tipos_obrigacao = [
            ("pgdas", "PGDAS - Programa Gerador DAS"),
            ("sped_fiscal", "SPED Fiscal"),
            ("dctf", "DCTF - Declaração de Débitos"),
            ("defis", "DEFIS - Declaração Anual Simples"),
            ("gfip", "GFIP - Guia FGTS"),
        ]
        
        for emp in empresas[:5]:  # Apenas 5 empresas
            tipo, descricao = random.choice(tipos_obrigacao)
            
            # Próximo vencimento
            hoje = date.today()
            proximo_venc = date(hoje.year, hoje.month, 20)
            if proximo_venc < hoje:
                if hoje.month == 12:
                    proximo_venc = date(hoje.year + 1, 1, 20)
                else:
                    proximo_venc = date(hoje.year, hoje.month + 1, 20)
            
            obrigacao = {
                "id": str(uuid.uuid4()),
                "empresa_id": str(uuid.uuid4()),
                "empresa": emp["nome"],
                "tipo": tipo,
                "tipo_obrigacao": tipo,
                "nome": descricao,
                "descricao": descricao,
                "periodicidade": "mensal",
                "dia_vencimento": 20,
                "proximo_vencimento": datetime.combine(proximo_venc, datetime.min.time()),
                "responsavel": "Contador Responsável",
                "status": random.choice(["pendente", "em_andamento", "entregue"]),
                "regime_tributario": emp["regime"],
                "observacoes": f"Obrigação {tipo.upper()} da empresa {emp['fantasia']}",
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }
            
            await db.insert_one("obrigacoes_fiscais", obrigacao)
            obrigacoes_criadas += 1
        
        print(f"   ✅ {obrigacoes_criadas} obrigações fiscais criadas")

async def criar_notas_fiscais(empresas):
    """Criar notas fiscais de exemplo"""
    print("\n🧾 Criando notas fiscais...")
    
    async with DatabaseAdapter() as db:
        notas_criadas = 0
        
        for i, emp in enumerate(empresas[:6]):
            # 1-2 notas por empresa
            num_notas = random.randint(1, 2)
            
            for j in range(num_notas):
                data_emissao = date.today() - timedelta(days=random.randint(1, 30))
                
                valor_total = random.choice([1500.00, 2500.00, 3500.00, 5000.00])
                nota = {
                    "id": str(uuid.uuid4()),
                    "empresa_id": str(uuid.uuid4()),
                    "empresa": emp["nome"],
                    "tipo": random.choice(["entrada", "saida"]),
                    "numero": random.randint(1000, 9999),
                    "serie": "1",
                    "chave_nfe": f"{random.randint(10000000, 99999999)}{random.randint(10000000, 99999999)}{random.randint(10000, 99999)}",
                    "data_emissao": datetime.combine(data_emissao, datetime.min.time()),
                    "emitente_cnpj": emp["cnpj"],
                    "emitente_razao_social": emp["nome"],
                    "destinatario_cnpj": "00.000.000/0000-00",
                    "destinatario_razao_social": "Cliente Exemplo",
                    "valor_total": valor_total,
                    "valor_produtos": valor_total,
                    "valor_servicos": 0.0,
                    "base_icms": 0.0,
                    "valor_icms": 0.0,
                    "base_ipi": 0.0,
                    "valor_ipi": 0.0,
                    "valor_pis": 0.0,
                    "valor_cofins": 0.0,
                    "valor_iss": 0.0,
                    "status_conciliacao": random.choice(["pendente", "conciliado"]),
                    "created_at": datetime.utcnow(),
                    "updated_at": datetime.utcnow()
                }
                
                await db.insert_one("notas_fiscais", nota)
                notas_criadas += 1
        
        print(f"   ✅ {notas_criadas} notas fiscais criadas")

async def criar_solicitacoes_trabalhistas(empresas):
    """Criar solicitações trabalhistas de exemplo"""
    print("\n👥 Criando solicitações trabalhistas...")
    
    async with DatabaseAdapter() as db:
        solicitacoes_criadas = 0
        tipos_solicitacao = ["admissao", "demissao", "folha_pagamento", "afastamento", "ferias"]
        
        for i, emp in enumerate(empresas[:5]):
            tipo = random.choice(tipos_solicitacao)
            dias_prazo = random.randint(5, 30)
            
            solicitacao = {
                "id": str(uuid.uuid4()),
                "empresa_id": str(uuid.uuid4()),
                "empresa": emp["nome"],
                "tipo": tipo,
                "titulo": f"Solicitação de {tipo.replace('_', ' ').title()} - {emp['fantasia']}",
                "descricao": f"Processar {tipo.replace('_', ' ')} para a empresa {emp['fantasia']}",
                "data_solicitacao": datetime.combine(date.today(), datetime.min.time()),
                "prazo": datetime.combine(date.today() + timedelta(days=dias_prazo), datetime.min.time()),
                "responsavel": "Setor Trabalhista",
                "status": random.choice(["pendente", "em_andamento", "concluido"]),
                "prioridade": random.choice(["alta", "media", "baixa"]),
                "observacoes": f"Solicitação {tipo} número {i+1}",
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }
            
            await db.insert_one("solicitacoes_trabalhistas", solicitacao)
            solicitacoes_criadas += 1
        
        print(f"   ✅ {solicitacoes_criadas} solicitações trabalhistas criadas")

async def criar_funcionarios(empresas):
    """Criar funcionários de exemplo"""
    print("\n👤 Criando funcionários...")
    
    async with DatabaseAdapter() as db:
        funcionarios_criados = 0
        nomes = ["João Silva", "Maria Santos", "Pedro Oliveira", "Ana Costa", "Carlos Ferreira", 
                 "Juliana Alves", "Roberto Lima", "Fernanda Souza", "Ricardo Martins", "Patricia Rocha"]
        funcoes = ["Vendedor", "Caixa", "Gerente", "Atendente", "Auxiliar Administrativo"]
        
        for i, emp in enumerate(empresas[:5]):
            # 2-3 funcionários por empresa
            num_funcionarios = random.randint(2, 3)
            
            for j in range(num_funcionarios):
                nome = random.choice(nomes)
                cpf = f"{random.randint(100,999)}.{random.randint(100,999)}.{random.randint(100,999)}-{random.randint(10,99)}"
                data_admissao = date.today() - timedelta(days=random.randint(30, 730))
                
                funcionario = {
                    "id": str(uuid.uuid4()),
                    "empresa_id": str(uuid.uuid4()),
                    "nome_completo": nome,
                    "cpf": cpf,
                    "rg": f"{random.randint(10,99)}.{random.randint(100,999)}.{random.randint(100,999)}-{random.randint(0,9)}",
                    "data_nascimento": datetime.combine(date(1980 + random.randint(0, 25), random.randint(1, 12), random.randint(1, 28)), datetime.min.time()),
                    "funcao": random.choice(funcoes),
                    "cargo": random.choice(funcoes),
                    "tipo_contrato": "clt",
                    "salario_base": random.choice([1500.00, 2000.00, 2500.00, 3000.00, 4000.00]),
                    "carga_horaria": 44,
                    "data_admissao": datetime.combine(data_admissao, datetime.min.time()),
                    "status": "ativo",
                    "telefone": f"(11) 9{random.randint(1000,9999)}-{random.randint(1000,9999)}",
                    "email": f"{nome.lower().replace(' ', '.')}@{emp['fantasia'].lower().replace(' ', '')}.com.br",
                    "created_at": datetime.utcnow(),
                    "updated_at": datetime.utcnow()
                }
                
                await db.insert_one("funcionarios", funcionario)
                funcionarios_criados += 1
        
        print(f"   ✅ {funcionarios_criados} funcionários criados")

async def criar_tickets_atendimento(empresas):
    """Criar tickets de atendimento de exemplo"""
    print("\n🎫 Criando tickets de atendimento...")
    
    async with DatabaseAdapter() as db:
        tickets_criados = 0
        assuntos = [
            "Dúvida sobre impostos",
            "Solicitação de certidões",
            "Alteração de dados cadastrais",
            "Dúvida sobre folha de pagamento",
            "Consulta sobre obrigações fiscais"
        ]
        
        for i, emp in enumerate(empresas[:6]):
            numero_ticket = 1000 + i
            assunto = random.choice(assuntos)
            
            ticket = {
                "id": str(uuid.uuid4()),
                "numero": numero_ticket,
                "empresa_id": str(uuid.uuid4()),
                "empresa": emp["nome"],
                "titulo": assunto,
                "descricao": f"Cliente {emp['fantasia']} solicitou ajuda com: {assunto.lower()}",
                "tipo": random.choice(["duvida", "solicitacao", "reclamacao"]),
                "prioridade": random.choice(["alta", "media", "baixa"]),
                "status": random.choice(["aberto", "em_andamento", "aguardando_cliente", "resolvido"]),
                "canal": random.choice(["email", "telefone", "whatsapp", "presencial"]),
                "responsavel": "Atendimento",
                "equipe": "Suporte",
                "data_abertura": datetime.utcnow() - timedelta(days=random.randint(0, 15)),
                "prazo_primeira_resposta": datetime.utcnow() + timedelta(hours=4),
                "prazo_resolucao": datetime.utcnow() + timedelta(days=2),
                "sla_primeira_resposta_violado": False,
                "sla_resolucao_violado": False,
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }
            
            await db.insert_one("tickets", ticket)
            tickets_criados += 1
        
        print(f"   ✅ {tickets_criados} tickets criados")

async def criar_servicos_comerciais(empresas):
    """Criar serviços comerciais de exemplo"""
    print("\n🛠️ Criando serviços comerciais...")
    
    async with DatabaseAdapter() as db:
        servicos_criados = 0
        tipos_servico = [
            ("Contabilidade Mensal", 1500.00),
            ("Assessoria Fiscal", 800.00),
            ("Folha de Pagamento", 600.00),
            ("Abertura de Empresa", 2500.00),
            ("Legalização", 1200.00),
        ]
        
        for i, emp in enumerate(empresas[:4]):
            tipo, valor = random.choice(tipos_servico)
            
            servico = {
                "id": str(uuid.uuid4()),
                "empresa_id": str(uuid.uuid4()),
                "empresa_nome": emp["nome"],
                "nome_servico": tipo,
                "descricao": f"Serviço de {tipo.lower()} para {emp['fantasia']}",
                "valor": valor,
                "tipo_cobranca": random.choice(["mensal", "avulso", "trimestral"]),
                "status": "ativo",
                "data_inicio": datetime.combine(date.today() - timedelta(days=random.randint(30, 180)), datetime.min.time()),
                "responsavel": "Comercial",
                "observacoes": f"Contrato de {tipo.lower()}",
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }
            
            await db.insert_one("servicos_comerciais", servico)
            servicos_criados += 1
        
        print(f"   ✅ {servicos_criados} serviços comerciais criados")

async def criar_agendamentos(empresas):
    """Criar agendamentos de exemplo"""
    print("\n📅 Criando agendamentos...")
    
    async with DatabaseAdapter() as db:
        agendamentos_criados = 0
        contadores = ["João Contador", "Maria Contadora", "Carlos Contador"]
        
        for i in range(8):
            dias_futuro = random.randint(1, 15)
            hora = random.randint(8, 17)
            
            agendamento = {
                "id": str(uuid.uuid4()),
                "empresa_id": str(uuid.uuid4()),
                "empresa": random.choice(EMPRESAS_EXEMPLO)["nome"],
                "cliente_nome": f"Cliente {i+1}",
                "cliente_telefone": f"(11) 9{random.randint(1000,9999)}-{random.randint(1000,9999)}",
                "cliente_email": f"cliente{i+1}@email.com",
                "data_agendamento": datetime.combine(date.today() + timedelta(days=dias_futuro), datetime.min.time().replace(hour=hora)),
                "tipo_atendimento": random.choice(["presencial", "online", "telefone"]),
                "contador_responsavel": random.choice(contadores),
                "motivo": random.choice([
                    "Entrega de documentos",
                    "Consultoria fiscal",
                    "Revisão contábil",
                    "Planejamento tributário",
                    "Dúvidas gerais"
                ]),
                "status": random.choice(["pendente", "confirmado", "realizado"]),
                "cidade": random.choice(CIDADES),
                "observacoes": f"Agendamento {i+1}",
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }
            
            await db.insert_one("agendamentos", agendamento)
            agendamentos_criados += 1
        
        print(f"   ✅ {agendamentos_criados} agendamentos criados")

async def criar_servicos_tarefas():
    """Criar serviços/tarefas de exemplo"""
    print("\n📋 Criando serviços/tarefas...")
    
    async with DatabaseAdapter() as db:
        servicos_criados = 0
        setores = ["contabil", "fiscal", "trabalhista", "financeiro"]
        
        for i in range(10):
            setor = random.choice(setores)
            dias_prazo = random.randint(-5, 20)
            
            servico = {
                "id": str(uuid.uuid4()),
                "empresa_id": str(uuid.uuid4()),
                "empresa": random.choice(EMPRESAS_EXEMPLO)["nome"],
                "titulo": f"Tarefa {i+1} - {setor.title()}",
                "descricao": f"Descrição detalhada da tarefa {i+1} do setor {setor}",
                "setor": setor,
                "status": random.choice(["nova", "pendente", "em_andamento", "concluida", "atrasada"]),
                "prioridade": random.choice(["alta", "media", "baixa"]),
                "responsavel": f"Colaborador {random.randint(1, 5)}",
                "prazo": datetime.combine(date.today() + timedelta(days=dias_prazo), datetime.min.time()),
                "cidade": random.choice(CIDADES),
                "observacoes": f"Observações da tarefa {i+1}",
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }
            
            await db.insert_one("tasks", servico)
            servicos_criados += 1
        
        print(f"   ✅ {servicos_criados} tarefas criadas")

async def main():
    """Executar população do banco"""
    print("=" * 60)
    print("🚀 POPULANDO BANCO DE DADOS COM EXEMPLOS")
    print("=" * 60)
    
    try:
        # Criar empresas primeiro
        empresas = await criar_clientes()
        
        # Criar dados para cada módulo
        await criar_contas_receber(empresas)
        await criar_obrigacoes_fiscais(empresas)
        await criar_notas_fiscais(empresas)
        await criar_solicitacoes_trabalhistas(empresas)
        await criar_funcionarios(empresas)
        await criar_tickets_atendimento(empresas)
        await criar_servicos_comerciais(empresas)
        await criar_agendamentos(empresas)
        await criar_servicos_tarefas()
        
        print("\n" + "=" * 60)
        print("✅ POPULAÇÃO DO BANCO CONCLUÍDA COM SUCESSO!")
        print("=" * 60)
        
    except Exception as e:
        print(f"\n❌ Erro durante população: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
