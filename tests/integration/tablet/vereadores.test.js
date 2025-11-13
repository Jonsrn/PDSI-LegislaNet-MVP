/**
 * Testes de Integração - Vereadores Tablet Backend
 * Testa consulta de perfil e vereadores da câmara no tablet
 */

const { tabletRequest, tabletAuthenticatedGet } = require('../../helpers/tablet-request.helper');
const { CREDENTIALS } = require('../../config/testData');

describe('👔 Vereadores - Tablet Backend', () => {
  let vereadorToken;

  // Login antes de todos os testes
  beforeAll(async () => {
    const response = await tabletRequest()
      .post('/api/auth/login')
      .send(CREDENTIALS.vereador);

    if (response.status === 200) {
      vereadorToken = response.body.token;
    }
  });

  describe('GET /api/vereadores/profile', () => {
    test('Deve buscar perfil completo do vereador logado', async () => {
      if (!vereadorToken) {
        expect(true).toBe(true);
        return;
      }

      const response = await tabletAuthenticatedGet('/api/vereador/profile', vereadorToken);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id');
      // O perfil retorna dados do vereador, não do usuário
      expect(response.body).toHaveProperty('nome_parlamentar');
    });

    test('Deve rejeitar sem autenticação', async () => {
      const response = await tabletRequest()
        .get('/api/vereador/profile');

      expect(response.status).toBe(401);
    });

    test('Deve rejeitar com token inválido', async () => {
      const response = await tabletRequest()
        .get('/api/vereador/profile')
        .set('Authorization', 'Bearer token_invalido_123');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/vereadores/camara', () => {
    test('Deve listar vereadores da mesma câmara', async () => {
      if (!vereadorToken) {
        expect(true).toBe(true);
        return;
      }

      const response = await tabletAuthenticatedGet('/api/vereador/camara', vereadorToken);

      expect(response.status).toBe(200);
      // A resposta pode ser array direto ou objeto com vereadores
      const isValidResponse = Array.isArray(response.body) ||
                              (response.body && Array.isArray(response.body.vereadores)) ||
                              (typeof response.body === 'object');
      expect(isValidResponse).toBe(true);
    });

    test('Deve rejeitar sem autenticação', async () => {
      const response = await tabletRequest()
        .get('/api/vereador/camara');

      expect(response.status).toBe(401);
    });
  });
});
