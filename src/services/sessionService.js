// C:\Projects\LegislaNet\src\services\sessionService.js

import { createHash } from "crypto";
import { supabaseAdmin } from "../config/supabaseAdminClient.js"; // Verifique se o caminho está correto
import logger from "../utils/logger.js"; // Verifique se o caminho do logger está correto

const TABLE_NAME = "auth_sessions";

/**
 * Cria um hash SHA256 do refresh token para armazenamento seguro.
 * @param {string} token - O refresh token em texto plano.
 * @returns {string} O hash do token.
 */
function hashRefreshToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Cria uma nova sessão de autenticação no banco de dados.
 * @param {object} sessionData - Dados da sessão.
 * @param {string} sessionData.profile_id - UUID do perfil do usuário.
 * @param {string} sessionData.refresh_token - O refresh token recebido do Supabase.
 * @param {string} [sessionData.ip] - Endereço IP do cliente.
 * @param {string} [sessionData.user_agent] - User agent do cliente.
 * @param {string} [sessionData.device_type] - Tipo de dispositivo (ex: 'web_admin', 'portal', 'tv').
 * @returns {Promise<object>} O registro da sessão criada.
 */
async function createSession({
  profile_id,
  refresh_token,
  ip,
  user_agent,
  device_type,
}) {
  if (!profile_id || !refresh_token) {
    throw new Error(
      "Profile ID and refresh token are required to create a session."
    );
  }

  const refresh_token_hash = hashRefreshToken(refresh_token);

  const { data, error } = await supabaseAdmin
    .from(TABLE_NAME)
    .insert({
      profile_id,
      refresh_token_hash,
      ip,
      user_agent,
      device_type: device_type || "web", // Default para 'web' se não especificado
      last_used_at: new Date(),
    })
    .select()
    .single();

  if (error) {
    logger.error("Error creating auth session in DB:", error);
    throw error;
  }

  return data;
}

/**
 * Encontra uma sessão ativa pelo refresh token.
 * @param {string} refreshToken - O refresh token em texto plano.
 * @returns {Promise<object|null>} A sessão encontrada ou null.
 */
async function findSessionByRefreshToken(refreshToken) {
  const refreshTokenHash = hashRefreshToken(refreshToken);
  const { data, error } = await supabaseAdmin
    .from(TABLE_NAME)
    .select("*")
    .eq("refresh_token_hash", refreshTokenHash)
    .eq("revoked", false)
    .single();

  if (error && error.code !== "PGRST116") {
    // PGRST116 = 'single row not found'
    logger.error("Error finding session by refresh token:", error);
    throw error;
  }

  return data;
}

/**
 * Revoga uma sessão pelo seu ID.
 * @param {string} sessionId - O UUID da sessão.
 * @returns {Promise<boolean>} True se a sessão foi revogada com sucesso.
 */
async function revokeSessionById(sessionId) {
  const { error } = await supabaseAdmin
    .from(TABLE_NAME)
    .update({ revoked: true })
    .eq("id", sessionId);

  if (error) {
    logger.error(`Error revoking session ${sessionId}:`, error);
    return false;
  }
  return true;
}

/**
 * Revoga uma sessão pelo refresh token.
 * @param {string} refreshToken - O refresh token em texto plano.
 * @returns {Promise<boolean>} True se a sessão foi revogada com sucesso.
 */
async function revokeSessionByRefreshToken(refreshToken) {
  const refreshTokenHash = hashRefreshToken(refreshToken);
  const { error } = await supabaseAdmin
    .from(TABLE_NAME)
    .update({ revoked: true })
    .eq("refresh_token_hash", refreshTokenHash);

  if (error) {
    logger.error(`Error revoking session by refresh token:`, error);
    return false;
  }
  return true;
}

/**
 * Lista todas as sessões de um usuário.
 * @param {string} profileId - O UUID do perfil do usuário.
 * @returns {Promise<Array<object>>} Uma lista de sessões.
 */
async function listSessionsForProfile(profileId) {
  const { data, error } = await supabaseAdmin
    .from(TABLE_NAME)
    .select("id, created_at, last_used_at, device_type, ip, revoked")
    .eq("profile_id", profileId)
    .order("last_used_at", { ascending: false });

  if (error) {
    logger.error(`Error listing sessions for profile ${profileId}:`, error);
    throw error;
  }
  return data;
}

/**
 * Rotaciona um refresh token. A sessão antiga é revogada e uma nova é criada.
 * @param {string} oldRefreshToken - O refresh token a ser revogado.
 * @param {string} newRefreshToken - O novo refresh token a ser salvo.
 * @param {string} profileId - O ID do usuário.
 * @param {string} ip - O IP da requisição.
 * @param {string} userAgent - O User Agent da requisição.
 * @param {string} deviceType - O tipo de dispositivo.
 * @returns {Promise<object>} A nova sessão criada.
 */
async function rotateRefreshToken(
  oldRefreshToken,
  newRefreshToken,
  profileId,
  ip,
  userAgent,
  deviceType
) {
  // Revoga a sessão antiga em paralelo
  const revokePromise = revokeSessionByRefreshToken(oldRefreshToken);

  // Cria a nova sessão
  const createPromise = createSession({
    profile_id: profileId,
    refresh_token: newRefreshToken,
    ip,
    user_agent: userAgent,
    device_type: deviceType,
  });

  // Espera ambas as operações completarem
  const [revoked, newSession] = await Promise.all([
    revokePromise,
    createPromise,
  ]);

  if (!revoked) {
    logger.warn(
      `Failed to revoke old session for refresh token hash: ${hashRefreshToken(
        oldRefreshToken
      )}`
    );
  }

  return newSession;
}

export const sessionService = {
  createSession,
  findSessionByRefreshToken,
  revokeSessionById,
  revokeSessionByRefreshToken,
  listSessionsForProfile,
  rotateRefreshToken, // Adicionamos a nova função de rotação
};
