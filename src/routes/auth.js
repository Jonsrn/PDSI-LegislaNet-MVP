const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const authController = require('../controllers/authController');
const { hasPermission } = require('../middleware/authMiddleware'); // Importa o middleware de permissão

router.post(
    '/login',
    body('email', 'O email é inválido').isEmail(),
    body('password', 'A senha não pode estar em branco').notEmpty(),
    authController.handleLogin
);

// --- ROTA DE LOGOUT PARA APLICAÇÃO WEB ---
// Protegida para usuários da aplicação web (admins).
// Vereadores usam o backend tablet dedicado (porta 3001).
router.post('/logout', hasPermission(['super_admin', 'admin_camara']), authController.handleLogout);

// --- ROTA PARA BUSCAR PERFIL DO VEREADOR LOGADO ---
router.get('/profile', hasPermission(['vereador']), authController.getVereadorProfile);

module.exports = router;