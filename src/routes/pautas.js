const express = require('express');
const router = express.Router();
const pautaController = require('../controllers/pautaController');
const { uploadSingle } = require('../middleware/uploadMiddleware');

// GET /api/pautas - Buscar pautas da câmara do usuário logado
router.get('/', pautaController.getAllPautas);

// POST /api/pautas - Criar nova pauta (com upload de arquivo)
router.post('/', uploadSingle('arquivo'), pautaController.createPauta);

// GET /api/pautas/:id - Buscar uma pauta específica
router.get('/:id', pautaController.getPautaById);

// PUT /api/pautas/:id/status - Atualizar status de uma pauta
router.put('/:id/status', pautaController.updatePautaStatus);

// PUT /api/pautas/:id/resultado - Atualizar resultado da votação de uma pauta
router.put('/:id/resultado', pautaController.updateResultadoVotacao);

// PUT /api/pautas/:id - Editar uma pauta completa (com upload de arquivo)
router.put('/:id', uploadSingle('arquivo'), pautaController.updatePauta);

// DELETE /api/pautas/:id - Remover uma pauta
router.delete('/:id', pautaController.deletePauta);

module.exports = router;