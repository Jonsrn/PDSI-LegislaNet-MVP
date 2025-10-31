const { supabasePublic, supabaseAdmin } = require('../config/supabase');
const { validationResult } = require('express-validator');
const createLogger = require('../config/logger');
const logger = createLogger('TABLET_AUTH_CONTROLLER');

/**
 * Função auxiliar para decodificar o payload de um token JWT.
 * @param {string} token - O token JWT.
 * @returns {object|null} O payload decodificado ou null em caso de erro.
 */
const decodeJwtPayload = (token) => {
    try {
        const payloadBase64 = token.split('.')[1];
        const decodedJson = Buffer.from(payloadBase64, 'base64').toString();
        return JSON.parse(decodedJson);
    } catch (error) {
        logger.error('Erro ao decodificar o payload do JWT:', { error: error.message });
        return null;
    }
};

/**
 * Login específico para vereadores
 */
const handleVereadorLogin = async (req, res) => {
    logger.info('🔐 === INÍCIO DO PROCESSO DE LOGIN VEREADOR ===');

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        logger.error('❌ Erros de validação:', { errors: errors.array() });
        return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;
    logger.info('📧 Email recebido:', { email });

    try {
        logger.info('🚀 Tentando autenticar com Supabase...');
        const { data: authData, error: authError } = await supabasePublic.auth.signInWithPassword({
            email: email,
            password: password,
        });

        if (authError) {
            logger.error('❌ Erro de autenticação do Supabase:', { error: authError.message });
            return res.status(401).json({ error: 'Credenciais inválidas.' });
        }

        const user = authData.user;
        const session = authData.session;
        logger.info('✅ Usuário autenticado com sucesso!', { userId: user.id, email: user.email });

        // Atualizar timestamp de sessão
        const accessToken = session.access_token;
        const payload = decodeJwtPayload(accessToken);
        if (!payload || !payload.iat) {
            logger.error('Falha ao decodificar o payload do novo token ou encontrar o iat.');
            return res.status(500).json({ error: 'Falha ao processar o token da sessão.' });
        }

        const newIat = payload.iat;
        logger.info(`Atualizando min_token_iat para o usuário ${user.id} com o novo timestamp: ${newIat}`);

        const { error: updateError } = await supabaseAdmin
            .from('profiles')
            .update({ min_token_iat: newIat })
            .eq('id', user.id);

        if (updateError) {
            logger.error('Erro ao atualizar o timestamp do token:', { error: updateError.message });
            return res.status(500).json({ error: 'Falha ao iniciar a sessão de forma segura.' });
        }
        logger.info('✅ Timestamp do token atualizado com sucesso no perfil.');

        // Buscar perfil do usuário
        logger.info('🔍 Buscando perfil na tabela profiles...');
        const { data: profileData, error: profileError } = await supabaseAdmin
            .from('profiles')
            .select('role, nome, camara_id')
            .eq('id', user.id)
            .single();

        if (profileError || !profileData) {
            logger.error('❌ Perfil não encontrado para o usuário:', { userId: user.id, error: profileError?.message });
            return res.status(404).json({ error: 'Perfil de usuário não encontrado.' });
        }

        // Verificar se é vereador
        if (profileData.role !== 'vereador') {
            logger.error('❌ Acesso negado. Usuário não é vereador:', { role: profileData.role });
            return res.status(403).json({ error: 'Acesso restrito a vereadores.' });
        }

        logger.info('✅ Perfil encontrado:', profileData);
        logger.info('🏆 Login de vereador concluído com sucesso!');

        return res.status(200).json({
            message: 'Login bem-sucedido!',
            user: {
                id: user.id,
                email: user.email,
                nome: profileData.nome,
                role: profileData.role,
                camara_id: profileData.camara_id
            },
            token: accessToken
        });

    } catch (error) {
        logger.error('💥 ERRO INESPERADO NO CONTROLLER:', {
            error: error.message,
            stack: error.stack
        });
        return res.status(500).json({ error: 'Ocorreu um erro interno no servidor.' });
    }
};

/**
 * Logout para vereadores
 */
const handleVereadorLogout = async (req, res) => {
    logger.info('📤 === PROCESSO DE LOGOUT VEREADOR ===');

    try {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            logger.info('Token de logout recebido.');

            // Invalidar sessão no Supabase
            await supabasePublic.auth.signOut();
        }

        logger.info('✅ Logout realizado com sucesso.');
        res.status(200).json({ message: 'Logout realizado com sucesso.' });
    } catch (error) {
        logger.error('Erro no processo de logout:', {
            error: error.message,
            stack: error.stack
        });
        res.status(500).json({ error: 'Erro interno ao processar logout.' });
    }
};

module.exports = {
    handleVereadorLogin,
    handleVereadorLogout,
};