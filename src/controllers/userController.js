const supabaseAdmin = require('../config/supabaseAdminClient');
const createLogger = require('../utils/logger');
const logger = createLogger('USER_CONTROLLER');

const getUsersByCamara = async (req, res) => {
    const { camaraId } = req.params;
    logger.log(`Buscando usuários da câmara ID: ${camaraId}`);

    try {
        const { data: profiles, error: profileError } = await supabaseAdmin
            .from('profiles')
            .select('id, nome, role')
            .eq('camara_id', camaraId);
        if (profileError) throw profileError;

        const { data: vereadores, error: vereadorError } = await supabaseAdmin
            .from('vereadores')
            .select('id, profile_id, foto_url, is_active')
            .eq('camara_id', camaraId);
        if(vereadorError) throw vereadorError;

        const { data: { users }, error: usersError } = await supabaseAdmin.auth.admin.listUsers();
        if (usersError) throw usersError;

        const usersMap = new Map(users.map(u => [u.id, u]));
        const vereadoresMap = new Map(vereadores.map(v => [v.profile_id, v]));

        const responseData = profiles.map(p => {
            const authUser = usersMap.get(p.id);
            const vereadorData = vereadoresMap.get(p.id);
            const isAdmin = p.role === 'admin_camara';

            return {
                profile_id: p.id,
                vereador_id: vereadorData ? vereadorData.id : null,
                nome: p.nome,
                role: p.role,
                email: authUser ? authUser.email : 'Email não encontrado',
                foto_url: vereadorData ? vereadorData.foto_url : null,
                is_active: isAdmin ? true : (vereadorData ? vereadorData.is_active : false)
            };
        });

        res.status(200).json(responseData);
    } catch (error) {
        logger.error('Erro ao buscar usuários.', error.message);
        res.status(500).json({ error: 'Erro ao buscar usuários da câmara.' });
    }
};

const updateUser = async (req, res) => {
    const { id } = req.params;
    const { password } = req.body;

    if (!password) {
        return res.status(400).json({ error: 'A nova senha é obrigatória.' });
    }

    try {
        const { data, error } = await supabaseAdmin.auth.admin.updateUserById(id, {
            password: password
        });
        if (error) throw error;
        
        logger.log(`Senha do usuário ${id} foi atualizada.`);
        res.status(200).json({ message: 'Senha do usuário atualizada com sucesso.' });
    } catch (error) {
        logger.error('Erro ao atualizar senha do usuário.', error.message);
        res.status(500).json({ error: 'Erro ao atualizar senha do usuário.' });
    }
};

module.exports = {
    getUsersByCamara,
    updateUser
};