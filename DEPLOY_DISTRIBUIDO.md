# 🚀 Guia de Deploy Distribuído - LegislaNet

> ⚠️ **DOCUMENTO OBSOLETO**
>
> Este guia foi criado para implementar autenticação cross-server com IP + Secret, mas a solução foi **descartada** em favor de **comunicação direta** entre servidores.
>
> **Motivo:** Não escalável e trabalhoso manter lista de IPs no .env
>
> **Status Atual:** Sistema usa comunicação direta sem autenticação entre servidores (localhost)
>
> **Deploy Recomendado:** Monolítico (ambos servidores na mesma máquina)
>
> ---
>
> ℹ️ Este documento permanece como **referência histórica** caso seja necessário implementar autenticação cross-server no futuro para deploy distribuído em produção.

---

## 📋 Visão Geral (HISTÓRICO)

Este guia **NÃO ESTÁ IMPLEMENTADO**. Explica como seria o deploy em **servidores separados** de forma segura:

```
┌─────────────────────┐           ┌──────────────────────┐
│  SERVIDOR WEB       │           │  SERVIDOR TABLET     │
│  IP: 192.168.1.5    │◄─────────►│  IP: 192.168.1.10    │
│  Backend Web :3000  │  Seguro   │  Backend Tablet      │
│                     │           │  :3003               │
└─────────────────────┘           └──────────────────────┘
```

---

## 🔐 Segurança da Comunicação Cross-Server

### **Problema Resolvido**

No commit `a5ccb28f`, middlewares de autenticação JWT foram adicionados às rotas de notificação cross-server, **quebrando** a comunicação entre servidores que não enviavam tokens.

### **Solução Implementada**

Sistema de autenticação específico para comunicação interna usando:
1. **IP Whitelisting** - Apenas IPs confiáveis podem se comunicar
2. **Header Secreto** - Secret compartilhado (`X-Internal-Secret`)

### **Características**

✅ **Funciona em DEV** (localhost sem secret configurado)
✅ **Seguro em PRODUÇÃO** (requer secret + IP válido)
✅ **Zero impacto no JWT** (rotas públicas mantêm autenticação normal)
✅ **Performance máxima** (validação simples e rápida)

---

## 🛠️ Configuração Passo a Passo

### **1. Gerar Secret Compartilhado**

```bash
# Opção 1: Com OpenSSL (Linux/Mac)
openssl rand -hex 32

# Opção 2: Com Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Opção 3: Online
# https://randomkeygen.com/ (seção "CodeIgniter Encryption Keys")
```

**Resultado exemplo:**
```
a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6
```

---

### **2. Configurar Servidor Web (:3000)**

#### **2.1. Arquivo `.env`**

```bash
# Supabase (mesmo em ambos servidores)
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_ANON_KEY=sua-chave-anon
SUPABASE_SERVICE_KEY=sua-service-key

# Secret compartilhado (IGUAL nos dois servidores)
INTERNAL_SERVER_SECRET=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6

# IPs confiáveis (adicionar IP do servidor tablet)
TRUSTED_SERVER_IPS=127.0.0.1,::1,192.168.1.10

PORT=3000
NODE_ENV=production
```

#### **2.2. Instalar Dependências e Iniciar**

```bash
cd /caminho/do/projeto/LegislaNet
npm install
node server-debug.js
```

---

### **3. Configurar Servidor Tablet (:3003)**

#### **3.1. Arquivo `.env`**

```bash
# Supabase (mesmo em ambos servidores)
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_ANON_KEY=sua-chave-anon
SUPABASE_SERVICE_KEY=sua-service-key

# Secret compartilhado (MESMA CHAVE do servidor web)
INTERNAL_SERVER_SECRET=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6

# Configuração do servidor web
WEB_BACKEND_HOST=192.168.1.5
WEB_BACKEND_PORT=3000

PORT=3003
NODE_ENV=production
```

#### **3.2. Instalar Dependências e Iniciar**

```bash
cd /caminho/do/projeto/LegislaNet/Apps/tablet_backend
npm install
node server.js
```

---

## 🔍 Validação da Configuração

### **1. Verificar Logs de Inicialização**

**Servidor Web (:3000):**
```
[SERVER] 🚀 === INICIANDO SERVIDOR WEB ===
[INTERNAL_AUTH] 🔐 Secret interno configurado para comunicação segura
[SERVER] ✅ Servidor rodando em: http://192.168.1.5:3000
```

**Servidor Tablet (:3003):**
```
[TABLET_SERVER] 🚀 === INICIANDO SERVIDOR TABLET BACKEND ===
[TABLET_SERVER] 🌐 Backend Web configurado em: 192.168.1.5:3000
[TABLET_SERVER] 🔐 Secret interno configurado para comunicação segura
[TABLET_SERVER] ✅ Servidor rodando em: http://192.168.1.10:3003
```

---

### **2. Testar Comunicação Cross-Server**

#### **Teste 1: Iniciar Votação**

1. Admin acessa: `http://192.168.1.5:3000/app/painel_votacao.html`
2. Clica em "Iniciar Votação" em uma pauta
3. Verificar logs:

**Servidor Web:**
```
[PAINEL_CONTROLE] Iniciando votação da pauta 123
[PAINEL_CONTROLE] ✅ Notificação enviada ao tablet backend
```

**Servidor Tablet:**
```
[TABLET_SERVER] 🗳️ Recebida solicitação para iniciar votação da pauta 123
[INTERNAL_AUTH] ✅ IP validado: 192.168.1.5
[INTERNAL_AUTH] ✅ Requisição interna validada com sucesso
[TABLET_SERVER] ✅ Portal público notificado sobre início de votação
```

**Servidor Web (retorno):**
```
[INTERNAL_AUTH] ✅ IP validado: 192.168.1.10
[INTERNAL_AUTH] ✅ Requisição interna validada com sucesso
[VOTACAO_AO_VIVO] ✅ WebSocket emitido para TVs - Câmara 1
```

**Resultado esperado:**
- ✅ Tablets recebem notificação de votação
- ✅ TVs carregam template de votação automaticamente
- ✅ Sem erros 401 ou 403 nos logs

---

#### **Teste 2: Registrar Voto**

1. Vereador vota no tablet
2. Verificar logs:

**Servidor Tablet:**
```
[TABLET_VOTO_CONTROLLER] Registrando voto do vereador na pauta 123: SIM
[WEBSOCKET_SERVICE] 🗳️ Notificando voto para câmara 1
[TABLET_SERVER] ✅ Portal público notificado sobre voto
```

**Servidor Web:**
```
[INTERNAL_AUTH] ✅ Requisição interna validada
[VOTACAO_AO_VIVO] 🗳️ Voto recebido - Pauta: 123, Voto: SIM
[VOTACAO_AO_VIVO] 📺 Voto emitido para TVs na sala tv-camara-1
```

**Resultado esperado:**
- ✅ TV exibe notificação de voto em tempo real
- ✅ Estatísticas atualizam automaticamente

---

## ⚠️ Troubleshooting

### **Erro: "Origem não autorizada"**

```
[INTERNAL_AUTH] ⚠️ Requisição de IP NÃO CONFIÁVEL bloqueada: 192.168.1.99
```

**Solução:**
- Verificar `TRUSTED_SERVER_IPS` no servidor web
- Adicionar IP do servidor tablet: `192.168.1.10`
- Reiniciar servidor web

---

### **Erro: "Secret de autenticação inválido"**

```
[INTERNAL_AUTH] ⚠️ Secret inválido ou ausente de IP: 192.168.1.10
```

**Soluções:**

1. **Verificar se secret é o mesmo nos dois `.env`:**
   ```bash
   # Servidor Web
   grep INTERNAL_SERVER_SECRET .env

   # Servidor Tablet
   grep INTERNAL_SERVER_SECRET Apps/tablet_backend/.env
   ```

2. **Verificar espaços extras:**
   ```bash
   # ❌ ERRADO (com espaços)
   INTERNAL_SERVER_SECRET= a1b2c3d4

   # ✅ CERTO
   INTERNAL_SERVER_SECRET=a1b2c3d4
   ```

3. **Reiniciar ambos servidores após alterar `.env`**

---

### **TV não carrega template de votação**

**Verificar:**

1. **Servidor Tablet consegue alcançar Servidor Web:**
   ```bash
   # No servidor tablet
   curl -v http://192.168.1.5:3000/health
   ```

2. **Firewall permite porta 3000:**
   ```bash
   # Linux
   sudo ufw allow 3000/tcp

   # Windows
   netsh advfirewall firewall add rule name="Backend Web 3000" dir=in action=allow protocol=TCP localport=3000
   ```

3. **Variável `WEB_BACKEND_HOST` correta:**
   ```bash
   # Apps/tablet_backend/.env
   WEB_BACKEND_HOST=192.168.1.5  # IP real do servidor web
   ```

---

## 🌐 Topologias de Deploy Suportadas

### **1. Deploy em Rede Local (LAN)**

```
┌─────────────────────────────────────────┐
│         Rede Local 192.168.1.0/24       │
├─────────────────────────────────────────┤
│  Servidor Web: 192.168.1.5:3000        │
│  Servidor Tablet: 192.168.1.10:3003    │
│  Tablets/TVs: 192.168.1.x               │
└─────────────────────────────────────────┘
```

**Configuração:**
```bash
# Servidor Web .env
TRUSTED_SERVER_IPS=127.0.0.1,::1,192.168.1.10

# Servidor Tablet .env
WEB_BACKEND_HOST=192.168.1.5
```

---

### **2. Deploy em Cloud/VPC**

```
┌─────────────────────────────────────────┐
│         VPC 10.0.0.0/16                 │
├─────────────────────────────────────────┤
│  Servidor Web: 10.0.1.10:3000          │
│  Servidor Tablet: 10.0.2.20:3003       │
│                                         │
│  Security Groups:                       │
│  - Web → Tablet: Porta 3003            │
│  - Tablet → Web: Porta 3000             │
└─────────────────────────────────────────┘
```

**Configuração:**
```bash
# Servidor Web .env
TRUSTED_SERVER_IPS=127.0.0.1,::1,10.0.2.20

# Servidor Tablet .env
WEB_BACKEND_HOST=10.0.1.10
```

---

### **3. Deploy com Domínios**

```
┌─────────────────────────────────────────┐
│  web.legislanet.com → 203.0.113.5:3000 │
│  tablet.legislanet.com → 203.0.113.10  │
└─────────────────────────────────────────┘
```

**Configuração:**
```bash
# Servidor Web .env
TRUSTED_SERVER_IPS=127.0.0.1,::1,203.0.113.10

# Servidor Tablet .env
WEB_BACKEND_HOST=web.legislanet.com
WEB_BACKEND_PORT=3000
```

---

## 🔒 Boas Práticas de Segurança

### **1. Secret Forte**

✅ **Usar:**
- Mínimo 32 caracteres
- Gerado aleatoriamente
- Apenas caracteres hexadecimais

❌ **Evitar:**
- Senhas comuns
- Palavras de dicionário
- Secrets compartilhados com outras aplicações

---

### **2. Renovação de Secret**

**Quando renovar:**
- A cada 6 meses (rotação regular)
- Se houver suspeita de vazamento
- Após desligamento de funcionário com acesso

**Como renovar:**
1. Gerar novo secret
2. Atualizar `.env` de ambos servidores
3. Reiniciar servidores em sequência:
   - Primeiro: Servidor Tablet
   - Depois: Servidor Web

---

### **3. Monitoramento**

**Configurar alertas para:**
- Tentativas de acesso com IP não autorizado
- Falhas de autenticação repetidas
- Tempo de resposta entre servidores elevado

**Exemplo com PM2:**
```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

---

## 📊 Checklist de Deploy

- [ ] `.env` configurado em ambos servidores
- [ ] `INTERNAL_SERVER_SECRET` igual nos dois
- [ ] `WEB_BACKEND_HOST` apontando para IP correto
- [ ] `TRUSTED_SERVER_IPS` incluindo IP do tablet
- [ ] Firewall permite porta 3000 e 3003
- [ ] Teste de comunicação cross-server (curl)
- [ ] Teste de iniciar votação funcionando
- [ ] TV carrega template automaticamente
- [ ] Logs sem erros 401/403
- [ ] Backup dos arquivos `.env` em local seguro

---

## 📞 Suporte

**Problemas comuns:**
- Consultar seção [Troubleshooting](#-troubleshooting)
- Verificar logs em ambos servidores
- Validar conectividade de rede

**Documentos relacionados:**
- [ANALISE_BUGS_TOKENS.md](ANALISE_BUGS_TOKENS.md) - Análise técnica do problema
- [ARQUITETURA.md](ARQUITETURA.md) - Arquitetura completa do sistema
- [AUTH_USAGE_GUIDE.md](AUTH_USAGE_GUIDE.md) - Sistema de autenticação JWT

---

**✅ Deploy configurado com sucesso!**
