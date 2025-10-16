const { createClient } = require("@supabase/supabase-js");
const createLogger = require("../utils/logger");

const logger = createLogger("VOTO_CONTROLLER");

// Middleware de autenticação usando Supabase tokens
const authenticateToken = async (req) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    throw new Error("Token de acesso requerido");
  }

  try {
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
      logger.error("Erro ao verificar usuário:", userError);
      throw new Error("Token inválido ou expirado");
    }

    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("*, camaras(nome_camara)")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      logger.error("Erro ao buscar perfil:", profileError);
      throw new Error("Perfil não encontrado");
    }

    // Buscar dados do vereador se for role vereador
    let vereadorData = null;
    if (profile.role === "vereador") {
      const { data: vereador, error: vereadorError } = await supabaseAdmin
        .from("vereadores")
        .select(
          "id, nome_parlamentar, is_presidente, is_vice_presidente, partido_id"
        )
        .eq("profile_id", user.id)
        .single();

      if (vereadorError) {
        logger.error("Erro ao buscar dados do vereador:", vereadorError);
        throw new Error("Dados do vereador não encontrados");
      }

      vereadorData = vereador;
    }

    return {
      id: user.id,
      email: user.email,
      role: profile.role,
      camara_id: profile.camara_id,
      profile: profile,
      vereador: vereadorData,
    };
  } catch (error) {
    logger.error("Erro na autenticação:", error);
    throw new Error("Token inválido");
  }
};

// POST /api/votos - Registrar voto
const createVoto = async (req, res) => {
  logger.log("🗳️ === INÍCIO DO REGISTRO DE VOTO ===");

  try {
    const user = await authenticateToken(req);

    // Apenas vereadores podem votar
    if (user.role !== "vereador") {
      logger.error(`❌ Acesso negado: Usuário ${user.id} não é vereador`);
      return res.status(403).json({ error: "Apenas vereadores podem votar" });
    }

    const { pauta_id, voto } = req.body;

    logger.log("📋 Dados do voto:", {
      vereador_id: user.vereador.id,
      pauta_id,
      voto,
      is_presidente: user.vereador.is_presidente,
    });

    // Validações
    if (!pauta_id || !voto) {
      logger.error("❌ Dados obrigatórios não fornecidos");
      return res
        .status(400)
        .json({ error: "Pauta ID e voto são obrigatórios" });
    }

    // Mapear valores recebidos para valores do enum
    let votoEnum;
    switch (voto) {
      case "Sim":
        votoEnum = "SIM";
        break;
      case "Não":
        votoEnum = "NÃO";
        break;
      case "Abstenção":
        votoEnum = "ABSTENÇÃO";
        break;
      default:
        logger.error("❌ Voto inválido:", voto);
        return res.status(400).json({
          error: "Voto inválido. Permitidos: Sim, Não, Abstenção",
        });
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    // Verificar se a pauta existe e está em votação
    const { data: pauta, error: pautaError } = await supabase
      .from("pautas")
      .select(
        `
                id,
                nome,
                status,
                sessoes!inner (
                    id,
                    camara_id
                )
            `
      )
      .eq("id", pauta_id)
      .single();

    if (pautaError || !pauta) {
      logger.error("❌ Pauta não encontrada:", pautaError);
      return res.status(404).json({ error: "Pauta não encontrada" });
    }

    if (pauta.status !== "Em Votação") {
      logger.error("❌ Pauta não está em votação:", pauta.status);
      return res.status(400).json({ error: "Esta pauta não está em votação" });
    }

    // Verificar se a pauta pertence à câmara do vereador
    if (pauta.sessoes.camara_id !== user.camara_id) {
      logger.error("❌ Pauta de outra câmara");
      return res
        .status(403)
        .json({ error: "Você só pode votar em pautas da sua câmara" });
    }

    // Verificar se o vereador já votou nesta pauta
    const { data: votoExistente, error: votoExistenteError } = await supabase
      .from("votos")
      .select("id, voto")
      .eq("pauta_id", pauta_id)
      .eq("vereador_id", user.vereador.id)
      .single();

    if (votoExistente) {
      logger.log("🔄 Atualizando voto existente");

      // Atualizar voto existente
      const { data: votoAtualizado, error: updateError } = await supabase
        .from("votos")
        .update({
          voto: votoEnum,
          era_presidente_no_voto: user.vereador.is_presidente,
          era_vice_presidente_no_voto: user.vereador.is_vice_presidente,
          partido_id_no_voto: user.vereador.partido_id,
        })
        .eq("id", votoExistente.id)
        .select()
        .single();

      if (updateError) {
        logger.error("❌ Erro ao atualizar voto:", updateError);
        return res.status(500).json({ error: "Erro ao atualizar voto" });
      }

      logger.log("✅ Voto atualizado com sucesso");
      // Emitir atualização via WebSocket para TVs e portal
      try {
        if (typeof global !== "undefined" && global.io) {
          const totalsResp = await supabase.rpc("pauta_vote_totals", {
            pauta_id_input: pauta_id,
          });
          const totals =
            totalsResp && totalsResp.data
              ? totalsResp.data
              : { sim: null, nao: null, abstencao: null };
          global.io
            .to(`tv-camara-${pauta.sessoes.camara_id}`)
            .emit("votacao-ao-vivo-update", {
              pautaId: pauta_id,
              totals,
              voto: votoAtualizado,
            });
          global.io
            .to(`portal-camara-${pauta.sessoes.camara_id}`)
            .emit("votacao-ao-vivo-update", {
              pautaId: pauta_id,
              totals,
              voto: votoAtualizado,
            });
        }
      } catch (emitErr) {
        logger.warn(
          "⚠️ Falha ao emitir socket de update de voto:",
          emitErr.message
        );
      }

      // Post para tablet backend (redundância baixa latência)
      try {
        const http = require("http");
        const postData = JSON.stringify({
          pautaId: pauta_id,
          voto: votoAtualizado,
        });
        const options = {
          hostname: "localhost",
          port: 3003,
          path: "/api/notify/voto",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(postData),
          },
        };
        const r = http.request(options, (resp) => {
          if (resp.statusCode < 200 || resp.statusCode >= 300)
            logger.warn(
              "⚠️ Tablet backend notify voto retornou",
              resp.statusCode
            );
        });
        r.on("error", (e) =>
          logger.warn(
            "⚠️ Erro ao notificar tablet backend sobre voto:",
            e.message
          )
        );
        r.write(postData);
        r.end();
      } catch (err) {
        logger.warn("⚠️ Erro no post para tablet backend:", err.message);
      }

      return res.json({
        message: "Voto atualizado com sucesso",
        voto: votoAtualizado,
      });
    } else {
      logger.log("🆕 Criando novo voto");

      // Criar novo voto
      const { data: novoVoto, error: createError } = await supabase
        .from("votos")
        .insert({
          pauta_id,
          vereador_id: user.vereador.id,
          voto: votoEnum,
          era_presidente_no_voto: user.vereador.is_presidente,
          era_vice_presidente_no_voto: user.vereador.is_vice_presidente,
          partido_id_no_voto: user.vereador.partido_id,
        })
        .select()
        .single();

      if (createError) {
        logger.error("❌ Erro ao criar voto:", createError);
        return res.status(500).json({ error: "Erro ao registrar voto" });
      }

      // Emitir atualização via WebSocket para TVs e portal
      try {
        if (typeof global !== "undefined" && global.io) {
          const totalsResp = await supabase.rpc("pauta_vote_totals", {
            pauta_id_input: pauta_id,
          });
          const totals =
            totalsResp && totalsResp.data
              ? totalsResp.data
              : { sim: null, nao: null, abstencao: null };
          global.io
            .to(`tv-camara-${pauta.sessoes.camara_id}`)
            .emit("votacao-ao-vivo-update", {
              pautaId: pauta_id,
              totals,
              voto: novoVoto,
            });
          global.io
            .to(`portal-camara-${pauta.sessoes.camara_id}`)
            .emit("votacao-ao-vivo-update", {
              pautaId: pauta_id,
              totals,
              voto: novoVoto,
            });
        }
      } catch (emitErr) {
        logger.warn("⚠️ Falha ao emitir socket de novo voto:", emitErr.message);
      }

      // Post para tablet backend (redundância)
      try {
        const http = require("http");
        const postData = JSON.stringify({ pautaId: pauta_id, voto: novoVoto });
        const options = {
          hostname: "localhost",
          port: 3003,
          path: "/api/notify/voto",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(postData),
          },
        };
        const r = http.request(options, (resp) => {
          if (resp.statusCode < 200 || resp.statusCode >= 300)
            logger.warn(
              "⚠️ Tablet backend notify voto retornou",
              resp.statusCode
            );
        });
        r.on("error", (e) =>
          logger.warn(
            "⚠️ Erro ao notificar tablet backend sobre voto:",
            e.message
          )
        );
        r.write(postData);
        r.end();
      } catch (err) {
        logger.warn("⚠️ Erro no post para tablet backend:", err.message);
      }

      logger.log("✅ Voto registrado com sucesso");
      return res
        .status(201)
        .json({ message: "Voto registrado com sucesso", voto: novoVoto });
    }
  } catch (error) {
    logger.error("💥 Erro no registro de voto:", error);

    if (error.message === "Token de acesso requerido") {
      return res.status(401).json({ error: error.message });
    }
    if (
      error.message === "Token inválido" ||
      error.message.includes("não encontrado")
    ) {
      return res.status(401).json({ error: error.message });
    }

    res.status(500).json({ error: "Erro interno do servidor" });
  }
};

// GET /api/votos/pauta/:pauta_id - Obter votos de uma pauta
const getVotosPorPauta = async (req, res) => {
  try {
    const user = await authenticateToken(req);
    const { pauta_id } = req.params;

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    // Verificar se a pauta existe e o usuário tem acesso
    const { data: pauta, error: pautaError } = await supabase
      .from("pautas")
      .select(
        `
                id,
                nome,
                status,
                sessoes!inner (camara_id)
            `
      )
      .eq("id", pauta_id)
      .single();

    if (pautaError || !pauta) {
      return res.status(404).json({ error: "Pauta não encontrada" });
    }

    // Verificar permissão
    if (
      (user.role === "admin_camara" || user.role === "vereador") &&
      user.camara_id &&
      pauta.sessoes.camara_id !== user.camara_id
    ) {
      return res.status(403).json({ error: "Acesso negado" });
    }

    // Buscar votos com dados completos do vereador e partido
    const { data: votos, error: votosError } = await supabase
      .from("votos")
      .select(
        `
                id,
                voto,
                created_at,
                era_presidente_no_voto,
                era_vice_presidente_no_voto,
                vereadores (
                    id,
                    nome_parlamentar,
                    foto_url,
                    partidos (
                        id,
                        nome,
                        sigla,
                        logo_url
                    )
                )
            `
      )
      .eq("pauta_id", pauta_id)
      .order("created_at", { ascending: true });

    if (votosError) {
      logger.error("Erro ao buscar votos:", votosError);
      return res.status(500).json({ error: "Erro ao buscar votos" });
    }

    // Calcular estatísticas
    const stats = {
      total: votos.length,
      sim: votos.filter((v) => v.voto === "SIM").length,
      nao: votos.filter((v) => v.voto === "NÃO").length,
      abstencao: votos.filter((v) => v.voto === "ABSTENÇÃO").length,
      voto_presidente:
        votos.find((v) => v.era_presidente_no_voto)?.voto || null,
    };

    res.json({
      pauta: {
        id: pauta.id,
        nome: pauta.nome,
        status: pauta.status,
      },
      votos,
      estatisticas: stats,
    });
  } catch (error) {
    logger.error("Erro ao buscar votos:", error);

    if (error.message === "Token de acesso requerido") {
      return res.status(401).json({ error: error.message });
    }
    if (
      error.message === "Token inválido" ||
      error.message.includes("não encontrado")
    ) {
      return res.status(401).json({ error: error.message });
    }

    res.status(500).json({ error: "Erro interno do servidor" });
  }
};

module.exports = {
  createVoto,
  getVotosPorPauta,
};
