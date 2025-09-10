import re
import uuid
from datetime import datetime, date
from typing import Dict, List, Tuple, Optional
from pathlib import Path
import PyPDF2
import csv
import io
from database_json import db

class ExtratoProcessor:
    def __init__(self):
        self.valor_tolerancia = 0.50  # Tolerância de R$ 0,50 para conciliação
        self.dias_tolerancia = 5  # Tolerância de 5 dias
        
        # Padrões regex para detecção
        self.cnpj_pattern = re.compile(r'\d{2}\.?\d{3}\.?\d{3}/?\d{4}-?\d{2}')
        self.cpf_pattern = re.compile(r'\d{3}\.?\d{3}\.?\d{3}-?\d{2}')
        self.valor_pattern = re.compile(r'R?\$?\s*(\d{1,3}(?:\.\d{3})*,\d{2})')
        self.data_pattern = re.compile(r'(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})')
        
        # Palavras-chave para identificar tipo de movimento
        self.movimento_keywords = [
            'DOC', 'TED', 'PIX', 'BOLETO', 'TRANSFERENCIA', 'DEPOSITO',
            'RECIBO', 'PAGAMENTO', 'CREDITO', 'DEBITO'
        ]
    
    async def process_file(self, file_path: str, conta: str, cidade: str, user_id: str) -> Dict:
        """Processa arquivo de extrato (PDF ou CSV)"""
        file_path_obj = Path(file_path)
        
        if file_path_obj.suffix.lower() == '.pdf':
            movimentos = await self._process_pdf(file_path)
        elif file_path_obj.suffix.lower() == '.csv':
            movimentos = await self._process_csv(file_path)
        else:
            raise ValueError("Tipo de arquivo não suportado")
        
        # Processar cada movimento
        total_movimentos = len(movimentos)
        baixas_automaticas = 0
        pendentes_classificacao = 0
        
        import_id = str(uuid.uuid4())
        
        for movimento in movimentos:
            # Tentar conciliação automática
            match_result = await self._try_auto_match(movimento, cidade)
            
            if match_result['auto_matched']:
                # Realizar baixa automática
                await self._realizar_baixa_automatica(match_result['titulo_id'], movimento, user_id)
                baixas_automaticas += 1
                
                # Criar/atualizar regra de mapeamento
                await self._update_mapping_rule(movimento, match_result['empresa_id'], user_id)
            else:
                # Adicionar à fila de classificação
                await self._add_to_classification_queue(movimento, match_result['candidates'], import_id)
                pendentes_classificacao += 1
        
        return {
            'import_id': import_id,
            'total_movimentos': total_movimentos,
            'baixas_automaticas': baixas_automaticas,
            'pendentes_classificacao': pendentes_classificacao
        }
    
    async def _process_pdf(self, file_path: str) -> List[Dict]:
        """Processa PDF usando PyPDF2"""
        movimentos = []
        
        try:
            with open(file_path, 'rb') as file:
                pdf_reader = PyPDF2.PdfReader(file)
                
                full_text = ""
                for page in pdf_reader.pages:
                    full_text += page.extract_text() + "\n"
                
                # Limpar e normalizar texto
                full_text = self._clean_text(full_text)
                
                # Extrair movimentos do texto
                movimentos = self._extract_movements_from_text(full_text)
                
        except Exception as e:
            print(f"Erro ao processar PDF: {e}")
            # Fallback: tentar OCR (se disponível)
            movimentos = await self._process_pdf_with_ocr(file_path)
        
        return movimentos
    
    async def _process_pdf_with_ocr(self, file_path: str) -> List[Dict]:
        """Processamento com OCR como fallback"""
        # Implementação básica - em produção usaria Tesseract
        print("OCR não implementado nesta versão - usando extração básica")
        return []
    
    async def _process_csv(self, file_path: str) -> List[Dict]:
        """Processa arquivo CSV"""
        movimentos = []
        
        try:
            with open(file_path, 'r', encoding='utf-8') as file:
                # Detectar delimitador
                sample = file.read(1024)
                file.seek(0)
                
                delimiter = ';' if ';' in sample else ','
                
                csv_reader = csv.DictReader(file, delimiter=delimiter)
                
                for row in csv_reader:
                    movimento = self._parse_csv_row(row)
                    if movimento:
                        movimentos.append(movimento)
        
        except Exception as e:
            print(f"Erro ao processar CSV: {e}")
        
        return movimentos
    
    def _clean_text(self, text: str) -> str:
        """Limpa e normaliza texto do PDF"""
        # Remover caracteres especiais, normalizar espaços
        text = re.sub(r'\s+', ' ', text)
        text = text.replace('\n', ' ').strip()
        return text
    
    def _extract_movements_from_text(self, text: str) -> List[Dict]:
        """Extrai movimentos do texto do extrato"""
        movimentos = []
        
        # Dividir em linhas possíveis
        lines = text.split('\n')
        
        for line in lines:
            movimento = self._parse_movement_line(line)
            if movimento:
                movimentos.append(movimento)
        
        return movimentos
    
    def _parse_movement_line(self, line: str) -> Optional[Dict]:
        """Parse de uma linha de movimento"""
        line = line.strip()
        
        if not line:
            return None
        
        # Buscar data
        data_match = self.data_pattern.search(line)
        if not data_match:
            return None
        
        # Buscar valor
        valor_match = self.valor_pattern.search(line)
        if not valor_match:
            return None
        
        # Extrair informações
        data_str = data_match.group(0)
        valor_str = valor_match.group(1).replace('.', '').replace(',', '.')
        
        try:
            valor = float(valor_str)
            data_movimento = self._parse_date(data_str)
            
            # Extrair descrição (texto entre data e valor)
            descricao_start = data_match.end()
            descricao_end = valor_match.start()
            descricao = line[descricao_start:descricao_end].strip()
            
            # Detectar CNPJ/CPF na descrição
            cnpj_match = self.cnpj_pattern.search(descricao)
            cpf_match = self.cpf_pattern.search(descricao)
            
            documento_detectado = None
            if cnpj_match:
                documento_detectado = cnpj_match.group(0)
            elif cpf_match:
                documento_detectado = cpf_match.group(0)
            
            # Detectar tipo de movimento
            tipo_movimento = self._detect_movement_type(descricao)
            
            return {
                'data_movimento': data_movimento,
                'descricao': descricao,
                'valor': valor,
                'documento_detectado': documento_detectado,
                'tipo_movimento': tipo_movimento,
                'linha_original': line
            }
            
        except (ValueError, TypeError):
            return None
    
    def _parse_csv_row(self, row: Dict) -> Optional[Dict]:
        """Parse de linha CSV"""
        # Tentar mapear campos comuns
        campos_data = ['data', 'dt_movimento', 'date', 'data_movimento']
        campos_descricao = ['descricao', 'historico', 'description', 'desc']
        campos_valor = ['valor', 'value', 'amount', 'vlr_movimento']
        
        data_campo = next((k for k in campos_data if k in row), None)
        descricao_campo = next((k for k in campos_descricao if k in row), None)
        valor_campo = next((k for k in campos_valor if k in row), None)
        
        if not all([data_campo, descricao_campo, valor_campo]):
            return None
        
        try:
            data_str = row[data_campo]
            descricao = row[descricao_campo]
            valor_str = row[valor_campo].replace('.', '').replace(',', '.')
            
            data_movimento = self._parse_date(data_str)
            valor = float(valor_str)
            
            # Detectar documento
            cnpj_match = self.cnpj_pattern.search(descricao)
            cpf_match = self.cpf_pattern.search(descricao)
            
            documento_detectado = None
            if cnpj_match:
                documento_detectado = cnpj_match.group(0)
            elif cpf_match:
                documento_detectado = cpf_match.group(0)
            
            tipo_movimento = self._detect_movement_type(descricao)
            
            return {
                'data_movimento': data_movimento,
                'descricao': descricao,
                'valor': valor,
                'documento_detectado': documento_detectado,
                'tipo_movimento': tipo_movimento,
                'linha_original': str(row)
            }
            
        except (ValueError, TypeError, KeyError):
            return None
    
    def _parse_date(self, date_str: str) -> date:
        """Parse de data em vários formatos"""
        date_str = date_str.strip()
        
        # Tentar vários formatos
        formats = ['%d/%m/%Y', '%d-%m-%Y', '%d/%m/%y', '%d-%m-%y']
        
        for fmt in formats:
            try:
                return datetime.strptime(date_str, fmt).date()
            except ValueError:
                continue
        
        raise ValueError(f"Formato de data não reconhecido: {date_str}")
    
    def _detect_movement_type(self, descricao: str) -> str:
        """Detecta tipo de movimento pela descrição"""
        descricao_upper = descricao.upper()
        
        for keyword in self.movimento_keywords:
            if keyword in descricao_upper:
                return keyword.lower()
        
        return 'outros'
    
    async def _try_auto_match(self, movimento: Dict, cidade: str) -> Dict:
        """Tenta fazer match automático do movimento"""
        candidates = []
        best_match = None
        best_score = 0
        
        # Buscar títulos em aberto na cidade
        titulos_query = {
            'cidade_atendimento': cidade,
            'situacao': {'$in': ['em_aberto', 'atrasado']}
        }
        
        titulos = db.find('accounts_receivable', titulos_query)
        
        for titulo in titulos:
            score = self._calculate_match_score(movimento, titulo)
            
            if score > 0:
                candidates.append({
                    'titulo_id': titulo['id'],
                    'empresa_id': titulo['empresa_id'],
                    'empresa_nome': titulo['empresa'],
                    'score': score
                })
                
                if score > best_score:
                    best_score = score
                    best_match = titulo
        
        # Aplicar regras de mapeamento aprendidas
        mapping_score = await self._check_mapping_rules(movimento)
        if mapping_score and mapping_score['score'] > best_score:
            best_score = mapping_score['score']
            best_match = mapping_score
        
        # Determinar se é match automático (score >= 80)
        auto_matched = best_score >= 80
        
        return {
            'auto_matched': auto_matched,
            'titulo_id': best_match['id'] if best_match and auto_matched else None,
            'empresa_id': best_match['empresa_id'] if best_match and auto_matched else None,
            'candidates': sorted(candidates, key=lambda x: x['score'], reverse=True)[:5],
            'best_score': best_score
        }
    
    def _calculate_match_score(self, movimento: Dict, titulo: Dict) -> int:
        """Calcula score de match entre movimento e título"""
        score = 0
        
        # Score por valor (peso alto)
        valor_movimento = movimento['valor']
        valor_titulo = titulo['total_liquido']
        
        if abs(valor_movimento - valor_titulo) <= self.valor_tolerancia:
            score += 40  # Match exato de valor
        elif abs(valor_movimento - valor_titulo) <= (valor_titulo * 0.05):  # 5% de tolerância
            score += 20  # Match aproximado de valor
        
        # Score por data (peso médio)
        data_movimento = movimento['data_movimento']
        data_vencimento = datetime.fromisoformat(titulo['data_vencimento']).date()
        
        dias_diferenca = abs((data_movimento - data_vencimento).days)
        if dias_diferenca <= self.dias_tolerancia:
            score += 20
        elif dias_diferenca <= 15:
            score += 10
        
        # Score por CNPJ (peso alto)
        if movimento['documento_detectado']:
            empresa = db.find_one('companies', {'id': titulo['empresa_id']})
            if empresa and movimento['documento_detectado'] in empresa['cnpj']:
                score += 30
        
        # Score por correspondência textual (peso baixo)
        descricao_movimento = movimento['descricao'].upper()
        nome_empresa = titulo['empresa'].upper()
        
        # Buscar palavras em comum
        palavras_movimento = set(descricao_movimento.split())
        palavras_empresa = set(nome_empresa.split())
        
        palavras_comuns = palavras_movimento.intersection(palavras_empresa)
        if palavras_comuns:
            score += min(len(palavras_comuns) * 5, 15)
        
        return score
    
    async def _check_mapping_rules(self, movimento: Dict) -> Optional[Dict]:
        """Verifica regras de mapeamento aprendidas"""
        rules = db.get_mapping_rules()
        
        best_rule = None
        best_score = 0
        
        for rule in rules:
            if rule['tipo_pattern'] == 'exact':
                if rule['pattern'] in movimento['descricao']:
                    score = rule['confiabilidade']
                    if score > best_score:
                        best_score = score
                        best_rule = rule
            
            elif rule['tipo_pattern'] == 'regex':
                try:
                    if re.search(rule['pattern'], movimento['descricao'], re.IGNORECASE):
                        score = rule['confiabilidade']
                        if score > best_score:
                            best_score = score
                            best_rule = rule
                except re.error:
                    continue
            
            elif rule['tipo_pattern'] == 'contains':
                if rule['pattern'].lower() in movimento['descricao'].lower():
                    score = rule['confiabilidade']
                    if score > best_score:
                        best_score = score
                        best_rule = rule
        
        if best_rule and best_score >= 70:
            # Buscar título da empresa
            titulo = db.find_one('accounts_receivable', {
                'empresa_id': best_rule['empresa_id'],
                'situacao': {'$in': ['em_aberto', 'atrasado']}
            })
            
            if titulo:
                return {
                    'id': titulo['id'],
                    'empresa_id': best_rule['empresa_id'],
                    'score': best_score
                }
        
        return None
    
    async def _realizar_baixa_automatica(self, titulo_id: str, movimento: Dict, user_id: str):
        """Realiza baixa automática do título"""
        historico_entry = {
            'id': str(uuid.uuid4()),
            'data': datetime.now().isoformat(),
            'acao': 'Baixa automática via extrato',
            'usuario': 'Sistema',
            'observacao': f"Extrato: {movimento['descricao'][:100]}",
            'valor': movimento['valor']
        }
        
        update_data = {
            'situacao': 'pago',
            'data_recebimento': movimento['data_movimento'].isoformat(),
            'valor_quitado': movimento['valor'],
            'historico': []  # Será concatenado com o existente
        }
        
        # Buscar título atual para preservar histórico
        titulo_atual = db.find_one('accounts_receivable', {'id': titulo_id})
        if titulo_atual:
            historico_atual = titulo_atual.get('historico', [])
            update_data['historico'] = historico_atual + [historico_entry]
        
        db.update('accounts_receivable', {'id': titulo_id}, update_data, user_id)
    
    async def _update_mapping_rule(self, movimento: Dict, empresa_id: str, user_id: str):
        """Cria ou atualiza regra de mapeamento"""
        # Extrair padrão da descrição (simplificado)
        descricao = movimento['descricao'].strip()
        
        # Buscar regra existente
        existing_rule = db.find_one('mapping_rules', {
            'pattern': descricao,
            'empresa_id': empresa_id,
            'tipo_pattern': 'contains'
        })
        
        if existing_rule:
            # Atualizar uso e confiabilidade
            new_usage = existing_rule['uso_count'] + 1
            new_confidence = min(95, existing_rule['confiabilidade'] + 2)  # Aumentar confiabilidade
            
            db.update('mapping_rules', {'id': existing_rule['id']}, {
                'uso_count': new_usage,
                'confiabilidade': new_confidence,
                'data_ultima_utilizacao': datetime.now().isoformat()
            })
        else:
            # Criar nova regra
            empresa = db.find_one('companies', {'id': empresa_id})
            if empresa:
                new_rule = {
                    'pattern': descricao,
                    'tipo_pattern': 'contains',
                    'empresa_id': empresa_id,
                    'empresa_nome': empresa['nome_empresa'],
                    'confiabilidade': 75,  # Confiabilidade inicial
                    'uso_count': 1,
                    'data_ultima_utilizacao': datetime.now().isoformat(),
                    'active': True,
                    'criado_por': user_id
                }
                
                db.add_mapping_rule(new_rule)
    
    async def _add_to_classification_queue(self, movimento: Dict, candidates: List[Dict], import_id: str):
        """Adiciona movimento à fila de classificação manual"""
        queue_item = {
            'import_id': import_id,
            'arquivo_nome': 'extrato_imported',
            'tipo_arquivo': 'pdf',  # Será determinado pelo contexto
            'linha_texto': movimento['linha_original'],
            'data_movimento': movimento['data_movimento'].isoformat(),
            'valor': movimento['valor'],
            'cnpj_detectado': movimento['documento_detectado'],
            'descricao_parsed': movimento['descricao'],
            'status': 'pending',
            'candidate_matches': candidates,
            'score_melhor_match': candidates[0]['score'] if candidates else 0
        }
        
        db.add_to_import_queue(queue_item)
    
    async def classify_item(self, item_id: str, empresa_id: str, titulo_id: Optional[str], acao: str, user_id: str) -> Dict:
        """Classifica item da fila manualmente"""
        item = db.find_one('import_queue', {'id': item_id})
        if not item:
            raise ValueError("Item não encontrado na fila")
        
        if acao == 'associar' and titulo_id:
            # Associar a título existente
            movimento = {
                'data_movimento': datetime.fromisoformat(item['data_movimento']).date(),
                'descricao': item['descricao_parsed'],
                'valor': item['valor']
            }
            
            await self._realizar_baixa_automatica(titulo_id, movimento, user_id)
            
            # Criar regra de mapeamento
            await self._update_mapping_rule(movimento, empresa_id, user_id)
            
            # Marcar como processado
            db.update('import_queue', {'id': item_id}, {
                'status': 'classified',
                'empresa_associada': empresa_id,
                'titulo_associado': titulo_id,
                'processado_por': user_id,
                'data_processamento': datetime.now().isoformat()
            })
            
            return {'action': 'associated', 'message': 'Item associado com sucesso'}
        
        elif acao == 'ignorar':
            # Marcar como ignorado
            db.update('import_queue', {'id': item_id}, {
                'status': 'ignored',
                'processado_por': user_id,
                'data_processamento': datetime.now().isoformat()
            })
            
            return {'action': 'ignored', 'message': 'Item ignorado'}
        
        elif acao == 'criar_empresa':
            # Lógica para criar nova empresa (implementar conforme necessário)
            return {'action': 'create_company', 'message': 'Funcionalidade de criar empresa não implementada'}
        
        else:
            raise ValueError("Ação não reconhecida")