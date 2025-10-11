# 📬 Sistema de Notificações Automáticas - CRM Macedo SI

## 🎯 Funcionalidade Implementada

### Notificação Automática ao Cadastrar Nova Empresa

Quando uma nova empresa é cadastrada no sistema, **automaticamente** é enviada uma mensagem via chat para **todos os usuários do setor Financeiro** que atendem aquela cidade.

---

## 📋 Detalhes da Implementação

### **Quando é Disparada:**
- Ao criar uma nova empresa através do módulo "Clientes"
- Endpoint: `POST /api/clients`

### **Quem Recebe:**
- Todos os usuários que possuem:
  - ✅ Setor "financeiro" em `allowed_sectors`
  - ✅ Cidade da empresa em `allowed_cities`
  - ❌ **Exceto** o próprio usuário que cadastrou a empresa

### **O Que É Enviado:**
Mensagem automática via chat contendo:
- 🏢 Nome da Empresa
- 🏷️ Nome Fantasia (se houver)
- 📄 CNPJ
- 📍 Cidade/Estado
- 📞 Telefone
- ✉️ Email
- 🏭 Setor
- 👤 Quem cadastrou
- 📅 Data e hora do cadastro

### **Exemplo de Mensagem:**
```
🏢 Nova Empresa Cadastrada

📋 Empresa: Empresa ABC Ltda
🏷️ Nome Fantasia: ABC Comércio
📄 CNPJ: 12.345.678/0001-90
📍 Cidade: São Paulo/SP
📞 Telefone: (11) 3456-7890
✉️ Email: contato@empresaabc.com.br
🏭 Setor: contabilidade
👤 Cadastrado por: João Silva
📅 Data: 25/01/2025 às 14:30

ℹ️ Esta empresa foi cadastrada e está disponível para vinculação em contas a receber.
```

---

## 🔧 Implementação Técnica

### **Backend:**
Arquivo: `/app/backend/routes/clients.py`

**Função:** `send_notification_to_financial(client, creator)`
- Busca usuários do financeiro na cidade
- Cria/localiza conversa privada com cada usuário
- Envia mensagem automática do "Sistema"

**Características:**
- ✅ Assíncrono (não bloqueia o cadastro)
- ✅ Erros são logados mas não impedem o cadastro
- ✅ Mensagens são enviadas como tipo "notificacao"
- ✅ Metadata inclui informações da empresa
- ✅ Remetente: "Sistema - Notificação Automática"

### **Frontend:**
Arquivo: `/app/frontend/src/components/Clients/ClientesExpandido.js`

**Feedback ao Usuário:**
- Toast de sucesso: "Cliente criado com sucesso!"
- Toast informativo: "📨 Notificação automática enviada para o setor Financeiro de [Cidade]"

---

## 📊 Fluxo da Notificação

```
1. Usuário cadastra nova empresa
   ↓
2. Backend valida dados e cria empresa
   ↓
3. Sistema busca usuários do financeiro da cidade
   ↓
4. Para cada usuário encontrado:
   a. Verifica se já existe conversa privada
   b. Cria conversa (se não existir)
   c. Envia mensagem automática
   ↓
5. Usuários do financeiro recebem notificação no chat
   ↓
6. Notificação aparece como não lida
```

---

## 🎨 Interface do Usuário

### **Ao Cadastrar:**
- Usuário preenche formulário de nova empresa
- Clica em "Criar Cliente"
- Vê confirmação: ✅ "Cliente criado com sucesso!"
- Vê notificação: 📨 "Notificação automática enviada para o setor Financeiro de [Cidade]"

### **Ao Receber (Financeiro):**
- Usuário do financeiro vê notificação no chat
- Badge de mensagem não lida
- Mensagem vem do "Sistema - Notificação Automática"
- Contém todos os dados relevantes da nova empresa

---

## 🔍 Como Verificar

### **1. Criar Usuário de Teste (Financeiro):**
```python
# No banco de dados, criar usuário com:
{
  "allowed_sectors": ["financeiro"],
  "allowed_cities": ["São Paulo"]
}
```

### **2. Cadastrar Nova Empresa:**
- Fazer login com usuário normal
- Ir em "Clientes" → "Novo Cliente"
- Preencher dados com cidade "São Paulo"
- Salvar

### **3. Verificar Notificação:**
- Fazer login com usuário do financeiro
- Ir em "Chat"
- Verificar nova mensagem do "Sistema"

---

## ⚙️ Configurações

### **Campos Necessários no Usuário:**
```json
{
  "allowed_sectors": ["financeiro"],  // Obrigatório
  "allowed_cities": ["Cidade"]        // Obrigatório
}
```

### **Campos da Empresa Usados na Notificação:**
- `nome_empresa` (obrigatório)
- `nome_fantasia` (opcional)
- `cnpj` (obrigatório)
- `cidade` (obrigatório)
- `estado` (obrigatório)
- `telefone` (opcional)
- `email` (obrigatório)
- `setor` (obrigatório)

---

## 🚀 Benefícios

1. **Comunicação Imediata:** Financeiro é notificado instantaneamente
2. **Rastreabilidade:** Histórico completo no chat
3. **Automação:** Elimina necessidade de notificação manual
4. **Contexto Completo:** Todas as informações relevantes em uma mensagem
5. **Não Intrusivo:** Mensagens no chat, não bloqueiam trabalho
6. **Segmentado:** Apenas financeiro da cidade específica recebe

---

## 🔮 Melhorias Futuras Possíveis

1. **Notificações por Email:** Enviar também por email
2. **Configurações Personalizadas:** Usuário escolher se quer receber
3. **Digest Diário:** Opção de receber resumo diário ao invés de imediato
4. **Notificações para Outros Eventos:**
   - Atualização de dados da empresa
   - Status alterado para inadimplente
   - Vencimento de contrato próximo
5. **Templates Customizáveis:** Permitir personalizar formato da mensagem
6. **Prioridades:** Empresas VIP com notificação destacada

---

## 📝 Observações Importantes

- ⚠️ Usuário que cadastra **não recebe** a própria notificação
- ⚠️ Sistema **não falha** se não houver usuários do financeiro na cidade
- ⚠️ Erros no envio de notificações **não impedem** o cadastro da empresa
- ✅ Notificações ficam registradas no histórico do chat
- ✅ Suporta múltiplos usuários do financeiro na mesma cidade

---

## 🛠️ Troubleshooting

### **Notificação não está sendo enviada:**
1. Verificar se existem usuários com `allowed_sectors: "financeiro"`
2. Verificar se usuários têm a cidade correta em `allowed_cities`
3. Checar logs do backend: `tail -f /var/log/supervisor/backend.*.log`
4. Verificar se chat_enhanced está funcionando

### **Mensagem não aparece no chat:**
1. Verificar se usuário tem acesso ao chat
2. Refresh da página
3. Verificar se conversa foi criada no banco de dados

---

**Sistema implementado e funcionando! ✅**
