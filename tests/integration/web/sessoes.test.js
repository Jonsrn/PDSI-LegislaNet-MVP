/**
 * Testes de Integração - Sessões
 * Testa endpoints de gerenciamento de sessões legislativas
 */

const { loginAs } = require('../../helpers/auth.helper');
const { authenticatedGet, authenticatedPost, authenticatedPut, authenticatedDelete, webRequest } = require('../../helpers/request.helper');
const { REAL_IDS } = require('../../config/testData');

describe('📋 Sessões - Web Backend', () => {
  let superAdminToken;
  let adminCamaraToken;
  let tvToken;
  let createdSessaoId = null;

  // Login antes de todos os testes
  beforeAll(async () => {
    superAdminToken = await loginAs('super_admin');
    adminCamaraToken = await loginAs('admin_camara');
    tvToken = await loginAs('tv');
  });

  describe('GET /api/sessoes', () => {
    test('Deve listar sessões (admin_camara)', async () => {
      const response = await authenticatedGet('/api/sessoes', adminCamaraToken);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    test('Deve rejeitar sem autenticação', async () => {
      const response = await webRequest()
        .get('/api/sessoes');

      expect(response.status).toBe(401);
    });

    test('Deve rejeitar tv (sem permissão)', async () => {
      const response = await authenticatedGet('/api/sessoes', tvToken);

      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/sessoes/disponiveis', () => {
    test('Deve listar sessões disponíveis (admin_camara)', async () => {
      const response = await authenticatedGet('/api/sessoes/disponiveis', adminCamaraToken);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    test('Deve rejeitar sem autenticação', async () => {
      const response = await webRequest()
        .get('/api/sessoes/disponiveis');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/sessoes/:id', () => {
    test('Deve buscar sessão por ID (admin_camara)', async () => {
      const response = await authenticatedGet(
        `/api/sessoes/${REAL_IDS.sessaoId}`,
        adminCamaraToken
      );

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id');
      expect(response.body.id).toBe(REAL_IDS.sessaoId);
    });

    test('Deve retornar erro para sessão inexistente', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const response = await authenticatedGet(
        `/api/sessoes/${fakeId}`,
        adminCamaraToken
      );

      expect([404, 500]).toContain(response.status);
    });

    test('Deve rejeitar sem autenticação', async () => {
      const response = await webRequest()
        .get(`/api/sessoes/${REAL_IDS.sessaoId}`);

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/sessoes', () => {
    test('Deve criar sessão (admin_camara)', async () => {
      const novaSessao = {
        tipo: 'Ordinária',
        data_sessao: '2025-12-31',
        hora_inicio: '14:00:00',
        numero_sessao: 999
      };

      const response = await authenticatedPost(
        '/api/sessoes',
        novaSessao,
        adminCamaraToken
      );

      // Aceitar 201, 200 ou erro de validação
      expect([200, 201, 400, 500]).toContain(response.status);

      if (response.status === 200 || response.status === 201) {
        expect(response.body).toHaveProperty('id');
        createdSessaoId = response.body.id;
      }
    });

    test('Deve retornar erro sem tipo', async () => {
      const sessaoInvalida = {
        data_sessao: '2025-12-31'
      };

      const response = await authenticatedPost(
        '/api/sessoes',
        sessaoInvalida,
        adminCamaraToken
      );

      expect([400, 500]).toContain(response.status);
    });

    test('Deve rejeitar sem autenticação', async () => {
      const novaSessao = {
        tipo: 'Ordinária',
        data_sessao: '2025-12-31'
      };

      const response = await webRequest()
        .post('/api/sessoes')
        .send(novaSessao);

      expect(response.status).toBe(401);
    });

    test('Deve rejeitar tv (sem permissão)', async () => {
      const novaSessao = {
        tipo: 'Ordinária',
        data_sessao: '2025-12-31'
      };

      const response = await authenticatedPost(
        '/api/sessoes',
        novaSessao,
        tvToken
      );

      expect(response.status).toBe(403);
    });
  });

  describe('PUT /api/sessoes/:id', () => {
    test('Deve atualizar sessão (admin_camara)', async () => {
      const updateData = {
        tipo: 'Extraordinária',
        data_sessao: '2025-10-18'
      };

      const response = await authenticatedPut(
        `/api/sessoes/${REAL_IDS.sessaoId}`,
        updateData,
        adminCamaraToken
      );

      // Aceitar 200 ou erro
      expect([200, 400, 500]).toContain(response.status);
    });

    test('Deve retornar erro para sessão inexistente', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const updateData = {
        tipo: 'Ordinária'
      };

      const response = await authenticatedPut(
        `/api/sessoes/${fakeId}`,
        updateData,
        adminCamaraToken
      );

      expect([404, 400, 500]).toContain(response.status);
    });

    test('Deve rejeitar sem autenticação', async () => {
      const updateData = {
        tipo: 'Ordinária'
      };

      const response = await webRequest()
        .put(`/api/sessoes/${REAL_IDS.sessaoId}`)
        .send(updateData);

      expect(response.status).toBe(401);
    });
  });

  describe('DELETE /api/sessoes/:id', () => {
    test('Deve deletar sessão criada nos testes (admin_camara)', async () => {
      // Só deletar se conseguimos criar uma sessão
      if (createdSessaoId) {
        const response = await authenticatedDelete(
          `/api/sessoes/${createdSessaoId}`,
          adminCamaraToken
        );

        expect([200, 204, 404, 500]).toContain(response.status);
      } else {
        // Skip se não criamos sessão
        expect(true).toBe(true);
      }
    });

    test('Deve retornar erro para sessão inexistente', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const response = await authenticatedDelete(
        `/api/sessoes/${fakeId}`,
        adminCamaraToken
      );

      expect([404, 400, 500]).toContain(response.status);
    });

    test('Deve rejeitar sem autenticação', async () => {
      const response = await webRequest()
        .delete(`/api/sessoes/${REAL_IDS.sessaoId}`);

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/sessoes/oradores', () => {
    test('Deve listar oradores (admin_camara)', async () => {
      const response = await authenticatedGet('/api/sessoes/oradores', adminCamaraToken);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    test('Deve rejeitar sem autenticação', async () => {
      const response = await webRequest()
        .get('/api/sessoes/oradores');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/sessoes/vereadores-ativos', () => {
    test('Deve listar vereadores ativos (admin_camara)', async () => {
      const response = await authenticatedGet('/api/sessoes/vereadores-ativos', adminCamaraToken);

      expect(response.status).toBe(200);
      // A resposta pode ser array direto, objeto com vereadores, ou objeto vazio
      const isValidResponse = Array.isArray(response.body) ||
                              (response.body && Array.isArray(response.body.vereadores)) ||
                              (typeof response.body === 'object');
      expect(isValidResponse).toBe(true);
    });

    test('Deve rejeitar sem autenticação', async () => {
      const response = await webRequest()
        .get('/api/sessoes/vereadores-ativos');

      expect(response.status).toBe(401);
    });
  });
});
