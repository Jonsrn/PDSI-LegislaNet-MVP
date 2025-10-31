const express = require('express');
const router = express.Router();
const pautaController = require('../controllers/pautaController');
const { authenticateVereador } = require('../middleware/authMiddleware');

// Todas as rotas exigem autenticação de vereador
router.use(authenticateVereador);

// Listar pautas da câmara (com paginação)
router.get('/', pautaController.getPautasDaCamara);

// Buscar pauta específica por ID
router.get('/:id', pautaController.getPautaById);

// Buscar estatísticas de votação de uma pauta
router.get('/:id/estatisticas', pautaController.getEstatisticasVotacao);

module.exports = router;