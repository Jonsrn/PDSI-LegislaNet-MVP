/**
 * Helper de Requisições
 * Funções auxiliares para fazer requisições HTTP nos testes
 */

const request = require('supertest');
const { WEB_BASE_URL, TABLET_BASE_URL } = require('../config/testData');

/**
 * Cria uma requisição para o servidor web
 * @returns {supertest.SuperTest<supertest.Test>}
 */
function webRequest() {
  return request(WEB_BASE_URL);
}

/**
 * Cria uma requisição para o servidor tablet
 * @returns {supertest.SuperTest<supertest.Test>}
 */
function tabletRequest() {
  return request(TABLET_BASE_URL);
}

/**
 * Faz uma requisição GET autenticada
 * @param {string} path - Caminho do endpoint
 * @param {string} token - Token JWT
 * @param {string} server - Servidor ('web' ou 'tablet')
 * @returns {Promise<supertest.Response>}
 */
async function authenticatedGet(path, token, server = 'web') {
  const req = server === 'web' ? webRequest() : tabletRequest();

  return req
    .get(path)
    .set('Authorization', `Bearer ${token}`);
}

/**
 * Faz uma requisição POST autenticada
 * @param {string} path - Caminho do endpoint
 * @param {object} body - Corpo da requisição
 * @param {string} token - Token JWT
 * @param {string} server - Servidor ('web' ou 'tablet')
 * @returns {Promise<supertest.Response>}
 */
async function authenticatedPost(path, body, token, server = 'web') {
  const req = server === 'web' ? webRequest() : tabletRequest();

  return req
    .post(path)
    .set('Authorization', `Bearer ${token}`)
    .send(body);
}

/**
 * Faz uma requisição PUT autenticada
 * @param {string} path - Caminho do endpoint
 * @param {object} body - Corpo da requisição
 * @param {string} token - Token JWT
 * @param {string} server - Servidor ('web' ou 'tablet')
 * @returns {Promise<supertest.Response>}
 */
async function authenticatedPut(path, body, token, server = 'web') {
  const req = server === 'web' ? webRequest() : tabletRequest();

  return req
    .put(path)
    .set('Authorization', `Bearer ${token}`)
    .send(body);
}

/**
 * Faz uma requisição DELETE autenticada
 * @param {string} path - Caminho do endpoint
 * @param {string} token - Token JWT
 * @param {string} server - Servidor ('web' ou 'tablet')
 * @returns {Promise<supertest.Response>}
 */
async function authenticatedDelete(path, token, server = 'web') {
  const req = server === 'web' ? webRequest() : tabletRequest();

  return req
    .delete(path)
    .set('Authorization', `Bearer ${token}`);
}

module.exports = {
  webRequest,
  tabletRequest,
  authenticatedGet,
  authenticatedPost,
  authenticatedPut,
  authenticatedDelete
};
