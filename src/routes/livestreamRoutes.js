/**
 * Rotas de Livestreams
 * Endpoints para consultar e gerenciar livestreams do YouTube
 */

const express = require('express');
const router = express.Router();
const livestreamController = require('../controllers/livestreamController');

// Middleware de log para rotas de livestream
router.use((req, res, next) => {
    console.log(`[LIVESTREAM_ROUTES] ${new Date().toISOString()} - ${req.method} ${req.originalUrl}`);
    next();
});

// GET /api/livestreams/status - Status geral do sistema
router.get('/status', livestreamController.getSystemStatus);

// GET /api/livestreams/camara/:camaraId/current - Livestream atual
router.get('/camara/:camaraId/current', livestreamController.getCurrentLivestream);

// GET /api/livestreams/camara/:camaraId/last - Última livestream
router.get('/camara/:camaraId/last', livestreamController.getLastLivestream);

// GET /api/livestreams/camara/:camaraId/display - Para exibição no portal (atual OU última)
router.get('/camara/:camaraId/display', livestreamController.getDisplayLivestream);

// GET /api/livestreams/camara/:camaraId - Lista todas as livestreams com paginação
router.get('/camara/:camaraId', livestreamController.getCamaraLivestreams);

// POST /api/livestreams/camara/:camaraId/check - Força verificação manual
router.post('/camara/:camaraId/check', livestreamController.forceCheckCamara);

module.exports = router;