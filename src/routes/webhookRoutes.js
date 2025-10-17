/**
 * Rotas para Webhooks do YouTube
 * Endpoints para receber notificações push do YouTube
 */

const express = require('express');
const {
    handleYouTubeWebhook,
    subscribeToChannel,
    unsubscribeFromChannel,
    subscribeToAllChannels,
    getSubscriptionStatus
} = require('../controllers/webhookController');

const router = express.Router();

// Middleware para capturar o corpo da requisição como texto (para webhooks)
router.use('/youtube', express.text({ type: 'application/atom+xml' }));
router.use('/youtube', express.text({ type: 'text/xml' }));

/**
 * Endpoint principal para webhooks do YouTube
 * GET: Verificação de subscrição (hub challenge)
 * POST: Notificações de novos vídeos/lives
 */
router.all('/youtube', handleYouTubeWebhook);

/**
 * Endpoints administrativos para gerenciar subscrições
 */

// Subscrever a um canal específico
router.post('/youtube/subscribe', subscribeToChannel);

// Cancelar subscrição de um canal
router.post('/youtube/unsubscribe', unsubscribeFromChannel);

// Subscrever a todos os canais configurados no sistema
router.post('/youtube/subscribe-all', subscribeToAllChannels);

// Verificar status das subscrições
router.get('/youtube/status', getSubscriptionStatus);

module.exports = router;