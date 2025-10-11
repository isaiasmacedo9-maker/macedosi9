# Replace imports
s/from database import get_clients_collection, get_users_collection, get_chat_enhanced_collection/from database_adapter import DatabaseAdapter/
s/from database import (\n    get_contas_receber_collection, get_financial_clients_collection,\n    get_importacoes_extrato_collection\n)/from database_adapter import DatabaseAdapter/

# Replace collection assignments with async with
s/clients_collection = await get_clients_collection()/async with DatabaseAdapter() as db:/
s/users_collection = await get_users_collection()/async with DatabaseAdapter() as db:/
s/contas_collection = await get_contas_receber_collection()/async with DatabaseAdapter() as db:/
s/financial_clients_collection = await get_financial_clients_collection()/async with DatabaseAdapter() as db:/
s/importacoes_collection = await get_importacoes_extrato_collection()/async with DatabaseAdapter() as db:/

# Replace collection operations - clients
s/clients_collection\.find_one(/await db.find_one("clients", /g
s/clients_collection\.find(/await db.find("clients", /g
s/clients_collection\.insert_one(/await db.insert_one("clients", /g
s/clients_collection\.update_one(/await db.update_one("clients", /g
s/clients_collection\.delete_one(/await db.delete_one("clients", /g
s/clients_collection\.count_documents(/await db.count_documents("clients", /g

# Replace collection operations - users
s/users_collection\.find_one(/await db.find_one("users", /g
s/users_collection\.find(/await db.find("users", /g

# Replace collection operations - contas
s/contas_collection\.find_one(/await db.find_one("contas_receber", /g
s/contas_collection\.find(/await db.find("contas_receber", /g
s/contas_collection\.insert_one(/await db.insert_one("contas_receber", /g
s/contas_collection\.update_one(/await db.update_one("contas_receber", /g
s/contas_collection\.delete_one(/await db.delete_one("contas_receber", /g
s/contas_collection\.count_documents(/await db.count_documents("contas_receber", /g

# Replace collection operations - financial_clients
s/financial_clients_collection\.find_one(/await db.find_one("financial_clients", /g
s/financial_clients_collection\.find(/await db.find("financial_clients", /g
s/financial_clients_collection\.insert_one(/await db.insert_one("financial_clients", /g
s/financial_clients_collection\.update_one(/await db.update_one("financial_clients", /g
s/financial_clients_collection\.delete_one(/await db.delete_one("financial_clients", /g
s/financial_clients_collection\.count_documents(/await db.count_documents("financial_clients", /g

# Replace collection operations - importacoes
s/importacoes_collection\.find_one(/await db.find_one("importacoes_extrato", /g
s/importacoes_collection\.find(/await db.find("importacoes_extrato", /g
s/importacoes_collection\.insert_one(/await db.insert_one("importacoes_extrato", /g
s/importacoes_collection\.update_one(/await db.update_one("importacoes_extrato", /g
