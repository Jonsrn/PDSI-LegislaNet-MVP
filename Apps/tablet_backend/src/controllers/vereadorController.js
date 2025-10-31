const { supabaseAdmin } = require('../config/supabase');
const createLogger = require('../config/logger');
const logger = createLogger('TABLET_VEREADOR_CONTROLLER');

/**
 * Busca os dados detalhados do vereador logado
 */
const getVereadorProfile = async (req, res) => {
    const { user, profile } = req;
    logger.info(`Buscando dados do vereador ${user.id} da câmara ${profile.camara_id}`);

    try {
        const { data: vereadorData, error } = await supabaseAdmin
            .from('vereadores')
            .select(`
                id,
                nome_parlamentar,
                foto_url,
                is_presidente,
                is_vice_presidente,
                is_active,
                partidos (
                    id,
                    nome,
                    sigla,
                    logo_url
                )
            `)
            .eq('profile_id', user.id)
            .eq('camara_id', profile.camara_id)
            .single();

        if (error) {
            logger.error('Erro ao buscar dados do vereador:', { error: error.message });
            return res.status(500).json({ error: 'Erro ao buscar dados do vereador.' });
        }

        if (!vereadorData) {
            logger.warn('Dados de vereador não encontrados:', { userId: user.id });
            return res.status(404).json({ error: 'Dados de vereador não encontrados.' });
        }

        logger.info('✅ Dados do vereador encontrados:', { vereadorId: vereadorData.id });
        res.status(200).json(vereadorData);

    } catch (error) {
        logger.error('Erro crítico ao buscar dados do vereador:', {
            error: error.message,
            stack: error.stack,
            userId: user.id
        });
        res.status(500).json({ error: 'Erro interno ao buscar dados do vereador.' });
    }
};

/**
 * Lista todos os vereadores ativos da mesma câmara
 */
const getVereadoresDaCamara = async (req, res) => {
    const { profile } = req;
    logger.info(`Buscando vereadores ativos da câmara ${profile.camara_id}`);

    try {
        const { data: vereadores, error } = await supabaseAdmin
            .from('vereadores')
            .select(`
                id,
                nome_parlamentar,
                foto_url,
                is_presidente,
                is_vice_presidente,
                partidos (
                    id,
                    nome,
                    sigla,
                    logo_url
                )
            `)
            .eq('camara_id', profile.camara_id)
            .eq('is_active', true)
            .order('nome_parlamentar', { ascending: true });

        if (error) {
            logger.error('Erro ao buscar vereadores da câmara:', { error: error.message });
            return res.status(500).json({ error: 'Erro ao buscar vereadores da câmara.' });
        }

        logger.info(`✅ Encontrados ${vereadores.length} vereadores ativos da câmara.`);
        res.status(200).json({ data: vereadores });

    } catch (error) {
        logger.error('Erro crítico ao buscar vereadores da câmara:', {
            error: error.message,
            stack: error.stack,
            camaraId: profile.camara_id
        });
        res.status(500).json({ error: 'Erro interno ao buscar vereadores da câmara.' });
    }
};

/**
 * Atualiza a foto do perfil do vereador
 */
const updateVereadorFoto = async (req, res) => {
    const { user } = req;
    const { foto_url } = req.body;

    logger.info(`Atualizando foto do vereador ${user.id}`);

    try {
        const { data, error } = await supabaseAdmin
            .from('vereadores')
            .update({ foto_url })
            .eq('profile_id', user.id)
            .select()
            .single();

        if (error) {
            logger.error('Erro ao atualizar foto do vereador:', { error: error.message });
            return res.status(500).json({ error: 'Erro ao atualizar foto do vereador.' });
        }

        logger.info('✅ Foto do vereador atualizada com sucesso:', { vereadorId: data.id });
        res.status(200).json({ message: 'Foto atualizada com sucesso.', data });

    } catch (error) {
        logger.error('Erro crítico ao atualizar foto do vereador:', {
            error: error.message,
            stack: error.stack,
            userId: user.id
        });
        res.status(500).json({ error: 'Erro interno ao atualizar foto do vereador.' });
    }
};

module.exports = {
    getVereadorProfile,
    getVereadoresDaCamara,
    updateVereadorFoto
};