const request = require('supertest');
const { TABLET_BASE_URL } = require('../config/testData');

/**
 * Cria uma requisição base para o tablet backend
 */
const tabletRequest = () => {
  return request(TABLET_BASE_URL);
};

/**
 * Faz uma requisição GET autenticada para o tablet backend
 */
const tabletAuthenticatedGet = async (path, token) => {
  return tabletRequest()
    .get(path)
    .set('Authorization', `Bearer ${token}`);
};

/**
 * Faz uma requisição POST autenticada para o tablet backend
 */
const tabletAuthenticatedPost = async (path, data, token) => {
  return tabletRequest()
    .post(path)
    .set('Authorization', `Bearer ${token}`)
    .send(data);
};

/**
 * Faz uma requisição PUT autenticada para o tablet backend
 */
const tabletAuthenticatedPut = async (path, data, token) => {
  return tabletRequest()
    .put(path)
    .set('Authorization', `Bearer ${token}`)
    .send(data);
};

/**
 * Faz uma requisição DELETE autenticada para o tablet backend
 */
const tabletAuthenticatedDelete = async (path, token) => {
  return tabletRequest()
    .delete(path)
    .set('Authorization', `Bearer ${token}`);
};

module.exports = {
  tabletRequest,
  tabletAuthenticatedGet,
  tabletAuthenticatedPost,
  tabletAuthenticatedPut,
  tabletAuthenticatedDelete
};
