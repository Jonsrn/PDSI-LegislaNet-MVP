const express = require('express');
const router = express.Router();
const vereadorController = require('../controllers/vereadorController');
const { authenticateVereador } = require('../middleware/authMiddleware');

// Todas as rotas exigem autenticação de vereador
router.use(authenticateVereador);

// Buscar perfil completo do vereador logado
router.get('/profile', vereadorController.getVereadorProfile);

// Listar todos os vereadores da mesma câmara
router.get('/camara', vereadorController.getVereadoresDaCamara);

// Atualizar foto do perfil
router.put('/foto', vereadorController.updateVereadorFoto);

module.exports = router;