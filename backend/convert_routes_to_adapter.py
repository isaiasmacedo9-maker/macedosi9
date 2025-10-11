"""
Script para converter rotas MongoDB para database adapter pattern
Atualiza arquivos para usar DatabaseAdapter em vez de get_*_collection()
"""
import re
from pathlib import Path

# Mapeamento de collections para nomes SQL
COLLECTION_MAPPING = {
    'get_contas_receber_collection': 'contas_receber',
    'get_financial_clients_collection': 'financial_clients',
    'get_clients_collection': 'clients',
    'get_users_collection': 'users',
    'get_historico_alteracoes_collection': 'historico_alteracoes',
    'get_contatos_cobranca_collection': 'contatos_cobranca',
    'get_anexos_collection': 'anexos',
    'get_importacoes_extrato_collection': 'importacoes_extrato',
    'get_movimentos_extrato_collection': 'movimentos_extrato',
    'get_chat_enhanced_collection': 'chats',
}

def convert_file(filepath: Path):
    """Converte um arquivo de rotas para usar database adapter"""
    
    print(f"Converting: {filepath.name}")
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original_content = content
    
    # 1. Adicionar import do DatabaseAdapter se não existir
    if 'from database_adapter import DatabaseAdapter' not in content:
        # Procurar linha com imports do database
        import_pattern = r'from database import.*\n'
        if re.search(import_pattern, content):
            content = re.sub(
                import_pattern,
                'from database_adapter import DatabaseAdapter\n',
                content,
                count=1
            )
        else:
            # Adicionar após outros imports
            content = re.sub(
                r'(from fastapi.*\n)',
                r'\1from database_adapter import DatabaseAdapter\n',
                content,
                count=1
            )
    
    # 2. Substituir chamadas get_*_collection() por database adapter
    for func_name, collection_name in COLLECTION_MAPPING.items():
        # Padrão: collection_var = await get_*_collection()
        pattern = rf'(\s+)(\w+)\s*=\s*await\s+{func_name}\(\)'
        
        matches = list(re.finditer(pattern, content))
        
        for match in reversed(matches):  # Reverse para manter índices válidos
            indent = match.group(1)
            var_name = match.group(2)
            
            # Encontrar o bloco de código que usa essa variável
            # Procurar até encontrar próxima função ou bloco async with
            start_pos = match.end()
            
            # Encontrar final do bloco (próxima função ou fim do arquivo)
            next_func = re.search(r'\n@\w+\.', content[start_pos:])
            if next_func:
                end_pos = start_pos + next_func.start()
            else:
                end_pos = len(content)
            
            block = content[match.start():end_pos]
            
            # Substituir a variável collection por db.* calls
            new_block = block.replace(
                f'{var_name}.find_one(',
                f'await db.find_one("{collection_name}", '
            ).replace(
                f'{var_name}.find(',
                f'await db.find("{collection_name}", '
            ).replace(
                f'{var_name}.insert_one(',
                f'await db.insert_one("{collection_name", '
            ).replace(
                f'{var_name}.update_one(',
                f'await db.update_one("{collection_name}", '
            ).replace(
                f'{var_name}.delete_one(',
                f'await db.delete_one("{collection_name}", '
            ).replace(
                f'{var_name}.count_documents(',
                f'await db.count_documents("{collection_name}", '
            )
            
            # Remover linha de atribuição da collection
            new_block = re.sub(
                rf'{indent}{var_name}\s*=\s*await\s+{func_name}\(\)\n',
                '',
                new_block
            )
            
            # Envolver em async with DatabaseAdapter()
            if 'async with DatabaseAdapter()' not in new_block:
                # Encontrar primeira linha de código após remoção da collection
                lines = new_block.split('\n')
                func_line_idx = 0
                for i, line in enumerate(lines):
                    if line.strip() and not line.strip().startswith('@') and 'def ' in line:
                        func_line_idx = i
                        break
                
                # Adicionar async with após a linha da função
                if func_line_idx > 0:
                    insert_idx = func_line_idx + 1
                    lines.insert(insert_idx, f'{indent}async with DatabaseAdapter() as db:')
                    # Indentar todo o resto do código
                    for i in range(insert_idx + 1, len(lines)):
                        if lines[i].strip():  # Não indentar linhas vazias
                            lines[i] = '    ' + lines[i]
                    new_block = '\n'.join(lines)
            
            content = content[:match.start()] + new_block + content[end_pos:]
    
    # 3. Remover imports não utilizados das collections
    for func_name in COLLECTION_MAPPING.keys():
        # Verificar se ainda é usado no arquivo
        if f'{func_name}()' not in content:
            # Remover do import
            content = re.sub(rf',?\s*{func_name}', '', content)
    
    # Limpar imports vazios
    content = re.sub(r'from database import\s*\n', '', content)
    
    if content != original_content:
        # Salvar arquivo convertido
        backup_path = filepath.with_suffix('.py.bak')
        with open(backup_path, 'w', encoding='utf-8') as f:
            f.write(original_content)
        print(f"  Backup saved: {backup_path.name}")
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"  ✓ Converted successfully")
        return True
    else:
        print(f"  - No changes needed")
        return False

def main():
    """Converter arquivos de rotas"""
    routes_dir = Path(__file__).parent / 'routes'
    
    files_to_convert = [
        'financial.py',
        'clients.py',
    ]
    
    print("=" * 60)
    print("Converting routes to DatabaseAdapter pattern")
    print("=" * 60)
    
    converted_count = 0
    for filename in files_to_convert:
        filepath = routes_dir / filename
        if filepath.exists():
            if convert_file(filepath):
                converted_count += 1
        else:
            print(f"File not found: {filename}")
    
    print("=" * 60)
    print(f"Conversion complete: {converted_count} files converted")
    print("=" * 60)

if __name__ == "__main__":
    main()
