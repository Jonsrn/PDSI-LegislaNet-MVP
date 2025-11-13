// ==========================================
// SERVIDOR DE DEBUG PARA DIAGNOSTICAR O 404
// ==========================================

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const path = require("path");
const { createServer } = require("http");
const { Server } = require("socket.io");
require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");

// ==========================================
// SISTEMA DE LOGS DETALHADO
// ==========================================
const createLogger = (context) => {
  return {
    log: (...args) =>
      console.log(`[${context}]`, new Date().toISOString(), ...args),
    error: (...args) =>
      console.error(`[${context} ERROR]`, new Date().toISOString(), ...args),
  };
};

const serverLogger = createLogger("SERVER");
const routeLogger = createLogger("ROUTES");
const middlewareLogger = createLogger("MIDDLEWARE");

// ==========================================
// INTERCEPTADOR DE TODAS AS REQUISIÇÕES
// ==========================================
function createRequestInterceptor() {
  return (req, res, next) => {
    const startTime = Date.now();
    middlewareLogger.log(`🟦 REQUISIÇÃO RECEBIDA: ${req.method} ${req.url}`);
    middlewareLogger.log(`   Headers:`, JSON.stringify(req.headers, null, 2));
    middlewareLogger.log(`   Body:`, req.body);
    middlewareLogger.log(`   Query:`, req.query);
    middlewareLogger.log(`   Params:`, req.params);

    // Interceptar resposta
    const originalSend = res.send;
    const originalJson = res.json;

    res.send = function (data) {
      const duration = Date.now() - startTime;
      middlewareLogger.log(
        `🟩 RESPOSTA ENVIADA: ${res.statusCode} (${duration}ms)`
      );
      middlewareLogger.log(`   Data:`, data);
      originalSend.call(this, data);
    };

    res.json = function (data) {
      const duration = Date.now() - startTime;
      middlewareLogger.log(
        `🟩 RESPOSTA JSON: ${res.statusCode} (${duration}ms)`
      );
      middlewareLogger.log(`   Data:`, JSON.stringify(data, null, 2));
      originalJson.call(this, data);
    };

    next();
  };
}

// ==========================================
// MOSTRAR TODAS AS ROTAS REGISTRADAS
// ==========================================
function showRegisteredRoutes(app) {
  serverLogger.log("🔍 === ROTAS REGISTRADAS NO EXPRESS ===");

  function printRoutes(routes, prefix = "") {
    routes.forEach((route, index) => {
      if (route.route) {
        // Rota direta
        const methods = Object.keys(route.route.methods)
          .join(", ")
          .toUpperCase();
        serverLogger.log(
          `   ${index + 1}. ${methods} ${prefix}${route.route.path}`
        );
      } else if (route.name === "router") {
        // Sub-router
        let routerPrefix = route.regexp.source;
        // Limpar regex para mostrar path limpo
        routerPrefix = routerPrefix
          .replace(/^\^\\?/, "")
          .replace(/\$.*/, "")
          .replace(/\\\//g, "/")
          .replace(/\(\?\:\[\^\\\/\]\+\)\?\$/g, "");

        serverLogger.log(`   📁 ROUTER: ${routerPrefix}`);
        if (route.handle && route.handle.stack) {
          printRoutes(route.handle.stack, routerPrefix);
        }
      } else {
        serverLogger.log(
          `   ${index + 1}. MIDDLEWARE: ${route.name || "anonymous"}`
        );
      }
    });
  }

  if (app._router && app._router.stack) {
    serverLogger.log(
      `📊 Total de middlewares/rotas: ${app._router.stack.length}`
    );
    printRoutes(app._router.stack);
  } else {
    serverLogger.error("❌ Nenhuma rota encontrada no stack do Express!");
  }
}

// ==========================================
// MIDDLEWARE 404 PERSONALIZADO
// ==========================================
function create404Handler() {
  return (req, res, next) => {
    middlewareLogger.error(`❌ 404 NOT FOUND: ${req.method} ${req.url}`);
    middlewareLogger.error(`   Esta rota não foi encontrada no Express`);
    middlewareLogger.error(
      `   Verifique se a rota foi registrada corretamente`
    );

    res.status(404).json({
      error: "Rota não encontrada",
      method: req.method,
      url: req.url,
      timestamp: new Date().toISOString(),
      debug: "Middleware 404 personalizado - rota não existe",
    });
  };
}

// ==========================================
// SERVIDOR PRINCIPAL
// ==========================================
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin:
      process.env.NODE_ENV === "production"
        ? ["https://seu-dominio.com"]
        : [
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            /^http:\/\/(localhost|127\.0\.0\.1):\d+$/,
          ],
    methods: ["GET", "POST"],
  },
});
const PORT = process.env.PORT || 3000;

serverLogger.log("🚀 === INICIANDO SERVIDOR DE DEBUG ===");

// 1. Middleware de debug (PRIMEIRO DE TODOS)
serverLogger.log("1️⃣ Registrando interceptador de requisições...");
app.use(createRequestInterceptor());

// 2. Middleware de segurança
serverLogger.log("2️⃣ Registrando Helmet...");
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://fonts.googleapis.com",
          "https://cdnjs.cloudflare.com",
        ],
        fontSrc: [
          "'self'",
          "https://fonts.gstatic.com",
          "https://cdnjs.cloudflare.com",
        ],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://cdn.jsdelivr.net",
          "https://cdnjs.cloudflare.com",
          "https://cdn.socket.io",
          "https://www.youtube.com",
        ],
        scriptSrcAttr: ["'unsafe-inline'"], // Permite onclick, onload, etc
        imgSrc: ["'self'", "data:", "https:", "blob:"],
        connectSrc: [
          "'self'",
          process.env.SUPABASE_URL,
          "https://cdn.socket.io",
          "http://localhost:3002",
          "http://127.0.0.1:3002",
          "http://localhost:3003",
          "http://127.0.0.1:3003",
        ],
        frameSrc: ["'self'", "https://www.youtube.com", "https://youtube.com"],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);

// 3. CORS configurado para aplicação web
serverLogger.log("3️⃣ Registrando CORS...");
app.use(
  cors({
    origin:
      process.env.NODE_ENV === "production"
        ? ["https://seu-dominio.com"]
        : [
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            // Permitir qualquer porta local para desenvolvimento
            /^http:\/\/(localhost|127\.0\.0\.1):\d+$/,
          ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// 4. Body parsing com limite
serverLogger.log("4️⃣ Registrando express.json...");
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// 5. Tentar importar e registrar rotas
serverLogger.log("5️⃣ Tentando importar rotas...");
try {
  // Rotas existentes
  const authRoutes = require("./src/routes/auth");
  const adminRoutes = require("./src/routes/admin");
  const partidosRoutes = require("./src/routes/partidos");
  const pautasRoutes = require("./src/routes/pautas");
  const sessoesRoutes = require("./src/routes/sessoes");
  const votosRoutes = require("./src/routes/votos");

  // --- ROTAS ADICIONADAS ---
  const camaraRoutes = require("./src/routes/camaraRoutes");
  const publicRoutes = require("./src/routes/public");
  const livestreamRoutes = require("./src/routes/livestreamRoutes");
  const webhookRoutes = require("./src/routes/webhookRoutes");
  const painelControleRoutes = require("./src/routes/painelControle");
  const votacaoAoVivoRoutes = require("./src/routes/votacaoAoVivo");
  const {
    nestedVereadorRouter,
    singleVereadorRouter,
    appVereadorRouter,
  } = require("./src/routes/vereadorRoutes");
  const {
    nestedUserRouter,
    singleUserRouter,
  } = require("./src/routes/userRoutes");

  serverLogger.log("✅ Rotas importadas com sucesso!");

  serverLogger.log("6️⃣ Registrando rotas...");

  // Rotas públicas (sem autenticação) - registrar primeiro
  app.use("/api", publicRoutes);

  // Rotas autenticadas
  app.use("/api/auth", authRoutes);
  app.use("/api/admin", adminRoutes);
  app.use("/api/partidos", partidosRoutes);
  app.use("/api/pautas", pautasRoutes);
  app.use("/api/sessoes", sessoesRoutes);
  app.use("/api/votos", votosRoutes);

  // --- REGISTRO DAS NOVAS ROTAS ---
  app.use("/api/camaras", camaraRoutes);
  app.use("/api/livestreams", livestreamRoutes); // Rotas de livestreams
  app.use("/api/webhooks", webhookRoutes); // Rotas de webhooks do YouTube
  app.use("/api/painel-controle", painelControleRoutes); // Rotas do painel de controle
  app.use("/api/votacao-ao-vivo", votacaoAoVivoRoutes); // Rotas de votação ao vivo para portal público
  app.use("/api/vereadores", singleVereadorRouter); // Para /api/vereadores/:id
  app.use("/api/users", singleUserRouter); // Para /api/users/:id
  app.use("/api/app/vereadores", appVereadorRouter); // Para usuários da câmara

  // Rotas aninhadas
  app.use("/api/camaras/:camaraId/vereadores", nestedVereadorRouter);
  app.use("/api/camaras/:camaraId/users", nestedUserRouter);

  serverLogger.log("✅ Rotas registradas com sucesso!");
} catch (error) {
  serverLogger.error("❌ ERRO AO IMPORTAR OU REGISTRAR ROTAS:", error);
  serverLogger.error("Stack:", error.stack);
}

// 5.5. Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    service: "web-backend",
    version: "1.0.0",
  });
});
serverLogger.log("5.5️⃣ Health check endpoint registrado!");

// 6. Servir uploads (pautas e vereadores)
serverLogger.log("7️⃣ Registrando pasta de uploads...");
app.use(
  "/uploads",
  express.static(path.join(__dirname, "uploads"), {
    maxAge: "1h", // Cache de 1 hora para uploads
    etag: true,
  })
);

// 6.5. Servir scripts de teste
serverLogger.log("7.5️⃣ Registrando pasta de scripts de teste...");
app.use(
  "/scripts",
  express.static(path.join(__dirname, "scripts"), {
    maxAge: "0", // Sem cache para scripts de teste
    etag: false,
  })
);

// 7. Arquivos estáticos (DEPOIS das rotas da API)
serverLogger.log("8️⃣ Registrando arquivos estáticos...");
app.use(
  express.static(path.join(__dirname, "web"), {
    maxAge: "1d", // Cache de 1 dia para arquivos estáticos
    etag: true,
  })
);

// 5. Mostrar todas as rotas registradas
showRegisteredRoutes(app);

// 9. Middleware 404 (ÚLTIMO)
serverLogger.log("9️⃣ Registrando handler 404...");
app.use(create404Handler());

// 9. Middleware de erro global
app.use((error, req, res, next) => {
  serverLogger.error("💥 ERRO GLOBAL:", {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
  });

  // Não vazar detalhes do erro em produção
  const message =
    process.env.NODE_ENV === "production"
      ? "Erro interno do servidor"
      : error.message;

  res.status(500).json({
    error: message,
    code: "INTERNAL_SERVER_ERROR",
  });
});

// Rota catch-all para SPA
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "web", "index.html"));
});

// Graceful shutdown
process.on("SIGTERM", () => {
  serverLogger.log("SIGTERM signal received: closing HTTP server");

  // Para o serviço de livestream
  try {
    const livestreamService = require("./src/services/livestreamService");
    livestreamService.stopAutoCheck();
    serverLogger.log("📺 Serviço de livestream parado");
  } catch (error) {
    serverLogger.error("Erro ao parar serviço de livestream:", error.message);
  }

  server.close(() => {
    serverLogger.log("HTTP server closed");
  });
});

// 9. Configurar WebSocket para livestreams e portal público
io.on("connection", (socket) => {
  serverLogger.log(`🔌 Cliente WebSocket conectado: ${socket.id}`);

  // Cliente se junta a uma sala específica da câmara (livestreams)
  socket.on("join-camara", (camaraId) => {
    socket.join(`camara-${camaraId}`);
    serverLogger.log(
      `📡 Cliente ${socket.id} entrou na sala da câmara: ${camaraId}`
    );
  });

  // Cliente sai da sala da câmara (livestreams)
  socket.on("leave-camara", (camaraId) => {
    socket.leave(`camara-${camaraId}`);
    serverLogger.log(
      `📡 Cliente ${socket.id} saiu da sala da câmara: ${camaraId}`
    );
  });

  // Cliente se junta ao portal público de uma câmara (votações recentes)
  socket.on("join-portal-camara", (camaraId) => {
    socket.join(`portal-camara-${camaraId}`);
    serverLogger.log(
      `🏡 Cliente ${socket.id} entrou no portal da câmara: ${camaraId}`
    );
  });

  // Cliente sai do portal público da câmara
  socket.on("leave-portal-camara", (camaraId) => {
    socket.leave(`portal-camara-${camaraId}`);
    serverLogger.log(
      `🏡 Cliente ${socket.id} saiu do portal da câmara: ${camaraId}`
    );
  });

  // Cliente se junta a uma sala genérica (para votação ao vivo)
  socket.on("join-room", (roomName) => {
    socket.join(roomName);
    serverLogger.log(`🔗 Cliente ${socket.id} entrou na sala: ${roomName}`);
    socket.emit("room-joined", {
      room: roomName,
      timestamp: new Date().toISOString(),
    });
  });

  // Cliente sai de uma sala genérica
  socket.on("leave-room", (roomName) => {
    socket.leave(roomName);
    serverLogger.log(`🔗 Cliente ${socket.id} saiu da sala: ${roomName}`);
  });

  socket.on("disconnect", () => {
    serverLogger.log(`🔌 Cliente WebSocket desconectado: ${socket.id}`);
  });

  // --- HANDLERS PARA TVs (AUTENTICAÇÃO E JOIN EM SALAS POR CÂMARA/PAUTA) ---
  socket.on("tv:join-camara", async (payload) => {
    try {
      const token = socket.handshake.auth && socket.handshake.auth.token;
      const camaraId = payload && (payload.camaraId || payload.camara_id);
      serverLogger.log(
        `tv:join-camara pedido por ${socket.id}. CamaraId: ${camaraId}`
      );

      if (!token) {
        socket.emit("tv:join-error", { error: "Token ausente" });
        return;
      }

      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_ANON_KEY,
        { global: { headers: { Authorization: `Bearer ${token}` } } }
      );

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) {
        serverLogger.log(
          "tv:join-camara - token inválido para socket",
          socket.id,
          userError
        );
        socket.emit("tv:join-error", { error: "Token inválido" });
        return;
      }

      const supabaseAdmin = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_KEY
      );
      const { data: profile, error: profileError } = await supabaseAdmin
        .from("profiles")
        .select("role, camara_id")
        .eq("id", user.id)
        .single();

      if (profileError || !profile) {
        serverLogger.log(
          "tv:join-camara - perfil não encontrado",
          socket.id,
          profileError
        );
        socket.emit("tv:join-error", { error: "Perfil não encontrado" });
        return;
      }

      if (profile.role !== "tv") {
        serverLogger.log(
          "tv:join-camara - acesso negado, role não é tv",
          socket.id,
          profile.role
        );
        socket.emit("tv:join-error", { error: "Acesso negado" });
        return;
      }

      if (
        camaraId &&
        profile.camara_id &&
        profile.camara_id.toString() !== camaraId.toString()
      ) {
        serverLogger.log(
          "tv:join-camara - tentativa de join em câmara diferente",
          socket.id
        );
        socket.emit("tv:join-error", {
          error: "Câmara inválida para esta credencial",
        });
        return;
      }

      // Tudo ok: junta na sala específica da TV por câmara
      const roomName = `tv-camara-${profile.camara_id || camaraId}`;
      socket.join(roomName);
      serverLogger.log(`📺 TV ${socket.id} entrou na sala: ${roomName}`);
      socket.emit("tv:joined", { room: roomName });
    } catch (err) {
      serverLogger.error("Erro em tv:join-camara", err.message || err);
      socket.emit("tv:join-error", { error: "Erro interno ao validar TV" });
    }
  });

  socket.on("tv:leave-camara", (payload) => {
    try {
      const camaraId = payload && (payload.camaraId || payload.camara_id);
      const roomName = `tv-camara-${camaraId}`;
      socket.leave(roomName);
      serverLogger.log(`📺 TV ${socket.id} saiu da sala: ${roomName}`);
      socket.emit("tv:left", { room: roomName });
    } catch (err) {
      serverLogger.error("Erro em tv:leave-camara", err.message || err);
    }
  });

  socket.on("tv:join-pauta", async (payload) => {
    try {
      const token = socket.handshake.auth && socket.handshake.auth.token;
      const pautaId = payload && (payload.pautaId || payload.pauta_id);
      serverLogger.log(
        `tv:join-pauta pedido por ${socket.id}. PautaId: ${pautaId}`
      );

      if (!token) {
        socket.emit("tv:join-error", { error: "Token ausente" });
        return;
      }

      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_ANON_KEY,
        { global: { headers: { Authorization: `Bearer ${token}` } } }
      );

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) {
        serverLogger.log(
          "tv:join-pauta - token inválido para socket",
          socket.id,
          userError
        );
        socket.emit("tv:join-error", { error: "Token inválido" });
        return;
      }

      const supabaseAdmin = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_KEY
      );
      const { data: profile, error: profileError } = await supabaseAdmin
        .from("profiles")
        .select("role, camara_id")
        .eq("id", user.id)
        .single();

      if (profileError || !profile) {
        serverLogger.log(
          "tv:join-pauta - perfil não encontrado",
          socket.id,
          profileError
        );
        socket.emit("tv:join-error", { error: "Perfil não encontrado" });
        return;
      }

      if (profile.role !== "tv") {
        serverLogger.log(
          "tv:join-pauta - acesso negado, role não é tv",
          socket.id,
          profile.role
        );
        socket.emit("tv:join-error", { error: "Acesso negado" });
        return;
      }

      // Validar que a pauta pertence à mesma câmara
      const { data: pauta, error: pautaError } = await supabaseAdmin
        .from("pautas")
        .select("id, sessoes ( camara_id )")
        .eq("id", pautaId)
        .single();

      if (pautaError || !pauta) {
        serverLogger.log(
          "tv:join-pauta - pauta não encontrada",
          socket.id,
          pautaError
        );
        socket.emit("tv:join-error", { error: "Pauta não encontrada" });
        return;
      }

      const pautaCamaraId = pauta.sessoes && pauta.sessoes.camara_id;
      if (
        !pautaCamaraId ||
        pautaCamaraId.toString() !== (profile.camara_id || "").toString()
      ) {
        serverLogger.log(
          "tv:join-pauta - pauta de câmara diferente",
          socket.id
        );
        socket.emit("tv:join-error", {
          error: "Pauta não pertence à câmara desta TV",
        });
        return;
      }

      const roomName = `tv-pauta-${pautaId}`;
      socket.join(roomName);
      // Também junte na room de câmara para receber notificações gerais
      socket.join(`tv-camara-${profile.camara_id}`);
      serverLogger.log(
        `📺 TV ${socket.id} entrou na sala: ${roomName} e tv-camara-${profile.camara_id}`
      );
      socket.emit("tv:joined-pauta", { room: roomName });
    } catch (err) {
      serverLogger.error("Erro em tv:join-pauta", err.message || err);
      socket.emit("tv:join-error", { error: "Erro interno ao validar pauta" });
    }
  });
});

// Tornar io global para uso em outros módulos
global.io = io;
app.set("io", io);

// 10. Inicializar serviços de livestream
try {
  const livestreamService = require("./src/services/livestreamService");

  // Aguarda 5 segundos após o servidor iniciar para começar a verificação
  setTimeout(() => {
    livestreamService.startAutoCheck();
    serverLogger.log("📺 Serviço de verificação de livestreams iniciado");
  }, 5000);
} catch (error) {
  serverLogger.error(
    "❌ Erro ao inicializar serviço de livestream:",
    error.message
  );
}

// 11. Iniciar servidor
const server = httpServer.listen(PORT, () => {
  serverLogger.log("🎯 === SERVIDOR INICIADO COM SUCESSO ===");
  serverLogger.log(`🌐 URL: http://localhost:${PORT}`, {
    env: process.env.NODE_ENV || "development",
    pid: process.pid,
  });
  serverLogger.log(
    "🔍 Logs detalhados de requisições e rotas serão exibidos aqui."
  );
  serverLogger.log(
    "📺 Verificação de livestreams será iniciada em 5 segundos..."
  );
});
