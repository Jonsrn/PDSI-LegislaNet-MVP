# Legisla Net - Backend para Tablets

Backend dedicado para aplicação tablet dos vereadores.

## 🚀 Características

- **Segregação de responsabilidades**: Backend exclusivo para tablets
- **Autenticação específica**: Apenas vereadores podem acessar
- **Logs persistentes**: Sistema de logs com rotação diária
- **API RESTful**: Endpoints organizados e documentados
- **Segurança**: Rate limiting, CORS configurado, validações

## 📁 Estrutura

```
Apps/tablet_backend/
├── src/
│   ├── config/
│   │   ├── logger.js          # Sistema de logs com Winston
│   │   └── supabase.js        # Clientes Supabase
│   ├── controllers/
│   │   ├── authController.js  # Autenticação de vereadores
│   │   └── vereadorController.js # Operações de vereadores
│   ├── middleware/
│   │   └── authMiddleware.js  # Middleware de autenticação
│   └── routes/
│       ├── auth.js           # Rotas de autenticação
│       └── vereador.js       # Rotas de vereadores
├── logs/                     # Logs persistentes (auto-criado)
├── .env                      # Configurações
├── .env.example             # Exemplo de configurações
├── package.json             # Dependências
└── server.js               # Servidor principal
```

## 🛠️ Instalação

1. Instalar dependências:
```bash
cd Apps/tablet_backend
npm install
```

2. Configurar variáveis de ambiente:
```bash
cp .env.example .env
# Editar .env com suas configurações
```

3. Iniciar servidor:
```bash
# Desenvolvimento
npm run dev

# Produção
npm start
```

## 📡 API Endpoints

### Autenticação
- `POST /api/auth/login` - Login de vereador
- `POST /api/auth/logout` - Logout

### Vereador (requer autenticação)
- `GET /api/vereador/profile` - Perfil do vereador logado
- `GET /api/vereador/camara` - Vereadores da mesma câmara
- `PUT /api/vereador/foto` - Atualizar foto do perfil

### Sistema
- `GET /health` - Health check

## 🔐 Segurança

- Rate limiting: 100 requests por 15 minutos por IP
- CORS configurado para Flutter
- Helmet para headers de segurança
- Validação de entrada com express-validator
- Autenticação JWT com Supabase

## 📊 Logs

Os logs são salvos em `logs/` com rotação diária:
- `tablet_backend_YYYY-MM-DD.log` - Logs gerais
- `tablet_errors_YYYY-MM-DD.log` - Apenas erros
- `tablet_auth_YYYY-MM-DD.log` - Logs de autenticação

## 🔄 Comunicação com Frontend

O backend roda na porta `3001` por padrão e está configurado para aceitar requisições do Flutter em desenvolvimento.

## 📝 Desenvolvimento

Para adicionar novas funcionalidades:

1. Criar controller em `src/controllers/`
2. Adicionar rotas em `src/routes/`
3. Implementar middleware se necessário em `src/middleware/`
4. Atualizar documentação

## 🐛 Debug

Logs detalhados são exibidos no console em modo desenvolvimento e salvos em arquivos em todos os ambientes.