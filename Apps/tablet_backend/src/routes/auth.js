const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const authController = require('../controllers/authController');
const { authenticateVereador } = require('../middleware/authMiddleware');

// Rota de login para vereadores
router.post(
    '/login',
    body('email', 'O email é inválido').isEmail(),
    body('password', 'A senha não pode estar em branco').notEmpty(),
    authController.handleVereadorLogin
);

// Rota de logout para vereadores
router.post('/logout', authenticateVereador, authController.handleVereadorLogout);

module.exports = router;