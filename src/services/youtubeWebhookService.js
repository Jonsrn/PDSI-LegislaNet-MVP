/**
 * YouTube Push Notification (Webhook) Service
 * Implementa webhooks do YouTube para notificações instantâneas sem consumir quota da API
 */

const crypto = require('crypto');
const supabaseAdmin = require('../config/supabaseAdminClient');

const logger = {
    log: (...args) => console.log('[YOUTUBE_WEBHOOK]', new Date().toISOString(), '-', ...args),
    error: (...args) => console.error('[YOUTUBE_WEBHOOK ERROR]', new Date().toISOString(), '-', ...args)
};

class YouTubeWebhookService {
    constructor() {
        this.subscriptions = new Map(); // Tracking das subscrições ativas
        this.hubUrl = 'https://pubsubhubbub.appspot.com/subscribe';
        this.hubSecret = process.env.YOUTUBE_WEBHOOK_SECRET || 'legisla-net-webhook-secret';
        this.callbackUrl = process.env.YOUTUBE_WEBHOOK_CALLBACK_URL || 'https://seu-dominio.com/api/webhooks/youtube';
        this.leaseSeconds = 864000; // 10 dias
    }

    /**
     * Subscreve para notificações de um canal do YouTube
     * @param {string} channelId - ID do canal do YouTube
     * @param {string} camaraId - ID da câmara no sistema
     */
    async subscribeToChannel(channelId, camaraId) {
        logger.log(`Subscrevendo ao canal ${channelId} para câmara ${camaraId}`);

        const topicUrl = `https://www.youtube.com/xml/feeds/videos.xml?channel_id=${channelId}`;

        const formData = new URLSearchParams({
            'hub.mode': 'subscribe',
            'hub.topic': topicUrl,
            'hub.callback': this.callbackUrl,
            'hub.verify': 'async',
            'hub.secret': this.hubSecret,
            'hub.lease_seconds': this.leaseSeconds.toString()
        });

        try {
            const response = await fetch(this.hubUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: formData
            });

            if (response.ok) {
                this.subscriptions.set(channelId, {
                    camaraId,
                    subscribedAt: new Date(),
                    topicUrl,
                    status: 'pending'
                });
                logger.log(`✅ Subscrição solicitada para canal ${channelId}`);
                return true;
            } else {
                const errorText = await response.text();
                logger.error(`Erro ao subscrever canal ${channelId}:`, errorText);
                return false;
            }
        } catch (error) {
            logger.error(`Erro ao subscrever canal ${channelId}:`, error.message);
            return false;
        }
    }

    /**
     * Cancela subscrição de um canal
     * @param {string} channelId - ID do canal do YouTube
     */
    async unsubscribeFromChannel(channelId) {
        logger.log(`Cancelando subscrição do canal ${channelId}`);

        const topicUrl = `https://www.youtube.com/xml/feeds/videos.xml?channel_id=${channelId}`;

        const formData = new URLSearchParams({
            'hub.mode': 'unsubscribe',
            'hub.topic': topicUrl,
            'hub.callback': this.callbackUrl,
            'hub.verify': 'async'
        });

        try {
            const response = await fetch(this.hubUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: formData
            });

            if (response.ok) {
                this.subscriptions.delete(channelId);
                logger.log(`✅ Subscrição cancelada para canal ${channelId}`);
                return true;
            } else {
                const errorText = await response.text();
                logger.error(`Erro ao cancelar subscrição do canal ${channelId}:`, errorText);
                return false;
            }
        } catch (error) {
            logger.error(`Erro ao cancelar subscrição do canal ${channelId}:`, error.message);
            return false;
        }
    }

    /**
     * Verifica a assinatura HMAC do webhook
     * @param {string} body - Corpo da requisição
     * @param {string} signature - Assinatura recebida no header
     */
    verifySignature(body, signature) {
        if (!signature) {
            return false;
        }

        const expectedSignature = crypto
            .createHmac('sha1', this.hubSecret)
            .update(body)
            .digest('hex');

        const receivedSignature = signature.replace('sha1=', '');

        return crypto.timingSafeEqual(
            Buffer.from(expectedSignature, 'hex'),
            Buffer.from(receivedSignature, 'hex')
        );
    }

    /**
     * Processa notificação XML do YouTube
     * @param {string} xmlData - Dados XML recebidos do YouTube
     */
    async processWebhookNotification(xmlData) {
        try {
            // Parse simples do XML para extrair informações do vídeo
            const videoIdMatch = xmlData.match(/<yt:videoId>([^<]+)<\/yt:videoId>/);
            const channelIdMatch = xmlData.match(/<yt:channelId>([^<]+)<\/yt:channelId>/);
            const titleMatch = xmlData.match(/<media:title>([^<]+)<\/media:title>/);
            const publishedMatch = xmlData.match(/<published>([^<]+)<\/published>/);

            if (!videoIdMatch || !channelIdMatch) {
                logger.error('Dados inválidos no webhook XML');
                return false;
            }

            const videoId = videoIdMatch[1];
            const channelId = channelIdMatch[1];
            const title = titleMatch ? titleMatch[1] : '';
            const published = publishedMatch ? new Date(publishedMatch[1]) : new Date();

            logger.log(`📺 Notificação recebida: Canal ${channelId}, Vídeo ${videoId} - "${title}"`);

            // Busca informações da câmara associada ao canal
            const subscription = this.subscriptions.get(channelId);
            if (!subscription) {
                logger.log(`Notificação recebida para canal não monitorado: ${channelId}`);
                return false;
            }

            const camaraId = subscription.camaraId;

            // Verifica se é uma live recente (últimos 10 minutos)
            const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
            const isRecentVideo = published > tenMinutesAgo;

            if (isRecentVideo) {
                logger.log(`🔴 Possível livestream detectada: ${title}`);

                // Busca detalhes do vídeo via API (usando 1 quota apenas quando necessário)
                await this.handleLivestreamDetected(camaraId, channelId, videoId, title);
            } else {
                logger.log(`📄 Vídeo antigo ignorado: ${title} (${published})`);
            }

            return true;
        } catch (error) {
            logger.error('Erro ao processar notificação webhook:', error.message);
            return false;
        }
    }

    /**
     * Lida com detecção de livestream
     * @param {string} camaraId - ID da câmara
     * @param {string} channelId - ID do canal
     * @param {string} videoId - ID do vídeo
     * @param {string} title - Título do vídeo
     */
    async handleLivestreamDetected(camaraId, channelId, videoId, title) {
        try {
            // Importa serviços necessários
            const youtubeService = require('./youtubeService');
            const livestreamService = require('./livestreamService');

            // Busca detalhes completos do vídeo (1 quota)
            const videoDetails = await youtubeService.getVideoDetails(videoId);
            const liveDetails = videoDetails.liveStreamingDetails;

            // Verifica se é realmente uma live
            if (liveDetails && (liveDetails.actualStartTime || liveDetails.scheduledStartTime)) {
                const isLive = !!liveDetails.actualStartTime && !liveDetails.actualEndTime;

                logger.log(`🎯 Livestream confirmada: ${title} (Live: ${isLive})`);

                // Salva no banco de dados
                const streamData = youtubeService.formatLivestreamData(videoDetails, camaraId);
                streamData.status = isLive ? 'live' : 'upcoming';
                streamData.is_current = isLive;

                const { data, error } = await supabaseAdmin
                    .from('livestreams')
                    .upsert([streamData], {
                        onConflict: 'youtube_video_id,camara_id',
                        ignoreDuplicates: false
                    })
                    .select()
                    .single();

                if (error) {
                    logger.error('Erro ao salvar livestream:', error.message);
                    return;
                }

                // Emite notificação WebSocket
                if (typeof global !== 'undefined' && global.io) {
                    const eventData = {
                        camaraId,
                        livestreamData: data,
                        isLive,
                        timestamp: new Date().toISOString(),
                        source: 'webhook'
                    };

                    global.io.to(`camara-${camaraId}`).emit('livestream-updated', eventData);
                    logger.log(`📡 WebSocket: Notificação enviada para câmara ${camaraId} via webhook`);
                }

                // Atualiza status da livestream ativa na câmara
                if (isLive) {
                    await livestreamService.updateCamaraCurrentLivestream(camaraId, data.id);
                }

                logger.log(`✅ Livestream processada com sucesso: ${title}`);
            } else {
                logger.log(`📄 Vídeo não é livestream: ${title}`);
            }

        } catch (error) {
            logger.error('Erro ao processar livestream detectada:', error.message);
        }
    }

    /**
     * Confirma verificação do webhook
     * @param {string} mode - Modo da verificação
     * @param {string} topic - Tópico da subscrição
     * @param {string} challenge - Challenge do hub
     */
    handleVerification(mode, topic, challenge) {
        logger.log(`🔍 Verificação de webhook: ${mode} para ${topic}`);

        // Extrai channel ID do topic
        const channelIdMatch = topic.match(/channel_id=([^&]+)/);
        if (channelIdMatch) {
            const channelId = channelIdMatch[1];
            const subscription = this.subscriptions.get(channelId);

            if (subscription) {
                subscription.status = mode === 'subscribe' ? 'verified' : 'unsubscribed';
                logger.log(`✅ Subscrição ${mode} verificada para canal ${channelId}`);
            }
        }

        return challenge;
    }

    /**
     * Subscreve a todos os canais configurados no sistema
     */
    async subscribeToAllChannels() {
        try {
            logger.log('🔄 Subscrevendo a todos os canais configurados...');

            const { data: camaras, error } = await supabaseAdmin
                .from('camaras')
                .select('id, nome_camara, youtube_channel_id')
                .not('youtube_channel_id', 'is', null)
                .neq('youtube_channel_id', '');

            if (error) {
                throw new Error(`Erro ao buscar câmaras: ${error.message}`);
            }

            if (!camaras || camaras.length === 0) {
                logger.log('Nenhuma câmara com Channel ID configurado encontrada');
                return;
            }

            let subscribed = 0;
            for (const camara of camaras) {
                const success = await this.subscribeToChannel(camara.youtube_channel_id, camara.id);
                if (success) subscribed++;

                // Aguarda 1 segundo entre subscrições para evitar rate limits
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            logger.log(`✅ Subscrições solicitadas: ${subscribed}/${camaras.length} canais`);
        } catch (error) {
            logger.error('Erro ao subscrever canais:', error.message);
        }
    }

    /**
     * Obtém status das subscrições
     */
    getSubscriptionStatus() {
        const status = {};
        for (const [channelId, subscription] of this.subscriptions) {
            status[channelId] = {
                camaraId: subscription.camaraId,
                status: subscription.status,
                subscribedAt: subscription.subscribedAt
            };
        }
        return status;
    }
}

module.exports = new YouTubeWebhookService();