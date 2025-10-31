const { Server } = require("socket.io");
const { supabaseAdmin } = require("../config/supabase");
const createLogger = require("../config/logger");

const logger = createLogger("WEBSOCKET_SERVICE");

class WebSocketService {
  constructor() {
    this.io = null;
    this.connectedUsers = new Map(); // userId -> { socketId, camaraId, role, isPresidente }
    this.camaraRooms = new Map(); // camaraId -> Set(socketIds)
    this.pautaRooms = new Map(); // pautaId -> Set(socketIds)
  }

  /**
   * Inicializa o servidor WebSocket
   */
  initialize(server) {
    this.io = new Server(server, {
      cors: {
        origin: true,
        credentials: true,
        methods: ["GET", "POST"],
      },
      transports: ["websocket", "polling"],
      pingTimeout: 5000, // Ultra rápido: 5s
      pingInterval: 2000, // Ultra rápido: 2s
      upgradeTimeout: 2000, // Timeout ultra rápido para upgrade
      allowEIO3: true, // Compatibilidade
      compression: false, // Desabilitar compressão para velocidade
      perMessageDeflate: false, // Desabilitar deflate para latência menor
      httpCompression: false, // Sem compressão HTTP
    });

    this.setupMiddleware();
    this.setupConnectionHandlers();

    logger.info("🚀 WebSocket servidor inicializado com sucesso");
  }

  /**
   * Decodifica o payload de um token JWT (igual ao middleware HTTP)
   */
  decodeJwtPayload(token) {
    try {
      const payloadBase64 = token.split(".")[1];
      const decodedJson = Buffer.from(payloadBase64, "base64").toString();
      return JSON.parse(decodedJson);
    } catch (error) {
      logger.error("Erro ao decodificar o payload do JWT:", {
        error: error.message,
      });
      return null;
    }
  }

  /**
   * Configura middleware de autenticação
   */
  setupMiddleware() {
    this.io.use(async (socket, next) => {
      try {
        const token =
          socket.handshake.auth.token ||
          socket.handshake.headers.authorization?.replace("Bearer ", "");

        // Verificar se é conexão pública (sem token)
        if (!token) {
          // Permitir conexão pública para visualização
          socket.isPublic = true;
          logger.info(
            "🌐 [WebSocket] Conexão pública permitida para visualização"
          );
          next();
          return;
        }

        logger.info("🔐 [WebSocket] Iniciando verificação de autenticação...");
        logger.info(
          `🔐 [WebSocket] Token recebido: ${token.substring(0, 20)}...`
        );

        // Verificar token no Supabase (igual ao middleware HTTP)
        const {
          data: { user },
          error: userError,
        } = await supabaseAdmin.auth.getUser(token);
        if (userError || !user) {
          logger.error("❌ [WebSocket] Token inválido ou expirado:", {
            error: userError?.message,
          });
          throw new Error("Token inválido ou expirado");
        }

        logger.info(
          `✅ [WebSocket] Usuário ${user.id} (${user.email}) autenticado com sucesso`
        );

        // Buscar perfil do usuário (igual ao middleware HTTP)
        const { data: profile, error: profileError } = await supabaseAdmin
          .from("profiles")
          .select("role, camara_id, min_token_iat, nome")
          .eq("id", user.id)
          .single();

        if (profileError || !profile) {
          logger.error(
            `❌ [WebSocket] Perfil não encontrado para o usuário ${user.id}:`,
            { error: profileError?.message }
          );
          throw new Error("Perfil de usuário não encontrado");
        }

        logger.info(
          `📋 [WebSocket] Perfil encontrado. Role: '${profile.role}', Câmara: ${profile.camara_id}`
        );

        // Verificar se é vereador
        if (profile.role !== "vereador") {
          logger.error(
            `❌ [WebSocket] Acesso negado. Role '${profile.role}' não permitida`
          );
          throw new Error("Acesso restrito a vereadores");
        }

        // Verificar sessão única (IAT) - igual ao middleware HTTP
        const tokenPayload = this.decodeJwtPayload(token);
        const iatDoToken = tokenPayload ? tokenPayload.iat : null;
        const iatMinimoDoPerfil = profile.min_token_iat;

        logger.info(
          `🔐 [WebSocket] Comparando IATs. Token IAT: ${iatDoToken}, Perfil IAT Mínimo: ${iatMinimoDoPerfil}`
        );

        if (!tokenPayload || tokenPayload.iat < profile.min_token_iat) {
          logger.warn(
            `❌ [WebSocket] Token antigo detectado. IAT: ${tokenPayload?.iat}, IAT mínimo: ${profile.min_token_iat}`
          );
          throw new Error("Sessão expirada. Faça login novamente");
        }

        // Buscar dados completos do vereador
        const { data: vereadorData, error: vereadorError } = await supabaseAdmin
          .from("vereadores")
          .select(
            "id, nome_parlamentar, camara_id, is_presidente, is_vice_presidente, partido_id"
          )
          .eq("profile_id", user.id)
          .single();

        if (vereadorError || !vereadorData) {
          logger.error(
            `❌ [WebSocket] Dados do vereador não encontrados para ${user.id}:`,
            { error: vereadorError?.message }
          );
          throw new Error("Dados do vereador não encontrados");
        }

        // Anexar dados do usuário ao socket
        socket.userId = user.id;
        socket.userEmail = user.email;
        socket.profile = profile;
        socket.vereadorData = vereadorData;
        socket.camaraId = vereadorData.camara_id;
        socket.isPresidente = vereadorData.is_presidente;

        logger.info(
          `✅ [WebSocket] Acesso autorizado para vereador ${vereadorData.nome_parlamentar} da câmara ${vereadorData.camara_id}`
        );
        next();
      } catch (error) {
        logger.warn(`❌ [WebSocket] Falha na autenticação: ${error.message}`);
        next(new Error("Falha na autenticação"));
      }
    });
  }

  /**
   * Configura handlers de conexão
   */
  setupConnectionHandlers() {
    this.io.on("connection", (socket) => {
      this.handleConnection(socket);

      socket.on("disconnect", () => {
        this.handleDisconnection(socket);
      });

      socket.on("join-pauta", (pautaId) => {
        this.handleJoinPauta(socket, pautaId);
      });

      socket.on("leave-pauta", (pautaId) => {
        this.handleLeavePauta(socket, pautaId);
      });

      // Eventos de ping/pong para monitoramento de conexão
      socket.on("ping", () => {
        socket.emit("pong");
      });
    });
  }

  /**
   * Handle nova conexão
   */
  handleConnection(socket) {
    // Verificar se é conexão pública
    if (socket.isPublic) {
      logger.info(`🌐 Usuário público conectado: Socket ID ${socket.id}`);

      // Enviar status de conexão pública
      socket.emit("connection-status", {
        connected: true,
        isPublic: true,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const userInfo = {
      socketId: socket.id,
      camaraId: socket.camaraId,
      role: "vereador",
      isPresidente: socket.isPresidente,
      connectedAt: new Date().toISOString(),
    };

    // Armazenar usuário conectado
    this.connectedUsers.set(socket.userId, userInfo);

    // Adicionar à room da câmara
    const camaraRoom = `camara_${socket.camaraId}`;
    socket.join(camaraRoom);

    // Manter track das rooms da câmara
    if (!this.camaraRooms.has(socket.camaraId)) {
      this.camaraRooms.set(socket.camaraId, new Set());
    }
    this.camaraRooms.get(socket.camaraId).add(socket.id);

    logger.info(
      `👤 Vereador conectado: ${socket.userEmail} (ID: ${socket.userId}, Câmara: ${socket.camaraId})`
    );
    logger.info(
      `📊 Usuários conectados na Câmara ${socket.camaraId}: ${
        this.camaraRooms.get(socket.camaraId).size
      }`
    );

    // Notificar outros vereadores da mesma câmara sobre a conexão
    socket.to(camaraRoom).emit("vereador-connected", {
      vereadorId: socket.userId,
      nomeVereador: socket.vereadorData.nome_parlamentar,
      isPresidente: socket.isPresidente,
      timestamp: new Date().toISOString(),
    });

    // Enviar status de conexão para o usuário
    socket.emit("connection-status", {
      connected: true,
      camaraId: socket.camaraId,
      connectedUsers: this.camaraRooms.get(socket.camaraId).size,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Handle desconexão
   */
  handleDisconnection(socket) {
    const userInfo = this.connectedUsers.get(socket.userId);

    if (userInfo) {
      // Remover da room da câmara
      const camaraRoom = `camara_${socket.camaraId}`;

      if (this.camaraRooms.has(socket.camaraId)) {
        this.camaraRooms.get(socket.camaraId).delete(socket.id);

        // Se não há mais usuários desta câmara, remover o mapa
        if (this.camaraRooms.get(socket.camaraId).size === 0) {
          this.camaraRooms.delete(socket.camaraId);
        }
      }

      // Remover das rooms de pautas
      this.pautaRooms.forEach((sockets, pautaId) => {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          this.pautaRooms.delete(pautaId);
        }
      });

      // Remover usuário conectado
      this.connectedUsers.delete(socket.userId);

      logger.info(
        `👋 Vereador desconectado: ${socket.userEmail} (ID: ${socket.userId})`
      );

      // Notificar outros vereadores da mesma câmara sobre a desconexão
      socket.to(camaraRoom).emit("vereador-disconnected", {
        vereadorId: socket.userId,
        nomeVereador: socket.vereadorData?.nome_parlamentar,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Handle entrada em room de pauta
   */
  async handleJoinPauta(socket, pautaId) {
    try {
      // Verificar se a pauta pertence à câmara do vereador
      const { data: pauta, error } = await supabaseAdmin
        .from("pautas")
        .select("id, nome, sessoes!inner(camara_id)")
        .eq("id", pautaId)
        .single();

      if (error || !pauta) {
        socket.emit("error", { message: "Pauta não encontrada" });
        return;
      }

      if (pauta.sessoes.camara_id !== socket.camaraId) {
        socket.emit("error", {
          message: "Acesso negado - pauta de outra câmara",
        });
        return;
      }

      // Entrar na room da pauta
      const pautaRoom = `pauta_${pautaId}`;
      socket.join(pautaRoom);

      // Manter track das rooms de pauta
      if (!this.pautaRooms.has(pautaId)) {
        this.pautaRooms.set(pautaId, new Set());
      }
      this.pautaRooms.get(pautaId).add(socket.id);

      logger.info(`📋 Vereador ${socket.userEmail} entrou na pauta ${pautaId}`);

      socket.emit("pauta-joined", {
        pautaId,
        pautaNome: pauta.nome,
        timestamp: new Date().toISOString(),
      });

      // Enviar estatísticas atuais da pauta
      this.sendPautaStats(pautaId);
    } catch (error) {
      logger.error(`Erro ao entrar na pauta ${pautaId}:`, error);
      socket.emit("error", { message: "Erro ao entrar na pauta" });
    }
  }

  /**
   * Handle saída da room de pauta
   */
  handleLeavePauta(socket, pautaId) {
    const pautaRoom = `pauta_${pautaId}`;
    socket.leave(pautaRoom);

    if (this.pautaRooms.has(pautaId)) {
      this.pautaRooms.get(pautaId).delete(socket.id);

      if (this.pautaRooms.get(pautaId).size === 0) {
        this.pautaRooms.delete(pautaId);
      }
    }

    logger.info(`📋 Vereador ${socket.userEmail} saiu da pauta ${pautaId}`);

    socket.emit("pauta-left", {
      pautaId,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Handle solicitação de estatísticas
   */
  async handleRequestStats(socket, pautaId) {
    try {
      await this.sendPautaStatsToSocket(socket, pautaId);
    } catch (error) {
      logger.error(`Erro ao buscar estatísticas para pauta ${pautaId}:`, error);
      socket.emit("error", { message: "Erro ao buscar estatísticas" });
    }
  }

  /**
   * Notifica sobre novo voto
   */
  async notifyVoto(pautaId, votoData) {
    try {
      const { vereador, voto, isUpdate } = votoData;

      logger.info(
        `🗳️ Notificando voto: ${vereador.nome_parlamentar} votou ${voto} na pauta ${pautaId}`
      );

      // Buscar dados da pauta para verificar câmara
      const { data: pauta, error } = await supabaseAdmin
        .from("pautas")
        .select("sessoes!inner(camara_id)")
        .eq("id", pautaId)
        .single();

      if (error || !pauta) {
        logger.warn(`Pauta ${pautaId} não encontrada para notificação`);
        return;
      }

      const camaraId = pauta.sessoes.camara_id;
      const camaraRoom = `camara_${camaraId}`;
      const pautaRoom = `pauta_${pautaId}`;

      // Preparar dados da notificação
      const notification = {
        type: "voto-registrado",
        pautaId: pautaId, // Garantir que pautaId está sempre presente
        vereador: {
          id: vereador.id,
          nome: vereador.nome_parlamentar,
          isPresidente: vereador.is_presidente,
        },
        voto,
        isUpdate,
        timestamp: new Date().toISOString(),
      };

      // Enviar notificação imediata para todos os vereadores da câmara
      // (A filtragem por pauta será feita no lado cliente)
      this.io.to(camaraRoom).emit("voto-notification", notification);

      // Notificar servidor global (porta 3000) para retransmitir o voto
      const http = require("http");
      const votoPayload = JSON.stringify({
        pautaId,
        voto,
        isUpdate,
        vereadorNome: vereador.nome_parlamentar,
        camaraId: camaraId, // ✅ Incluir camaraId para notificar TVs
      });

      const options = {
        hostname: "localhost",
        port: 3000,
        path: "/api/votacao-ao-vivo/notify-voto",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(votoPayload),
        },
      };

      const request = http.request(options, (response) => {
        if (response.statusCode >= 200 && response.statusCode < 300) {
          logger.info(
            `✅ Voto retransmitido para servidor global (porta 3000)`
          );
        }
      });

      request.on("error", (error) => {
        logger.warn(
          `⚠️ Erro ao notificar servidor global sobre voto: ${error.message}`
        );
      });

      request.write(votoPayload);
      request.end();

      // Atualizar estatísticas em tempo real (sem await para velocidade)
      this.sendPautaStats(pautaId).catch((err) => {
        logger.error("Erro ao enviar estatísticas:", err);
      });

      // Atualizar estatísticas públicas em tempo real
      this.sendPautaStatsToPublicRoom(pautaId).catch((err) => {
        logger.error("Erro ao enviar estatísticas públicas:", err);
      });

      logger.info(`✅ Notificação de voto enviada para Câmara ${camaraId}`);
    } catch (error) {
      logger.error("Erro ao notificar voto:", error);
    }
  }

  /**
   * Envia estatísticas da pauta para room específica
   */
  async sendPautaStats(pautaId) {
    try {
      const stats = await this.fetchPautaStats(pautaId);
      const pautaRoom = `pauta_${pautaId}`;

      this.io.to(pautaRoom).emit("pauta-stats-update", {
        pautaId,
        estatisticas: stats,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error(`Erro ao enviar estatísticas da pauta ${pautaId}:`, error);
    }
  }

  /**
   * Envia estatísticas da pauta para socket específico
   */
  async sendPautaStatsToSocket(socket, pautaId) {
    try {
      const stats = await this.fetchPautaStats(pautaId);

      socket.emit("pauta-stats-update", {
        pautaId,
        estatisticas: stats,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error(
        `Erro ao enviar estatísticas da pauta ${pautaId} para socket:`,
        error
      );
    }
  }

  /**
   * Busca estatísticas da pauta no banco
   */
  async fetchPautaStats(pautaId) {
    const { data: votos, error } = await supabaseAdmin
      .from("votos")
      .select("voto")
      .eq("pauta_id", pautaId);

    if (error) {
      throw error;
    }

    return {
      total: votos.length,
      sim: votos.filter((v) => v.voto === "SIM").length,
      nao: votos.filter((v) => v.voto === "NÃO").length,
      abstencao: votos.filter((v) => v.voto === "ABSTENÇÃO").length,
    };
  }

  /**
   * Envia estatísticas da pauta para o servidor público/global (porta 3000)
   * para que o portal público possa receber atualizações em tempo real.
   */
  async sendPautaStatsToPublicRoom(pautaId) {
    try {
      const stats = await this.fetchPautaStats(pautaId);

      const http = require("http");
      const payload = JSON.stringify({ pautaId, estatisticas: stats });

      const options = {
        hostname: "localhost",
        port: 3000,
        path: "/api/votacao-ao-vivo/notify-stats",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
        },
        timeout: 3000,
      };

      const req = http.request(options, (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          logger.info(
            `✅ Estatísticas da pauta ${pautaId} enviadas ao servidor público`
          );
        } else {
          logger.warn(
            `⚠️ Falha ao enviar estatísticas públicas (status ${res.statusCode})`
          );
        }
      });

      req.on("error", (err) => {
        logger.warn(
          `⚠️ Erro ao notificar servidor público sobre estatísticas: ${err.message}`
        );
      });

      req.write(payload);
      req.end();
    } catch (error) {
      logger.error(
        `Erro em sendPautaStatsToPublicRoom para pauta ${pautaId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Notifica mudança de status da pauta
   */
  async notifyPautaStatusChange(pautaId, newStatus, resultado = null) {
    try {
      logger.info(
        `📢 Notificando mudança de status da pauta ${pautaId}: ${newStatus}`
      );

      // Buscar dados da pauta
      const { data: pauta, error } = await supabaseAdmin
        .from("pautas")
        .select(
          `
                    id,
                    nome,
                    status,
                    resultado_votacao,
                    sessoes!inner(camara_id)
                `
        )
        .eq("id", pautaId)
        .single();

      if (error || !pauta) {
        logger.warn(
          `Pauta ${pautaId} não encontrada para notificação de status`
        );
        return;
      }

      const camaraId = pauta.sessoes.camara_id;
      const camaraRoom = `camara_${camaraId}`;
      const pautaRoom = `pauta_${pautaId}`;

      const notification = {
        type: "pauta-status-changed",
        pautaId,
        pautaNome: pauta.nome,
        oldStatus: pauta.status,
        newStatus,
        resultado,
        timestamp: new Date().toISOString(),
      };

      // Enviar para todos da câmara
      this.io.to(camaraRoom).emit("pauta-status-notification", notification);

      // Enviar para visualizadores da pauta
      this.io.to(pautaRoom).emit("pauta-status-update", notification);

      logger.info(
        `✅ Notificação de mudança de status enviada para Câmara ${camaraId}`
      );
    } catch (error) {
      logger.error("Erro ao notificar mudança de status da pauta:", error);
    }
  }

  /**
   * Obter estatísticas de conexão
   */
  getConnectionStats() {
    const stats = {
      totalConnections: this.connectedUsers.size,
      camaraConnections: {},
      activePautas: this.pautaRooms.size,
    };

    this.camaraRooms.forEach((sockets, camaraId) => {
      stats.camaraConnections[camaraId] = sockets.size;
    });

    return stats;
  }

  /**
   * Broadcast para toda a aplicação (uso administrativo)
   */
  broadcastToAll(event, data) {
    this.io.emit(event, {
      ...data,
      timestamp: new Date().toISOString(),
    });

    logger.info(`📢 Broadcast global enviado: ${event}`);
  }

  /**
   * Broadcast para câmara específica
   */
  broadcastToCamara(camaraId, event, data) {
    const camaraRoom = `camara_${camaraId}`;

    this.io.to(camaraRoom).emit(event, {
      ...data,
      timestamp: new Date().toISOString(),
    });

    logger.info(`📢 Broadcast para Câmara ${camaraId}: ${event}`);
  }

  /**
   * Notifica início de votação - abre tela de votação no app dos vereadores
   */
  notifyIniciarVotacao(camaraId, pautaId, pautaNome) {
    const camaraRoom = `camara_${camaraId}`;

    const notification = {
      type: "iniciar-votacao",
      pautaId,
      pautaNome,
      action: "open-voting-screen",
      timestamp: new Date().toISOString(),
    };

    // Emitir para todos os vereadores da câmara
    this.io.to(camaraRoom).emit("iniciar-votacao", notification);

    // Contar APENAS vereadores autenticados (APKs), não portais públicos
    const room = this.io.sockets.adapter.rooms.get(camaraRoom);
    let vereadoresOnline = 0;

    if (room) {
      // Iterar pelos sockets na sala e contar apenas vereadores
      room.forEach((socketId) => {
        const socket = this.io.sockets.sockets.get(socketId);
        // Contar apenas se NÃO for público (ou seja, é vereador autenticado)
        if (socket && !socket.isPublic && socket.vereadorData) {
          vereadoresOnline++;
        }
      });
    }

    logger.info(
      `🗳️ Notificação de início de votação enviada para Câmara ${camaraId} - Pauta: ${pautaNome} - Vereadores online: ${vereadoresOnline} (de ${
        room ? room.size : 0
      } conexões totais)`
    );

    // Retornar número de vereadores online para uso no servidor
    return vereadoresOnline;
  }

  /**
   * Notifica encerramento de votação
   */
  notifyEncerrarVotacao(camaraId, pautaId, pautaNome, resultado) {
    const camaraRoom = `camara_${camaraId}`;

    const notification = {
      type: "encerrar-votacao",
      pautaId,
      pautaNome,
      resultado,
      action: "return-to-dashboard",
      timestamp: new Date().toISOString(),
    };

    this.io.to(camaraRoom).emit("encerrar-votacao", notification);

    logger.info(
      `🏁 Notificação de encerramento de votação enviada para Câmara ${camaraId} - Pauta: ${pautaNome} - Resultado: ${resultado}`
    );
  }

  /**
   * Notifica início de fala de orador
   */
  notifyIniciarFala(camaraId, oradorId, oradorNome, sessaoNome, tempoFala) {
    const camaraRoom = `camara_${camaraId}`;

    const notification = {
      type: "iniciar-fala",
      oradorId,
      oradorNome,
      sessaoNome,
      tempoFala,
      timestamp: new Date().toISOString(),
    };

    this.io.to(camaraRoom).emit("iniciar-fala", notification);

    logger.info(
      `🎤 Notificação de início de fala enviada para Câmara ${camaraId} - Orador: ${oradorNome}`
    );
  }
}

module.exports = new WebSocketService();
