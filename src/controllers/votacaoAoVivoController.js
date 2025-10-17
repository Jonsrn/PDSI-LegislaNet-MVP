const createLogger = require("../utils/logger");
const logger = createLogger("VOTACAO_AO_VIVO");

// Mapa para armazenar estado das votações ativas por câmara
const votacoesAtivas = new Map();

/**
 * POST /api/votacao-ao-vivo/notify
 * Recebe notificação de início/atualização de votação e emite via WebSocket global
 */
const notifyVotacaoAoVivo = async (req, res) => {
  try {
    const {
      camaraId,
      pautaId,
      pautaNome,
      pautaDescricao,
      sessaoNome,
      sessaoTipo,
      sessaoDataHora,
      vereadoresOnline,
      status,
      timestamp,
    } = req.body;

    logger.log(
      `📡 Notificação de votação ao vivo recebida - Câmara: ${camaraId}, Pauta: ${pautaId}, Vereadores online: ${vereadoresOnline}`
    );

    // Armazenar estado da votação ativa
    const votacaoKey = `${camaraId}_${pautaId}`;
    votacoesAtivas.set(votacaoKey, {
      camaraId,
      pautaId,
      pautaNome,
      pautaDescricao,
      sessaoNome,
      sessaoTipo,
      sessaoDataHora,
      vereadoresOnline,
      status,
      timestamp,
    });

    // Obter instância do Socket.IO global do app
    const io = req.app.get("io");

    if (io) {
      // Payload para portal público
      const publicPayload = {
        type: "votacao-ao-vivo",
        camaraId,
        pautaId,
        pautaNome,
        pautaDescricao,
        sessaoNome,
        sessaoTipo,
        sessaoDataHora,
        vereadoresOnline,
        status,
        isLive: status === "iniciada",
        timestamp,
      };

      // Emitir para portal público
      io.emit("votacao-ao-vivo-update", publicPayload);

      // 📺 EMITIR PARA TVs DA CÂMARA ESPECÍFICA (quando votação é iniciada)
      if (status === "iniciada") {
        const tvPayload = {
          type: "iniciar-votacao",
          pauta: {
            id: pautaId,
            nome: pautaNome,
            descricao: pautaDescricao,
          },
          sessao: {
            nome: sessaoNome,
            tipo: sessaoTipo,
            dataHora: sessaoDataHora,
          },
          camaraId,
          vereadoresOnline,
          timestamp,
        };

        // Emitir para sala específica das TVs da câmara
        const tvRoom = `tv-camara-${camaraId}`;
        io.to(tvRoom).emit("tv:iniciar-votacao", tvPayload);

        logger.log(`📺 Evento tv:iniciar-votacao emitido para sala ${tvRoom}`);
      }

      logger.log(
        `✅ WebSocket emitido para portal público - Câmara ${camaraId}, ${vereadoresOnline} vereadores online`
      );
    } else {
      logger.warn("⚠️ Socket.IO não disponível no app");
    }

    res.status(200).json({
      success: true,
      message: "Notificação processada e emitida via WebSocket",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("❌ Erro ao processar notificação de votação ao vivo:", error);
    res.status(500).json({
      success: false,
      error: "Erro interno do servidor",
      timestamp: new Date().toISOString(),
    });
  }
};

/**
 * GET /api/votacao-ao-vivo/status/:camaraId
 * Retorna estado atual das votações ativas de uma câmara
 */
const getStatusVotacao = async (req, res) => {
  try {
    const { camaraId } = req.params;

    // Buscar votações ativas da câmara
    const votacoesCamera = Array.from(votacoesAtivas.values()).filter(
      (v) => v.camaraId === camaraId && v.status === "iniciada"
    );

    if (votacoesCamera.length === 0) {
      return res.json({
        isLive: false,
        votacoes: [],
        message: "Nenhuma votação ativa no momento",
      });
    }

    res.json({
      isLive: true,
      votacoes: votacoesCamera,
    });
  } catch (error) {
    logger.error("Erro ao buscar status de votação:", error);
    res.status(500).json({
      error: "Erro interno do servidor",
    });
  }
};

/**
 * POST /api/votacao-ao-vivo/notify-voto
 * Recebe notificação de voto e retransmite via WebSocket
 */
const notifyVoto = async (req, res) => {
  try {
    const { pautaId, voto, isUpdate, vereadorNome, camaraId } = req.body;

    logger.log(
      `🗳️ Notificação de voto recebida - Pauta: ${pautaId}, Voto: ${voto}, IsUpdate: ${isUpdate}`
    );

    const io = req.app.get("io");
    if (io) {
      const votoPayload = {
        type: "voto-registrado",
        pautaId,
        voto,
        isUpdate: isUpdate || false,
        vereadorNome,
        timestamp: new Date().toISOString(),
      };

      // Emitir para sala pública da pauta
      io.to(`pauta_public_${pautaId}`).emit(
        "voto-notification-public",
        votoPayload
      );
      logger.log(
        `✅ Voto retransmitido via WebSocket para sala pauta_public_${pautaId}`
      );

      // 📺 EMITIR PARA TVS DA CÂMARA (se camaraId foi informado)
      if (camaraId) {
        const tvVotoPayload = {
          type: "voto-tv",
          pautaId,
          voto,
          vereadorNome,
          isUpdate: isUpdate || false,
          timestamp: new Date().toISOString(),
        };

        const tvRoom = `tv-camara-${camaraId}`;
        io.to(tvRoom).emit("tv:voto-notification", tvVotoPayload);
        logger.log(`📺 Voto emitido para TVs na sala ${tvRoom}`);
      }
    }

    res.status(200).json({ success: true });
  } catch (error) {
    logger.error("❌ Erro ao retransmitir voto:", error);
    res.status(500).json({ success: false, error: "Erro interno" });
  }
};

module.exports = {
  notifyVotacaoAoVivo,
  getStatusVotacao,
  notifyVoto,
  votacoesAtivas,
};
