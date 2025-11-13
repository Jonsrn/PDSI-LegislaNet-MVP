/**
 * Testes de Autenticação
 * Valida login, logout e verificação de tokens para todas as roles
 */

const { webRequest, tabletRequest } = require('../../helpers/request.helper');
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

describe.skip('🔐 Autenticação - Tablet Backend (REQUER SERVIDOR NA PORTA 3003)', () => {
  describe('POST /api/auth/login', () => {
    test('Deve fazer login como vereador', async () => {
      const response = await tabletRequest()
        .post('/api/auth/login')
        .send(CREDENTIALS.vereador);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe(CREDENTIALS.vereador.email);
    });

    test('Deve rejeitar credenciais inválidas', async () => {
      const response = await tabletRequest()
        .post('/api/auth/login')
        .send({
          email: 'vereador@inexistente.com',
          password: 'senhaerrada'
        });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/auth/profile', () => {
    let token;

    beforeAll(async () => {
      const response = await tabletRequest()
        .post('/api/auth/login')
        .send(CREDENTIALS.vereador);
      token = response.body.token;
    });

    test('Deve retornar perfil do vereador autenticado', async () => {
      const response = await tabletRequest()
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe(CREDENTIALS.vereador.email);
    });

    test('Deve rejeitar sem token', async () => {
      const response = await tabletRequest()
        .get('/api/auth/profile');

      expect(response.status).toBe(401);
    });
  });
});
