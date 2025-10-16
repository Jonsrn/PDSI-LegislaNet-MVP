const supabaseAdmin = require('../config/supabaseAdminClient');
const createLogger = require('../utils/logger');
const logger = createLogger('PAINEL_CONTROLE');

/**
 * Verifica se uma sessão está válida para exibição
 * Critério: Todas as sessões são válidas (não filtra por data)
 * O painel de controle deve mostrar todas as pautas e oradores independente da data
 */
function isSessaoValida(dataSessao) {
    // Retorna sempre true - exibe todas as sessões
    return true;
}

/**
 * GET /api/painel-controle/pautas-em-votacao
 * Busca pautas com status "Em Votação" de sessões válidas (hoje ou passado)
 */
const getPautasEmVotacao = async (req, res) => {
    try {
        const { profile } = req;

        logger.log(`Buscando pautas em votação da câmara ${profile.camara_id}`);

        // Buscar todas as pautas em votação da câmara
        const { data: pautas, error } = await supabaseAdmin
            .from('pautas')
            .select(`
                id,
                nome,
                descricao,
                autor,
                status,
                votacao_simbolica,
                created_at,
                sessoes!inner (
                    id,
                    nome,
                    tipo,
                    data_sessao,
                    status,
                    camara_id
                )
            `)
            .eq('status', 'Em Votação')
            .eq('sessoes.camara_id', profile.camara_id)
            .order('created_at', { ascending: false });

        if (error) {
            logger.error('Erro ao buscar pautas em votação:', error);
            return res.status(500).json({ error: 'Erro ao buscar pautas' });
        }

        // Filtrar apenas pautas de sessões válidas
        const pautasValidas = pautas.filter(pauta => {
            const valida = isSessaoValida(pauta.sessoes.data_sessao);
            logger.log(`Pauta "${pauta.nome}" - Sessão: ${pauta.sessoes.data_sessao} - Válida: ${valida}`);
            return valida;
        });

        logger.log(`✅ Encontradas ${pautasValidas.length} pautas em votação válidas (de ${pautas.length} total)`);

        res.json({
            data: pautasValidas,
            total: pautasValidas.length
        });

    } catch (error) {
        logger.error('Erro inesperado ao buscar pautas em votação:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
};

/**
 * GET /api/painel-controle/oradores
 * Busca oradores de sessões válidas (hoje ou passado)
 */
const getOradoresAtivos = async (req, res) => {
    try {
        const { profile } = req;

        logger.log(`Buscando oradores ativos da câmara ${profile.camara_id}`);

        // Buscar todos os oradores com informações da sessão
        const { data: oradores, error } = await supabaseAdmin
            .from('oradores')
            .select(`
                id,
                ordem,
                tempo_fala_minutos,
                created_at,
                vereadores (
                    id,
                    nome_parlamentar,
                    foto_url,
                    partidos (
                        id,
                        nome,
                        sigla,
                        logo_url
                    )
                ),
                sessoes!inner (
                    id,
                    nome,
                    tipo,
                    data_sessao,
                    status,
                    camara_id
                )
            `)
            .eq('sessoes.camara_id', profile.camara_id)
            .order('ordem', { ascending: true });

        if (error) {
            logger.error('Erro ao buscar oradores:', error);
            return res.status(500).json({ error: 'Erro ao buscar oradores' });
        }

        // Filtrar apenas oradores de sessões válidas
        logger.log(`📋 Total de oradores encontrados no banco: ${oradores.length}`);

        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        logger.log(`📅 Data de hoje (00:00): ${hoje.toISOString()}`);

        const oradoresValidos = oradores.filter(orador => {
            const sessaoDate = new Date(orador.sessoes.data_sessao);
            sessaoDate.setHours(0, 0, 0, 0);
            const valida = isSessaoValida(orador.sessoes.data_sessao);

            logger.log(`👤 Orador: ${orador.vereadores?.nome_parlamentar || 'N/A'} | Sessão: ${orador.sessoes.nome} | Data: ${orador.sessoes.data_sessao} (${sessaoDate.toISOString()}) | Válida: ${valida ? '✅ SIM' : '❌ NÃO'}`);

            return valida;
        });

        // Ordenar por data de sessão (mais recente primeiro) e depois por ordem
        oradoresValidos.sort((a, b) => {
            const dataA = new Date(a.sessoes.data_sessao);
            const dataB = new Date(b.sessoes.data_sessao);

            // Primeiro ordena por data (mais recente primeiro)
            if (dataB.getTime() !== dataA.getTime()) {
                return dataB.getTime() - dataA.getTime();
            }

            // Se as datas são iguais, ordena por ordem
            return a.ordem - b.ordem;
        });

        logger.log(`✅ Encontrados ${oradoresValidos.length} oradores válidos (de ${oradores.length} total)`);

        res.json({
            data: oradoresValidos,
            total: oradoresValidos.length
        });

    } catch (error) {
        logger.error('Erro inesperado ao buscar oradores:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
};

/**
 * POST /api/painel-controle/iniciar-votacao/:pautaId
 * Inicia votação de uma pauta e envia notificação via WebSocket para tablets
 */
const iniciarVotacao = async (req, res) => {
    try {
        const { profile } = req;
        const { pautaId } = req.params;

        logger.log(`Iniciando votação da pauta ${pautaId} pela câmara ${profile.camara_id}`);

        // Verificar se a pauta existe e pertence à câmara (com informações da sessão)
        const { data: pauta, error: pautaError } = await supabaseAdmin
            .from('pautas')
            .select(`
                id,
                nome,
                descricao,
                status,
                sessoes!inner (
                    id,
                    camara_id,
                    nome,
                    tipo,
                    data_sessao
                )
            `)
            .eq('id', pautaId)
            .eq('sessoes.camara_id', profile.camara_id)
            .single();

        if (pautaError || !pauta) {
            logger.error('Pauta não encontrada ou não pertence à câmara');
            return res.status(404).json({ error: 'Pauta não encontrada' });
        }

        // Atualizar status da pauta para "Em Votação" se ainda não estiver
        if (pauta.status !== 'Em Votação') {
            const { error: updateError } = await supabaseAdmin
                .from('pautas')
                .update({ status: 'Em Votação' })
                .eq('id', pautaId);

            if (updateError) {
                logger.error('Erro ao atualizar status da pauta:', updateError);
                return res.status(500).json({ error: 'Erro ao iniciar votação' });
            }
        }

        // Notificar tablet backend via HTTP para emitir WebSocket
        const http = require('http');
        const notificationPayload = JSON.stringify({
            camaraId: pauta.sessoes.camara_id,
            pautaId: pauta.id,
            pautaNome: pauta.nome,
            pautaDescricao: pauta.descricao,
            sessaoNome: pauta.sessoes.nome,
            sessaoTipo: pauta.sessoes.tipo,
            sessaoDataHora: pauta.sessoes.data_sessao,
            action: 'iniciar-votacao'
        });

        const options = {
            hostname: 'localhost',
            port: 3003,
            path: '/api/notify/iniciar-votacao',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(notificationPayload)
            }
        };

        const request = http.request(options, (response) => {
            if (response.statusCode >= 200 && response.statusCode < 300) {
                logger.log('✅ Notificação de início de votação enviada ao tablet backend');
            } else {
                logger.log('⚠️ Falha ao notificar tablet backend:', response.statusCode);
            }
        });

        request.on('error', (error) => {
            logger.log('⚠️ Erro ao notificar tablet backend:', error.message);
        });

        request.write(notificationPayload);
        request.end();

        logger.log(`✅ Votação iniciada para pauta ${pautaId}`);

        res.json({
            message: 'Votação iniciada com sucesso',
            pauta: {
                id: pauta.id,
                nome: pauta.nome
            }
        });

    } catch (error) {
        logger.error('Erro inesperado ao iniciar votação:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
};

/**
 * POST /api/painel-controle/iniciar-fala/:oradorId
 * Inicia fala de um orador e envia notificação via WebSocket para tablets
 */
const iniciarFala = async (req, res) => {
    try {
        const { profile } = req;
        const { oradorId } = req.params;

        logger.log(`Iniciando fala do orador ${oradorId} pela câmara ${profile.camara_id}`);

        // Buscar dados completos do orador
        const { data: orador, error: oradorError } = await supabaseAdmin
            .from('oradores')
            .select(`
                id,
                ordem,
                tempo_fala_minutos,
                vereadores (
                    id,
                    nome_parlamentar,
                    foto_url
                ),
                sessoes!inner (
                    id,
                    nome,
                    camara_id
                )
            `)
            .eq('id', oradorId)
            .eq('sessoes.camara_id', profile.camara_id)
            .single();

        if (oradorError || !orador) {
            logger.error('Orador não encontrado ou não pertence à câmara');
            return res.status(404).json({ error: 'Orador não encontrado' });
        }

        // Notificar tablet backend via HTTP para emitir WebSocket
        const http = require('http');
        const notificationPayload = JSON.stringify({
            camaraId: orador.sessoes.camara_id,
            oradorId: orador.id,
            oradorNome: orador.vereadores.nome_parlamentar,
            sessaoNome: orador.sessoes.nome,
            tempoFala: orador.tempo_fala_minutos,
            action: 'iniciar-fala'
        });

        const options = {
            hostname: 'localhost',
            port: 3003,
            path: '/api/notify/iniciar-fala',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(notificationPayload)
            }
        };

        const request = http.request(options, (response) => {
            if (response.statusCode >= 200 && response.statusCode < 300) {
                logger.log('✅ Notificação de início de fala enviada ao tablet backend');
            } else {
                logger.log('⚠️ Falha ao notificar tablet backend:', response.statusCode);
            }
        });

        request.on('error', (error) => {
            logger.log('⚠️ Erro ao notificar tablet backend:', error.message);
        });

        request.write(notificationPayload);
        request.end();

        logger.log(`✅ Fala iniciada para orador ${oradorId}`);

        res.json({
            message: 'Fala iniciada com sucesso',
            orador: {
                id: orador.id,
                nome: orador.vereadores.nome_parlamentar,
                tempo_fala_minutos: orador.tempo_fala_minutos
            }
        });

    } catch (error) {
        logger.error('Erro inesperado ao iniciar fala:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
};

module.exports = {
    getPautasEmVotacao,
    getOradoresAtivos,
    iniciarVotacao,
    iniciarFala,
    isSessaoValida // Exportar para testes
};
