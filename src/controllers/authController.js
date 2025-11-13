const { createClient } = require("@supabase/supabase-js");
const { validationResult } = require("express-validator");
const tokenManager = require("../utils/tokenManager");
const createLogger = require("../utils/logger");
const logger = createLogger("AUTH_CONTROLLER");

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

/**
 * Função auxiliar para decodificar o payload de um token JWT.
 * @param {string} token - O token JWT.
 * @returns {object|null} O payload decodificado ou null em caso de erro.
 */
const decodeJwtPayload = (token) => {
  try {
    const payloadBase64 = token.split(".")[1];
    const decodedJson = Buffer.from(payloadBase64, "base64").toString();
    return JSON.parse(decodedJson);
  } catch (error) {
    logger.error("Erro ao decodificar o payload do JWT:", error);
    return null;
  }
};

const handleLogin = async (req, res) => {
  logger.log("🔐 === INÍCIO DO PROCESSO DE LOGIN ===");

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.error("❌ Erros de validação:", errors.array());
    return res.status(400).json({ errors: errors.array() });
  }

  const { email, password } = req.body;
  logger.log("📧 Email recebido:", email);

  try {
    logger.log("🚀 Tentando autenticar com Supabase...");
    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({
        email: email,
        password: password,
      });

    if (authError) {
      logger.error("❌ Erro de autenticação do Supabase:", authError.message);
      return res.status(401).json({ error: "Credenciais inválidas." });
    }

    const user = authData.user;
    const session = authData.session;
    logger.log("✅ Usuário autenticado com sucesso! ID:", user.id);

    // --- LÓGICA DE INVALIDAÇÃO CORRIGIDA ---
    // 1. Pega o token de acesso da sessão.
    const accessToken = session.access_token;

    // 2. Decodifica o payload do token para encontrar o 'iat'.
    const payload = decodeJwtPayload(accessToken);
    if (!payload || !payload.iat) {
      logger.error(
        "Falha ao decodificar o payload do novo token ou encontrar o iat."
      );
      return res
        .status(500)
        .json({ error: "Falha ao processar o token da sessão." });
    }
    const newIat = payload.iat;
    // --- LOG DE DEPURAÇÃO ---
    logger.log(`[DEBUG-BACKEND] Novo IAT extraído do token: ${newIat}`);
    if (!newIat) {
      logger.error(
        "[DEBUG-BACKEND] ATENÇÃO: IAT não encontrado no payload do token!"
      );
    }

    logger.log(
      `Atualizando min_token_iat para o usuário ${user.id} com o novo timestamp: ${newIat}`
    );

    // 3. Atualiza o perfil do usuário com o novo timestamp.
    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({ min_token_iat: newIat })
      .eq("id", user.id);

    if (updateError) {
      logger.error("Erro ao atualizar o timestamp do token:", updateError);
      return res
        .status(500)
        .json({ error: "Falha ao iniciar a sessão de forma segura." });
    }
    logger.log("✅ Timestamp do token atualizado com sucesso no perfil.");
    // --- FIM DA CORREÇÃO ---

    logger.log("🔍 Buscando perfil na tabela profiles...");
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("role, nome, camara_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profileData) {
      logger.error("❌ Perfil não encontrado para o usuário ID:", user.id);
      return res
        .status(404)
        .json({ error: "Perfil de usuário não encontrado." });
    }

    logger.log("✅ Perfil encontrado:", profileData);
    logger.log("🏆 Login concluído com sucesso!");

    return res.status(200).json({
      message: "Login bem-sucedido!",
      user: {
        id: user.id,
        email: user.email,
        nome: profileData.nome,
        role: profileData.role,
        camara_id: profileData.camara_id,
      },
      token: accessToken, // Envia o token de acesso para o cliente
    });
  } catch (error) {
    logger.error("💥 ERRO INESPERADO NO CONTROLLER:", error);
    return res
      .status(500)
      .json({ error: "Ocorreu um erro interno no servidor." });
  }
};

const handleLogout = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    // --- LOG DE DEPURAÇÃO ---
    logger.log(
      `[DEBUG-BACKEND] Rota de logout acessada. Cabeçalho Auth: ${
        authHeader ? "Presente" : "Ausente"
      }`
    );

    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      tokenManager.blacklistToken(token);
    }
    res.status(200).json({ message: "Logout realizado com sucesso." });
  } catch (error) {
    logger.error("Erro no processo de logout:", error);
    res.status(500).json({ error: "Erro interno ao processar logout." });
  }
};

const getVereadorProfile = async (req, res) => {
  logger.log("👤 === BUSCANDO PERFIL DO VEREADOR ===");

  try {
    const { user } = req; // user vem do middleware de autenticação
    logger.log(
      "🔍 Buscando dados completos do vereador para usuário ID:",
      user.id
    );

    // Buscar dados do vereador com informações da câmara e partido
    const { data: vereadorData, error: vereadorError } = await supabaseAdmin
      .from("vereadores")
      .select(
        `
                id,
                nome_parlamentar,
                foto_url,
                is_presidente,
                is_vice_presidente,
                is_active,
                created_at,
                camaras (
                    id,
                    nome_camara,
                    municipio,
                    estado
                ),
                partidos (
                    id,
                    nome,
                    sigla,
                    logo_url
                )
            `
      )
      .eq("profile_id", user.id)
      .single();

    if (vereadorError || !vereadorData) {
      logger.error("❌ Dados do vereador não encontrados:", vereadorError);
      return res
        .status(404)
        .json({ error: "Dados do vereador não encontrados" });
    }

    logger.log("✅ Dados do vereador encontrados:", {
      id: vereadorData.id,
      nome: vereadorData.nome_parlamentar,
      foto_url: vereadorData.foto_url,
    });

    return res.status(200).json(vereadorData);
  } catch (error) {
    logger.error("💥 ERRO INESPERADO ao buscar perfil do vereador:", error);
    return res.status(500).json({ error: "Erro interno do servidor" });
  }
};

/**
 * GET /api/me
 * Retorna informações básicas do usuário autenticado, perfil e dados da câmara (se houver)
 * A rota espera o header Authorization: Bearer <token>
 */
const getMe = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Token de acesso ausente" });
    }

    const token = authHeader.split(" ")[1];

    // Validar token via Supabase (cliente com token do usuário)
    const supabaseUser = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY,
      {
        global: { headers: { Authorization: `Bearer ${token}` } },
      }
    );

    const {
      data: { user },
      error: userError,
    } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return res.status(401).json({ error: "Token inválido ou expirado" });
    }

    // Buscar perfil via supabaseAdmin
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id, role, nome, camara_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return res.status(404).json({ error: "Perfil não encontrado" });
    }

    let camara = null;
    if (profile.camara_id) {
      const { data: camaraData, error: camaraError } = await supabaseAdmin
        .from("camaras")
        .select("id, nome_camara, brasao_url")
        .eq("id", profile.camara_id)
        .single();

      if (!camaraError && camaraData) camara = camaraData;
    }

    return res.status(200).json({
      user: { id: user.id, email: user.email },
      profile,
      camara,
    });
  } catch (error) {
    logger.error("Erro em getMe:", error.message || error);
    return res.status(500).json({ error: "Erro interno do servidor" });
  }
};

const handleRefreshToken = async (req, res) => {
  logger.log("🔄 === INÍCIO DO PROCESSO DE REFRESH TOKEN ===");

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      logger.error("❌ Token de autorização ausente ou mal formatado");
      return res.status(401).json({ error: "Token de autorização requerido" });
    }

    const currentToken = authHeader.split(" ")[1];
    logger.log("🔍 Verificando token atual...");

    // Verifica se o token atual ainda é válido
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(currentToken);

    if (userError || !user) {
      logger.error("❌ Token atual inválido:", userError?.message);
      return res.status(401).json({ error: "Token inválido ou expirado" });
    }

    logger.log(`✅ Token atual válido para usuário: ${user.id}`);

    // Tenta renovar a sessão usando Supabase Auth
    // IMPORTANTE: Isso só funciona se o refresh_token estiver disponível no servidor
    // Como estamos usando JWT stateless, vamos verificar se o token precisa ser renovado

    // Decodifica o token atual para verificar tempo restante
    const tokenParts = currentToken.split('.');
    if (tokenParts.length !== 3) {
      logger.error("❌ Formato de token inválido");
      return res.status(401).json({ error: "Token malformado" });
    }

    const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
    const now = Math.floor(Date.now() / 1000);
    const timeUntilExpiry = payload.exp - now;

    logger.log(`⏰ Token expira em ${Math.floor(timeUntilExpiry / 60)} minutos`);

    // Se o token está muito próximo de expirar (< 30 min), tenta gerar novo
    // NOTA: Com Supabase, a única forma de obter novo access_token é via refreshSession()
    // mas isso requer o refresh_token que geralmente fica apenas no cliente

    // Por enquanto, vamos retornar o token atual mas com dados atualizados
    // A renovação real acontecerá quando o usuário fizer novo login

    // Busca dados atualizados do perfil
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("role, nome, camara_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profileData) {
      logger.error("❌ Perfil não encontrado para o usuário ID:", user.id);
      return res
        .status(404)
        .json({ error: "Perfil de usuário não encontrado." });
    }

    logger.log("✅ Token validado e dados do usuário atualizados!");

    return res.status(200).json({
      message: "Token validado com sucesso!",
      user: {
        id: user.id,
        email: user.email,
        nome: profileData.nome,
        role: profileData.role,
        camara_id: profileData.camara_id,
      },
      token: currentToken,
      expiresIn: timeUntilExpiry, // Tempo em segundos até expirar
    });
  } catch (error) {
    logger.error("💥 ERRO INESPERADO NO REFRESH TOKEN:", error);
    return res.status(500).json({ error: "Erro interno no servidor" });
  }
};

module.exports = {
  handleLogin,
  handleLogout,
  handleRefreshToken,
  getVereadorProfile,
  getMe,
};
