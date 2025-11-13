# Metodologia de Testes - LegislaNet

## 🎯 Objetivo
Implementar testes automatizados com **100% de precisão**, garantindo que cada endpoint seja testado corretamente desde a primeira execução.

---

## 📋 Princípios da Metodologia

### 1. **Separação Clara de Responsabilidades**
- ✅ Testes de Autenticação (isolados)
- ✅ Testes de Endpoints Backend Web (porta 3000)
- ✅ Testes de Endpoints Backend Tablet (porta 3003)

### 2. **Dados Reais do Banco**
- ✅ Usar dados existentes no backup_completo.sql
- ✅ Consultas SQL para extrair IDs válidos
- ✅ Nenhum mock ou ID inventado

### 3. **Validação de Rotas Antes de Testar**
- ✅ Mapear rotas reais do código-fonte
- ✅ Validar que cada endpoint existe antes de criar teste
- ✅ Documentar expectativas de cada endpoint

---

## 🗂️ Estrutura de Arquivos Proposta

```
tests/
├── config/
│   ├── jest.config.js              # Configuração do Jest
│   └── testData.js                 # IDs e dados reais do banco
│
├── helpers/
│   ├── auth.helper.js              # Funções de autenticação
│   ├── request.helper.js           # Wrapper para requisições
│   └── validation.helper.js        # Validações comuns
│
├── fixtures/
│   ├── web-endpoints.json          # Endpoints do backend web
│   ├── tablet-endpoints.json       # Endpoints do backend tablet
│   └── test-payloads.json          # Payloads para POST/PUT
│
├── unit/
│   └── auth/
│       ├── login.test.js           # Testes de login (4 roles)
│       ├── logout.test.js          # Testes de logout
│       ├── refresh.test.js         # Testes de refresh token
│       └── profile.test.js         # Testes de perfil
│
├── integration/
│   ├── web/
│   │   ├── admin.test.js           # Endpoints /admin/* (super_admin)
│   │   ├── camaras.test.js         # Endpoints /camaras/*
│   │   ├── sessoes.test.js         # Endpoints /sessoes/* (admin_camara)
│   │   ├── pautas.test.js          # Endpoints /pautas/* (admin_camara)
│   │   ├── livestreams.test.js     # Endpoints /livestreams/* (tv)
│   │   └── webhooks.test.js        # Endpoints /webhooks/*
│   │
│   └── tablet/
│       ├── vereador.test.js        # Endpoints /vereador/*
│       ├── pautas.test.js          # Endpoints /pautas/* (GET only)
│       └── votos.test.js           # Endpoints /votos/*
│
├── scripts/
│   ├── extract-real-ids.js         # Extrai IDs do banco via SQL
│   ├── map-routes.js               # Mapeia rotas do código-fonte
│   └── validate-endpoints.js       # Valida endpoints antes dos testes
│
└── reports/
    └── test-results.html           # Relatório visual dos testes
```

---

## 🔍 Fase 1: Preparação dos Dados

### 1.1 Extrair IDs Reais do Banco

**Script: `tests/scripts/extract-real-ids.js`**

```javascript
// Extrai IDs diretamente do backup SQL ou via API
// Retorna objeto com IDs válidos para testes

const REAL_IDS = {
  camaraId: 'a5df7317-35d5-47e0-955f-668862ed00ac',  // Del
  superAdminId: '...',
  adminCamaraId: '...',
  vereadorId: '...',
  tvId: '...',
  partidoId: '...',
  sessaoId: '...',
  pautaId: '...',
  oradorId: '...'
}
```

**Consultas SQL Necessárias:**
```sql
-- 1. Câmara principal de teste
SELECT id, nome_camara FROM camaras WHERE nome_camara LIKE '%Del%' LIMIT 1;

-- 2. Usuários de cada role
SELECT p.id, p.nome, p.role, u.email
FROM profiles p
JOIN auth.users u ON p.id = u.id
WHERE p.role IN ('super_admin', 'admin_camara', 'tv', 'vereador');

-- 3. Partido válido
SELECT id, sigla FROM partidos LIMIT 1;

-- 4. Vereador ativo da câmara Del
SELECT v.id, v.nome_parlamentar
FROM vereadores v
WHERE v.camara_id = 'a5df7317-35d5-47e0-955f-668862ed00ac'
LIMIT 1;

-- 5. Sessão válida da câmara Del
SELECT s.id, s.tipo, s.data_sessao
FROM sessoes s
WHERE s.camara_id = 'a5df7317-35d5-47e0-955f-668862ed00ac'
ORDER BY s.created_at DESC
LIMIT 1;

-- 6. Pauta válida
SELECT p.id, p.nome, p.sessao_id
FROM pautas p
WHERE p.sessao_id IN (
  SELECT id FROM sessoes WHERE camara_id = 'a5df7317-35d5-47e0-955f-668862ed00ac'
)
LIMIT 1;

-- 7. Orador válido
SELECT o.id, o.vereador_id, o.sessao_id
FROM oradores o
WHERE o.sessao_id IN (
  SELECT id FROM sessoes WHERE camara_id = 'a5df7317-35d5-47e0-955f-668862ed00ac'
)
LIMIT 1;
```

### 1.2 Mapear Rotas do Código-Fonte

**Script: `tests/scripts/map-routes.js`**

```javascript
// Escaneia todos os arquivos de rotas (src/routes/*)
// Extrai método HTTP, path, middleware de autenticação
// Gera JSON com endpoints válidos organizados por servidor

{
  "web": [
    {
      "method": "GET",
      "path": "/api/admin/camaras",
      "auth": "isSuperAdmin",
      "file": "src/routes/admin.js:15"
    }
  ],
  "tablet": [
    {
      "method": "GET",
      "path": "/api/vereador/profile",
      "auth": "hasPermission(['vereador'])",
      "file": "Apps/tablet_backend/src/routes/vereador.js:8"
    }
  ]
}
```

**Detecção Automática:**
- Varre arquivos em `src/routes/` (backend web)
- Varre arquivos em `Apps/tablet_backend/src/routes/` (backend tablet)
- Identifica patterns: `router.get()`, `router.post()`, etc.
- Extrai middleware de autenticação usado

---

## 🧪 Fase 2: Implementação dos Testes

### 2.1 Estrutura de Cada Teste

```javascript
describe('Endpoint: GET /api/admin/camaras', () => {
  let authToken;

  beforeAll(async () => {
    // Login apenas uma vez por suite
    authToken = await loginAs('super_admin');
  });

  it('deve retornar lista de câmaras', async () => {
    const response = await request(WEB_BASE_URL)
      .get('/api/admin/camaras')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.body.data).toBeInstanceOf(Array);
    expect(response.body.data.length).toBeGreaterThan(0);
  });

  it('deve conter a câmara Del', async () => {
    const response = await request(WEB_BASE_URL)
      .get('/api/admin/camaras')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    const camaraDel = response.body.data.find(c =>
      c.nome_camara.includes('Del')
    );

    expect(camaraDel).toBeDefined();
    expect(camaraDel.id).toBe(REAL_IDS.camaraId);
  });

  it('deve negar acesso sem autenticação', async () => {
    await request(WEB_BASE_URL)
      .get('/api/admin/camaras')
      .expect(401);
  });

  it('deve negar acesso a role não autorizada', async () => {
    const vereadorToken = await loginAs('vereador');

    await request(WEB_BASE_URL)
      .get('/api/admin/camaras')
      .set('Authorization', `Bearer ${vereadorToken}`)
      .expect(403);
  });
});
```

### 2.2 Helper de Autenticação

```javascript
// tests/helpers/auth.helper.js

const CREDENTIALS = {
  super_admin: { email: 'jffilho618@gmail.com', password: '2512' },
  admin_camara: { email: 'del@exemplo.com', password: '123456' },
  tv: { email: 'tv@del.com', password: 'Tvdel123@' },
  vereador: { email: 'marcilene@del.com', password: 'Marcilene123@' }
};

const tokenCache = new Map();

async function loginAs(role, server = 'web') {
  const cacheKey = `${role}_${server}`;

  if (tokenCache.has(cacheKey)) {
    return tokenCache.get(cacheKey);
  }

  const baseUrl = server === 'web' ? WEB_BASE_URL : TABLET_BASE_URL;
  const credentials = CREDENTIALS[role];

  const response = await request(baseUrl)
    .post('/api/auth/login')
    .send(credentials);

  if (response.status !== 200) {
    throw new Error(`Login falhou para ${role}: ${response.status}`);
  }

  const token = response.body.token;
  tokenCache.set(cacheKey, token);

  return token;
}

async function clearTokenCache() {
  tokenCache.clear();
}

module.exports = { loginAs, clearTokenCache };
```

---

## 🎯 Fase 3: Execução Estratégica

### 3.1 Ordem de Execução

```bash
# 1. Validar que servidores estão rodando
npm run test:health

# 2. Testar autenticação (base para tudo)
npm run test:auth

# 3. Testar endpoints web por categoria
npm run test:web:admin
npm run test:web:camaras
npm run test:web:sessoes
npm run test:web:livestreams

# 4. Testar endpoints tablet
npm run test:tablet:vereador
npm run test:tablet:votos

# 5. Executar tudo
npm test
```

### 3.2 Scripts no package.json

```json
{
  "scripts": {
    "test": "jest --verbose --coverage",
    "test:health": "node tests/scripts/check-servers.js",
    "test:auth": "jest tests/unit/auth --verbose",
    "test:web": "jest tests/integration/web --verbose",
    "test:tablet": "jest tests/integration/tablet --verbose",
    "test:web:admin": "jest tests/integration/web/admin.test.js",
    "test:prepare": "node tests/scripts/extract-real-ids.js && node tests/scripts/map-routes.js"
  }
}
```

---

## 📊 Fase 4: Validação e Relatórios

### 4.1 Critérios de Sucesso

**Cada teste deve:**
- ✅ Usar IDs reais do banco
- ✅ Validar estrutura de resposta (não apenas status code)
- ✅ Testar autenticação/autorização
- ✅ Testar casos de erro (404, 400, 403)
- ✅ Não depender de ordem de execução
- ✅ Limpar cache de tokens entre suites se necessário

**Métricas de Qualidade:**
- ✅ **Coverage:** > 80% dos endpoints
- ✅ **Precisão:** 0 falsos positivos
- ✅ **Confiabilidade:** Testes determinísticos
- ✅ **Performance:** Suite completa < 2 minutos

### 4.2 Relatório Detalhado

```javascript
// Ao final de cada suite
afterAll(() => {
  console.log(`
    ✅ Endpoints testados: ${passedTests}/${totalTests}
    ❌ Falhas: ${failedTests}
    ⏱️  Tempo: ${duration}ms
  `);
});
```

---

## 🚨 Checklist de Implementação

### Antes de Começar
- [ ] Servidores web (3000) e tablet (3003) rodando
- [ ] Banco de dados com backup restaurado
- [ ] Dependências instaladas (jest, supertest)

### Fase de Preparação
- [ ] Executar `extract-real-ids.js` para obter IDs válidos
- [ ] Executar `map-routes.js` para mapear rotas reais
- [ ] Validar que todos os IDs existem no banco

### Implementação de Testes
- [ ] Testes de autenticação (4 roles)
- [ ] Testes web - endpoints /admin/
- [ ] Testes web - endpoints /camaras/
- [ ] Testes web - endpoints /sessoes/
- [ ] Testes web - endpoints /pautas/
- [ ] Testes web - endpoints /livestreams/
- [ ] Testes tablet - endpoints /vereador/
- [ ] Testes tablet - endpoints /votos/

### Validação Final
- [ ] Todos os testes passam individualmente
- [ ] Todos os testes passam em sequência
- [ ] Sem falsos positivos
- [ ] Relatório de cobertura gerado

---

## 💡 Vantagens desta Metodologia

1. **Mitigação de Erros:**
   - Dados reais eliminam IDs inválidos
   - Mapeamento de rotas evita testar endpoints inexistentes
   - Separação por servidor evita confusão de portas

2. **Manutenibilidade:**
   - Estrutura clara e organizada
   - Fácil adicionar novos testes
   - Helpers reutilizáveis

3. **Confiabilidade:**
   - Testes determinísticos
   - Independentes entre si
   - Cache de tokens otimiza performance

4. **Rastreabilidade:**
   - Cada teste documenta o endpoint
   - Relatórios detalhados
   - Fácil identificar problemas

---

## 🎓 Próximo Passo Sugerido

**Começar pela Fase 1:**
1. Criar script `extract-real-ids.js` com as consultas SQL
2. Executar e validar IDs
3. Criar estrutura de pastas
4. Implementar helper de autenticação
5. Testar autenticação primeiro (base para tudo)

**Gostaria que eu implemente essa metodologia passo a passo?**
