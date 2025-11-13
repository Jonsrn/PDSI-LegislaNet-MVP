const { createClient } = require("@supabase/supabase-js");
const createLogger = require("../utils/logger");
const tokenManager = require("../utils/tokenManager"); // Importa o tokenManager
const logger = createLogger("AUTH_MIDDLEWARE");

/**
 * Decodifica o payload de um token JWT.
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

/**
 * Função de Ordem Superior que cria um middleware de permissão.
 * @param {Array<string>} allowedRoles - Um array de 'roles' que têm permissão para acessar a rota.
 */
const hasPermission = (allowedRoles) => {
  return async (req, res, next) => {
    logger.log(
      `--- INICIANDO VERIFICAÇÃO DE PERMISSÃO: [${allowedRoles.join(", ")}] ---`
    );

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      logger.error("FALHA: Cabeçalho Authorization ausente ou mal formatado.");
      return res
        .status(401)
        .json({ error: "Token de acesso ausente ou mal formatado." });
    }

    const token = authHeader.split(" ")[1];

    // Log seguro - não expõe parte do token em produção
    if (process.env.NODE_ENV === 'development') {
      logger.log(`Token extraído: Bearer ${token.substring(0, 10)}...`);
    } else {
      logger.log('Token extraído: Bearer ****...');
    }

    // --- NOVA VERIFICAÇÃO DE BLACKLIST ---
    if (tokenManager.isBlacklisted(token)) {
      logger.error(`FALHA: Tentativa de uso de token na blacklist (deslogado).`);
      return res.status(401).json({ error: "Token inválido ou expirado." });
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
        logger.error(
          "FALHA no Passo 1: Token inválido ou expirado.",
          userError
        );
        return res.status(401).json({ error: "Token inválido ou expirado." });
      }
      logger.log(
        `-> SUCESSO no Passo 1: Usuário ${user.id} (${user.email}) autenticado.`
      );

      const supabaseAdmin = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_KEY
      );
      const { data: profile, error: profileError } = await supabaseAdmin
        .from("profiles")
        .select("role, camara_id, min_token_iat") // Seleciona o novo campo
        .eq("id", user.id)
        .single();

      if (profileError || !profile) {
        logger.error(
          `FALHA no Passo 2: Perfil não encontrado para o usuário ${user.id}.`,
          profileError
        );
        return res
          .status(404)
          .json({ error: "Perfil de usuário não encontrado." });
      }
      logger.log(
        `-> SUCESSO no Passo 2: Perfil encontrado. Role: '${profile.role}'. IAT Mínimo: ${profile.min_token_iat}`
      );

      // --- NOVA VERIFICAÇÃO DE SESSÃO ÚNICA (IAT) ---
      const tokenPayload = decodeJwtPayload(token);
      const iatDoToken = tokenPayload ? tokenPayload.iat : null;
      const iatMinimoDoPerfil = profile.min_token_iat;
      logger.log(
        `[DEBUG-BACKEND] Comparando IATs. Token IAT: ${iatDoToken}, Perfil IAT Mínimo: ${iatMinimoDoPerfil}`
      );
      if (!tokenPayload || tokenPayload.iat < profile.min_token_iat) {
        logger.warn(
          `FALHA: Token antigo detectado (sessão invalidada por novo login). IAT do token: ${tokenPayload?.iat}, IAT mínimo exigido: ${profile.min_token_iat}`
        );
        tokenManager.blacklistToken(token); // Adiciona o token antigo à blacklist por segurança
        return res
          .status(401)
          .json({ error: "Sessão expirada. Por favor, faça login novamente." });
      }
      logger.log("-> SUCESSO: Timestamp (iat) do token é válido.");

      if (!allowedRoles.includes(profile.role)) {
        logger.error(
          `FALHA no Passo 3: ACESSO NEGADO. Role '${
            profile.role
          }' não está na lista [${allowedRoles.join(", ")}].`
        );
        return res
          .status(403)
          .json({
            error:
              "Acesso negado. Você não tem permissão para realizar esta ação.",
          });
      }

      logger.log(
        `✅ SUCESSO no Passo 3: ACESSO PERMITIDO. A role '${profile.role}' é válida.`
      );

      req.user = user;
      req.profile = profile;

      next();
    } catch (error) {
      logger.error("ERRO CRÍTICO na verificação de permissão.", error.message);
      return res
        .status(500)
        .json({ error: "Erro interno no servidor durante a autenticação." });
    }
  };
};

const isSuperAdmin = hasPermission(["super_admin"]);
const canManageSessoes = hasPermission(["super_admin", "admin_camara"]);
const canManagePautas = hasPermission(["super_admin", "admin_camara"]);
const canAccessVotacaoStatus = hasPermission([
  "super_admin",
  "admin_camara",
  "tv",
]);

module.exports = {
  hasPermission,
  isSuperAdmin,
  canManageSessoes,
  canManagePautas,
  canAccessVotacaoStatus,
};
