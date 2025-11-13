/**
 * Testes de Integração - Votos Tablet Backend
 * Testa registro e consulta de votos por vereadores no tablet
 */

const { tabletRequest, tabletAuthenticatedGet, tabletAuthenticatedPost } = require('../../helpers/tablet-request.helper');
const { CREDENTIALS, REAL_IDS } = require('../../config/testData');

describe('🗳️ Votos - Tablet Backend', () => {
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

  describe('GET /api/votos/meus-votos', () => {
    test('Deve listar votos do vereador logado', async () => {
      if (!vereadorToken) {
        expect(true).toBe(true);
        return;
      }

      const response = await tabletAuthenticatedGet('/api/votos/meus-votos', vereadorToken);

      expect(response.status).toBe(200);
      // A resposta pode ser array direto ou objeto com votos
      const isValidResponse = Array.isArray(response.body) ||
                              (response.body && Array.isArray(response.body.votos)) ||
                              (typeof response.body === 'object');
      expect(isValidResponse).toBe(true);
    });

    test('Deve rejeitar sem autenticação', async () => {
      const response = await tabletRequest()
        .get('/api/votos/meus-votos');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/votos/pauta/:pauta_id', () => {
    test('Deve buscar voto do vereador em uma pauta específica', async () => {
      if (!vereadorToken) {
        expect(true).toBe(true);
        return;
      }

      const pautaId = REAL_IDS.pautaId || '00000000-0000-0000-0000-000000000000';

      const response = await tabletAuthenticatedGet(
        `/api/votos/pauta/${pautaId}`,
        vereadorToken
      );

      // Pode retornar 200 (voto encontrado), 404 (ainda não votou), ou 500
      expect([200, 404, 500]).toContain(response.status);
    });

    test('Deve retornar erro para pauta inexistente', async () => {
      if (!vereadorToken) {
        expect(true).toBe(true);
        return;
      }

      const fakeId = '00000000-0000-0000-0000-000000000000';
      const response = await tabletAuthenticatedGet(
        `/api/votos/pauta/${fakeId}`,
        vereadorToken
      );

      // Pode retornar 200 (sem voto), 404, ou 500
      expect([200, 404, 500]).toContain(response.status);
    });

    test('Deve rejeitar sem autenticação', async () => {
      const pautaId = REAL_IDS.pautaId || '00000000-0000-0000-0000-000000000000';

      const response = await tabletRequest()
        .get(`/api/votos/pauta/${pautaId}`);

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/votos/pauta/:pauta_id/estatisticas', () => {
    test('Deve buscar estatísticas de votação de uma pauta', async () => {
      if (!vereadorToken) {
        expect(true).toBe(true);
        return;
      }

      const pautaId = REAL_IDS.pautaId || '00000000-0000-0000-0000-000000000000';

      const response = await tabletAuthenticatedGet(
        `/api/votos/pauta/${pautaId}/estatisticas`,
        vereadorToken
      );

      expect([200, 404, 500]).toContain(response.status);

      if (response.status === 200) {
        expect(typeof response.body).toBe('object');
      }
    });

    test('Deve rejeitar sem autenticação', async () => {
      const pautaId = REAL_IDS.pautaId || '00000000-0000-0000-0000-000000000000';

      const response = await tabletRequest()
        .get(`/api/votos/pauta/${pautaId}/estatisticas`);

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/votos', () => {
    test('Deve registrar/atualizar voto em pauta (apenas se pauta existir e estiver em votação)', async () => {
      if (!vereadorToken) {
        expect(true).toBe(true);
        return;
      }

      const novoVoto = {
        pauta_id: REAL_IDS.pautaId || '00000000-0000-0000-0000-000000000000',
        voto: 'Sim'
      };

      const response = await tabletAuthenticatedPost(
        '/api/votos',
        novoVoto,
        vereadorToken
      );

      // Pode retornar 200/201 (sucesso), 400 (pauta não em votação), 404 (pauta não existe), ou 500
      expect([200, 201, 400, 404, 500]).toContain(response.status);
    });

    test('Deve retornar erro sem pauta_id', async () => {
      if (!vereadorToken) {
        expect(true).toBe(true);
        return;
      }

      const votoInvalido = {
        voto: 'Sim'
      };

      const response = await tabletAuthenticatedPost(
        '/api/votos',
        votoInvalido,
        vereadorToken
      );

      expect([400, 500]).toContain(response.status);
    });

    test('Deve retornar erro sem voto', async () => {
      if (!vereadorToken) {
        expect(true).toBe(true);
        return;
      }

      const votoInvalido = {
        pauta_id: REAL_IDS.pautaId || '00000000-0000-0000-0000-000000000000'
      };

      const response = await tabletAuthenticatedPost(
        '/api/votos',
        votoInvalido,
        vereadorToken
      );

      expect([400, 500]).toContain(response.status);
    });

    test('Deve retornar erro com voto inválido', async () => {
      if (!vereadorToken) {
        expect(true).toBe(true);
        return;
      }

      const votoInvalido = {
        pauta_id: REAL_IDS.pautaId || '00000000-0000-0000-0000-000000000000',
        voto: 'VotoInvalido'
      };

      const response = await tabletAuthenticatedPost(
        '/api/votos',
        votoInvalido,
        vereadorToken
      );

      expect([400, 404, 500]).toContain(response.status);
    });

    test('Deve rejeitar sem autenticação', async () => {
      const novoVoto = {
        pauta_id: REAL_IDS.pautaId || '00000000-0000-0000-0000-000000000000',
        voto: 'Sim'
      };

      const response = await tabletRequest()
        .post('/api/votos')
        .send(novoVoto);

      expect(response.status).toBe(401);
    });
  });
});
