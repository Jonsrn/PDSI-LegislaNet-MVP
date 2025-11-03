const { supabaseAdmin } = require('../config/supabase');
const createLogger = require('../config/logger');
const websocketService = require('../services/websocketService');
const logger = createLogger('TABLET_VOTO_CONTROLLER');

/**
 * Registra ou atualiza o voto do vereador em uma pauta
 */
const registrarVoto = async (req, res) => {
    const { user, profile } = req;
    const { pauta_id, voto } = req.body;

    logger.info(`Registrando voto do vereador ${user.id} na pauta ${pauta_id}: ${voto}`);

    try {
        // Validar dados obrigatórios
        if (!pauta_id || !voto) {
            return res.status(400).json({ error: 'Pauta ID e voto são obrigatórios.' });
        }

        // Mapear valores recebidos para valores do enum
        let votoEnum;
        switch (voto) {
            case 'Sim':
                votoEnum = 'SIM';
                break;
            case 'Não':
                votoEnum = 'NÃO';
                break;
            case 'Abstenção':
                votoEnum = 'ABSTENÇÃO';
                break;
            default:
                return res.status(400).json({
                    error: 'Voto inválido. Permitidos: Sim, Não, Abstenção'
                });
        }

        // Verificar se a pauta existe e está em votação
        const { data: pauta, error: pautaError } = await supabaseAdmin
            .from('pautas')
            .select(`
                id,
                nome,
                status,
                sessoes!inner (
                    id,
                    camara_id
                )
            `)
            .eq('id', pauta_id)
            .single();

        if (pautaError || !pauta) {
            logger.warn('Pauta não encontrada:', { pautaId: pauta_id, error: pautaError?.message });
            return res.status(404).json({ error: 'Pauta não encontrada.' });
        }

        if (pauta.status !== 'Em Votação') {
            logger.warn('Pauta não está em votação:', { pautaId: pauta_id, status: pauta.status });
            return res.status(400).json({ error: 'Esta pauta não está em votação.' });
        }

        // Verificar se a pauta pertence à câmara do vereador
        if (pauta.sessoes.camara_id !== profile.camara_id) {
            logger.warn('Tentativa de voto em pauta de outra câmara:', {
                pautaId: pauta_id,
                pautaCamara: pauta.sessoes.camara_id,
                vereadorCamara: profile.camara_id
            });
            return res.status(403).json({ error: 'Você só pode votar em pautas da sua câmara.' });
        }

        // Buscar dados do vereador
        const { data: vereadorData, error: vereadorError } = await supabaseAdmin
            .from('vereadores')
            .select('id, is_presidente, is_vice_presidente, partido_id')
            .eq('profile_id', user.id)
            .single();

        if (vereadorError || !vereadorData) {
            logger.error('Dados do vereador não encontrados:', { userId: user.id });
            return res.status(404).json({ error: 'Dados do vereador não encontrados.' });
        }

        // Verificar se o vereador já votou nesta pauta
        const { data: votoExistente, error: votoExistenteError } = await supabaseAdmin
            .from('votos')
            .select('id, voto')
            .eq('pauta_id', pauta_id)
            .eq('vereador_id', vereadorData.id)
            .single();

        if (votoExistente) {
            // Atualizar voto existente
            logger.info('Atualizando voto existente:', { votoId: votoExistente.id });

            const { data: votoAtualizado, error: updateError } = await supabaseAdmin
                .from('votos')
                .update({
                    voto: votoEnum,
                    era_presidente_no_voto: vereadorData.is_presidente,
                    era_vice_presidente_no_voto: vereadorData.is_vice_presidente,
                    partido_id_no_voto: vereadorData.partido_id
                })
                .eq('id', votoExistente.id)
                .select()
                .single();

            if (updateError) {
                logger.error('Erro ao atualizar voto:', { error: updateError.message });
                return res.status(500).json({ error: 'Erro ao atualizar voto.' });
            }

            logger.info('✅ Voto atualizado com sucesso:', { votoId: votoAtualizado.id });

            // Notificar atualização via WebSocket
            await websocketService.notifyVoto(pauta_id, {
                vereador: {
                    id: vereadorData.id,
                    nome_parlamentar: profile.nome_parlamentar || profile.nome,
                    is_presidente: vereadorData.is_presidente
                },
                voto: votoEnum,
                isUpdate: true
            });

            return res.status(200).json({
                message: 'Voto atualizado com sucesso.',
                voto: votoAtualizado
            });

        } else {
            // Criar novo voto
            logger.info('Criando novo voto');

            const { data: novoVoto, error: createError } = await supabaseAdmin
                .from('votos')
                .insert({
                    pauta_id,
                    vereador_id: vereadorData.id,
                    voto: votoEnum,
                    era_presidente_no_voto: vereadorData.is_presidente,
                    era_vice_presidente_no_voto: vereadorData.is_vice_presidente,
                    partido_id_no_voto: vereadorData.partido_id
                })
                .select()
                .single();

            if (createError) {
                logger.error('Erro ao criar voto:', { error: createError.message });
                return res.status(500).json({ error: 'Erro ao registrar voto.' });
            }

            logger.info('✅ Voto registrado com sucesso:', { votoId: novoVoto.id });

            // Notificar novo voto via WebSocket
            await websocketService.notifyVoto(pauta_id, {
                vereador: {
                    id: vereadorData.id,
                    nome_parlamentar: profile.nome_parlamentar || profile.nome,
                    is_presidente: vereadorData.is_presidente
                },
                voto: votoEnum,
                isUpdate: false
            });

            return res.status(201).json({
                message: 'Voto registrado com sucesso.',
                voto: novoVoto
            });
        }

    } catch (error) {
        logger.error('Erro crítico ao registrar voto:', {
            error: error.message,
            stack: error.stack,
            userId: user.id,
            pautaId: pauta_id
        });
        res.status(500).json({ error: 'Erro interno ao registrar voto.' });
    }
};

/**
 * Busca os votos do vereador logado em todas as pautas
 */
const getVotosDoVereador = async (req, res) => {
    const { user, profile } = req;

    logger.info(`Buscando votos do vereador ${user.id}`);

    try {
        // Buscar dados do vereador
        const { data: vereadorData, error: vereadorError } = await supabaseAdmin
            .from('vereadores')
            .select('id')
            .eq('profile_id', user.id)
            .single();

        if (vereadorError || !vereadorData) {
            return res.status(404).json({ error: 'Dados do vereador não encontrados.' });
        }

        // Buscar todos os votos do vereador
        const { data: votos, error: votosError } = await supabaseAdmin
            .from('votos')
            .select(`
                id,
                pauta_id,
                voto,
                created_at,
                era_presidente_no_voto,
                era_vice_presidente_no_voto,
                pautas (
                    id,
                    nome,
                    status,
                    resultado_votacao
                )
            `)
            .eq('vereador_id', vereadorData.id)
            .order('created_at', { ascending: false });

        if (votosError) {
            logger.error('Erro ao buscar votos do vereador:', { error: votosError.message });
            return res.status(500).json({ error: 'Erro ao buscar votos.' });
        }

        // Organizar votos por pauta_id para facilitar acesso
        const votosPorPauta = {};
        votos.forEach(voto => {
            votosPorPauta[voto.pauta_id] = voto;
        });

        logger.info(`✅ Encontrados ${votos.length} votos do vereador`);

        res.status(200).json({
            votos,
            votosPorPauta
        });

    } catch (error) {
        logger.error('Erro crítico ao buscar votos do vereador:', {
            error: error.message,
            stack: error.stack,
            userId: user.id
        });
        res.status(500).json({ error: 'Erro interno ao buscar votos.' });
    }
};

/**
 * Busca o voto específico do vereador em uma pauta
 */
const getVotoEmPauta = async (req, res) => {
    const { user } = req;
    const { pauta_id } = req.params;

    logger.info(`Buscando voto do vereador ${user.id} na pauta ${pauta_id}`);

    try {
        // Buscar dados do vereador
        const { data: vereadorData, error: vereadorError } = await supabaseAdmin
            .from('vereadores')
            .select('id')
            .eq('profile_id', user.id)
            .single();

        if (vereadorError || !vereadorData) {
            return res.status(404).json({ error: 'Dados do vereador não encontrados.' });
        }

        // Buscar o voto específico
        const { data: voto, error: votoError } = await supabaseAdmin
            .from('votos')
            .select(`
                id,
                pauta_id,
                voto,
                created_at,
                era_presidente_no_voto,
                era_vice_presidente_no_voto
            `)
            .eq('pauta_id', pauta_id)
            .eq('vereador_id', vereadorData.id)
            .single();

        if (votoError && votoError.code !== 'PGRST116') {
            // PGRST116 = não encontrado, que é normal
            logger.error('Erro ao buscar voto:', { error: votoError.message });
            return res.status(500).json({ error: 'Erro ao buscar voto.' });
        }

        if (!voto) {
            return res.status(200).json({ voto: null, message: 'Vereador ainda não votou nesta pauta.' });
        }

        logger.info('✅ Voto encontrado:', { votoId: voto.id, voto: voto.voto });
        res.status(200).json({ voto });

    } catch (error) {
        logger.error('Erro crítico ao buscar voto em pauta:', {
            error: error.message,
            stack: error.stack,
            userId: user.id,
            pautaId: pauta_id
        });
        res.status(500).json({ error: 'Erro interno ao buscar voto.' });
    }
};

/**
 * Busca estatísticas de votos de uma pauta específica
 */
const getEstatisticasPauta = async (req, res) => {
    const { user } = req;
    const { pauta_id } = req.params;

    logger.info(`Buscando estatísticas da pauta ${pauta_id} para vereador ${user.id}`);

    try {
        // Buscar dados do vereador
        const { data: vereadorData, error: vereadorError } = await supabaseAdmin
            .from('vereadores')
            .select('id, camara_id')
            .eq('profile_id', user.id)
            .single();

        if (vereadorError || !vereadorData) {
            return res.status(404).json({ error: 'Dados do vereador não encontrados.' });
        }

        // Verificar se a pauta existe e pertence à mesma câmara
        const { data: pauta, error: pautaError } = await supabaseAdmin
            .from('pautas')
            .select(`
                id,
                nome,
                status,
                sessoes!inner (camara_id)
            `)
            .eq('id', pauta_id)
            .single();

        if (pautaError || !pauta) {
            return res.status(404).json({ error: 'Pauta não encontrada.' });
        }

        if (pauta.sessoes.camara_id !== vereadorData.camara_id) {
            return res.status(403).json({ error: 'Acesso negado - pauta de outra câmara.' });
        }

        // Buscar todos os votos da pauta
        const { data: votos, error: votosError } = await supabaseAdmin
            .from('votos')
            .select('voto')
            .eq('pauta_id', pauta_id);

        if (votosError) {
            logger.error('Erro ao buscar votos:', { error: votosError.message });
            return res.status(500).json({ error: 'Erro ao buscar votos.' });
        }

        // Calcular estatísticas
        const estatisticas = {
            total: votos.length,
            sim: votos.filter(v => v.voto === 'SIM').length,
            nao: votos.filter(v => v.voto === 'NÃO').length,
            abstencao: votos.filter(v => v.voto === 'ABSTENÇÃO').length
        };

        logger.info('✅ Estatísticas calculadas:', estatisticas);
        res.status(200).json({
            pauta: {
                id: pauta.id,
                nome: pauta.nome,
                status: pauta.status
            },
            estatisticas
        });

    } catch (error) {
        logger.error('Erro crítico ao buscar estatísticas:', {
            error: error.message,
            stack: error.stack,
            userId: user.id,
            pautaId: pauta_id
        });
        res.status(500).json({ error: 'Erro interno ao buscar estatísticas.' });
    }
};

module.exports = {
    registrarVoto,
    getVotosDoVereador,
    getVotoEmPauta,
    getEstatisticasPauta
};