const express = require('express');
const router = express.Router();
const votoController = require('../controllers/votoController');
const { authenticateVereador } = require('../middleware/authMiddleware');

// Todas as rotas exigem autenticação de vereador
router.use(authenticateVereador);

// Registrar ou atualizar voto
router.post('/', votoController.registrarVoto);

// Buscar todos os votos do vereador logado
router.get('/meus-votos', votoController.getVotosDoVereador);

// Buscar voto específico do vereador em uma pauta
router.get('/pauta/:pauta_id', votoController.getVotoEmPauta);

// Buscar estatísticas de votos de uma pauta
router.get('/pauta/:pauta_id/estatisticas', votoController.getEstatisticasPauta);

module.exports = router;