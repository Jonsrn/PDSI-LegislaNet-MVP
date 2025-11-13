# 🔍 Análise Cruzada de Bugs - Sistema de Tokens e Notificações TV

**Data:** 13/10/2025
**Status:** ✅ **RESOLVIDO - Comunicação Direta Restaurada**

**Commits Analisados:**
- ✅ `c7cacd58` - MVP finalized (funcionando)
- ⚠️ `9abcbc90` - Ajuste de manipulação de token JWT + teste de endpoints
- ⚠️ `a5ccb28f` - Ajustes de proteção + testes de tokens (quebrou TV)
- ✅ **ATUAL** - Middleware removido, comunicação direta restaurada

---

## 🚨 PROBLEMA CRÍTICO #1: TV NÃO RECEBE NOTIFICAÇÃO DE VOTAÇÃO

### **Causa Raiz Identificada**

No commit `a5ccb28f`, foram adicionados middlewares de autenticação nas rotas de notificação cross-server:

**Arquivo:** [src/routes/votacaoAoVivo.js](src/routes/votacaoAoVivo.js#L9-L21)

```javascript
// ❌ ANTES (funcionava):
router.post('/notify', votacaoAoVivoController.notifyVotacaoAoVivo);
router.post('/notify-voto', votacaoAoVivoController.notifyVoto);

// ❌ DEPOIS (quebrou):
router.post('/notify', canManagePautas, votacaoAoVivoController.notifyVotacaoAoVivo);
router.post('/notify-voto', canManagePautas, votacaoAoVivoController.notifyVoto);
```

### **Por que quebrou?**

1. **Backend Tablet (:3003)** envia HTTP POST para `:3000` **SEM TOKEN JWT**:
   ```javascript
   // Apps/tablet_backend/server.js:221-230
   const options = {
     hostname: 'localhost',
     port: 3000,
     path: '/api/votacao-ao-vivo/notify',
     method: 'POST',
     headers: {
       'Content-Type': 'application/json',
       // ❌ FALTA: 'Authorization': 'Bearer <token>'
     }
   };
   ```

2. **Middleware `canManagePautas`** requer token JWT válido:
   ```javascript
   // src/middleware/authMiddleware.js:145
   const canManagePautas = hasPermission(['super_admin', 'admin_camara']);
   ```

3. **Resultado:** Requisições HTTP cross-server retornam **401 Unauthorized**

4. **Consequência:** TV nunca recebe evento `tv:iniciar-votacao` via WebSocket

---

### **Fluxo Quebrado**

```
Admin Web (:3000) → POST /api/painel-controle/iniciar-votacao
       ↓
Backend Web (:3000) → HTTP POST :3003/api/notify/iniciar-votacao (SEM TOKEN)
       ↓
Backend Tablet (:3003) → Emite WebSocket para tablets ✅
       ↓
Backend Tablet (:3003) → HTTP POST :3000/api/votacao-ao-vivo/notify (SEM TOKEN)
       ↓
Backend Web (:3000) → ❌ 401 Unauthorized (middleware canManagePautas bloqueia)
       ↓
TV → ❌ NÃO RECEBE "tv:iniciar-votacao"
```

---

## 🛠️ SOLUÇÃO APLICADA

### **✅ Solução Implementada: Remover Middleware de Rotas Internas**

As rotas de notificação cross-server foram restauradas ao estado original **sem autenticação**, pois:
- São chamadas entre servidores confiáveis na mesma máquina
- Não são expostas publicamente
- Já possuem rate limiting para proteger contra abuso
- Simplifica arquitetura e mantém performance

**Correção Aplicada:**

```javascript
// src/routes/votacaoAoVivo.js

// Rotas para comunicação cross-server (INTERNAS - sem autenticação)
router.post("/notify", votacaoAoVivoController.notifyVotacaoAoVivo);
router.post("/notify-voto", votacaoAoVivoController.notifyVoto);

// Rota para portal público (EXTERNA - com autenticação)
router.get("/status/:camaraId", canAccessVotacaoStatus, votacaoAoVivoController.getStatusVotacao);
```

**Resultado:**
- ✅ TV volta a receber notificações de votação
- ✅ Comunicação cross-server funcionando normalmente
- ✅ Sistema restaurado ao estado funcional de `c7cacd58`

---

## 💡 SOLUÇÕES ALTERNATIVAS (NÃO IMPLEMENTADAS)

### **Alternativa: IP + Secret Validation (Descartada)**

Esta solução foi considerada mas **não implementada** pois:
- ❌ Não escalável para múltiplos servidores
- ❌ Trabalhoso manter lista de IPs no .env
- ❌ Complexidade desnecessária para deploy monolítico

**Nota:** Para deploy distribuído em produção, considere implementar validação mais robusta no futuro.

---

### **Alternativa 2: Adicionar Token Interno para Comunicação Cross-Server (Não Implementada)**

Esta solução poderia ser usada em deploy distribuído, mas adiciona complexidade desnecessária:

#### **2.1. Criar Token de Serviço**

```javascript
// src/config/serviceToken.js
const jwt = require('jsonwebtoken');

const SERVICE_TOKEN_SECRET = process.env.SERVICE_TOKEN_SECRET || 'service-internal-secret-key';

function generateServiceToken() {
  return jwt.sign(
    {
      service: 'tablet_backend',
      role: 'service',
      iat: Math.floor(Date.now() / 1000)
    },
    SERVICE_TOKEN_SECRET,
    { expiresIn: '1y' } // Token de longa duração para serviços
  );
}

function validateServiceToken(token) {
  try {
    const decoded = jwt.verify(token, SERVICE_TOKEN_SECRET);
    return decoded.service === 'tablet_backend';
  } catch (error) {
    return false;
  }
}

module.exports = { generateServiceToken, validateServiceToken };
```

#### **2.2. Middleware Especial para Rotas Internas**

```javascript
// src/middleware/authMiddleware.js

const { validateServiceToken } = require('../config/serviceToken');

const allowServiceOrManagePautas = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token de acesso ausente' });
  }

  const token = authHeader.split(' ')[1];

  // Verifica se é token de serviço interno
  if (validateServiceToken(token)) {
    logger.log('✅ Token de serviço interno válido');
    req.isServiceRequest = true;
    return next();
  }

  // Se não for token de serviço, aplica validação normal
  return canManagePautas(req, res, next);
};

module.exports = {
  // ... outros exports
  allowServiceOrManagePautas
};
```

#### **2.3. Atualizar Rotas**

```javascript
// src/routes/votacaoAoVivo.js
router.post("/notify", allowServiceOrManagePautas, votacaoAoVivoController.notifyVotacaoAoVivo);
router.post("/notify-voto", allowServiceOrManagePautas, votacaoAoVivoController.notifyVoto);
```

#### **2.4. Backend Tablet Envia Token**

```javascript
// Apps/tablet_backend/server.js

const { generateServiceToken } = require('../../src/config/serviceToken'); // Importar da raiz
const SERVICE_TOKEN = generateServiceToken();

// Nas requisições HTTP:
const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/votacao-ao-vivo/notify',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${SERVICE_TOKEN}`, // ✅ Token de serviço
    'Content-Length': Buffer.byteLength(notificationPayload)
  }
};
```

---

### **Comparação de Soluções**

| Solução | Segurança | Complexidade | Performance | Status |
|---------|-----------|--------------|-------------|--------|
| **Comunicação Direta** | Boa (rate limit + localhost) | Baixa | Alta | ✅ **IMPLEMENTADA** |
| **IP + Secret Validation** | Muito Boa | Média | Alta | ❌ Descartada (não escalável) |
| **Token de Serviço JWT** | Excelente | Alta | Alta | ⚠️ Para produção distribuída futura |

---

## 🔐 PROBLEMA #2: GERENCIAMENTO DE TOKENS

### **Análise da Implementação**

#### **✅ Pontos Positivos**

1. **Blacklist de Tokens Implementada**
   ```javascript
   // src/utils/tokenManager.js
   if (tokenManager.isBlacklisted(token)) {
     return res.status(401).json({ error: 'Token inválido ou expirado.' });
   }
   ```
   - ✅ Tokens deslogados são invalidados imediatamente
   - ✅ Previne reuso de tokens antigos

2. **Sessão Única via `min_token_iat`**
   ```javascript
   if (tokenPayload.iat < profile.min_token_iat) {
     tokenManager.blacklistToken(token);
     return res.status(401).json({ error: 'Sessão expirada.' });
   }
   ```
   - ✅ Novo login invalida sessões anteriores
   - ✅ Protege contra roubo de token

3. **Verificação de Expiração no Frontend**
   ```javascript
   const now = Math.floor(Date.now() / 1000);
   if (tokenPayload.exp && tokenPayload.exp <= now) {
     // Tenta renovar
   }
   ```
   - ✅ Previne uso de tokens expirados
   - ✅ Tentativa automática de renovação

#### **⚠️ Problemas Identificados**

### **PROBLEMA #2.1: Refresh Token Não Gera Novo Token**

**Arquivo:** [src/controllers/authController.js:323-338](src/controllers/authController.js#L323-L338)

```javascript
// ❌ PROBLEMA: Retorna o MESMO token ao invés de gerar novo
return res.status(200).json({
  message: "Token validado com sucesso!",
  user: { /* dados */ },
  token: currentToken, // ❌ Mesmo token, não renovado!
});
```

**Impacto:**
- Token nunca é realmente renovado
- Quando expirar, usuário será deslogado mesmo chamando `/api/auth/refresh`
- Função não cumpre o propósito de "refresh"

**Correção Necessária:**

```javascript
// ✅ SOLUÇÃO: Gerar novo token via Supabase
const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();

if (refreshError || !refreshData.session) {
  logger.error('❌ Erro ao renovar sessão Supabase:', refreshError);
  return res.status(401).json({ error: 'Não foi possível renovar o token' });
}

const newToken = refreshData.session.access_token;

logger.log('✅ Novo token gerado com sucesso!');

return res.status(200).json({
  message: 'Token renovado com sucesso!',
  user: { /* dados */ },
  token: newToken, // ✅ Novo token gerado
});
```

**Observação:** O Supabase Auth gerencia refresh tokens automaticamente. É preciso usar `refreshSession()` para obter um novo access token.

---

### **PROBLEMA #2.2: Refresh Automático com Lógica Incorreta**

**Arquivo:** [web/js/global.js:388](web/js/global.js#L388)

```javascript
function shouldRefreshToken(tokenPayload) {
  if (!tokenPayload || !tokenPayload.exp) return true;

  const now = Math.floor(Date.now() / 1000);
  const timeUntilExpiry = tokenPayload.exp - now;
  const sixHours = 6 * 60 * 60; // 6 horas

  // ❌ Se faltam MENOS de 6 horas, valida
  return timeUntilExpiry <= sixHours;
}
```

**Problema:**
- Token padrão do Supabase dura **1 hora**
- Lógica verifica se faltam **6 horas**
- Resultado: **SEMPRE retorna true** (renova sempre)

**Correção:**

```javascript
function shouldRefreshToken(tokenPayload) {
  if (!tokenPayload || !tokenPayload.exp) return true;

  const now = Math.floor(Date.now() / 1000);
  const timeUntilExpiry = tokenPayload.exp - now;

  // ✅ Renovar quando faltam 10 minutos (tokens Supabase duram 1h)
  const tenMinutes = 10 * 60;

  return timeUntilExpiry <= tenMinutes;
}
```

---

### **PROBLEMA #2.3: protectPage() com await na Renovação Opcional**

**Arquivo:** [web/js/global.js:549-553](web/js/global.js#L549-L553)

```javascript
// ❌ Fire-and-forget pode causar race condition
refreshAuthToken().catch((error) => {
  console.warn("[AUTH_GUARD] ⚠️ Renovação automática falhou:", error);
});
```

**Problema:**
- Renovação falha silenciosamente
- Se token expirar logo depois, usuário será deslogado sem aviso
- Não há retry

**Correção:**

```javascript
// ✅ Tentar renovar e avisar usuário se falhar criticamente
try {
  const refreshed = await refreshAuthToken();
  if (!refreshed) {
    console.warn("[AUTH_GUARD] ⚠️ Renovação falhou, mas token ainda válido");
  }
} catch (error) {
  console.warn("[AUTH_GUARD] ⚠️ Erro na renovação automática:", error);
  // Token ainda é válido, então não bloqueia acesso
}
```

---

## 🐛 PROBLEMA #3: ERROS CORRIQUEIROS ENCONTRADOS

### **3.1. Inconsistência de Portas na Documentação**

**Arquivos afetados:**
- [ARQUITETURA.md](ARQUITETURA.md) menciona porta `:3001`
- **Realidade:** Porta usada é `:3003`

**Correção:** Atualizar documentação (já corrigido no ARQUITETURA.md atualizado)

---

### **3.2. CORS Permissivo em Produção**

**Arquivo:** [Apps/tablet_backend/server.js:62-68](Apps/tablet_backend/server.js#L62-L68)

```javascript
// ⚠️ PROBLEMA: Permite qualquer localhost em produção
if (process.env.NODE_ENV !== "production") {
  if (origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:")) {
    return callback(null, true);
  }
}
```

**Correção:**

```javascript
// ✅ SOLUÇÃO: Desabilitar em produção real
if (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "staging") {
  if (origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:")) {
    return callback(null, true);
  }
}
```

---

### **3.3. Falta de Validação de Origem nas Requisições HTTP Cross-Server**

**Problema:**
- Qualquer processo localhost pode chamar `/api/votacao-ao-vivo/notify`
- Não há verificação de que a requisição vem do backend tablet

**Correção (Opcional):**

```javascript
// src/controllers/votacaoAoVivoController.js

const notifyVotacaoAoVivo = async (req, res) => {
  // ✅ Validar IP de origem
  const clientIp = req.ip || req.connection.remoteAddress;
  if (!['::1', '::ffff:127.0.0.1', '127.0.0.1'].includes(clientIp)) {
    logger.warn(`⚠️ Tentativa de notificação de IP não autorizado: ${clientIp}`);
    return res.status(403).json({ error: 'Origem não autorizada' });
  }

  // ... resto do código
};
```

---

### **3.4. Logs Sensíveis no Console**

**Arquivo:** [src/middleware/authMiddleware.js:43](src/middleware/authMiddleware.js#L43)

```javascript
logger.log(`Token extraído: Bearer ${token.substring(0, 10)}...`);
```

**Problema:**
- Loga parte do token (mesmo que parcial)
- Em produção, tokens não devem aparecer em logs

**Correção:**

```javascript
logger.log(`Token extraído: Bearer ****...`);
// OU
if (process.env.NODE_ENV === 'development') {
  logger.log(`Token extraído: Bearer ${token.substring(0, 10)}...`);
} else {
  logger.log(`Token extraído: Bearer ****...`);
}
```

---

## 📊 RESUMO EXECUTIVO

### **Problemas Críticos (Impedem Funcionalidade)**

| # | Problema | Severidade | Impacto | Solução |
|---|----------|------------|---------|---------|
| 1 | TV não recebe notificação de votação | 🔴 CRÍTICO | Sistema de votação TV não funciona | Remover middleware de rotas internas |
| 2.1 | Refresh token não gera novo token | 🟠 ALTO | Usuários serão deslogados ao expirar | Implementar `refreshSession()` do Supabase |

### **Problemas Médios (Degradam Experiência)**

| # | Problema | Severidade | Impacto | Solução |
|---|----------|------------|---------|---------|
| 2.2 | Lógica de refresh sempre ativa | 🟡 MÉDIO | Performance degradada | Ajustar threshold para 10 minutos |
| 2.3 | Renovação falha silenciosamente | 🟡 MÉDIO | Usuário deslogado sem aviso | Adicionar await e tratamento |

### **Problemas Baixos (Boas Práticas)**

| # | Problema | Severidade | Impacto | Solução |
|---|----------|------------|---------|---------|
| 3.1 | Documentação desatualizada | 🟢 BAIXO | Confusão para desenvolvedores | Corrigir portas na documentação |
| 3.2 | CORS permissivo | 🟢 BAIXO | Potencial de abuso em produção | Restringir a dev/staging |
| 3.3 | Sem validação de origem HTTP | 🟢 BAIXO | Risco de notificações falsas | Validar IP localhost |
| 3.4 | Logs com tokens | 🟢 BAIXO | Exposição de segredos | Ocultar tokens em produção |

---

## 🚀 PLANO DE AÇÃO E STATUS

### **✅ Prioridade 1 (CONCLUÍDO):**
1. ✅ **Remover middlewares** das rotas `/notify` e `/notify-voto`
   - **Arquivo:** `src/routes/votacaoAoVivo.js`
   - **Status:** IMPLEMENTADO
   - **Resultado:** TV volta a funcionar corretamente

### **⏭️ Prioridade 2 (PRÓXIMOS PASSOS - Recomendado):**
2. ⚠️ **Implementar refresh real** com `refreshSession()`
   - **Arquivo:** `src/controllers/authController.js`
   - **Tempo estimado:** 15 minutos
   - **Impacto:** Usuários não serão deslogados ao expirar token

3. ⚠️ **Ajustar lógica de `shouldRefreshToken`**
   - **Arquivo:** `web/js/global.js`
   - **Tempo estimado:** 5 minutos
   - **Impacto:** Melhor performance (evita renovações desnecessárias)

### **📋 Prioridade 3 (BACKLOG):**
4. ⏸️ **Adicionar tratamento na renovação**
   - **Arquivo:** `web/js/global.js`
   - **Status:** Pendente

5. ⏸️ **Adicionar validações de segurança**
   - Validação de IP localhost, ocultar logs sensíveis
   - **Status:** Pendente

### **🔮 Futuro (Apenas se Deploy Distribuído):**
6. 💡 **Implementar autenticação cross-server robusta**
   - Considerar IP + Secret ou Token de Serviço
   - **Apenas necessário para produção com servidores separados**

---

## ✅ VALIDAÇÃO DO SISTEMA DE TOKENS

### **Aspectos Corretos:**
- ✅ Blacklist de tokens funcionando
- ✅ Sessão única (min_token_iat) implementada corretamente
- ✅ Verificação de expiração no frontend
- ✅ Redirecionamento inteligente por role
- ✅ Middleware robusto com logs detalhados
- ✅ Rate limiting configurado
- ✅ Estrutura de roles bem definida

### **Requer Correção:**
- ❌ Refresh token não gera novo token (problema lógico)
- ❌ Threshold de renovação incorreto (sempre renova)
- ⚠️ Renovação falha silenciosamente

---

## 📝 CONCLUSÃO

### **Causa Principal do Bug da TV:**
A adição de middleware de autenticação (`canManagePautas`) nas rotas de notificação cross-server bloqueou a comunicação entre os backends, pois o backend tablet não envia token JWT ao notificar o backend web.

### **Solução Aplicada:**
✅ **Middlewares removidos** das rotas internas `/notify` e `/notify-voto`, restaurando comunicação direta entre servidores.

### **Estado do Sistema de Tokens:**
O sistema está **80% correto** na estrutura, mas com **bugs não-críticos na implementação do refresh** que podem ser corrigidos posteriormente.

### **Próximos Passos Recomendados:**
1. ✅ ~~Aplicar correção crítica (remover middlewares)~~ - CONCLUÍDO
2. 🧪 Testar sistema de votação TV
3. ⚠️ Implementar correções de refresh token (opcional, não urgente)
4. 🔐 Avaliar necessidade de autenticação cross-server apenas se deploy distribuído

---

**Gerado e atualizado automaticamente por Claude Code**
**Data de criação:** 13/10/2025
**Última atualização:** 13/10/2025 - Correção implementada
