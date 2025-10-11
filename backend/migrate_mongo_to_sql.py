"""
Script de migração de dados do MongoDB para SQLite
Lê todos os dados do MongoDB e insere no SQLite mantendo integridade
"""
import asyncio
import json
from datetime import datetime, date
from motor.motor_asyncio import AsyncIOMotorClient
from sqlalchemy.ext.asyncio import AsyncSession
from database_sql import AsyncSessionLocal, init_db, engine
from models_sql import (
    UserSQL, ClientSQL, FinancialClientSQL, ContaReceberSQL,
    HistoricoAlteracaoSQL, ContatoCobrancaSQL, AnexoSQL,
    ImportacaoExtratoSQL, MovimentoExtratoSQL,
    SolicitacaoTrabalhistaSQL, FuncionarioSQL, ObrigacaoTrabalhistaSQL,
    ChecklistTrabalhistaSQL, ObrigacaoFiscalSQL, NotaFiscalSQL,
    ApuracaoFiscalSQL, TicketSQL, ConversaSQL, ArtigoBaseConhecimentoSQL,
    AvaliacaoAtendimentoSQL, ConfiguracaoSQL, ChatSQL, TaskSQL
)
import os
from pathlib import Path
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
MONGO_URL = os.environ['MONGO_URL']
DB_NAME = os.environ['DB_NAME']

# Helpers
def convert_date(value):
    """Convert date/datetime to proper format"""
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.date() if hasattr(value, 'date') else value
    if isinstance(value, date):
        return value
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value.replace('Z', '+00:00'))
        except:
            return None
    return value

def convert_datetime(value):
    """Convert datetime"""
    if value is None:
        return None
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value.replace('Z', '+00:00'))
        except:
            return None
    return value

def json_dumps(value):
    """Convert list/dict to JSON string"""
    if value is None:
        return None
    if isinstance(value, (list, dict)):
        return json.dumps(value, default=str, ensure_ascii=False)
    return value

class MongoToSQLMigration:
    def __init__(self):
        self.mongo_client = None
        self.mongo_db = None
        self.stats = {}
    
    async def connect_mongo(self):
        """Connect to MongoDB"""
        self.mongo_client = AsyncIOMotorClient(MONGO_URL)
        self.mongo_db = self.mongo_client[DB_NAME]
        print(f"✓ Connected to MongoDB: {DB_NAME}")
    
    async def close_mongo(self):
        """Close MongoDB connection"""
        if self.mongo_client:
            self.mongo_client.close()
            print("✓ Disconnected from MongoDB")
    
    async def migrate_users(self, session: AsyncSession):
        """Migrate users collection"""
        print("\n[1/18] Migrating users...")
        collection = self.mongo_db.users
        count = 0
        
        async for doc in collection.find():
            user = UserSQL(
                id=doc.get('id'),
                email=doc.get('email'),
                name=doc.get('name'),
                password_hash=doc.get('password_hash'),
                role=doc.get('role'),
                allowed_cities=json_dumps(doc.get('allowed_cities', [])),
                allowed_sectors=json_dumps(doc.get('allowed_sectors', [])),
                is_active=doc.get('is_active', True),
                created_at=convert_datetime(doc.get('created_at')),
                updated_at=convert_datetime(doc.get('updated_at'))
            )
            session.add(user)
            count += 1
        
        await session.commit()
        self.stats['users'] = count
        print(f"  ✓ Migrated {count} users")
    
    async def migrate_clients(self, session: AsyncSession):
        """Migrate clients collection"""
        print("\n[2/18] Migrating clients...")
        collection = self.mongo_db.clients
        count = 0
        
        async for doc in collection.find():
            endereco = doc.get('endereco', {})
            client = ClientSQL(
                id=doc.get('id'),
                nome_empresa=doc.get('nome_empresa'),
                nome_fantasia=doc.get('nome_fantasia'),
                status_empresa=doc.get('status_empresa', 'ativa'),
                cidade_atendimento=doc.get('cidade_atendimento'),
                telefone=doc.get('telefone'),
                whatsapp=doc.get('whatsapp'),
                email=doc.get('email'),
                responsavel_empresa=doc.get('responsavel_empresa'),
                cnpj=doc.get('cnpj'),
                codigo_iob=doc.get('codigo_iob'),
                novo_cliente=doc.get('novo_cliente', False),
                tipo_empresa=doc.get('tipo_empresa', 'matriz'),
                tipo_regime=doc.get('tipo_regime'),
                endereco_logradouro=endereco.get('logradouro'),
                endereco_numero=endereco.get('numero'),
                endereco_complemento=endereco.get('complemento'),
                endereco_bairro=endereco.get('bairro'),
                endereco_distrito=endereco.get('distrito'),
                endereco_cep=endereco.get('cep'),
                endereco_cidade=endereco.get('cidade'),
                endereco_estado=endereco.get('estado'),
                forma_envio=doc.get('forma_envio', 'email'),
                empresa_grupo=doc.get('empresa_grupo'),
                created_at=convert_datetime(doc.get('created_at')),
                updated_at=convert_datetime(doc.get('updated_at'))
            )
            session.add(client)
            count += 1
        
        await session.commit()
        self.stats['clients'] = count
        print(f"  ✓ Migrated {count} clients")
    
    async def migrate_financial_clients(self, session: AsyncSession):
        """Migrate financial_clients collection"""
        print("\n[3/18] Migrating financial clients...")
        collection = self.mongo_db.financial_clients
        count = 0
        
        async for doc in collection.find():
            fc = FinancialClientSQL(
                id=doc.get('id'),
                empresa_id=doc.get('empresa_id'),
                empresa=doc.get('empresa'),
                valor_com_desconto=doc.get('valor_com_desconto'),
                valor_boleto=doc.get('valor_boleto'),
                dia_vencimento=doc.get('dia_vencimento'),
                tipo_honorario=doc.get('tipo_honorario'),
                empresa_individual_grupo=doc.get('empresa_individual_grupo'),
                contas_pagamento=json_dumps(doc.get('contas_pagamento', [])),
                tipo_pagamento=doc.get('tipo_pagamento'),
                forma_pagamento_especial=doc.get('forma_pagamento_especial'),
                tipo_empresa=doc.get('tipo_empresa'),
                ultimo_pagamento=convert_date(doc.get('ultimo_pagamento')),
                status_pagamento=doc.get('status_pagamento', 'em_dia'),
                observacoes=doc.get('observacoes'),
                created_at=convert_datetime(doc.get('created_at')),
                updated_at=convert_datetime(doc.get('updated_at'))
            )
            session.add(fc)
            count += 1
        
        await session.commit()
        self.stats['financial_clients'] = count
        print(f"  ✓ Migrated {count} financial clients")
    
    async def migrate_contas_receber(self, session: AsyncSession):
        """Migrate contas_receber collection with related data"""
        print("\n[4/18] Migrating contas a receber...")
        collection = self.mongo_db.contas_receber
        count = 0
        count_historico = 0
        count_contatos = 0
        count_anexos = 0
        
        async for doc in collection.find():
            # Main conta
            conta = ContaReceberSQL(
                id=doc.get('id'),
                empresa_id=doc.get('empresa_id'),
                empresa=doc.get('empresa'),
                situacao=doc.get('situacao', 'em_aberto'),
                descricao=doc.get('descricao'),
                documento=doc.get('documento'),
                tipo_documento=doc.get('tipo_documento', 'boleto'),
                forma_pagamento=doc.get('forma_pagamento'),
                conta=doc.get('conta'),
                centro_custo=doc.get('centro_custo'),
                plano_custo=doc.get('plano_custo'),
                data_emissao=convert_date(doc.get('data_emissao')),
                data_vencimento=convert_date(doc.get('data_vencimento')),
                data_recebimento=convert_date(doc.get('data_recebimento')),
                valor_original=doc.get('valor_original'),
                desconto_aplicado=doc.get('desconto_aplicado', 0.0),
                acrescimo_aplicado=doc.get('acrescimo_aplicado', 0.0),
                valor_quitado=doc.get('valor_quitado', 0.0),
                troco=doc.get('troco', 0.0),
                total_bruto=doc.get('total_bruto'),
                total_liquido=doc.get('total_liquido'),
                cidade_atendimento=doc.get('cidade_atendimento'),
                usuario_responsavel=doc.get('usuario_responsavel'),
                observacao=doc.get('observacao'),
                created_at=convert_datetime(doc.get('created_at')),
                updated_at=convert_datetime(doc.get('updated_at'))
            )
            session.add(conta)
            count += 1
            
            # Histórico
            for hist in doc.get('historico_alteracoes', []):
                historico = HistoricoAlteracaoSQL(
                    conta_id=doc.get('id'),
                    data=convert_datetime(hist.get('data')),
                    acao=hist.get('acao'),
                    usuario=hist.get('usuario'),
                    campo_alterado=hist.get('campo_alterado'),
                    valor_anterior=hist.get('valor_anterior'),
                    valor_novo=hist.get('valor_novo'),
                    observacao=hist.get('observacao')
                )
                session.add(historico)
                count_historico += 1
            
            # Contatos de cobrança
            for contato in doc.get('contatos_cobranca', []):
                contato_obj = ContatoCobrancaSQL(
                    id=contato.get('id'),
                    conta_id=doc.get('id'),
                    data_contato=convert_datetime(contato.get('data_contato')),
                    tipo_contato=contato.get('tipo_contato'),
                    usuario_responsavel=contato.get('usuario_responsavel'),
                    observacao=contato.get('observacao'),
                    resultado=contato.get('resultado')
                )
                session.add(contato_obj)
                count_contatos += 1
            
            # Anexos
            for anexo in doc.get('anexos', []):
                anexo_obj = AnexoSQL(
                    id=anexo.get('id'),
                    conta_id=doc.get('id'),
                    nome_arquivo=anexo.get('nome_arquivo'),
                    tipo_arquivo=anexo.get('tipo_arquivo'),
                    caminho_arquivo=anexo.get('caminho_arquivo'),
                    tamanho_arquivo=anexo.get('tamanho_arquivo'),
                    data_upload=convert_datetime(anexo.get('data_upload')),
                    usuario_upload=anexo.get('usuario_upload')
                )
                session.add(anexo_obj)
                count_anexos += 1
        
        await session.commit()
        self.stats['contas_receber'] = count
        self.stats['historico_alteracoes'] = count_historico
        self.stats['contatos_cobranca'] = count_contatos
        self.stats['anexos'] = count_anexos
        print(f"  ✓ Migrated {count} contas a receber")
        print(f"    - {count_historico} histórico alterações")
        print(f"    - {count_contatos} contatos cobrança")
        print(f"    - {count_anexos} anexos")
    
    async def migrate_importacoes_extrato(self, session: AsyncSession):
        """Migrate importacoes_extrato collection"""
        print("\n[5/18] Migrating importações de extrato...")
        collection = self.mongo_db.importacoes_extrato
        count = 0
        count_movimentos = 0
        
        async for doc in collection.find():
            importacao = ImportacaoExtratoSQL(
                id=doc.get('id'),
                nome_arquivo=doc.get('nome_arquivo'),
                tipo_arquivo=doc.get('tipo_arquivo'),
                conta_bancaria=doc.get('conta_bancaria'),
                cidade=doc.get('cidade'),
                usuario_responsavel=doc.get('usuario_responsavel'),
                data_importacao=convert_datetime(doc.get('data_importacao')),
                total_movimentos=doc.get('total_movimentos', 0),
                movimentos_processados=doc.get('movimentos_processados', 0),
                baixas_automaticas=doc.get('baixas_automaticas', 0),
                pendentes_classificacao=doc.get('pendentes_classificacao', 0),
                status=doc.get('status', 'processando'),
                log_processamento=json_dumps(doc.get('log_processamento', []))
            )
            session.add(importacao)
            count += 1
            
            # Movimentos
            for mov in doc.get('movimentos', []):
                movimento = MovimentoExtratoSQL(
                    id=mov.get('id'),
                    importacao_id=doc.get('id'),
                    data_movimento=convert_date(mov.get('data_movimento')),
                    descricao_original=mov.get('descricao_original'),
                    descricao_processada=mov.get('descricao_processada'),
                    valor=mov.get('valor'),
                    tipo_movimento=mov.get('tipo_movimento'),
                    saldo=mov.get('saldo'),
                    cnpj_detectado=mov.get('cnpj_detectado'),
                    empresa_sugerida=mov.get('empresa_sugerida'),
                    titulo_sugerido=mov.get('titulo_sugerido'),
                    score_match=mov.get('score_match'),
                    status_classificacao=mov.get('status_classificacao', 'pendente'),
                    classificado_por=mov.get('classificado_por'),
                    data_classificacao=convert_datetime(mov.get('data_classificacao'))
                )
                session.add(movimento)
                count_movimentos += 1
        
        await session.commit()
        self.stats['importacoes_extrato'] = count
        self.stats['movimentos_extrato'] = count_movimentos
        print(f"  ✓ Migrated {count} importações de extrato")
        print(f"    - {count_movimentos} movimentos")
    
    async def migrate_trabalhista(self, session: AsyncSession):
        """Migrate trabalhista collections"""
        print("\n[6/18] Migrating solicitações trabalhistas...")
        collection = self.mongo_db.trabalhista
        count = 0
        
        async for doc in collection.find():
            solicitacao = SolicitacaoTrabalhistaSQL(
                id=doc.get('id'),
                empresa_id=doc.get('empresa_id'),
                empresa=doc.get('empresa'),
                tipo=doc.get('tipo'),
                titulo=doc.get('titulo'),
                descricao=doc.get('descricao'),
                data_solicitacao=convert_date(doc.get('data_solicitacao')),
                prazo=convert_date(doc.get('prazo')),
                responsavel=doc.get('responsavel'),
                status=doc.get('status', 'pendente'),
                prioridade=doc.get('prioridade', 'media'),
                funcionario_id=doc.get('funcionario_id'),
                tipo_afastamento=doc.get('tipo_afastamento'),
                periodo_afastamento=json_dumps(doc.get('periodo_afastamento')),
                detalhes_folha=json_dumps(doc.get('detalhes_folha')),
                documentos_anexos=json_dumps(doc.get('documentos_anexos', [])),
                documentos_necessarios=json_dumps(doc.get('documentos_necessarios', [])),
                checklist_id=doc.get('checklist_id'),
                checklist_items=json_dumps(doc.get('checklist_items', [])),
                observacoes=doc.get('observacoes'),
                historico_alteracoes=json_dumps(doc.get('historico_alteracoes', [])),
                created_at=convert_datetime(doc.get('created_at')),
                updated_at=convert_datetime(doc.get('updated_at'))
            )
            session.add(solicitacao)
            count += 1
        
        await session.commit()
        self.stats['solicitacoes_trabalhistas'] = count
        print(f"  ✓ Migrated {count} solicitações trabalhistas")
    
    async def migrate_funcionarios(self, session: AsyncSession):
        """Migrate funcionarios collection"""
        print("\n[7/18] Migrating funcionários...")
        collection = self.mongo_db.funcionarios
        count = 0
        
        async for doc in collection.find():
            dados_pessoais = doc.get('dados_pessoais', {})
            dados_contratuais = doc.get('dados_contratuais', {})
            
            funcionario = FuncionarioSQL(
                id=doc.get('id'),
                empresa_id=doc.get('empresa_id'),
                nome_completo=dados_pessoais.get('nome_completo'),
                cpf=dados_pessoais.get('cpf'),
                rg=dados_pessoais.get('rg'),
                data_nascimento=convert_date(dados_pessoais.get('data_nascimento')),
                estado_civil=dados_pessoais.get('estado_civil'),
                endereco=dados_pessoais.get('endereco'),
                telefone=dados_pessoais.get('telefone'),
                email=dados_pessoais.get('email'),
                nome_mae=dados_pessoais.get('nome_mae'),
                nome_pai=dados_pessoais.get('nome_pai'),
                funcao=dados_contratuais.get('funcao'),
                cargo=dados_contratuais.get('cargo'),
                tipo_contrato=dados_contratuais.get('tipo_contrato', 'clt'),
                salario_base=dados_contratuais.get('salario_base'),
                carga_horaria=dados_contratuais.get('carga_horaria'),
                data_admissao=convert_date(dados_contratuais.get('data_admissao')),
                data_demissao=convert_date(dados_contratuais.get('data_demissao')),
                motivo_demissao=dados_contratuais.get('motivo_demissao'),
                setor=dados_contratuais.get('setor'),
                centro_custo=dados_contratuais.get('centro_custo'),
                status=doc.get('status', 'ativo'),
                observacoes=doc.get('observacoes'),
                documentos_anexos=json_dumps(doc.get('documentos_anexos', [])),
                historico_alteracoes=json_dumps(doc.get('historico_alteracoes', [])),
                created_at=convert_datetime(doc.get('created_at')),
                updated_at=convert_datetime(doc.get('updated_at'))
            )
            session.add(funcionario)
            count += 1
        
        await session.commit()
        self.stats['funcionarios'] = count
        print(f"  ✓ Migrated {count} funcionários")
    
    async def migrate_obrigacoes_trabalhistas(self, session: AsyncSession):
        """Migrate obrigacoes_trabalhistas collection"""
        print("\n[8/18] Migrating obrigações trabalhistas...")
        collection = self.mongo_db.obrigacoes_trabalhistas
        count = 0
        
        async for doc in collection.find():
            obrigacao = ObrigacaoTrabalhistaSQL(
                id=doc.get('id'),
                empresa_id=doc.get('empresa_id'),
                nome=doc.get('nome'),
                descricao=doc.get('descricao'),
                periodicidade=doc.get('periodicidade'),
                dia_vencimento=doc.get('dia_vencimento'),
                proximo_vencimento=convert_date(doc.get('proximo_vencimento')),
                status=doc.get('status', 'pendente'),
                responsavel=doc.get('responsavel'),
                observacoes=doc.get('observacoes'),
                arquivos_entrega=json_dumps(doc.get('arquivos_entrega', [])),
                historico_entregas=json_dumps(doc.get('historico_entregas', [])),
                created_at=convert_datetime(doc.get('created_at')),
                updated_at=convert_datetime(doc.get('updated_at'))
            )
            session.add(obrigacao)
            count += 1
        
        await session.commit()
        self.stats['obrigacoes_trabalhistas'] = count
        print(f"  ✓ Migrated {count} obrigações trabalhistas")
    
    async def migrate_checklists_trabalhistas(self, session: AsyncSession):
        """Migrate checklists_trabalhistas collection"""
        print("\n[9/18] Migrating checklists trabalhistas...")
        collection = self.mongo_db.checklists_trabalhistas
        count = 0
        
        async for doc in collection.find():
            checklist = ChecklistTrabalhistaSQL(
                id=doc.get('id'),
                tipo_processo=doc.get('tipo_processo'),
                nome=doc.get('nome'),
                descricao=doc.get('descricao'),
                itens=json_dumps(doc.get('itens', [])),
                template=doc.get('template', False),
                created_at=convert_datetime(doc.get('created_at'))
            )
            session.add(checklist)
            count += 1
        
        await session.commit()
        self.stats['checklists_trabalhistas'] = count
        print(f"  ✓ Migrated {count} checklists trabalhistas")
    
    async def migrate_fiscal(self, session: AsyncSession):
        """Migrate fiscal (obrigações fiscais) collection"""
        print("\n[10/18] Migrating obrigações fiscais...")
        collection = self.mongo_db.fiscal
        count = 0
        
        async for doc in collection.find():
            obrigacao = ObrigacaoFiscalSQL(
                id=doc.get('id'),
                empresa_id=doc.get('empresa_id'),
                empresa=doc.get('empresa'),
                tipo=doc.get('tipo'),
                nome=doc.get('nome'),
                descricao=doc.get('descricao'),
                periodicidade=doc.get('periodicidade'),
                dia_vencimento=doc.get('dia_vencimento'),
                proximo_vencimento=convert_date(doc.get('proximo_vencimento')),
                ultimo_vencimento=convert_date(doc.get('ultimo_vencimento')),
                status=doc.get('status', 'pendente'),
                responsavel=doc.get('responsavel'),
                regime_tributario=doc.get('regime_tributario'),
                protocolo_entrega=doc.get('protocolo_entrega'),
                data_entrega=convert_date(doc.get('data_entrega')),
                arquivo_enviado=doc.get('arquivo_enviado'),
                comprovante_entrega=doc.get('comprovante_entrega'),
                observacoes=doc.get('observacoes'),
                valor=doc.get('valor'),
                documentos=json_dumps(doc.get('documentos', [])),
                vencimento=convert_date(doc.get('vencimento')),
                historico_entregas=json_dumps(doc.get('historico_entregas', [])),
                created_at=convert_datetime(doc.get('created_at')),
                updated_at=convert_datetime(doc.get('updated_at'))
            )
            session.add(obrigacao)
            count += 1
        
        await session.commit()
        self.stats['obrigacoes_fiscais'] = count
        print(f"  ✓ Migrated {count} obrigações fiscais")
    
    async def migrate_notas_fiscais(self, session: AsyncSession):
        """Migrate notas_fiscais collection"""
        print("\n[11/18] Migrating notas fiscais...")
        collection = self.mongo_db.notas_fiscais
        count = 0
        
        async for doc in collection.find():
            nota = NotaFiscalSQL(
                id=doc.get('id'),
                empresa_id=doc.get('empresa_id'),
                empresa=doc.get('empresa'),
                tipo=doc.get('tipo'),
                numero=doc.get('numero'),
                serie=doc.get('serie'),
                chave_nfe=doc.get('chave_nfe'),
                data_emissao=convert_date(doc.get('data_emissao')),
                data_vencimento=convert_date(doc.get('data_vencimento')),
                emitente_cnpj=doc.get('emitente_cnpj'),
                emitente_razao_social=doc.get('emitente_razao_social'),
                destinatario_cnpj=doc.get('destinatario_cnpj'),
                destinatario_razao_social=doc.get('destinatario_razao_social'),
                valor_total=doc.get('valor_total'),
                valor_produtos=doc.get('valor_produtos'),
                valor_servicos=doc.get('valor_servicos', 0.0),
                base_icms=doc.get('base_icms', 0.0),
                valor_icms=doc.get('valor_icms', 0.0),
                base_ipi=doc.get('base_ipi', 0.0),
                valor_ipi=doc.get('valor_ipi', 0.0),
                valor_pis=doc.get('valor_pis', 0.0),
                valor_cofins=doc.get('valor_cofins', 0.0),
                valor_iss=doc.get('valor_iss', 0.0),
                impostos=json_dumps(doc.get('impostos', [])),
                status_conciliacao=doc.get('status_conciliacao', 'nao_conciliado'),
                conciliado_com=doc.get('conciliado_com'),
                data_conciliacao=convert_datetime(doc.get('data_conciliacao')),
                arquivo_xml=doc.get('arquivo_xml'),
                arquivo_pdf=doc.get('arquivo_pdf'),
                cfop=doc.get('cfop'),
                natureza_operacao=doc.get('natureza_operacao'),
                created_at=convert_datetime(doc.get('created_at')),
                updated_at=convert_datetime(doc.get('updated_at'))
            )
            session.add(nota)
            count += 1
        
        await session.commit()
        self.stats['notas_fiscais'] = count
        print(f"  ✓ Migrated {count} notas fiscais")
    
    async def migrate_apuracoes_fiscais(self, session: AsyncSession):
        """Migrate apuracoes_fiscais collection"""
        print("\n[12/18] Migrating apurações fiscais...")
        collection = self.mongo_db.apuracoes_fiscais
        count = 0
        
        async for doc in collection.find():
            apuracao = ApuracaoFiscalSQL(
                id=doc.get('id'),
                empresa_id=doc.get('empresa_id'),
                periodo=doc.get('periodo'),
                regime_tributario=doc.get('regime_tributario'),
                icms=doc.get('icms', 0.0),
                ipi=doc.get('ipi', 0.0),
                pis=doc.get('pis', 0.0),
                cofins=doc.get('cofins', 0.0),
                iss=doc.get('iss', 0.0),
                irpj=doc.get('irpj', 0.0),
                csll=doc.get('csll', 0.0),
                total_impostos=doc.get('total_impostos', 0.0),
                created_at=convert_datetime(doc.get('created_at')),
                updated_at=convert_datetime(doc.get('updated_at'))
            )
            session.add(apuracao)
            count += 1
        
        await session.commit()
        self.stats['apuracoes_fiscais'] = count
        print(f"  ✓ Migrated {count} apurações fiscais")
    
    async def migrate_tickets(self, session: AsyncSession):
        """Migrate atendimento (tickets) collection"""
        print("\n[13/18] Migrating tickets...")
        collection = self.mongo_db.atendimento
        count = 0
        count_conversas = 0
        
        async for doc in collection.find():
            ticket = TicketSQL(
                id=doc.get('id'),
                numero=doc.get('numero'),
                empresa_id=doc.get('empresa_id'),
                empresa=doc.get('empresa'),
                solicitante_nome=doc.get('solicitante_nome'),
                solicitante_email=doc.get('solicitante_email'),
                solicitante_telefone=doc.get('solicitante_telefone'),
                titulo=doc.get('titulo'),
                descricao=doc.get('descricao'),
                tipo=doc.get('tipo', 'duvida'),
                categoria=doc.get('categoria'),
                prioridade=doc.get('prioridade', 'media'),
                status=doc.get('status', 'aberto'),
                responsavel=doc.get('responsavel'),
                equipe=doc.get('equipe'),
                canal=doc.get('canal'),
                data_abertura=convert_date(doc.get('data_abertura')),
                data_primeira_resposta=convert_datetime(doc.get('data_primeira_resposta')),
                data_resolucao=convert_datetime(doc.get('data_resolucao')),
                data_fechamento=convert_datetime(doc.get('data_fechamento')),
                sla=convert_datetime(doc.get('sla')),
                prazo_primeira_resposta=convert_datetime(doc.get('prazo_primeira_resposta')),
                prazo_resolucao=convert_datetime(doc.get('prazo_resolucao')),
                sla_primeira_resposta_violado=doc.get('sla_primeira_resposta_violado', False),
                sla_resolucao_violado=doc.get('sla_resolucao_violado', False),
                tempo_primeira_resposta=doc.get('tempo_primeira_resposta'),
                tempo_resolucao=doc.get('tempo_resolucao'),
                solucao=doc.get('solucao'),
                satisfacao_cliente=doc.get('satisfacao_cliente'),
                feedback_cliente=doc.get('feedback_cliente'),
                tags=json_dumps(doc.get('tags', [])),
                tickets_relacionados=json_dumps(doc.get('tickets_relacionados', [])),
                documentos_relacionados=json_dumps(doc.get('documentos_relacionados', [])),
                arquivos=json_dumps(doc.get('arquivos', [])),
                historico_status=json_dumps(doc.get('historico_status', [])),
                created_at=convert_datetime(doc.get('created_at')),
                updated_at=convert_datetime(doc.get('updated_at'))
            )
            session.add(ticket)
            count += 1
            
            # Conversas
            for conv in doc.get('conversas', []):
                conversa = ConversaSQL(
                    id=conv.get('id'),
                    ticket_id=doc.get('id'),
                    data=convert_datetime(conv.get('data')),
                    usuario=conv.get('usuario'),
                    mensagem=conv.get('mensagem'),
                    tipo=conv.get('tipo', 'resposta'),
                    eh_cliente=conv.get('eh_cliente', False),
                    eh_publico=conv.get('eh_publico', True),
                    anexos=json_dumps(conv.get('anexos', [])),
                    editado=conv.get('editado', False),
                    data_edicao=convert_datetime(conv.get('data_edicao'))
                )
                session.add(conversa)
                count_conversas += 1
        
        await session.commit()
        self.stats['tickets'] = count
        self.stats['conversas'] = count_conversas
        print(f"  ✓ Migrated {count} tickets")
        print(f"    - {count_conversas} conversas")
    
    async def migrate_base_conhecimento(self, session: AsyncSession):
        """Migrate base_conhecimento collection"""
        print("\n[14/18] Migrating base de conhecimento...")
        collection = self.mongo_db.base_conhecimento
        count = 0
        
        async for doc in collection.find():
            artigo = ArtigoBaseConhecimentoSQL(
                id=doc.get('id'),
                titulo=doc.get('titulo'),
                conteudo=doc.get('conteudo'),
                resumo=doc.get('resumo'),
                categoria=doc.get('categoria'),
                tags=json_dumps(doc.get('tags', [])),
                publicado=doc.get('publicado', False),
                visivel_cliente=doc.get('visivel_cliente', False),
                visualizacoes=doc.get('visualizacoes', 0),
                avaliacoes_positivas=doc.get('avaliacoes_positivas', 0),
                avaliacoes_negativas=doc.get('avaliacoes_negativas', 0),
                tickets_relacionados=json_dumps(doc.get('tickets_relacionados', [])),
                autor=doc.get('autor'),
                data_publicacao=convert_datetime(doc.get('data_publicacao')),
                created_at=convert_datetime(doc.get('created_at')),
                updated_at=convert_datetime(doc.get('updated_at'))
            )
            session.add(artigo)
            count += 1
        
        await session.commit()
        self.stats['base_conhecimento'] = count
        print(f"  ✓ Migrated {count} artigos de base de conhecimento")
    
    async def migrate_avaliacoes_atendimento(self, session: AsyncSession):
        """Migrate avaliacoes_atendimento collection"""
        print("\n[15/18] Migrating avaliações de atendimento...")
        collection = self.mongo_db.avaliacoes_atendimento
        count = 0
        
        async for doc in collection.find():
            avaliacao = AvaliacaoAtendimentoSQL(
                id=doc.get('id'),
                ticket_id=doc.get('ticket_id'),
                empresa_id=doc.get('empresa_id'),
                cliente_nome=doc.get('cliente_nome'),
                cliente_email=doc.get('cliente_email'),
                satisfacao_geral=doc.get('satisfacao_geral'),
                satisfacao_atendimento=doc.get('satisfacao_atendimento'),
                satisfacao_tempo_resposta=doc.get('satisfacao_tempo_resposta'),
                satisfacao_resolucao=doc.get('satisfacao_resolucao'),
                comentarios=doc.get('comentarios'),
                sugestoes=doc.get('sugestoes'),
                recomendaria_servico=doc.get('recomendaria_servico'),
                data_avaliacao=convert_datetime(doc.get('data_avaliacao'))
            )
            session.add(avaliacao)
            count += 1
        
        await session.commit()
        self.stats['avaliacoes_atendimento'] = count
        print(f"  ✓ Migrated {count} avaliações de atendimento")
    
    async def migrate_configuracoes(self, session: AsyncSession):
        """Migrate configuracoes collection"""
        print("\n[16/18] Migrating configurações...")
        collection = self.mongo_db.configuracoes
        count = 0
        
        async for doc in collection.find():
            config = ConfiguracaoSQL(
                id=doc.get('id'),
                chave=doc.get('chave'),
                valor=doc.get('valor'),
                tipo=doc.get('tipo'),
                descricao=doc.get('descricao'),
                created_at=convert_datetime(doc.get('created_at')),
                updated_at=convert_datetime(doc.get('updated_at'))
            )
            session.add(config)
            count += 1
        
        await session.commit()
        self.stats['configuracoes'] = count
        print(f"  ✓ Migrated {count} configurações")
    
    async def migrate_chats(self, session: AsyncSession):
        """Migrate chats collection"""
        print("\n[17/18] Migrating chats...")
        collection = self.mongo_db.chats
        count = 0
        
        async for doc in collection.find():
            chat = ChatSQL(
                id=doc.get('id'),
                user_id=doc.get('user_id'),
                messages=json_dumps(doc.get('messages', [])),
                created_at=convert_datetime(doc.get('created_at')),
                updated_at=convert_datetime(doc.get('updated_at'))
            )
            session.add(chat)
            count += 1
        
        await session.commit()
        self.stats['chats'] = count
        print(f"  ✓ Migrated {count} chats")
    
    async def migrate_tasks(self, session: AsyncSession):
        """Migrate tasks collection"""
        print("\n[18/18] Migrating tasks...")
        collection = self.mongo_db.tasks
        count = 0
        
        async for doc in collection.find():
            task = TaskSQL(
                id=doc.get('id'),
                title=doc.get('title'),
                description=doc.get('description'),
                status=doc.get('status', 'pending'),
                priority=doc.get('priority', 'medium'),
                assigned_to=doc.get('assigned_to'),
                due_date=convert_date(doc.get('due_date')),
                completed_at=convert_datetime(doc.get('completed_at')),
                tags=json_dumps(doc.get('tags', [])),
                created_at=convert_datetime(doc.get('created_at')),
                updated_at=convert_datetime(doc.get('updated_at'))
            )
            session.add(task)
            count += 1
        
        await session.commit()
        self.stats['tasks'] = count
        print(f"  ✓ Migrated {count} tasks")
    
    async def run_migration(self):
        """Run complete migration"""
        print("="*60)
        print("INICIANDO MIGRAÇÃO DE MONGODB PARA SQLITE")
        print("="*60)
        
        try:
            # Connect to MongoDB
            await self.connect_mongo()
            
            # Initialize SQL database
            print("\nInitializing SQLite database...")
            await init_db()
            
            # Run all migrations
            async with AsyncSessionLocal() as session:
                await self.migrate_users(session)
                await self.migrate_clients(session)
                await self.migrate_financial_clients(session)
                await self.migrate_contas_receber(session)
                await self.migrate_importacoes_extrato(session)
                await self.migrate_trabalhista(session)
                await self.migrate_funcionarios(session)
                await self.migrate_obrigacoes_trabalhistas(session)
                await self.migrate_checklists_trabalhistas(session)
                await self.migrate_fiscal(session)
                await self.migrate_notas_fiscais(session)
                await self.migrate_apuracoes_fiscais(session)
                await self.migrate_tickets(session)
                await self.migrate_base_conhecimento(session)
                await self.migrate_avaliacoes_atendimento(session)
                await self.migrate_configuracoes(session)
                await self.migrate_chats(session)
                await self.migrate_tasks(session)
            
            # Close MongoDB
            await self.close_mongo()
            
            # Print summary
            print("\n" + "="*60)
            print("MIGRAÇÃO CONCLUÍDA COM SUCESSO!")
            print("="*60)
            print("\nResumo da migração:")
            for collection, count in sorted(self.stats.items()):
                print(f"  {collection:.<40} {count:>6} registros")
            print(f"\n  {'TOTAL':.<40} {sum(self.stats.values()):>6} registros")
            print("="*60)
            
        except Exception as e:
            print(f"\n❌ ERRO NA MIGRAÇÃO: {e}")
            import traceback
            traceback.print_exc()
            raise

async def main():
    migration = MongoToSQLMigration()
    await migration.run_migration()

if __name__ == "__main__":
    asyncio.run(main())
