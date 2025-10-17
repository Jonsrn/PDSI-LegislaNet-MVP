/**
 * Controller para Webhooks do YouTube
 * Lida com notificações push do YouTube via PubSubHubbub
 */

const youtubeWebhookService = require('../services/youtubeWebhookService');

const logger = {
    log: (...args) => console.log('[WEBHOOK_CONTROLLER]', new Date().toISOString(), '-', ...args),
    error: (...args) => console.error('[WEBHOOK_CONTROLLER ERROR]', new Date().toISOString(), '-', ...args)
};

/**
 * Endpoint para receber notificações do YouTube
 * GET: Verificação de subscrição
 * POST: Notificação de novo vídeo/live
 */
async function handleYouTubeWebhook(req, res) {
    try {
        if (req.method === 'GET') {
            // Verificação de subscrição
            const {
                'hub.mode': mode,
                'hub.topic': topic,
                'hub.challenge': challenge,
                'hub.lease_seconds': leaseSeconds
            } = req.query;

            logger.log(`📋 Verificação de webhook: ${mode} para ${topic}`);

            if (mode && topic && challenge) {
                const responseChallenge = youtubeWebhookService.handleVerification(mode, topic, challenge);

                res.status(200)
                   .type('text/plain')
                   .send(responseChallenge);

                logger.log(`✅ Challenge respondido: ${challenge}`);
            } else {
                logger.error('Parâmetros de verificação inválidos');
                res.status(400).json({ error: 'Parâmetros de verificação inválidos' });
            }

        } else if (req.method === 'POST') {
            // Notificação de novo vídeo/live
            const signature = req.headers['x-hub-signature'];
            const body = req.body;

            logger.log('📨 Notificação recebida do YouTube');

            // Verifica assinatura HMAC se presente
            if (signature) {
                const isValidSignature = youtubeWebhookService.verifySignature(body, signature);
                if (!isValidSignature) {
                    logger.error('Assinatura HMAC inválida');
                    return res.status(401).json({ error: 'Assinatura inválida' });
                }
            }

            // Processa a notificação
            const success = await youtubeWebhookService.processWebhookNotification(body);

            if (success) {
                logger.log('✅ Notificação processada com sucesso');
                res.status(200).json({ status: 'success', message: 'Notificação processada' });
            } else {
                logger.error('Erro ao processar notificação');
                res.status(500).json({ error: 'Erro ao processar notificação' });
            }

        } else {
            res.status(405).json({ error: 'Método não permitido' });
        }

    } catch (error) {
        logger.error('Erro no webhook:', error.message);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
}

/**
 * Endpoint para subscrever manualmente a um canal
 */
async function subscribeToChannel(req, res) {
    try {
        const { channelId, camaraId } = req.body;

        if (!channelId || !camaraId) {
            return res.status(400).json({ error: 'channelId e camaraId são obrigatórios' });
        }

        logger.log(`📝 Solicitação de subscrição manual: Canal ${channelId}, Câmara ${camaraId}`);

        const success = await youtubeWebhookService.subscribeToChannel(channelId, camaraId);

        if (success) {
            res.status(200).json({
                status: 'success',
                message: `Subscrição solicitada para canal ${channelId}`,
                channelId,
                camaraId
            });
        } else {
            res.status(500).json({ error: 'Erro ao solicitar subscrição' });
        }

    } catch (error) {
        logger.error('Erro ao subscrever canal:', error.message);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
}

/**
 * Endpoint para cancelar subscrição de um canal
 */
async function unsubscribeFromChannel(req, res) {
    try {
        const { channelId } = req.body;

        if (!channelId) {
            return res.status(400).json({ error: 'channelId é obrigatório' });
        }

        logger.log(`🗑️ Solicitação de cancelamento: Canal ${channelId}`);

        const success = await youtubeWebhookService.unsubscribeFromChannel(channelId);

        if (success) {
            res.status(200).json({
                status: 'success',
                message: `Subscrição cancelada para canal ${channelId}`,
                channelId
            });
        } else {
            res.status(500).json({ error: 'Erro ao cancelar subscrição' });
        }

    } catch (error) {
        logger.error('Erro ao cancelar subscrição:', error.message);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
}

/**
 * Endpoint para subscrever a todos os canais configurados
 */
async function subscribeToAllChannels(req, res) {
    try {
        logger.log('🔄 Solicitação para subscrever todos os canais');

        await youtubeWebhookService.subscribeToAllChannels();

        res.status(200).json({
            status: 'success',
            message: 'Subscrições solicitadas para todos os canais configurados'
        });

    } catch (error) {
        logger.error('Erro ao subscrever todos os canais:', error.message);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
}

/**
 * Endpoint para verificar status das subscrições
 */
async function getSubscriptionStatus(req, res) {
    try {
        const status = youtubeWebhookService.getSubscriptionStatus();

        res.status(200).json({
            status: 'success',
            subscriptions: status,
            totalSubscriptions: Object.keys(status).length
        });

    } catch (error) {
        logger.error('Erro ao obter status das subscrições:', error.message);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
}

module.exports = {
    handleYouTubeWebhook,
    subscribeToChannel,
    unsubscribeFromChannel,
    subscribeToAllChannels,
    getSubscriptionStatus
};