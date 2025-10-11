"""
Script de migração de SQLite para MySQL
Transfere todos os dados do banco SQLite para MySQL
"""
import asyncio
import sqlite3
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import text
import os
from pathlib import Path
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Configurações
SQLITE_DB = "macedo_si.db"
MYSQL_URL = os.environ.get('SQL_DATABASE_URL', 'mysql+aiomysql://macedo_user:macedo_pass_2025@localhost:3306/macedo_si_crm')

# Ordem das tabelas respeitando foreign keys
TABLES_ORDER = [
    'users',
    'clients',
    'financial_clients',
    'contas_receber',
    'historico_alteracoes',
    'contatos_cobranca',
    'anexos',
    'importacoes_extrato',
    'movimentos_extrato',
    'solicitacoes_trabalhistas',
    'funcionarios',
    'obrigacoes_trabalhistas',
    'checklists_trabalhistas',
    'obrigacoes_fiscais',
    'notas_fiscais',
    'apuracoes_fiscais',
    'tickets',
    'conversas',
    'base_conhecimento',
    'avaliacoes_atendimento',
    'configuracoes',
    'chats',
    'tasks',
    'user_permissions',
    'user_online_status',
    'conversations',
    'conversation_members',
    'chat_messages',
    'message_read_status',
    'servicos',
    'comentarios_servico',
    'servicos_comerciais',
    'ordens_servico',
    'contratos',
    'historico_contratos',
    'agendamentos',
    'disponibilidade_contador',
    'bloqueios_agenda',
    'historico_agendamentos'
]

async def migrate_data():
    """Migra dados do SQLite para MySQL"""
    
    print("🔄 Iniciando migração SQLite → MySQL...")
    
    # Conectar ao SQLite
    if not os.path.exists(SQLITE_DB):
        print(f"❌ Arquivo SQLite não encontrado: {SQLITE_DB}")
        return
    
    sqlite_conn = sqlite3.connect(SQLITE_DB)
    sqlite_conn.row_factory = sqlite3.Row
    cursor = sqlite_conn.cursor()
    
    # Conectar ao MySQL
    engine = create_async_engine(MYSQL_URL, echo=False)
    
    try:
        # Criar todas as tabelas no MySQL
        print("📋 Criando tabelas no MySQL...")
        from models_sql import Base
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        print("✅ Tabelas criadas com sucesso!")
        
        # Criar sessão
        AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
        
        # Obter lista de tabelas do SQLite
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
        sqlite_tables = [row[0] for row in cursor.fetchall()]
        
        total_migrated = 0
        
        # Migrar cada tabela na ordem correta
        for table_name in TABLES_ORDER:
            if table_name not in sqlite_tables:
                continue
                
            print(f"\n🔄 Migrando tabela: {table_name}")
            
            # Obter dados do SQLite
            cursor.execute(f"SELECT * FROM {table_name}")
            rows = cursor.fetchall()
            
            if not rows:
                print(f"   ℹ️  Tabela vazia, pulando...")
                continue
            
            # Obter nomes das colunas
            columns = [description[0] for description in cursor.description]
            
            # Inserir dados no MySQL
            async with AsyncSessionLocal() as session:
                try:
                    for row in rows:
                        # Converter row para dict
                        row_dict = dict(zip(columns, row))
                        
                        # Preparar valores para inserção
                        placeholders = ', '.join([f':{col}' for col in columns])
                        columns_str = ', '.join([f'`{col}`' for col in columns])
                        
                        query = text(f"INSERT INTO {table_name} ({columns_str}) VALUES ({placeholders})")
                        
                        try:
                            await session.execute(query, row_dict)
                        except Exception as e:
                            print(f"   ⚠️  Erro ao inserir registro: {str(e)[:100]}")
                            continue
                    
                    await session.commit()
                    print(f"   ✅ {len(rows)} registros migrados")
                    total_migrated += len(rows)
                    
                except Exception as e:
                    await session.rollback()
                    print(f"   ❌ Erro na migração: {str(e)}")
        
        print(f"\n🎉 Migração concluída! Total de registros migrados: {total_migrated}")
        
    except Exception as e:
        print(f"❌ Erro durante migração: {e}")
        import traceback
        traceback.print_exc()
    finally:
        sqlite_conn.close()
        await engine.dispose()

if __name__ == "__main__":
    asyncio.run(migrate_data())
