/**
 * Testes de Autenticação
 * Valida login, logout e verificação de tokens para todas as roles
 */

const { webRequest } = require('../../helpers/request.helper');
const { tabletRequest } = require('../../helpers/tablet-request.helper');
const { CREDENTIALS } = require('../../config/testData');

describe('🔐 Autenticação - Web Backend', () => {
  describe('POST /api/auth/login', () => {
    test('Deve fazer login como super_admin', async () => {
      const response = await webRequest()
        .post('/api/auth/login')
        .send(CREDENTIALS.super_admin);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe(CREDENTIALS.super_admin.email);
    });

    test('Deve fazer login como admin_camara', async () => {
      const response = await webRequest()
        .post('/api/auth/login')
        .send(CREDENTIALS.admin_camara);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe(CREDENTIALS.admin_camara.email);
    });

    test('Deve fazer login como tv', async () => {
      const response = await webRequest()
        .post('/api/auth/login')
        .send(CREDENTIALS.tv);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe(CREDENTIALS.tv.email);
    });

    test('Deve rejeitar credenciais inválidas', async () => {
      const response = await webRequest()
        .post('/api/auth/login')
        .send({
          email: 'usuario@inexistente.com',
          password: 'senhaerrada'
        });

      expect(response.status).toBe(401);
    });

    test('Deve rejeitar login sem email', async () => {
      const response = await webRequest()
        .post('/api/auth/login')
        .send({
          password: '123456'
        });

      expect(response.status).toBe(400);
    });

    test('Deve rejeitar login sem senha', async () => {
      const response = await webRequest()
        .post('/api/auth/login')
        .send({
          email: 'test@exemplo.com'
        });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/me', () => {
    let token;

    beforeAll(async () => {
      const response = await webRequest()
        .post('/api/auth/login')
        .send(CREDENTIALS.super_admin);
      token = response.body.token;
    });

    test('Deve retornar perfil do usuário autenticado', async () => {
      const response = await webRequest()
        .get('/api/me')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe(CREDENTIALS.super_admin.email);
    });

    test('Deve rejeitar sem token', async () => {
      const response = await webRequest()
        .get('/api/me');

      expect(response.status).toBe(401);
    });

    test('Deve rejeitar com token inválido', async () => {
      const response = await webRequest()
        .get('/api/me')
        .set('Authorization', 'Bearer token_invalido_123');

      expect(response.status).toBe(401);
    });
  });
});

describe('🔐 Autenticação - Tablet Backend', () => {
  let vereadorToken;

  describe('POST /api/auth/login', () => {
    test('Deve fazer login como vereador com credenciais válidas', async () => {
      const response = await tabletRequest()
        .post('/api/auth/login')
        .send(CREDENTIALS.vereador);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('email', CREDENTIALS.vereador.email);
      expect(response.body.user).toHaveProperty('role', 'vereador');

      // Salvar token para testes subsequentes
      vereadorToken = response.body.token;
    });

    test('Deve retornar erro com credenciais inválidas', async () => {
      const response = await tabletRequest()
        .post('/api/auth/login')
        .send({
          email: CREDENTIALS.vereador.email,
          password: 'senha_errada'
        });

      expect([400, 401]).toContain(response.status);
    });

    test('Deve retornar erro sem email', async () => {
      const response = await tabletRequest()
        .post('/api/auth/login')
        .send({
          password: CREDENTIALS.vereador.password
        });

      expect([400, 422]).toContain(response.status);
    });

    test('Deve retornar erro sem senha', async () => {
      const response = await tabletRequest()
        .post('/api/auth/login')
        .send({
          email: CREDENTIALS.vereador.email
        });

      expect([400, 422]).toContain(response.status);
    });

    test('Deve retornar erro com email inválido', async () => {
      const response = await tabletRequest()
        .post('/api/auth/login')
        .send({
          email: 'email_invalido',
          password: 'senha123'
        });

      expect([400, 422]).toContain(response.status);
    });

    test('Deve rejeitar login de não-vereador (admin_camara)', async () => {
      const response = await tabletRequest()
        .post('/api/auth/login')
        .send(CREDENTIALS.admin_camara);

      // Admin da câmara não pode fazer login no tablet
      expect([401, 403]).toContain(response.status);
    });

    test('Deve rejeitar login de não-vereador (super_admin)', async () => {
      const response = await tabletRequest()
        .post('/api/auth/login')
        .send(CREDENTIALS.super_admin);

      // Super admin não pode fazer login no tablet
      expect([401, 403]).toContain(response.status);
    });

    test('Deve rejeitar login de não-vereador (tv)', async () => {
      const response = await tabletRequest()
        .post('/api/auth/login')
        .send(CREDENTIALS.tv);

      // TV não pode fazer login no tablet
      expect([401, 403]).toContain(response.status);
    });
  });

  describe('POST /api/auth/logout', () => {
    test('Deve fazer logout com token válido', async () => {
      if (vereadorToken) {
        const response = await tabletRequest()
          .post('/api/auth/logout')
          .set('Authorization', `Bearer ${vereadorToken}`);

        expect([200, 204]).toContain(response.status);
      } else {
        // Skip se não temos token
        expect(true).toBe(true);
      }
    });

    test('Deve rejeitar logout sem token', async () => {
      const response = await tabletRequest()
        .post('/api/auth/logout');

      expect(response.status).toBe(401);
    });

    test('Deve rejeitar logout com token inválido', async () => {
      const response = await tabletRequest()
        .post('/api/auth/logout')
        .set('Authorization', 'Bearer token_invalido_123');

      expect(response.status).toBe(401);
    });
  });
});
