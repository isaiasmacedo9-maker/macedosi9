"""
Seed de dados ficticios para ambiente local.

Executa criacao de dados nas principais areas via API:
- Clientes
- Servicos
- Tarefas
- Financeiro (contas a receber)
- Fiscal (obrigacoes e notas fiscais)
- Trabalhista (solicitacoes e funcionarios)
- Atendimento (tickets)
- Comercial (servicos)
- Guias fiscais
"""

from __future__ import annotations

from datetime import datetime, timedelta
import requests

BASE_URL = "http://localhost:8001/api"
ADMIN_EMAIL = "admin@macedosi.com"
ADMIN_PASSWORD = "admin123"
TIMEOUT = 20


def safe_post(session: requests.Session, path: str, payload: dict):
    try:
        response = session.post(f"{BASE_URL}{path}", json=payload, timeout=TIMEOUT)
        if response.status_code in (200, 201):
            return True, response.json() if response.content else {}
        return False, {"status": response.status_code, "detail": response.text}
    except Exception as exc:
        return False, {"error": str(exc)}


def safe_get(session: requests.Session, path: str):
    try:
        response = session.get(f"{BASE_URL}{path}", timeout=TIMEOUT)
        if response.status_code == 200:
            return True, response.json()
        return False, {"status": response.status_code, "detail": response.text}
    except Exception as exc:
        return False, {"error": str(exc)}


def login() -> requests.Session:
    session = requests.Session()
    response = session.post(
        f"{BASE_URL}/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=TIMEOUT,
    )
    response.raise_for_status()
    token = response.json()["access_token"]
    session.headers.update({"Authorization": f"Bearer {token}"})
    return session


def get_current_user(session: requests.Session) -> dict:
    ok, data = safe_get(session, "/auth/me")
    if not ok:
        return {"id": "admin-local", "name": "Administrador"}
    return data


def create_clients(session: requests.Session):
    cities = ["Jacobina", "Ourolandia", "Umburanas", "Uberlandia"]
    created = []
    base_seed = datetime.now().strftime("%H%M%S")
    for idx in range(1, 13):
        city = cities[(idx - 1) % len(cities)]
        regime = "mei" if idx % 4 == 0 else "simples"
        cnpj_raw = f"{base_seed[-4:]}{idx:02d}{(idx+30):02d}0001{(idx+40):02d}"
        cnpj_raw = ("9" + cnpj_raw).zfill(14)[-14:]
        payload = {
            "nome_empresa": f"Empresa Exemplo {idx:02d} LTDA",
            "nome_fantasia": f"Exemplo {idx:02d}",
            "cnpj": cnpj_raw,
            "email": f"contato{idx:02d}.{base_seed}@empresaexemplo.com.br",
            "telefone": f"(74) 34{idx:02d}-{1000+idx}",
            "whatsapp": f"(74) 98{idx:02d}-{2000+idx}",
            "cidade_atendimento": city,
            "tipo_regime": regime,
            "status_empresa": "ativa",
            "endereco": {
                "logradouro": f"Rua Exemplo {idx}",
                "numero": str(100 + idx),
                "bairro": "Centro",
                "cep": f"44{idx:03d}-000",
                "cidade": city,
                "estado": "BA" if city != "Uberlandia" else "MG",
            },
        }
        ok, data = safe_post(session, "/clients", payload)
        if ok:
            created.append(data)

    if not created:
        ok, data = safe_get(session, "/clients?limit=1000")
        if ok:
            return data.get("clients", data if isinstance(data, list) else [])
    return created


def client_name(client: dict) -> str:
    return client.get("nome_empresa") or client.get("nome_fantasia") or "Cliente"


def client_id(client: dict) -> str:
    return client.get("id") or client.get("_id") or ""


def seed_services(session: requests.Session, clients: list[dict], user: dict):
    sectors = ["atendimento", "fiscal", "financeiro", "trabalhista", "contadores"]
    created = 0
    for idx, client in enumerate(clients[:10], start=1):
        payload = {
            "empresa_id": client_id(client),
            "tipo_servico": f"Servico exemplo {idx:02d}",
            "setor": sectors[(idx - 1) % len(sectors)],
            "cidade": client.get("cidade_atendimento") or "Jacobina",
            "titulo": f"Execucao de servico {idx:02d}",
            "descricao": f"Servico ficticio para {client_name(client)}",
            "prioridade": "alta" if idx % 3 == 0 else "media",
            "responsavel_id": user.get("id"),
            "data_prazo": (datetime.now() + timedelta(days=idx + 3)).strftime("%Y-%m-%d"),
        }
        ok, _ = safe_post(session, "/services/", payload)
        created += int(ok)
    return created


def seed_tasks(session: requests.Session, clients: list[dict], user: dict):
    categorias = ["comercial", "financeiro", "trabalhista", "fiscal", "contabil", "atendimento"]
    created = 0
    for idx, client in enumerate(clients[:12], start=1):
        payload = {
            "titulo": f"Tarefa {idx:02d} - {client_name(client)}",
            "descricao": "Tarefa ficticia para testes operacionais.",
            "prioridade": "alta" if idx % 4 == 0 else "media",
            "categoria": categorias[(idx - 1) % len(categorias)],
            "responsavel_id": user.get("id"),
            "data_prazo": (datetime.now() + timedelta(days=idx + 1)).strftime("%Y-%m-%d"),
            "tags": ["seed", "teste"],
        }
        ok, _ = safe_post(session, "/tasks/", payload)
        created += int(ok)
    return created


def seed_financial(session: requests.Session, clients: list[dict], user: dict):
    created = 0
    for idx, client in enumerate(clients[:10], start=1):
        payload = {
            "empresa_id": client_id(client),
            "empresa": client_name(client),
            "descricao": f"Honorario contabil {idx:02d}",
            "documento": f"FAT-{datetime.now().year}-{idx:03d}",
            "tipo_documento": "boleto",
            "forma_pagamento": "boleto",
            "conta": "Banco Principal",
            "centro_custo": "Administrativo",
            "plano_custo": "Honorarios",
            "data_emissao": datetime.now().strftime("%Y-%m-%d"),
            "data_vencimento": (datetime.now() + timedelta(days=idx * 2)).strftime("%Y-%m-%d"),
            "valor_original": float(390 + idx * 90),
            "observacao": "Lancamento automatico de seed",
            "cidade_atendimento": client.get("cidade_atendimento") or "Jacobina",
            "usuario_responsavel": user.get("name") or "Administrador",
        }
        ok, _ = safe_post(session, "/financial/contas-receber", payload)
        created += int(ok)
    return created


def seed_fiscal(session: requests.Session, clients: list[dict], user: dict):
    obrigacoes = 0
    notas = 0

    for idx, client in enumerate(clients[:8], start=1):
        payload_obr = {
            "empresa_id": client_id(client),
            "empresa": client_name(client),
            "tipo": "pgdas" if idx % 2 else "dctf",
            "nome": f"Obrigacao fiscal {idx:02d}",
            "descricao": "Obrigacao criada automaticamente para testes.",
            "periodicidade": "mensal",
            "dia_vencimento": 20,
            "responsavel": user.get("name") or "Administrador",
            "regime_tributario": "mei" if idx % 4 == 0 else "simples_nacional",
            "valor": float(120 + idx * 25),
        }
        ok_obr, _ = safe_post(session, "/fiscal/obrigacoes", payload_obr)
        obrigacoes += int(ok_obr)

        payload_nf = {
            "empresa_id": client_id(client),
            "empresa": client_name(client),
            "tipo": "saida",
            "numero": 1000 + idx,
            "serie": "1",
            "chave_nfe": f"35260{idx:02d}12345678000190{idx:036d}"[:44],
            "data_emissao": (datetime.now() - timedelta(days=idx)).strftime("%Y-%m-%d"),
            "emitente_cnpj": (client.get("cnpj") or "00000000000000").replace(".", "").replace("/", "").replace("-", "")[:14],
            "emitente_razao_social": client_name(client),
            "valor_total": float(850 + idx * 100),
            "valor_produtos": float(850 + idx * 100),
            "valor_servicos": 0.0,
            "cfop": "5102",
            "natureza_operacao": "Venda de mercadoria",
        }
        ok_nf, _ = safe_post(session, "/fiscal/notas-fiscais", payload_nf)
        notas += int(ok_nf)

    return obrigacoes, notas


def seed_trabalhista(session: requests.Session, clients: list[dict], user: dict):
    solicitacoes = 0
    funcionarios = 0

    for idx, client in enumerate(clients[:8], start=1):
        payload_sol = {
            "empresa_id": client_id(client),
            "empresa": client_name(client),
            "tipo": "folha_pagamento" if idx % 2 else "admissao",
            "titulo": f"Solicitacao trabalhista {idx:02d}",
            "descricao": "Solicitacao ficticia para testes.",
            "prazo": (datetime.now() + timedelta(days=idx + 3)).strftime("%Y-%m-%d"),
            "responsavel": user.get("name") or "Administrador",
            "prioridade": "media",
        }
        ok_sol, _ = safe_post(session, "/trabalhista/solicitacoes", payload_sol)
        solicitacoes += int(ok_sol)

        payload_fun = {
            "empresa_id": client_id(client),
            "dados_pessoais": {
                "nome_completo": f"Funcionario {idx:02d}",
                "cpf": f"00000000{idx:03d}",
                "telefone": f"(74) 9999-{3000+idx}",
                "email": f"func{idx:02d}@empresa.com.br",
            },
            "dados_contratuais": {
                "funcao": "Assistente",
                "tipo_contrato": "clt",
                "salario_base": float(1512 + idx * 120),
                "data_admissao": (datetime.now() - timedelta(days=180 + idx)).strftime("%Y-%m-%d"),
            },
            "observacoes": "Funcionario criado por seed automatizado",
        }
        ok_fun, _ = safe_post(session, "/trabalhista/funcionarios", payload_fun)
        funcionarios += int(ok_fun)

    return solicitacoes, funcionarios


def seed_atendimento(session: requests.Session, clients: list[dict], user: dict):
    created = 0
    for idx, client in enumerate(clients[:8], start=1):
        payload = {
            "empresa_id": client_id(client),
            "empresa": client_name(client),
            "solicitante_nome": "Contato Principal",
            "solicitante_email": f"atendimento{idx:02d}@empresa.com.br",
            "solicitante_telefone": f"(74) 98888-{1200+idx}",
            "titulo": f"Ticket de suporte {idx:02d}",
            "descricao": "Abertura de ticket ficticio para validacao da interface.",
            "tipo": "solicitacao",
            "prioridade": "media",
            "responsavel": user.get("name") or "Administrador",
            "equipe": "Atendimento",
            "canal": "chat",
            "data_abertura": datetime.now().strftime("%Y-%m-%d"),
            "tags": ["seed"],
        }
        ok, _ = safe_post(session, "/atendimento/tickets", payload)
        created += int(ok)
    return created


def seed_comercial(session: requests.Session, clients: list[dict], user: dict):
    created = 0
    for idx, client in enumerate(clients[:6], start=1):
        payload = {
            "empresa_id": client_id(client),
            "tipo_servico": "consultoria",
            "descricao": f"Servico comercial de exemplo {idx:02d}",
            "valor_servico": float(600 + idx * 130),
            "valor_desconto": float(20 if idx % 3 == 0 else 0),
            "data_contratacao": datetime.now().strftime("%Y-%m-%d"),
            "data_inicio_previsto": (datetime.now() + timedelta(days=2)).strftime("%Y-%m-%d"),
            "data_conclusao_prevista": (datetime.now() + timedelta(days=20)).strftime("%Y-%m-%d"),
            "responsavel_id": user.get("id"),
            "observacoes": "Seed automatico comercial",
        }
        ok, _ = safe_post(session, "/comercial/servicos", payload)
        created += int(ok)
    return created


def seed_guias_fiscais(session: requests.Session, clients: list[dict], user: dict):
    created = 0
    for idx, client in enumerate(clients[:8], start=1):
        payload = {
            "empresa_id": client_id(client),
            "empresa_nome": client_name(client),
            "tipo_guia": "DAS" if idx % 2 else "INSS",
            "competencia": f"{datetime.now().month:02d}/{datetime.now().year}",
            "valor": float(180 + idx * 40),
            "data_vencimento": (datetime.now() + timedelta(days=idx + 5)).strftime("%Y-%m-%d"),
            "status": "pendente",
            "colaborador_responsavel": user.get("name") or "Administrador",
            "observacoes": "Guia criada por seed automatico",
        }
        ok, _ = safe_post(session, "/guias-fiscais/", payload)
        created += int(ok)
    return created


def main():
    print("Iniciando seed de dados ficticios...")
    try:
        session = login()
    except Exception as exc:
        print(f"Erro ao logar: {exc}")
        return

    user = get_current_user(session)
    clients = create_clients(session)
    print(f"Clientes disponiveis: {len(clients)}")

    totals = {
        "servicos": seed_services(session, clients, user),
        "tarefas": seed_tasks(session, clients, user),
        "financeiro_contas_receber": seed_financial(session, clients, user),
    }

    fiscal_obr, fiscal_nf = seed_fiscal(session, clients, user)
    totals["fiscal_obrigacoes"] = fiscal_obr
    totals["fiscal_notas"] = fiscal_nf

    trab_sol, trab_fun = seed_trabalhista(session, clients, user)
    totals["trabalhista_solicitacoes"] = trab_sol
    totals["trabalhista_funcionarios"] = trab_fun

    totals["atendimento_tickets"] = seed_atendimento(session, clients, user)
    totals["comercial_servicos"] = seed_comercial(session, clients, user)
    totals["guias_fiscais"] = seed_guias_fiscais(session, clients, user)

    print("\nResumo:")
    for key, value in totals.items():
        print(f"- {key}: {value}")
    print("\nConcluido.")


if __name__ == "__main__":
    main()
