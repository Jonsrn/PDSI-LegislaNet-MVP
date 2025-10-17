/**
 * YouTube Data API Service
 * Serviço para integração com a API do YouTube para detecção de livestreams
 */

const logger = {
    log: (...args) => console.log('[YOUTUBE_SERVICE]', new Date().toISOString(), '-', ...args),
    error: (...args) => console.error('[YOUTUBE_SERVICE ERROR]', new Date().toISOString(), '-', ...args)
};

class YouTubeService {
    constructor() {
        this.apiKey = process.env.YOUTUBE_API_KEY;
        this.baseUrl = 'https://www.googleapis.com/youtube/v3';

        if (!this.apiKey) {
            logger.error('YouTube API Key não configurada! Adicione YOUTUBE_API_KEY no .env');
        }
    }

    /**
     * Busca livestreams ativas de um canal
     * @param {string} channelId - ID do canal do YouTube
     * @returns {Promise<Array>} Array de livestreams ativas
     */
    async getLiveStreams(channelId) {
        if (!this.apiKey) {
            throw new Error('YouTube API Key não configurada');
        }

        if (!channelId) {
            throw new Error('Channel ID é obrigatório');
        }

        try {
            logger.log(`Buscando livestreams para canal: ${channelId}`);

            const searchUrl = `${this.baseUrl}/search?` + new URLSearchParams({
                part: 'snippet',
                channelId: channelId,
                eventType: 'live',
                type: 'video',
                key: this.apiKey,
                maxResults: 10
            });

            const response = await fetch(searchUrl);

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`YouTube API Error: ${errorData.error?.message || response.statusText}`);
            }

            const data = await response.json();
            logger.log(`Encontradas ${data.items?.length || 0} livestreams ativas`);

            return data.items || [];
        } catch (error) {
            logger.error('Erro ao buscar livestreams:', error.message);
            throw error;
        }
    }

    /**
     * Busca detalhes de um vídeo específico
     * @param {string} videoId - ID do vídeo
     * @returns {Promise<Object>} Detalhes do vídeo
     */
    async getVideoDetails(videoId) {
        if (!this.apiKey || !videoId) {
            throw new Error('API Key e Video ID são obrigatórios');
        }

        try {
            const videoUrl = `${this.baseUrl}/videos?` + new URLSearchParams({
                part: 'snippet,liveStreamingDetails,statistics',
                id: videoId,
                key: this.apiKey
            });

            const response = await fetch(videoUrl);

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`YouTube API Error: ${errorData.error?.message || response.statusText}`);
            }

            const data = await response.json();

            if (!data.items || data.items.length === 0) {
                throw new Error(`Vídeo ${videoId} não encontrado`);
            }

            return data.items[0];
        } catch (error) {
            logger.error(`Erro ao buscar detalhes do vídeo ${videoId}:`, error.message);
            throw error;
        }
    }

    /**
     * Busca livestreams agendadas de um canal
     * @param {string} channelId - ID do canal do YouTube
     * @returns {Promise<Array>} Array de livestreams agendadas
     */
    async getUpcomingStreams(channelId) {
        if (!this.apiKey || !channelId) {
            throw new Error('API Key e Channel ID são obrigatórios');
        }

        try {
            logger.log(`Buscando livestreams agendadas para canal: ${channelId}`);

            const searchUrl = `${this.baseUrl}/search?` + new URLSearchParams({
                part: 'snippet',
                channelId: channelId,
                eventType: 'upcoming',
                type: 'video',
                key: this.apiKey,
                maxResults: 10,
                order: 'date'
            });

            const response = await fetch(searchUrl);

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`YouTube API Error: ${errorData.error?.message || response.statusText}`);
            }

            const data = await response.json();
            logger.log(`Encontradas ${data.items?.length || 0} livestreams agendadas`);

            return data.items || [];
        } catch (error) {
            logger.error('Erro ao buscar livestreams agendadas:', error.message);
            throw error;
        }
    }

    /**
     * Converte dados do YouTube para formato do banco
     * @param {Object} youtubeData - Dados do YouTube API
     * @param {string} camaraId - ID da câmara
     * @returns {Object} Dados formatados para o banco
     */
    formatLivestreamData(youtubeData, camaraId) {
        const snippet = youtubeData.snippet;
        const liveDetails = youtubeData.liveStreamingDetails || {};

        return {
            camara_id: camaraId,
            youtube_video_id: youtubeData.id,
            youtube_video_url: `https://www.youtube.com/watch?v=${youtubeData.id}`,
            title: snippet.title,
            description: snippet.description,
            thumbnail_url: snippet.thumbnails?.high?.url || snippet.thumbnails?.default?.url,
            scheduled_start_time: liveDetails.scheduledStartTime || null,
            actual_start_time: liveDetails.actualStartTime || null,
            actual_end_time: liveDetails.actualEndTime || null,
            viewer_count: parseInt(liveDetails.concurrentViewers) || 0,
            status: this.determineStatus(liveDetails)
        };
    }

    /**
     * Determina o status da livestream baseado nos dados do YouTube
     * @param {Object} liveDetails - Detalhes da live do YouTube
     * @returns {string} Status da live
     */
    determineStatus(liveDetails) {
        if (liveDetails.actualEndTime) {
            return 'ended';
        } else if (liveDetails.actualStartTime) {
            return 'live';
        } else if (liveDetails.scheduledStartTime) {
            return 'upcoming';
        }
        return 'scheduled';
    }

    /**
     * Extrai o ID do canal de uma URL do YouTube
     * @param {string} channelUrl - URL do canal
     * @returns {string|null} ID do canal ou null se inválido
     */
    extractChannelId(channelUrl) {
        if (!channelUrl) return null;

        // Padrões possíveis:
        // https://www.youtube.com/channel/UC_x5XG1OV2P6uZZ5FSM9Ttw
        // https://www.youtube.com/c/NomeDoCanal
        // https://www.youtube.com/@NomeDoCanal

        const patterns = [
            /youtube\.com\/channel\/([a-zA-Z0-9_-]+)/,
            /youtube\.com\/c\/([a-zA-Z0-9_-]+)/,
            /youtube\.com\/@([a-zA-Z0-9_-]+)/
        ];

        for (const pattern of patterns) {
            const match = channelUrl.match(pattern);
            if (match) {
                return match[1];
            }
        }

        return null;
    }

    /**
     * Busca vídeos recentes de um canal (últimos 50)
     * @param {string} channelId ID do canal
     * @returns {Promise<Array>} Array de vídeos
     */
    async getRecentVideos(channelId) {
        if (!this.apiKey) {
            throw new Error('YouTube API key não configurada');
        }

        try {
            logger.log(`Buscando vídeos recentes do canal: ${channelId}`);

            const searchUrl = `${this.baseUrl}/search?` + new URLSearchParams({
                part: 'snippet',
                channelId: channelId,
                type: 'video',
                order: 'date',
                maxResults: 50,
                key: this.apiKey
            });

            const response = await fetch(searchUrl);
            if (!response.ok) {
                throw new Error(`YouTube API error: ${response.status}`);
            }

            const data = await response.json();
            logger.log(`Encontrados ${data.items.length} vídeos recentes`);

            return data.items;
        } catch (error) {
            logger.error('Erro ao buscar vídeos recentes:', error.message);
            throw error;
        }
    }

    /**
     * Testa a conectividade com a API do YouTube
     * @returns {Promise<boolean>} True se a API estiver funcionando
     */
    async testConnection() {
        if (!this.apiKey) {
            return false;
        }

        try {
            const testUrl = `${this.baseUrl}/search?` + new URLSearchParams({
                part: 'snippet',
                q: 'test',
                type: 'video',
                maxResults: 1,
                key: this.apiKey
            });

            const response = await fetch(testUrl);
            return response.ok;
        } catch (error) {
            logger.error('Erro ao testar conexão com YouTube API:', error.message);
            return false;
        }
    }
}

module.exports = new YouTubeService();