/**
 * Livestream Management Service
 * Gerencia livestreams, verificação automática e sincronização com YouTube
 */

const supabaseAdmin = require('../config/supabaseAdminClient');
const youtubeService = require('./youtubeService');

const logger = {
    log: (...args) => console.log('[LIVESTREAM_SERVICE]', new Date().toISOString(), '-', ...args),
    error: (...args) => console.error('[LIVESTREAM_SERVICE ERROR]', new Date().toISOString(), '-', ...args)
};

class LivestreamService {
    constructor() {
        this.isChecking = false;
        this.checkInterval = null;
        this.activeLivestreams = new Set(); // Track das lives ativas
        this.connectedUsers = 0; // Count de usuários conectados
        this.quotaExceeded = false; // Flag para controlar quota da API
        this.lastQuotaError = null; // Timestamp do último erro de quota

        // Intervalos inteligentes baseados no contexto
        this.INTERVALS = {
            LIVE_ACTIVE: 30000,     // 30s quando há live ativa
            NO_LIVE_DAY: 300000,    // 5 minutos durante o dia sem live
            NO_LIVE_NIGHT: 900000,  // 15 minutos durante a madrugada
            NO_USERS: 600000,       // 10 minutos quando não há usuários
            QUOTA_EXCEEDED: 3600000 // 1 hora quando quota excedida
        };

        this.currentInterval = this.INTERVALS.NO_LIVE_DAY;
    }

    /**
     * Calcula o intervalo ideal baseado no contexto atual
     */
    calculateOptimalInterval() {
        // Se quota foi excedida recentemente, aguardar mais tempo
        if (this.quotaExceeded && this.lastQuotaError) {
            const timeSinceQuotaError = Date.now() - this.lastQuotaError;
            if (timeSinceQuotaError < this.INTERVALS.QUOTA_EXCEEDED) {
                logger.log(`⏳ Quota excedida - aguardando ${Math.round((this.INTERVALS.QUOTA_EXCEEDED - timeSinceQuotaError) / 60000)} minutos`);
                return this.INTERVALS.QUOTA_EXCEEDED;
            } else {
                // Reset quota flag após 1 hora
                this.quotaExceeded = false;
                this.lastQuotaError = null;
                logger.log('✅ Tentando reativar verificações após limite de quota');
            }
        }

        // Se não há usuários conectados, verificar menos frequentemente
        if (this.connectedUsers === 0) {
            return this.INTERVALS.NO_USERS;
        }

        // Se há lives ativas, verificar com mais frequência
        if (this.activeLivestreams.size > 0) {
            return this.INTERVALS.LIVE_ACTIVE;
        }

        // Verificar se é horário noturno (23h às 6h)
        const hour = new Date().getHours();
        if (hour >= 23 || hour <= 6) {
            return this.INTERVALS.NO_LIVE_NIGHT;
        }

        // Horário comercial sem lives ativas
        return this.INTERVALS.NO_LIVE_DAY;
    }

    /**
     * Ajusta o intervalo de verificação dinamicamente
     */
    adjustCheckInterval() {
        const optimalInterval = this.calculateOptimalInterval();

        if (optimalInterval !== this.currentInterval) {
            logger.log(`🔄 Ajustando intervalo: ${this.currentInterval/1000}s → ${optimalInterval/1000}s`);

            this.currentInterval = optimalInterval;

            // Reiniciar o timer com novo intervalo
            if (this.checkInterval) {
                this.stopAutoCheck();
                this.startAutoCheck();
            }
        }
    }

    /**
     * Atualiza contagem de usuários conectados
     */
    updateConnectedUsers() {
        try {
            if (global.io) {
                this.connectedUsers = global.io.engine.clientsCount || 0;
                logger.log(`👥 Usuários conectados: ${this.connectedUsers}`);
                this.adjustCheckInterval();
            }
        } catch (error) {
            logger.error('Erro ao contar usuários conectados:', error.message);
        }
    }

    /**
     * Emite evento WebSocket para clientes conectados à câmara
     */
    emitLivestreamUpdate(camaraId, livestreamData, isLive) {
        try {
            // Verifica se o io está disponível (definido globalmente no servidor)
            if (typeof global !== 'undefined' && global.io) {
                const eventData = {
                    camaraId,
                    livestreamData,
                    isLive,
                    timestamp: new Date().toISOString()
                };

                // Emite para a sala específica da câmara
                global.io.to(`camara-${camaraId}`).emit('livestream-updated', eventData);

                logger.log(`📡 WebSocket: Notificação enviada para câmara ${camaraId} (${isLive ? 'LIVE' : 'ÚLTIMA SESSÃO'})`);
            }
        } catch (error) {
            logger.error('Erro ao emitir evento WebSocket:', error.message);
        }
    }

    /**
     * Inicia a verificação automática de livestreams
     */
    startAutoCheck() {
        if (this.checkInterval) {
            logger.log('Verificação automática já está rodando');
            return;
        }

        // Atualizar contagem de usuários e calcular intervalo
        this.updateConnectedUsers();

        logger.log(`Iniciando verificação automática (intervalo: ${this.currentInterval / 1000}s)`);

        // Primeira verificação imediata
        this.checkAllCamarasLivestreams();

        // Agenda verificações periódicas com intervalo dinâmico
        this.checkInterval = setInterval(() => {
            this.updateConnectedUsers(); // Atualizar a cada ciclo
            this.checkAllCamarasLivestreams();
        }, this.currentInterval);
    }

    /**
     * Para a verificação automática
     */
    stopAutoCheck() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
            logger.log('Verificação automática parada');
        }
    }

    /**
     * Verifica livestreams de todas as câmaras que têm Channel ID configurado
     */
    async checkAllCamarasLivestreams() {
        if (this.isChecking) {
            logger.log('Verificação já em andamento, pulando...');
            return;
        }

        // PROTEÇÃO: Se quota excedida, não fazer NENHUMA verificação
        if (this.quotaExceeded) {
            const timeRemaining = Math.round((this.INTERVALS.QUOTA_EXCEEDED - (Date.now() - this.lastQuotaError)) / 60000);
            logger.log(`⏳ QUOTA EXCEDIDA - Pulando todas as verificações (${timeRemaining} min restantes)`);
            return;
        }

        this.isChecking = true;
        logger.log('🔍 Iniciando verificação de livestreams de todas as câmaras');

        try {
            // Busca câmaras com youtube_channel_id configurado
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

            logger.log(`Verificando ${camaras.length} câmara(s) configurada(s)`);

            // Verifica cada câmara
            for (const camara of camaras) {
                try {
                    await this.checkCamaraLivestreams(camara.id, camara.youtube_channel_id);
                } catch (error) {
                    // Se encontrar erro de quota, para imediatamente para todas as câmaras
                    if (this.isQuotaExceededError(error)) {
                        this.handleQuotaExceeded();
                        break; // Para o loop para não consumir mais quota
                    }
                    logger.error(`Erro ao verificar câmara ${camara.nome_camara} (${camara.id}):`, error.message);
                }
            }

            logger.log('✅ Verificação de todas as câmaras concluída');

        } catch (error) {
            logger.error('Erro na verificação geral:', error.message);
        } finally {
            this.isChecking = false;
        }
    }

    /**
     * Detecta se um erro é de quota excedida
     */
    isQuotaExceededError(error) {
        return error.message && error.message.includes('quota');
    }

    /**
     * Marca a quota como excedida e ajusta o intervalo
     */
    handleQuotaExceeded() {
        this.quotaExceeded = true;
        this.lastQuotaError = Date.now();
        logger.error('🚫 Quota da API YouTube excedida - pausando verificações por 1 hora');
        this.adjustCheckInterval(); // Reajusta o intervalo imediatamente
    }

    /**
     * Verifica livestreams de uma câmara específica
     */
    async checkCamaraLivestreams(camaraId, channelId) {
        // PROTEÇÃO DUPLA: Se quota foi excedida, NÃO fazer nenhuma chamada para API
        if (this.quotaExceeded) {
            logger.log(`🚫 Pulando verificação da câmara ${camaraId} - quota excedida`);
            return;
        }

        logger.log(`Verificando livestreams da câmara ${camaraId} (canal: ${channelId})`);

        try {
            // Busca livestreams ativas no YouTube
            const liveStreams = await youtubeService.getLiveStreams(channelId);
            const upcomingStreams = await youtubeService.getUpcomingStreams(channelId);

            logger.log(`Encontradas ${liveStreams.length} live(s) ativa(s) e ${upcomingStreams.length} agendada(s)`);

            // Processa livestreams ativas
            for (const stream of liveStreams) {
                await this.processLivestream(camaraId, stream, 'live');
            }

            // Processa livestreams agendadas
            for (const stream of upcomingStreams) {
                await this.processLivestream(camaraId, stream, 'upcoming');
            }

            // Se não há livestreams ativas/agendadas, busca vídeos históricos
            if (liveStreams.length === 0 && upcomingStreams.length === 0) {
                await this.checkHistoricalVideos(camaraId, channelId);
            }

            // Verifica se há livestreams que terminaram
            await this.checkEndedLivestreams(camaraId);

        } catch (error) {
            // Detecta se é erro de quota
            if (this.isQuotaExceededError(error)) {
                this.handleQuotaExceeded();
                throw error; // Propaga o erro para parar o loop no método pai
            }

            logger.error(`Erro ao verificar câmara ${camaraId}:`, error.message);
            throw error;
        }
    }

    /**
     * Processa uma livestream individual
     */
    async processLivestream(camaraId, youtubeStream, status) {
        const videoId = youtubeStream.id.videoId || youtubeStream.id;

        try {
            // Verifica se já existe no banco
            const { data: existingStream } = await supabaseAdmin
                .from('livestreams')
                .select('*')
                .eq('youtube_video_id', videoId)
                .eq('camara_id', camaraId)
                .single();

            if (existingStream) {
                // Atualiza stream existente
                await this.updateExistingLivestream(existingStream, youtubeStream, status);
            } else {
                // Cria nova stream
                await this.createNewLivestream(camaraId, youtubeStream, status);
            }

        } catch (error) {
            logger.error(`Erro ao processar livestream ${videoId}:`, error.message);
        }
    }

    /**
     * Cria uma nova livestream no banco
     */
    async createNewLivestream(camaraId, youtubeStream, status) {
        const videoId = youtubeStream.id.videoId || youtubeStream.id;

        logger.log(`📝 Criando nova livestream: ${videoId}`);

        try {
            // Busca detalhes completos do vídeo
            const videoDetails = await youtubeService.getVideoDetails(videoId);
            const streamData = youtubeService.formatLivestreamData(videoDetails, camaraId);

            // Força o status correto
            streamData.status = status;
            streamData.is_current = (status === 'live');

            const { data, error } = await supabaseAdmin
                .from('livestreams')
                .insert([streamData])
                .select()
                .single();

            if (error) {
                throw new Error(`Erro ao inserir livestream: ${error.message}`);
            }

            logger.log(`✅ Livestream criada: ${data.title}`);

            // Se é uma live ativa, atualiza a câmara
            if (status === 'live') {
                await this.updateCamaraCurrentLivestream(camaraId, data.id);
            }

            // Trackear live ativa
            if (status === 'live') {
                this.activeLivestreams.add(camaraId);
                this.adjustCheckInterval();
            }

            // Emitir evento WebSocket para clientes conectados
            this.emitLivestreamUpdate(camaraId, data, status === 'live');

        } catch (error) {
            logger.error(`Erro ao criar livestream ${videoId}:`, error.message);
            throw error;
        }
    }

    /**
     * Atualiza uma livestream existente
     */
    async updateExistingLivestream(existingStream, youtubeStream, currentStatus) {
        const videoId = existingStream.youtube_video_id;

        try {
            // Busca detalhes atualizados do YouTube
            const videoDetails = await youtubeService.getVideoDetails(videoId);
            const updatedData = youtubeService.formatLivestreamData(videoDetails, existingStream.camara_id);

            // Mantém alguns campos existentes
            updatedData.id = existingStream.id;
            updatedData.created_at = existingStream.created_at;

            // Determina se mudou o status
            const statusChanged = existingStream.status !== updatedData.status;
            updatedData.is_current = (updatedData.status === 'live');

            const { error } = await supabaseAdmin
                .from('livestreams')
                .update(updatedData)
                .eq('id', existingStream.id);

            if (error) {
                throw new Error(`Erro ao atualizar livestream: ${error.message}`);
            }

            if (statusChanged) {
                logger.log(`🔄 Status da livestream ${videoId} mudou: ${existingStream.status} → ${updatedData.status}`);

                // Atualiza referências na câmara
                if (updatedData.status === 'live') {
                    await this.updateCamaraCurrentLivestream(existingStream.camara_id, existingStream.id);
                } else if (updatedData.status === 'ended') {
                    await this.updateCamaraLastLivestream(existingStream.camara_id, existingStream.id);
                }

                // Trackear mudanças nas lives ativas
                if (updatedData.status === 'live') {
                    this.activeLivestreams.add(existingStream.camara_id);
                } else if (existingStream.status === 'live' && updatedData.status !== 'live') {
                    this.activeLivestreams.delete(existingStream.camara_id);
                }
                this.adjustCheckInterval();

                // Emitir evento WebSocket para notificar mudança de status
                const fullStreamData = { ...existingStream, ...updatedData };
                this.emitLivestreamUpdate(existingStream.camara_id, fullStreamData, updatedData.status === 'live');
            }

        } catch (error) {
            logger.error(`Erro ao atualizar livestream ${videoId}:`, error.message);
        }
    }

    /**
     * Verifica livestreams que podem ter terminado
     */
    async checkEndedLivestreams(camaraId) {
        try {
            // Busca livestreams que estavam ativas/agendadas
            const { data: activeStreams } = await supabaseAdmin
                .from('livestreams')
                .select('*')
                .eq('camara_id', camaraId)
                .in('status', ['live', 'upcoming']);

            if (!activeStreams || activeStreams.length === 0) {
                return;
            }

            for (const stream of activeStreams) {
                try {
                    // Verifica status atual no YouTube
                    const videoDetails = await youtubeService.getVideoDetails(stream.youtube_video_id);
                    const currentStatus = youtubeService.determineStatus(videoDetails.liveStreamingDetails || {});

                    if (currentStatus === 'ended' && stream.status !== 'ended') {
                        logger.log(`📺 Livestream ${stream.youtube_video_id} terminou`);

                        // Atualiza como finalizada
                        await supabaseAdmin
                            .from('livestreams')
                            .update({
                                status: 'ended',
                                is_current: false,
                                actual_end_time: new Date().toISOString()
                            })
                            .eq('id', stream.id);

                        // Atualiza como última live da câmara
                        await this.updateCamaraLastLivestream(camaraId, stream.id);
                    }

                } catch (error) {
                    logger.error(`Erro ao verificar status da livestream ${stream.youtube_video_id}:`, error.message);
                }
            }

        } catch (error) {
            logger.error(`Erro ao verificar livestreams finalizadas da câmara ${camaraId}:`, error.message);
        }
    }

    /**
     * Atualiza a livestream atual da câmara
     */
    async updateCamaraCurrentLivestream(camaraId, livestreamId) {
        try {
            // Remove current de outras livestreams da câmara
            await supabaseAdmin
                .from('livestreams')
                .update({ is_current: false })
                .eq('camara_id', camaraId)
                .neq('id', livestreamId);

            // Atualiza a câmara
            await supabaseAdmin
                .from('camaras')
                .update({ current_livestream_id: livestreamId })
                .eq('id', camaraId);

            logger.log(`📺 Câmara ${camaraId} - livestream atual atualizada: ${livestreamId}`);

        } catch (error) {
            logger.error(`Erro ao atualizar livestream atual da câmara ${camaraId}:`, error.message);
        }
    }

    /**
     * Atualiza a última livestream da câmara
     */
    async updateCamaraLastLivestream(camaraId, livestreamId) {
        try {
            await supabaseAdmin
                .from('camaras')
                .update({
                    last_livestream_id: livestreamId,
                    current_livestream_id: null
                })
                .eq('id', camaraId);

            logger.log(`📺 Câmara ${camaraId} - última livestream atualizada: ${livestreamId}`);

        } catch (error) {
            logger.error(`Erro ao atualizar última livestream da câmara ${camaraId}:`, error.message);
        }
    }

    /**
     * Busca a livestream atual de uma câmara
     */
    async getCurrentLivestream(camaraId) {
        try {
            const { data, error } = await supabaseAdmin
                .from('livestreams')
                .select('*')
                .eq('camara_id', camaraId)
                .eq('status', 'live')
                .eq('is_current', true)
                .single();

            if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
                throw new Error(`Erro ao buscar livestream atual: ${error.message}`);
            }

            return data;

        } catch (error) {
            logger.error(`Erro ao buscar livestream atual da câmara ${camaraId}:`, error.message);
            return null;
        }
    }

    /**
     * Busca a última livestream de uma câmara
     */
    async getLastLivestream(camaraId) {
        try {
            const { data, error } = await supabaseAdmin
                .from('livestreams')
                .select('*')
                .eq('camara_id', camaraId)
                .eq('status', 'ended')
                .order('actual_end_time', { ascending: false })
                .limit(1)
                .single();

            if (error && error.code !== 'PGRST116') {
                throw new Error(`Erro ao buscar última livestream: ${error.message}`);
            }

            return data;

        } catch (error) {
            logger.error(`Erro ao buscar última livestream da câmara ${camaraId}:`, error.message);
            return null;
        }
    }

    /**
     * Busca livestreams de uma câmara com paginação
     */
    async getCamaraLivestreams(camaraId, { page = 1, limit = 10, status = null } = {}) {
        try {
            let query = supabaseAdmin
                .from('livestreams')
                .select('*', { count: 'exact' })
                .eq('camara_id', camaraId)
                .order('created_at', { ascending: false });

            if (status) {
                query = query.eq('status', status);
            }

            const offset = (page - 1) * limit;
            query = query.range(offset, offset + limit - 1);

            const { data, error, count } = await query;

            if (error) {
                throw new Error(`Erro ao buscar livestreams: ${error.message}`);
            }

            return {
                data: data || [],
                pagination: {
                    page,
                    limit,
                    total: count || 0,
                    totalPages: Math.ceil((count || 0) / limit)
                }
            };

        } catch (error) {
            logger.error(`Erro ao buscar livestreams da câmara ${camaraId}:`, error.message);
            throw error;
        }
    }

    /**
     * Verifica e importa vídeos históricos do canal se não houver livestreams na tabela
     */
    async checkHistoricalVideos(camaraId, channelId) {
        try {
            // Verifica se já existem livestreams desta câmara no banco
            const { count: existingCount } = await supabaseAdmin
                .from('livestreams')
                .select('id', { count: 'exact', head: true })
                .eq('camara_id', camaraId);

            if (existingCount > 0) {
                // Já há registros, não precisa buscar histórico
                return;
            }

            logger.log(`📹 Buscando vídeos históricos para câmara ${camaraId} (primeira vez)`);

            // Busca vídeos recentes do canal
            const recentVideos = await youtubeService.getRecentVideos(channelId);

            if (recentVideos.length === 0) {
                logger.log(`📹 Nenhum vídeo encontrado no canal ${channelId}`);
                return;
            }

            logger.log(`📹 Encontrados ${recentVideos.length} vídeos para processar`);

            // Processa os vídeos mais recentes (máximo 10 para não sobrecarregar)
            const videosToProcess = recentVideos.slice(0, 10);

            for (const video of videosToProcess) {
                try {
                    // Busca detalhes completos do vídeo
                    const videoDetails = await youtubeService.getVideoDetails(video.id.videoId);

                    // Verifica se o vídeo foi uma transmissão ao vivo
                    if (videoDetails.liveStreamingDetails) {
                        await this.processHistoricalLivestream(camaraId, videoDetails);
                    }
                } catch (error) {
                    logger.error(`Erro ao processar vídeo histórico ${video.id.videoId}:`, error.message);
                }
            }

            logger.log(`📹 Processamento de vídeos históricos concluído para câmara ${camaraId}`);

        } catch (error) {
            logger.error(`Erro ao verificar vídeos históricos da câmara ${camaraId}:`, error.message);
        }
    }

    /**
     * Processa um vídeo histórico (livestream finalizada)
     */
    async processHistoricalLivestream(camaraId, videoDetails) {
        const videoId = videoDetails.id;

        try {
            // Verifica se já existe no banco
            const { data: existingStream } = await supabaseAdmin
                .from('livestreams')
                .select('*')
                .eq('youtube_video_id', videoId)
                .eq('camara_id', camaraId)
                .single();

            if (existingStream) {
                // Já existe, não processa novamente
                return;
            }

            logger.log(`📺 Processando livestream histórica: ${videoDetails.snippet.title}`);

            // Formata dados da livestream
            const streamData = youtubeService.formatLivestreamData(videoDetails, camaraId);

            // Define como finalizada
            streamData.status = 'ended';
            streamData.is_current = false;

            // Define data de fim baseada na duração se não existir
            if (!streamData.actual_end_time && videoDetails.contentDetails?.duration) {
                const startTime = new Date(streamData.scheduled_start_time);
                const duration = this.parseDuration(videoDetails.contentDetails.duration);
                streamData.actual_end_time = new Date(startTime.getTime() + duration).toISOString();
            }

            // Insere no banco
            const { data, error } = await supabaseAdmin
                .from('livestreams')
                .insert([streamData])
                .select()
                .single();

            if (error) {
                throw new Error(`Erro ao inserir livestream histórica: ${error.message}`);
            }

            logger.log(`✅ Livestream histórica processada: ${data.title}`);

            // Atualiza como última livestream da câmara
            await this.updateCamaraLastLivestream(camaraId, data.id);

        } catch (error) {
            logger.error(`Erro ao processar livestream histórica ${videoId}:`, error.message);
        }
    }

    /**
     * Converte duração ISO 8601 para milissegundos
     */
    parseDuration(duration) {
        const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
        if (!match) return 0;

        const hours = parseInt(match[1]) || 0;
        const minutes = parseInt(match[2]) || 0;
        const seconds = parseInt(match[3]) || 0;

        return (hours * 3600 + minutes * 60 + seconds) * 1000;
    }
}

module.exports = new LivestreamService();