const { createClient } = require('@supabase/supabase-js');
const createLogger = require('../utils/logger');
const logger = createLogger('PARTIDO_CONTROLLER');

const getAllPartidos = async (req, res) => {
    // Captura os parâmetros da URL
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 1000; // Limite alto para o select
    const searchTerm = req.query.search || ''; // Captura o termo de busca
    const offset = (page - 1) * limit;

    logger.log(`Buscando partidos... Página: ${page}, Limite: ${limit}, Busca: "${searchTerm}"`);
    
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ error: 'Token de autenticação ausente.' });
        }

        const supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_ANON_KEY,
            { global: { headers: { Authorization: `Bearer ${token}` } } }
        );

        // Constrói a query base
        let query = supabase
            .from('partidos')
            .select('id, nome, sigla, logo_url', { count: 'exact' });

        // APLICA O FILTRO DE BUSCA SE EXISTIR
        if (searchTerm) {
            query = query.or(`nome.ilike.%${searchTerm}%,sigla.ilike.%${searchTerm}%`);
        }

        // Aplica ordenação e paginação
        const { data, error, count } = await query
            .order('nome', { ascending: true })
            .range(offset, offset + limit - 1);

        if (error) throw error;
        
        logger.log(`Encontrados ${data.length} partidos de um total de ${count}.`);
        
        res.status(200).json({ data, count });

    } catch (error) {
        logger.error('Erro ao buscar partidos.', error.message);
        res.status(500).json({ error: 'Erro ao buscar partidos.' });
    }
};

module.exports = { getAllPartidos };