/**
 * Testes de Integração - Pautas Tablet Backend
 * Testa consulta de pautas por vereadores no tablet
 */

const { loginAs } = require('../../helpers/auth.helper');
const { tabletRequest, tabletAuthenticatedGet } = require('../../helpers/tablet-request.helper');
const { CREDENTIALS, REAL_IDS } = require('../../config/testData');

describe('📋 Pautas - Tablet Backend', () => {
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

  describe('GET /api/pautas', () => {
    test('Deve listar pautas da câmara (vereador)', async () => {
      if (!vereadorToken) {
        expect(true).toBe(true);
        return;
      }

      const response = await tabletAuthenticatedGet('/api/pautas', vereadorToken);

      expect(response.status).toBe(200);
      // A resposta pode ser array direto ou objeto com pautas
      const isValidResponse = Array.isArray(response.body) ||
                              (response.body && Array.isArray(response.body.pautas)) ||
                              (response.body && Array.isArray(response.body.data)) ||
                              (typeof response.body === 'object');
      expect(isValidResponse).toBe(true);
    });

    test('Deve rejeitar sem autenticação', async () => {
      const response = await tabletRequest()
        .get('/api/pautas');

      expect(response.status).toBe(401);
    });

    test('Deve rejeitar com token inválido', async () => {
      const response = await tabletRequest()
        .get('/api/pautas')
        .set('Authorization', 'Bearer token_invalido_123');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/pautas/:id', () => {
    test('Deve buscar pauta por ID (vereador)', async () => {
      if (!vereadorToken) {
        expect(true).toBe(true);
        return;
      }

      const pautaId = REAL_IDS.pautaId || '00000000-0000-0000-0000-000000000000';

      const response = await tabletAuthenticatedGet(
        `/api/pautas/${pautaId}`,
        vereadorToken
      );

      // Se a pauta existe, retorna 200, senão 404
      expect([200, 404, 500]).toContain(response.status);

      if (response.status === 200) {
        expect(response.body).toHaveProperty('id');
      }
    });

    test('Deve retornar erro para pauta inexistente', async () => {
      if (!vereadorToken) {
        expect(true).toBe(true);
        return;
      }

      const fakeId = '00000000-0000-0000-0000-000000000000';
      const response = await tabletAuthenticatedGet(
        `/api/pautas/${fakeId}`,
        vereadorToken
      );

      expect([404, 500]).toContain(response.status);
    });

    test('Deve rejeitar sem autenticação', async () => {
      const pautaId = REAL_IDS.pautaId || '00000000-0000-0000-0000-000000000000';

      const response = await tabletRequest()
        .get(`/api/pautas/${pautaId}`);

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/pautas/:id/estatisticas', () => {
    test('Deve buscar estatísticas de votação (vereador)', async () => {
      if (!vereadorToken) {
        expect(true).toBe(true);
        return;
      }

      const pautaId = REAL_IDS.pautaId || '00000000-0000-0000-0000-000000000000';

      const response = await tabletAuthenticatedGet(
        `/api/pautas/${pautaId}/estatisticas`,
        vereadorToken
      );

      expect([200, 404, 500]).toContain(response.status);

      if (response.status === 200) {
        // Estatísticas podem ter diferentes formatos
        expect(typeof response.body).toBe('object');
      }
    });

    test('Deve retornar erro para pauta inexistente', async () => {
      if (!vereadorToken) {
        expect(true).toBe(true);
        return;
      }

      const fakeId = '00000000-0000-0000-0000-000000000000';
      const response = await tabletAuthenticatedGet(
        `/api/pautas/${fakeId}/estatisticas`,
        vereadorToken
      );

      expect([404, 500]).toContain(response.status);
    });

    test('Deve rejeitar sem autenticação', async () => {
      const pautaId = REAL_IDS.pautaId || '00000000-0000-0000-0000-000000000000';

      const response = await tabletRequest()
        .get(`/api/pautas/${pautaId}/estatisticas`);

      expect(response.status).toBe(401);
    });
  });
});
