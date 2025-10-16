const express = require('express');
const router = express.Router();
const votoController = require('../controllers/votoController');

// POST /api/votos - Registrar/atualizar voto
router.post('/', votoController.createVoto);

// GET /api/votos/pauta/:pauta_id - Obter votos de uma pauta
router.get('/pauta/:pauta_id', votoController.getVotosPorPauta);

module.exports = router;