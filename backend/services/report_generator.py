from datetime import datetime, date, timedelta
from typing import Dict, List, Any, Optional
from database_json import db
import json
from pathlib import Path

class ReportGenerator:
    def __init__(self):
        self.reports_dir = Path("/app/data/reports")
        self.reports_dir.mkdir(exist_ok=True)
    
    def generate_financial_summary(self, cidade: Optional[str] = None, periodo_inicio: Optional[date] = None, periodo_fim: Optional[date] = None) -> Dict:
        """Gera resumo financeiro"""
        query = {}
        
        if cidade:
            query['cidade_atendimento'] = cidade
        
        contas = db.find('accounts_receivable', query)
        
        # Filtrar por período se especificado
        if periodo_inicio or periodo_fim:
            contas_filtradas = []
            for conta in contas:
                data_vencimento = datetime.fromisoformat(conta['data_vencimento']).date()
                
                if periodo_inicio and data_vencimento < periodo_inicio:
                    continue
                if periodo_fim and data_vencimento > periodo_fim:
                    continue
                
                contas_filtradas.append(conta)
            
            contas = contas_filtradas
        
        # Calcular estatísticas
        total_contas = len(contas)
        valor_total = sum(conta.get('valor_original', 0) for conta in contas)
        
        # Por situação
        em_aberto = [c for c in contas if c.get('situacao') == 'em_aberto']
        pagas = [c for c in contas if c.get('situacao') == 'pago']
        atrasadas = [c for c in contas if c.get('situacao') == 'atrasado']
        renegociadas = [c for c in contas if c.get('situacao') == 'renegociado']
        
        valor_em_aberto = sum(conta.get('total_liquido', 0) for conta in em_aberto)
        valor_pago = sum(conta.get('valor_quitado', 0) for conta in pagas)
        valor_atrasado = sum(conta.get('total_liquido', 0) for conta in atrasadas)
        valor_renegociado = sum(conta.get('total_liquido', 0) for conta in renegociadas)
        
        # Calcular taxa de inadimplência
        taxa_inadimplencia = (len(atrasadas) / total_contas * 100) if total_contas > 0 else 0
        
        # Receita por mês
        receita_mensal = {}
        for conta in pagas:
            if conta.get('data_recebimento'):
                data_recebimento = datetime.fromisoformat(conta['data_recebimento']).date()
                mes_ano = f"{data_recebimento.year}-{data_recebimento.month:02d}"
                
                if mes_ano not in receita_mensal:
                    receita_mensal[mes_ano] = 0
                
                receita_mensal[mes_ano] += conta.get('valor_quitado', 0)
        
        return {
            'periodo': {
                'inicio': periodo_inicio.isoformat() if periodo_inicio else None,
                'fim': periodo_fim.isoformat() if periodo_fim else None
            },
            'cidade': cidade,
            'total_contas': total_contas,
            'valor_total': valor_total,
            'resumo_situacao': {
                'em_aberto': {
                    'quantidade': len(em_aberto),
                    'valor': valor_em_aberto
                },
                'pagas': {
                    'quantidade': len(pagas),
                    'valor': valor_pago
                },
                'atrasadas': {
                    'quantidade': len(atrasadas),
                    'valor': valor_atrasado
                },
                'renegociadas': {
                    'quantidade': len(renegociadas),
                    'valor': valor_renegociado
                }
            },
            'taxa_inadimplencia': round(taxa_inadimplencia, 2),
            'receita_mensal': receita_mensal,
            'gerado_em': datetime.now().isoformat()
        }
    
    def generate_companies_report(self, cidade: Optional[str] = None) -> Dict:
        """Gera relatório de empresas"""
        query = {}
        if cidade:
            query['cidade'] = cidade
        
        companies = db.find('companies', query)
        
        # Estatísticas gerais
        total_empresas = len(companies)
        empresas_ativas = len([c for c in companies if c.get('status') == 'ativa'])
        empresas_inativas = len([c for c in companies if c.get('status') == 'inativa'])
        empresas_suspensas = len([c for c in companies if c.get('status') == 'suspensa'])
        
        # Por regime tributário
        por_regime = {}
        for company in companies:
            regime = company.get('tipo_regime', 'não_informado')
            por_regime[regime] = por_regime.get(regime, 0) + 1
        
        # Por cidade
        por_cidade = {}
        for company in companies:
            cidade_emp = company.get('cidade', 'não_informado')
            por_cidade[cidade_emp] = por_cidade.get(cidade_emp, 0) + 1
        
        # Novos clientes
        novos_clientes = len([c for c in companies if c.get('novo_cliente', False)])
        
        # Empresas por tipo
        matrizes = len([c for c in companies if c.get('tipo_empresa') == 'matriz'])
        filiais = len([c for c in companies if c.get('tipo_empresa') == 'filial'])
        
        return {
            'cidade_filtro': cidade,
            'total_empresas': total_empresas,
            'por_status': {
                'ativas': empresas_ativas,
                'inativas': empresas_inativas,
                'suspensas': empresas_suspensas
            },
            'por_regime_tributario': por_regime,
            'por_cidade': por_cidade,
            'novos_clientes': novos_clientes,
            'por_tipo': {
                'matrizes': matrizes,
                'filiais': filiais
            },
            'gerado_em': datetime.now().isoformat()
        }
    
    def generate_tasks_report(self, cidade: Optional[str] = None, setor: Optional[str] = None, periodo_dias: int = 30) -> Dict:
        """Gera relatório de tarefas"""
        query = {}
        if cidade:
            query['cidade'] = cidade
        if setor:
            query['categoria'] = setor
        
        all_tasks = db.find('tasks', query)
        
        # Filtrar por período
        data_limite = date.today() - timedelta(days=periodo_dias)
        tasks = []
        
        for task in all_tasks:
            data_criacao = datetime.fromisoformat(task['created_at']).date()
            if data_criacao >= data_limite:
                tasks.append(task)
        
        total_tarefas = len(tasks)
        
        # Por status
        por_status = {}
        for task in tasks:
            status = task.get('status', 'não_informado')
            por_status[status] = por_status.get(status, 0) + 1
        
        # Por prioridade
        por_prioridade = {}
        for task in tasks:
            prioridade = task.get('prioridade', 'não_informado')
            por_prioridade[prioridade] = por_prioridade.get(prioridade, 0) + 1
        
        # Por categoria/setor
        por_categoria = {}
        for task in tasks:
            categoria = task.get('categoria', 'não_informado')
            por_categoria[categoria] = por_categoria.get(categoria, 0) + 1
        
        # Tarefas atrasadas
        tarefas_atrasadas = []
        for task in tasks:
            if task.get('data_prazo'):
                prazo = datetime.fromisoformat(task['data_prazo']).date()
                if prazo < date.today() and task.get('status') not in ['concluida', 'cancelada']:
                    tarefas_atrasadas.append(task)
        
        # Tempo médio de conclusão
        tarefas_concluidas = [t for t in tasks if t.get('status') == 'concluida']
        tempo_medio = 0
        
        if tarefas_concluidas:
            tempos = []
            for task in tarefas_concluidas:
                if task.get('data_conclusao'):
                    criacao = datetime.fromisoformat(task['created_at'])
                    conclusao = datetime.fromisoformat(task['data_conclusao'])
                    tempo_dias = (conclusao - criacao).days
                    tempos.append(tempo_dias)
            
            if tempos:
                tempo_medio = sum(tempos) / len(tempos)
        
        # Produtividade por responsável
        por_responsavel = {}
        for task in tasks:
            responsavel = task.get('responsavel_nome', 'não_atribuído')
            if responsavel not in por_responsavel:
                por_responsavel[responsavel] = {
                    'total': 0,
                    'concluidas': 0,
                    'pendentes': 0,
                    'atrasadas': 0
                }
            
            por_responsavel[responsavel]['total'] += 1
            
            status = task.get('status')
            if status == 'concluida':
                por_responsavel[responsavel]['concluidas'] += 1
            elif status in ['pendente', 'em_andamento']:
                por_responsavel[responsavel]['pendentes'] += 1
            elif status == 'atrasada':
                por_responsavel[responsavel]['atrasadas'] += 1
        
        return {
            'periodo_dias': periodo_dias,
            'cidade_filtro': cidade,
            'setor_filtro': setor,
            'total_tarefas': total_tarefas,
            'por_status': por_status,
            'por_prioridade': por_prioridade,
            'por_categoria': por_categoria,
            'tarefas_atrasadas': len(tarefas_atrasadas),
            'tempo_medio_conclusao_dias': round(tempo_medio, 1),
            'produtividade_por_responsavel': por_responsavel,
            'gerado_em': datetime.now().isoformat()
        }
    
    def generate_attendance_report(self, cidade: Optional[str] = None, periodo_dias: int = 30) -> Dict:
        """Gera relatório de atendimento"""
        query = {}
        if cidade:
            query['cidade'] = cidade
        
        all_tickets = db.find('tickets', query)
        
        # Filtrar por período
        data_limite = date.today() - timedelta(days=periodo_dias)
        tickets = []
        
        for ticket in all_tickets:
            data_abertura = datetime.fromisoformat(ticket['data_abertura']).date()
            if data_abertura >= data_limite:
                tickets.append(ticket)
        
        total_tickets = len(tickets)
        
        # Por status
        por_status = {}
        for ticket in tickets:
            status = ticket.get('status', 'não_informado')
            por_status[status] = por_status.get(status, 0) + 1
        
        # Por prioridade
        por_prioridade = {}
        for ticket in tickets:
            prioridade = ticket.get('prioridade', 'não_informado')
            por_prioridade[prioridade] = por_prioridade.get(prioridade, 0) + 1
        
        # Por canal
        por_canal = {}
        for ticket in tickets:
            canal = ticket.get('canal', 'não_informado')
            por_canal[canal] = por_canal.get(canal, 0) + 1
        
        # Tempo médio de resposta
        tickets_com_resposta = [t for t in tickets if t.get('tempo_resposta')]
        tempo_medio_resposta = 0
        
        if tickets_com_resposta:
            tempos = [t['tempo_resposta'] for t in tickets_com_resposta]
            tempo_medio_resposta = sum(tempos) / len(tempos) / 60  # converter para horas
        
        # SLA cumprido
        tickets_resolvidos = [t for t in tickets if t.get('status') == 'resolvido']
        sla_cumprido = 0
        
        if tickets_resolvidos:
            cumpridos = 0
            for ticket in tickets_resolvidos:
                sla = datetime.fromisoformat(ticket['sla'])
                # Assumir que foi resolvido na data de hoje se não tiver data específica
                if datetime.now() <= sla:
                    cumpridos += 1
            
            sla_cumprido = (cumpridos / len(tickets_resolvidos)) * 100
        
        # Satisfação do cliente
        tickets_com_satisfacao = [t for t in tickets if t.get('satisfacao_cliente')]
        satisfacao_media = 0
        
        if tickets_com_satisfacao:
            satisfacoes = [t['satisfacao_cliente'] for t in tickets_com_satisfacao]
            satisfacao_media = sum(satisfacoes) / len(satisfacoes)
        
        return {
            'periodo_dias': periodo_dias,
            'cidade_filtro': cidade,
            'total_tickets': total_tickets,
            'por_status': por_status,
            'por_prioridade': por_prioridade,
            'por_canal': por_canal,
            'tempo_medio_resposta_horas': round(tempo_medio_resposta, 2),
            'sla_cumprido_percentual': round(sla_cumprido, 2),
            'satisfacao_media': round(satisfacao_media, 2),
            'gerado_em': datetime.now().isoformat()
        }
    
    def generate_risk_analysis(self, cidade: Optional[str] = None) -> Dict:
        """Gera análise de risco de inadimplência"""
        query = {}
        if cidade:
            query['cidade_atendimento'] = cidade
        
        contas = db.find('accounts_receivable', query)
        
        # Agrupar por empresa
        empresas_risco = {}
        
        for conta in contas:
            empresa_id = conta['empresa_id']
            empresa_nome = conta['empresa']
            
            if empresa_id not in empresas_risco:
                empresas_risco[empresa_id] = {
                    'nome': empresa_nome,
                    'total_contas': 0,
                    'contas_atrasadas': 0,
                    'valor_total': 0,
                    'valor_atrasado': 0,
                    'maior_atraso_dias': 0,
                    'score_risco': 0
                }
            
            empresa = empresas_risco[empresa_id]
            empresa['total_contas'] += 1
            empresa['valor_total'] += conta.get('valor_original', 0)
            
            if conta.get('situacao') == 'atrasado':
                empresa['contas_atrasadas'] += 1
                empresa['valor_atrasado'] += conta.get('total_liquido', 0)
                
                # Calcular dias de atraso
                data_vencimento = datetime.fromisoformat(conta['data_vencimento']).date()
                dias_atraso = (date.today() - data_vencimento).days
                empresa['maior_atraso_dias'] = max(empresa['maior_atraso_dias'], dias_atraso)
        
        # Calcular score de risco para cada empresa
        for empresa_id, dados in empresas_risco.items():
            if dados['total_contas'] > 0:
                taxa_atraso = dados['contas_atrasadas'] / dados['total_contas']
                
                # Score baseado em taxa de atraso e valor atrasado
                score = 100  # Começar com score máximo
                score -= taxa_atraso * 40  # Reduzir por taxa de atraso
                score -= min(dados['maior_atraso_dias'] / 30 * 20, 20)  # Reduzir por dias de atraso
                
                if dados['valor_atrasado'] > 5000:  # Valor alto atrasado
                    score -= 15
                elif dados['valor_atrasado'] > 1000:
                    score -= 10
                
                dados['score_risco'] = max(0, int(score))
        
        # Classificar empresas por risco
        empresas_lista = list(empresas_risco.values())
        empresas_lista.sort(key=lambda x: x['score_risco'])
        
        # Categorizar por nível de risco
        alto_risco = [e for e in empresas_lista if e['score_risco'] <= 30]
        medio_risco = [e for e in empresas_lista if 30 < e['score_risco'] <= 70]
        baixo_risco = [e for e in empresas_lista if e['score_risco'] > 70]
        
        return {
            'cidade_filtro': cidade,
            'total_empresas_analisadas': len(empresas_lista),
            'classificacao_risco': {
                'alto_risco': len(alto_risco),
                'medio_risco': len(medio_risco),
                'baixo_risco': len(baixo_risco)
            },
            'empresas_alto_risco': alto_risco[:10],  # Top 10 maior risco
            'valor_total_risco': sum(e['valor_atrasado'] for e in alto_risco),
            'gerado_em': datetime.now().isoformat()
        }
    
    def export_report_json(self, report_data: Dict, filename: str) -> str:
        """Exporta relatório em JSON"""
        file_path = self.reports_dir / f"{filename}.json"
        
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(report_data, f, ensure_ascii=False, indent=2)
        
        return str(file_path)
    
    def generate_abc_curve(self, cidade: Optional[str] = None) -> Dict:
        """Gera curva ABC dos clientes por faturamento"""
        query = {}
        if cidade:
            query['cidade_atendimento'] = cidade
        
        # Buscar contas pagas dos últimos 12 meses
        data_limite = date.today() - timedelta(days=365)
        
        contas_pagas = db.find('accounts_receivable', {
            **query,
            'situacao': 'pago'
        })
        
        # Filtrar por período
        contas_periodo = []
        for conta in contas_pagas:
            if conta.get('data_recebimento'):
                data_recebimento = datetime.fromisoformat(conta['data_recebimento']).date()
                if data_recebimento >= data_limite:
                    contas_periodo.append(conta)
        
        # Agrupar por empresa
        faturamento_empresas = {}
        
        for conta in contas_periodo:
            empresa_id = conta['empresa_id']
            empresa_nome = conta['empresa']
            valor = conta.get('valor_quitado', 0)
            
            if empresa_id not in faturamento_empresas:
                faturamento_empresas[empresa_id] = {
                    'nome': empresa_nome,
                    'faturamento': 0,
                    'quantidade_contas': 0
                }
            
            faturamento_empresas[empresa_id]['faturamento'] += valor
            faturamento_empresas[empresa_id]['quantidade_contas'] += 1
        
        # Ordenar por faturamento
        empresas_ordenadas = sorted(
            faturamento_empresas.values(),
            key=lambda x: x['faturamento'],
            reverse=True
        )
        
        # Calcular percentuais acumulados
        faturamento_total = sum(e['faturamento'] for e in empresas_ordenadas)
        percentual_acumulado = 0
        
        curva_abc = []
        
        for i, empresa in enumerate(empresas_ordenadas):
            percentual_empresa = (empresa['faturamento'] / faturamento_total) * 100
            percentual_acumulado += percentual_empresa
            
            # Classificar ABC
            if percentual_acumulado <= 80:
                classe = 'A'
            elif percentual_acumulado <= 95:
                classe = 'B'
            else:
                classe = 'C'
            
            curva_abc.append({
                'posicao': i + 1,
                'empresa': empresa['nome'],
                'faturamento': empresa['faturamento'],
                'percentual_individual': round(percentual_empresa, 2),
                'percentual_acumulado': round(percentual_acumulado, 2),
                'classe_abc': classe,
                'quantidade_contas': empresa['quantidade_contas']
            })
        
        # Resumo por classe
        classe_a = [e for e in curva_abc if e['classe_abc'] == 'A']
        classe_b = [e for e in curva_abc if e['classe_abc'] == 'B']
        classe_c = [e for e in curva_abc if e['classe_abc'] == 'C']
        
        return {
            'cidade_filtro': cidade,
            'periodo_analise_dias': 365,
            'faturamento_total': faturamento_total,
            'total_empresas': len(curva_abc),
            'resumo_classes': {
                'A': {
                    'quantidade': len(classe_a),
                    'faturamento': sum(e['faturamento'] for e in classe_a),
                    'percentual_faturamento': round(sum(e['percentual_individual'] for e in classe_a), 2)
                },
                'B': {
                    'quantidade': len(classe_b),
                    'faturamento': sum(e['faturamento'] for e in classe_b),
                    'percentual_faturamento': round(sum(e['percentual_individual'] for e in classe_b), 2)
                },
                'C': {
                    'quantidade': len(classe_c),
                    'faturamento': sum(e['faturamento'] for e in classe_c),
                    'percentual_faturamento': round(sum(e['percentual_individual'] for e in classe_c), 2)
                }
            },
            'curva_completa': curva_abc,
            'gerado_em': datetime.now().isoformat()
        }