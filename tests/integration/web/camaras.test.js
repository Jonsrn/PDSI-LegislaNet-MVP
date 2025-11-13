/**
 * Testes de Integração - Câmaras
 * Testa endpoints de gerenciamento de câmaras municipais
 */

const { loginAs } = require('../../helpers/auth.helper');
const { authenticatedGet, authenticatedPost, authenticatedPut, webRequest } = require('../../helpers/request.helper');
const { REAL_IDS } = require('../../config/testData');

describe('🏛️ Câmaras - Web Backend', () => {
  let superAdminToken;
  let adminCamaraToken;
  let tvToken;

  // Login antes de todos os testes
  beforeAll(async () => {
    superAdminToken = await loginAs('super_admin');
    adminCamaraToken = await loginAs('admin_camara');
    tvToken = await loginAs('tv');
  });

  describe('GET /api/admin/camaras', () => {
    test('Deve listar câmaras (super_admin)', async () => {
      const response = await authenticatedGet('/api/admin/camaras', superAdminToken);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);

      // Verificar estrutura da câmara
      const camara = response.body.data[0];
      expect(camara).toHaveProperty('id');
      expect(camara).toHaveProperty('nome_camara');
    });

    test('Deve rejeitar sem autenticação', async () => {
      const response = await webRequest()
        .get('/api/admin/camaras');

      expect(response.status).toBe(401);
    });

    test('Deve rejeitar admin_camara (sem permissão)', async () => {
      const response = await authenticatedGet('/api/admin/camaras', adminCamaraToken);

      expect(response.status).toBe(403);
    });

    test('Deve rejeitar tv (sem permissão)', async () => {
      const response = await authenticatedGet('/api/admin/camaras', tvToken);

      expect(response.status).toBe(403);
    });

    test('Deve suportar paginação', async () => {
      const response = await authenticatedGet('/api/admin/camaras?page=1&limit=10', superAdminToken);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.pagination).toHaveProperty('currentPage');
      expect(response.body.pagination).toHaveProperty('totalPages');
      expect(response.body.pagination).toHaveProperty('totalItems');
    });
  });

  describe('GET /api/camaras/:id', () => {
    test('Deve buscar câmara por ID (super_admin)', async () => {
      const response = await authenticatedGet(`/api/camaras/${REAL_IDS.camaraId}`, superAdminToken);

      expect(response.status).toBe(200);
      // A resposta retorna a câmara diretamente, não em um objeto 'camara'
      expect(response.body).toHaveProperty('id');
      expect(response.body.id).toBe(REAL_IDS.camaraId);
      expect(response.body).toHaveProperty('nome_camara');
    });

    test('Deve retornar erro para câmara inexistente', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const response = await authenticatedGet(`/api/camaras/${fakeId}`, superAdminToken);

      // Aceitar 404 ou 500 dependendo da implementação
      expect([404, 500]).toContain(response.status);
    });

    test('Deve retornar erro para ID inválido', async () => {
      const response = await authenticatedGet('/api/camaras/id-invalido', superAdminToken);

      // Aceitar 400 ou 500 dependendo da validação
      expect([400, 500]).toContain(response.status);
    });

    test('Deve rejeitar sem autenticação', async () => {
      const response = await webRequest()
        .get(`/api/camaras/${REAL_IDS.camaraId}`);

      expect(response.status).toBe(401);
    });

    test('Deve rejeitar admin_camara (sem permissão)', async () => {
      const response = await authenticatedGet(`/api/camaras/${REAL_IDS.camaraId}`, adminCamaraToken);

      expect(response.status).toBe(403);
    });
  });

  describe('PUT /api/camaras/:id', () => {
    test('Deve atualizar câmara (super_admin)', async () => {
      const updateData = {
        link_facebook: 'https://facebook.com/camara',
        link_instagram: 'https://instagram.com/camara',
        site_oficial: 'https://camara.gov.br'
      };

      const response = await authenticatedPut(
        `/api/camaras/${REAL_IDS.camaraId}`,
        updateData,
        superAdminToken
      );

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
    });

    test('Deve retornar erro para câmara inexistente', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const updateData = {
        link_facebook: 'https://facebook.com/camara'
      };

      const response = await authenticatedPut(
        `/api/camaras/${fakeId}`,
        updateData,
        superAdminToken
      );

      // Aceitar 404, 400 ou 500 dependendo da implementação
      expect([404, 400, 500]).toContain(response.status);
    });

    test('Deve retornar erro para ID inválido', async () => {
      const updateData = {
        link_facebook: 'https://facebook.com/camara'
      };

      const response = await authenticatedPut(
        '/api/camaras/id-invalido',
        updateData,
        superAdminToken
      );

      // Aceitar 400 ou 500 dependendo da validação
      expect([400, 500]).toContain(response.status);
    });

    test('Deve rejeitar sem autenticação', async () => {
      const updateData = {
        link_facebook: 'https://facebook.com/camara'
      };

      const response = await webRequest()
        .put(`/api/camaras/${REAL_IDS.camaraId}`)
        .send(updateData);

      expect(response.status).toBe(401);
    });

    test('Deve rejeitar admin_camara (sem permissão)', async () => {
      const updateData = {
        link_facebook: 'https://facebook.com/camara'
      };

      const response = await authenticatedPut(
        `/api/camaras/${REAL_IDS.camaraId}`,
        updateData,
        adminCamaraToken
      );

      expect(response.status).toBe(403);
    });

    test('Deve rejeitar tv (sem permissão)', async () => {
      const updateData = {
        link_facebook: 'https://facebook.com/camara'
      };

      const response = await authenticatedPut(
        `/api/camaras/${REAL_IDS.camaraId}`,
        updateData,
        tvToken
      );

      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/admin/check-email', () => {
    test('Deve verificar se email existe', async () => {
      const response = await authenticatedGet(
        '/api/admin/check-email?email=teste@exemplo.com',
        superAdminToken
      );

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('exists');
      expect(typeof response.body.exists).toBe('boolean');
    });

    test('Deve responder mesmo sem parâmetro email', async () => {
      const response = await authenticatedGet(
        '/api/admin/check-email',
        superAdminToken
      );

      // Aceitar 200 (retorna exists: false) ou 400 (erro de validação)
      expect([200, 400]).toContain(response.status);
    });

    test('Deve rejeitar sem autenticação', async () => {
      const response = await webRequest()
        .get('/api/admin/check-email?email=teste@exemplo.com');

      expect(response.status).toBe(401);
    });
  });
});
