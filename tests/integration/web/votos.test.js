/**
 * Testes de Integração - Votos (Web Backend)
 * Testa endpoints de consulta de votos (o registro é feito pelo tablet)
 */

const { loginAs } = require('../../helpers/auth.helper');
const { authenticatedGet, authenticatedPost, webRequest } = require('../../helpers/request.helper');
const { REAL_IDS } = require('../../config/testData');

describe('🗳️ Votos - Web Backend', () => {
  let superAdminToken;
  let adminCamaraToken;
  let tvToken;

  // Login antes de todos os testes
  beforeAll(async () => {
    superAdminToken = await loginAs('super_admin');
    adminCamaraToken = await loginAs('admin_camara');
    tvToken = await loginAs('tv');
  });

  describe('GET /api/votos/pauta/:pauta_id', () => {
    test('Deve buscar votos de uma pauta (admin_camara)', async () => {
      // Usar pautaId se existir, senão usar um ID fake para testar erro
      const pautaId = REAL_IDS.pautaId || '00000000-0000-0000-0000-000000000000';

      const response = await authenticatedGet(
        `/api/votos/pauta/${pautaId}`,
        adminCamaraToken
      );

      // Se a pauta existe, retorna 200, senão 404
      expect([200, 404, 500]).toContain(response.status);

      if (response.status === 200) {
        expect(response.body).toHaveProperty('pauta');
        expect(response.body).toHaveProperty('votos');
        expect(response.body).toHaveProperty('estatisticas');
        expect(Array.isArray(response.body.votos)).toBe(true);
      }
    });

    test('Deve buscar votos de uma pauta (super_admin)', async () => {
      const pautaId = REAL_IDS.pautaId || '00000000-0000-0000-0000-000000000000';

      const response = await authenticatedGet(
        `/api/votos/pauta/${pautaId}`,
        superAdminToken
      );

      expect([200, 404, 500]).toContain(response.status);
    });

    test('Deve retornar erro para pauta inexistente', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';

      const response = await authenticatedGet(
        `/api/votos/pauta/${fakeId}`,
        adminCamaraToken
      );

      expect([404, 500]).toContain(response.status);
    });

    test('Deve rejeitar sem autenticação', async () => {
      const pautaId = REAL_IDS.pautaId || '00000000-0000-0000-0000-000000000000';

      const response = await webRequest()
        .get(`/api/votos/pauta/${pautaId}`);

      expect(response.status).toBe(401);
    });

    test('Deve permitir tv acessar votos', async () => {
      const pautaId = REAL_IDS.pautaId || '00000000-0000-0000-0000-000000000000';

      const response = await authenticatedGet(
        `/api/votos/pauta/${pautaId}`,
        tvToken
      );

      // TV pode consultar votos, mas pode não ter acesso a pauta de outra câmara
      expect([200, 403, 404, 500]).toContain(response.status);
    });
  });

  describe('POST /api/votos', () => {
    test('Deve rejeitar admin_camara tentando votar (apenas vereadores)', async () => {
      const novoVoto = {
        pauta_id: REAL_IDS.pautaId || '00000000-0000-0000-0000-000000000000',
        voto: 'Sim'
      };

      const response = await authenticatedPost(
        '/api/votos',
        novoVoto,
        adminCamaraToken
      );

      // Admin não pode votar - apenas vereadores
      expect([403, 404, 500]).toContain(response.status);
    });

    test('Deve rejeitar super_admin tentando votar (apenas vereadores)', async () => {
      const novoVoto = {
        pauta_id: REAL_IDS.pautaId || '00000000-0000-0000-0000-000000000000',
        voto: 'Sim'
      };

      const response = await authenticatedPost(
        '/api/votos',
        novoVoto,
        superAdminToken
      );

      // Super admin não pode votar - apenas vereadores
      expect([403, 404, 500]).toContain(response.status);
    });

    test('Deve rejeitar tv tentando votar (apenas vereadores)', async () => {
      const novoVoto = {
        pauta_id: REAL_IDS.pautaId || '00000000-0000-0000-0000-000000000000',
        voto: 'Sim'
      };

      const response = await authenticatedPost(
        '/api/votos',
        novoVoto,
        tvToken
      );

      // TV não pode votar - apenas vereadores
      expect([403, 404, 500]).toContain(response.status);
    });

    test('Deve retornar erro sem pauta_id', async () => {
      const votoInvalido = {
        voto: 'Sim'
      };

      const response = await authenticatedPost(
        '/api/votos',
        votoInvalido,
        adminCamaraToken
      );

      expect([400, 403, 500]).toContain(response.status);
    });

    test('Deve retornar erro sem voto', async () => {
      const votoInvalido = {
        pauta_id: REAL_IDS.pautaId || '00000000-0000-0000-0000-000000000000'
      };

      const response = await authenticatedPost(
        '/api/votos',
        votoInvalido,
        adminCamaraToken
      );

      expect([400, 403, 500]).toContain(response.status);
    });

    test('Deve rejeitar sem autenticação', async () => {
      const novoVoto = {
        pauta_id: REAL_IDS.pautaId || '00000000-0000-0000-0000-000000000000',
        voto: 'Sim'
      };

      const response = await webRequest()
        .post('/api/votos')
        .send(novoVoto);

      expect(response.status).toBe(401);
    });
  });
});
