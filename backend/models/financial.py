from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime, date
import uuid

class HistoricoAction(BaseModel):
    data: datetime
    acao: str
    usuario: str
    observacao: Optional[str] = None
    valor: Optional[float] = None

class ContaReceber(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    empresa_id: str
    empresa: str
    situacao: str = Field(..., pattern="^(em_aberto|pago|atrasado|renegociado|cancelado)$")
    descricao: str
    documento: str
    forma_pagamento: str
    conta: str
    centro_custo: str
    plano_custo: str
    data_emissao: date
    data_vencimento: date
    valor_original: float
    observacao: Optional[str] = None
    cidade_atendimento: str
    data_recebimento: Optional[date] = None
    desconto_aplicado: float = 0.0
    acrescimo_aplicado: float = 0.0
    valor_quitado: float = 0.0
    troco: float = 0.0
    total_bruto: float
    total_liquido: float
    usuario_responsavel: str
    historico: List[HistoricoAction] = []
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class ContaReceberCreate(BaseModel):
    empresa_id: str
    empresa: str
    descricao: str
    documento: str
    forma_pagamento: str
    conta: str
    centro_custo: str
    plano_custo: str
    data_emissao: date
    data_vencimento: date
    valor_original: float
    observacao: Optional[str] = None
    cidade_atendimento: str
    usuario_responsavel: str

class FinancialClient(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    empresa_id: str
    empresa: str
    valor_com_desconto: float
    valor_boleto: float
    dia_vencimento: int = Field(..., ge=1, le=31)
    tipo_honorario: str = Field(..., pattern="^(mensal|avulso|anual)$")
    empresa_individual_grupo: str = Field(..., pattern="^(individual|grupo)$")
    contas_pagamento: List[str]
    tipo_pagamento: str = Field(..., pattern="^(recorrente|unico)$")
    forma_pagamento_especial: Optional[str] = None
    tipo_empresa: str
    ultimo_pagamento: Optional[date] = None
    status_pagamento: str = Field(..., pattern="^(em_dia|atrasado|renegociado)$")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class FinancialClientCreate(BaseModel):
    empresa_id: str
    empresa: str
    valor_com_desconto: float
    valor_boleto: float
    dia_vencimento: int = Field(..., ge=1, le=31)
    tipo_honorario: str = Field(..., pattern="^(mensal|avulso|anual)$")
    empresa_individual_grupo: str = Field(..., pattern="^(individual|grupo)$")
    contas_pagamento: List[str]
    tipo_pagamento: str = Field(..., pattern="^(recorrente|unico)$")
    forma_pagamento_especial: Optional[str] = None
    tipo_empresa: str
    status_pagamento: str = Field(default="em_dia", pattern="^(em_dia|atrasado|renegociado)$")