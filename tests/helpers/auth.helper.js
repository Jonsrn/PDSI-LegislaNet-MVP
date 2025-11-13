/**
 * Helper de Autenticação
 * Centraliza a lógica de login e cache de tokens
 */

const request = require('supertest');
const { CREDENTIALS, WEB_BASE_URL, TABLET_BASE_URL } = require('../config/testData');

// Cache de tokens para evitar logins repetidos
const tokenCache = new Map();

/**
 * Faz login e retorna o token (com cache)
 * @param {string} role - Role do usuário (super_admin, admin_camara, tv, vereador)
 * @param {string} server - Servidor ('web' ou 'tablet')
 * @returns {Promise<string>} Token JWT
 */
async function loginAs(role, server = 'web') {
  const cacheKey = `${role}_${server}`;

  // Retornar do cache se já existe
  if (tokenCache.has(cacheKey)) {
    return tokenCache.get(cacheKey);
  }

  const baseUrl = server === 'web' ? WEB_BASE_URL : TABLET_BASE_URL;
  const credentials = CREDENTIALS[role];

  if (!credentials) {
    throw new Error(`Credenciais não encontradas para role: ${role}`);
  }

  const response = await request(baseUrl)
    .post('/api/auth/login')
    .send(credentials);

  if (response.status !== 200) {
    throw new Error(
      `Login falhou para ${role} no servidor ${server}: ` +
      `Status ${response.status} - ${JSON.stringify(response.body)}`
    );
  }

  const token = response.body.token;

  // Armazenar no cache
  tokenCache.set(cacheKey, token);

  return token;
}

/**
 * Limpa o cache de tokens
 * Útil entre suites de testes para garantir tokens frescos
 */
function clearTokenCache() {
  tokenCache.clear();
}

/**
 * Obtém um token do cache (se existir)
 * @param {string} role - Role do usuário
 * @param {string} server - Servidor ('web' ou 'tablet')
 * @returns {string|null} Token ou null se não estiver no cache
 */
function getCachedToken(role, server = 'web') {
  const cacheKey = `${role}_${server}`;
  return tokenCache.get(cacheKey) || null;
}

/**
 * Verifica se um token está válido
 * @param {string} token - Token JWT
 * @param {string} server - Servidor ('web' ou 'tablet')
 * @returns {Promise<boolean>} True se válido
 */
async function isTokenValid(token, server = 'web') {
  const baseUrl = server === 'web' ? WEB_BASE_URL : TABLET_BASE_URL;

  try {
    const response = await request(baseUrl)
      .get('/api/auth/profile')
      .set('Authorization', `Bearer ${token}`);

    return response.status === 200;
  } catch (error) {
    return false;
  }
}

module.exports = {
  loginAs,
  clearTokenCache,
  getCachedToken,
  isTokenValid
};
