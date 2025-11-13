# Guia de Uso da Nova Autenticação do LegislaNet

## Visão Geral

O sistema de autenticação foi completamente reescrito para oferecer:

- ✅ **Validação automática de roles** por página
- ✅ **Refresh token automático** (renovação antes de expirar)
- ✅ **Redirecionamento inteligente** baseado no role do usuário
- ✅ **Proteção contra tokens expirados**
- ✅ **Sincronização entre abas** (logout em uma aba afeta todas)
- ✅ **Middleware robusto** no backend
- ✅ **Logs detalhados** para debug

## Tipos de Usuário e Módulos

```javascript
const ROLE_ROUTES = {
  super_admin: {
    module: "admin",
    defaultPage: "/admin/dashboard_admin.html",
    allowedPaths: ["/admin/"],
  },
  admin_camara: {
    module: "app",
    defaultPage: "/app/dashboard.html",
    allowedPaths: ["/app/"],
  },
  tv: {
    module: "tv",
    defaultPage: "/tv/espera.html",
    allowedPaths: ["/tv/"],
  },
  vereador: {
    module: "tablet",
    defaultPage: "/tablet/",
    allowedPaths: ["/tablet/"],
  },
};
```

## Como Usar em uma Página

### Método 1: Proteção Simples (Automática)

```javascript
document.addEventListener("DOMContentLoaded", async () => {
  try {
    // Proteção básica - verifica auth e redireciona automaticamente
    await protectPage();

    // Seu código da página aqui...
    console.log("Usuário autenticado:", window.currentUser);
  } catch (error) {
    console.error("Falha na autenticação:", error);
    return;
  }
});
```

### Método 2: Proteção com Validação de Role

```javascript
document.addEventListener("DOMContentLoaded", async () => {
  try {
    // Proteção com roles específicos
    await protectPage({
      allowedRoles: ["super_admin", "admin_camara"], // Apenas estes roles
      requireAuth: true,
      autoRedirect: true,
    });

    // Seu código da página aqui...
  } catch (error) {
    console.error("Acesso negado:", error);
    return;
  }
});
```

### Método 3: Proteção com Layout Integrado

```javascript
document.addEventListener("DOMContentLoaded", async () => {
  const success = await initPageWithAuth({
    // Configuração de autenticação
    auth: {
      allowedRoles: ["admin_camara"],
      requireAuth: true,
      autoRedirect: true,
    },
    // Configuração do layout
    title: "Dashboard",
    icon: "fa-chart-line",
    navActive: "dashboard",
  });

  if (!success) return;

  // Seu código da página aqui...
});
```

## Funcionalidades Automáticas

### 1. Renovação Automática de Token

- O sistema verifica o token a cada 5 minutos
- Renova automaticamente quando faltam 30 minutos para expirar
- Desloga automaticamente se a renovação falhar

### 2. Redirecionamento Inteligente

Se um usuário acessa uma URL incorreta para seu role:

- `super_admin` acessando `/app/` → redirecionado para `/admin/`
- `admin_camara` acessando `/admin/` → redirecionado para `/app/`
- `tv` acessando qualquer outra coisa → redirecionado para `/tv/`

### 3. Sincronização Entre Abas

- Logout em uma aba automaticamente desloga todas as outras
- Renovação de token em uma aba atualiza todas as outras

## Configurações da Função protectPage()

```javascript
await protectPage({
  allowedRoles: ["super_admin", "admin_camara"], // Array de roles permitidos
  requireAuth: true, // Se requer autenticação (padrão: true)
  autoRedirect: true, // Se deve redirecionar baseado no role (padrão: true)
});
```

### Parâmetros:

- **allowedRoles**: Array de strings com os roles permitidos. Se não especificado, qualquer usuário autenticado pode acessar
- **requireAuth**: Boolean indicando se a página requer autenticação. Padrão é `true`
- **autoRedirect**: Boolean indicando se deve redirecionar automaticamente usuários para o módulo correto baseado no role

## Exemplos por Tipo de Página

### Página de Admin (Super Admin apenas)

```javascript
await protectPage({
  allowedRoles: ["super_admin"],
  requireAuth: true,
  autoRedirect: true,
});
```

### Página de App (Admin de Câmara apenas)

```javascript
await protectPage({
  allowedRoles: ["admin_camara"],
  requireAuth: true,
  autoRedirect: true,
});
```

### Página de TV (TV apenas)

```javascript
await protectPage({
  allowedRoles: ["tv"],
  requireAuth: true,
  autoRedirect: true,
});
```

### Página Pública (Sem autenticação)

```javascript
await protectPage({
  requireAuth: false,
});
```

### Página Multi-Role (Vários tipos de usuário)

```javascript
await protectPage({
  allowedRoles: ["super_admin", "admin_camara"],
  requireAuth: true,
  autoRedirect: false, // Não redireciona, apenas valida
});
```

## Backend - Refresh Token

O backend agora possui endpoint `/api/auth/refresh` que:

1. Valida o token atual
2. Gera um novo token com prazo estendido
3. Atualiza o timestamp mínimo no perfil (invalidando tokens antigos)
4. Retorna os dados atualizados do usuário

## Logs de Debug

O sistema produz logs detalhados com prefixo `[AUTH_GUARD]`:

```
[AUTH_GUARD] 🛡️ Iniciando verificação de autenticação...
[AUTH_GUARD] ✅ Usuário autenticado: admin@camara.gov.br (admin_camara)
[AUTH_GUARD] 🔄 Token próximo do vencimento, renovando...
[AUTH_GUARD] ✅ Token renovado com sucesso
[AUTH_GUARD] ✅ Autenticação e autorização bem-sucedidas
```

## Migração de Código Existente

### Antes:

```javascript
try {
  protectPage();
} catch (e) {
  console.error(e.message);
  return;
}
```

### Depois:

```javascript
try {
  await protectPage({
    allowedRoles: ["admin_camara"], // Especifique os roles apropriados
    requireAuth: true,
    autoRedirect: true,
  });
} catch (e) {
  console.error(e.message);
  return;
}
```

## Vantagens da Nova Implementação

1. **Segurança**: Validação rigorosa de roles e tokens
2. **UX**: Usuários são redirecionados automaticamente para o módulo correto
3. **Performance**: Renovação automática evita re-logins desnecessários
4. **Manutenibilidade**: Código centralizado e reutilizável
5. **Debug**: Logs detalhados facilitam troubleshooting
6. **Escalabilidade**: Fácil adição de novos roles e módulos
