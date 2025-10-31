const { supabaseAdmin } = require('../config/supabase');
const createLogger = require('../config/logger');
const logger = createLogger('TABLET_AUTH_MIDDLEWARE');

/**
 * Decodifica o payload de um token JWT.
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
 * Middleware de autenticação específico para vereadores
 */
const authenticateVereador = async (req, res, next) => {
    logger.info('--- INICIANDO VERIFICAÇÃO DE AUTENTICAÇÃO VEREADOR ---');

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        logger.error('FALHA: Cabeçalho Authorization ausente ou mal formatado.');
        return res.status(401).json({ error: 'Token de acesso ausente ou mal formatado.' });
    }

    const token = authHeader.split(' ')[1];
    logger.info(`Token extraído: ${token.substring(0, 20)}...`);

    try {
        // Verificar token no Supabase
        const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
        if (userError || !user) {
            logger.error('FALHA: Token inválido ou expirado.', { error: userError?.message });
            return res.status(401).json({ error: 'Token inválido ou expirado.' });
        }
        logger.info(`Usuário ${user.id} (${user.email}) autenticado com sucesso.`);

        // Buscar perfil do usuário
        const { data: profile, error: profileError } = await supabaseAdmin
            .from('profiles')
            .select('role, camara_id, min_token_iat, nome')
            .eq('id', user.id)
            .single();

        if (profileError || !profile) {
            logger.error(`FALHA: Perfil não encontrado para o usuário ${user.id}.`, { error: profileError?.message });
            return res.status(404).json({ error: 'Perfil de usuário não encontrado.' });
        }
        logger.info(`Perfil encontrado. Role: '${profile.role}'. IAT Mínimo: ${profile.min_token_iat}`);

        // Verificar se é vereador
        if (profile.role !== 'vereador') {
            logger.error(`FALHA: Acesso negado. Role '${profile.role}' não permitida. Apenas vereadores podem acessar.`);
            return res.status(403).json({ error: 'Acesso negado. Apenas vereadores podem acessar esta aplicação.' });
        }

        // Verificar sessão única (IAT)
        const tokenPayload = decodeJwtPayload(token);
        const iatDoToken = tokenPayload ? tokenPayload.iat : null;
        const iatMinimoDoPerfil = profile.min_token_iat;
        logger.info(`Comparando IATs. Token IAT: ${iatDoToken}, Perfil IAT Mínimo: ${iatMinimoDoPerfil}`);

        if (!tokenPayload || tokenPayload.iat < profile.min_token_iat) {
            logger.warn(`FALHA: Token antigo detectado (sessão invalidada por novo login). IAT do token: ${tokenPayload?.iat}, IAT mínimo exigido: ${profile.min_token_iat}`);
            return res.status(401).json({ error: 'Sessão expirada. Por favor, faça login novamente.' });
        }
        logger.info('SUCESSO: Timestamp (iat) do token é válido.');

        // Adicionar dados do usuário e perfil à requisição
        req.user = user;
        req.profile = profile;

        logger.info(`✅ ACESSO AUTORIZADO para vereador ${profile.nome} da câmara ${profile.camara_id}`);
        next();

    } catch (error) {
        logger.error('ERRO CRÍTICO na verificação de autenticação.', {
            error: error.message,
            stack: error.stack
        });
        return res.status(500).json({ error: 'Erro interno no servidor durante a autenticação.' });
    }
};

module.exports = {
    authenticateVereador
};