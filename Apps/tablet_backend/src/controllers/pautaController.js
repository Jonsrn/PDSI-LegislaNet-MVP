const { supabaseAdmin } = require('../config/supabase');
const createLogger = require('../config/logger');
const logger = createLogger('TABLET_PAUTA_CONTROLLER');

/**
 * Lista todas as pautas da câmara do vereador logado, organizadas por status
 */
const getPautasDaCamara = async (req, res) => {
    const { profile } = req;
    const { page = 1, limit = 50 } = req.query;

    logger.info(`Buscando pautas da câmara ${profile.camara_id}, página ${page}`);

    try {
        const offset = (page - 1) * limit;

        // Buscar pautas com dados das sessões
        const { data: pautas, error, count } = await supabaseAdmin
            .from('pautas')
            .select(`
                id,
                nome,
                descricao,
                anexo_url,
                status,
                resultado_votacao,
                autor,
                created_at,
                votacao_simbolica,
                sessoes!inner (
                    id,
                    nome,
                    tipo,
                    status,
                    data_sessao,
                    camara_id
                )
            `, { count: 'exact' })
            .eq('sessoes.camara_id', profile.camara_id)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) {
            logger.error('Erro ao buscar pautas:', { error: error.message });
            return res.status(500).json({ error: 'Erro ao buscar pautas.' });
        }

        // Organizar pautas por status
        const pautasOrganizadas = {
            pendentes: pautas.filter(p => p.status === 'Pendente'),
            emVotacao: pautas.filter(p => p.status === 'Em Votação'),
            finalizadas: pautas.filter(p => p.status === 'Finalizada')
        };

        logger.info(`✅ Encontradas ${pautas.length} pautas da câmara:`, {
            pendentes: pautasOrganizadas.pendentes.length,
            emVotacao: pautasOrganizadas.emVotacao.length,
            finalizadas: pautasOrganizadas.finalizadas.length,
            total: count
        });

        res.status(200).json({
            data: pautasOrganizadas,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: count,
                totalPages: Math.ceil(count / limit)
            }
        });

    } catch (error) {
        logger.error('Erro crítico ao buscar pautas:', {
            error: error.message,
            stack: error.stack,
            camaraId: profile.camara_id
        });
        res.status(500).json({ error: 'Erro interno ao buscar pautas.' });
    }
};

/**
 * Busca uma pauta específica com detalhes
 */
const getPautaById = async (req, res) => {
    const { profile } = req;
    const { id } = req.params;

    logger.info(`Buscando pauta ${id} da câmara ${profile.camara_id}`);

    try {
        const { data: pauta, error } = await supabaseAdmin
            .from('pautas')
            .select(`
                id,
                nome,
                descricao,
                anexo_url,
                status,
                resultado_votacao,
                autor,
                created_at,
                votacao_simbolica,
                sessoes!inner (
                    id,
                    nome,
                    tipo,
                    status,
                    data_sessao,
                    camara_id
                )
            `)
            .eq('id', id)
            .eq('sessoes.camara_id', profile.camara_id)
            .single();

        if (error || !pauta) {
            logger.warn('Pauta não encontrada:', { pautaId: id, error: error?.message });
            return res.status(404).json({ error: 'Pauta não encontrada.' });
        }

        logger.info('✅ Pauta encontrada:', { pautaId: pauta.id, status: pauta.status });
        res.status(200).json(pauta);

    } catch (error) {
        logger.error('Erro crítico ao buscar pauta:', {
            error: error.message,
            stack: error.stack,
            pautaId: id
        });
        res.status(500).json({ error: 'Erro interno ao buscar pauta.' });
    }
};

/**
 * Busca as estatísticas de votação de uma pauta
 */
const getEstatisticasVotacao = async (req, res) => {
    const { profile } = req;
    const { id } = req.params;

    logger.info(`Buscando estatísticas da pauta ${id}`);

    try {
        // Verificar se a pauta pertence à câmara do vereador
        const { data: pauta, error: pautaError } = await supabaseAdmin
            .from('pautas')
            .select(`
                id,
                status,
                resultado_votacao,
                sessoes!inner (camara_id)
            `)
            .eq('id', id)
            .eq('sessoes.camara_id', profile.camara_id)
            .single();

        if (pautaError || !pauta) {
            return res.status(404).json({ error: 'Pauta não encontrada.' });
        }

        // Buscar todos os votos da pauta
        const { data: votos, error: votosError } = await supabaseAdmin
            .from('votos')
            .select(`
                id,
                voto,
                created_at,
                era_presidente_no_voto,
                era_vice_presidente_no_voto,
                vereadores (
                    id,
                    nome_parlamentar
                )
            `)
            .eq('pauta_id', id);

        if (votosError) {
            logger.error('Erro ao buscar votos:', { error: votosError.message });
            return res.status(500).json({ error: 'Erro ao buscar votos.' });
        }

        // Calcular estatísticas
        const stats = {
            total: votos.length,
            sim: votos.filter(v => v.voto === 'SIM').length,
            nao: votos.filter(v => v.voto === 'NÃO').length,
            abstencao: votos.filter(v => v.voto === 'ABSTENÇÃO').length,
            voto_presidente: votos.find(v => v.era_presidente_no_voto)?.voto || null,
            resultado: pauta.resultado_votacao
        };

        logger.info('✅ Estatísticas calculadas:', stats);

        res.status(200).json({
            pauta: {
                id: pauta.id,
                status: pauta.status,
                resultado_votacao: pauta.resultado_votacao
            },
            votos,
            estatisticas: stats
        });

    } catch (error) {
        logger.error('Erro crítico ao buscar estatísticas:', {
            error: error.message,
            stack: error.stack,
            pautaId: id
        });
        res.status(500).json({ error: 'Erro interno ao buscar estatísticas.' });
    }
};

module.exports = {
    getPautasDaCamara,
    getPautaById,
    getEstatisticasVotacao
};