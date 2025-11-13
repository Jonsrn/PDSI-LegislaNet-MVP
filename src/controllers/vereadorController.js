const supabaseAdmin = require('../config/supabaseAdminClient');
const createLogger = require('../utils/logger');
const logger = createLogger('VEREADOR_CONTROLLER');

/**
 * Lista todos os vereadores de uma cÃ¢mara especÃ­fica.
 */
const getVereadoresByCamara = async (req, res) => {
    const { camaraId } = req.params;
    logger.log(`Buscando vereadores da cÃ¢mara ID: ${camaraId}`);

    try {
        const { data, error } = await supabaseAdmin
            .from('vereadores')
            .select(`
                id,
                profile_id,
                nome_parlamentar,
                foto_url,
                is_presidente,
                is_vice_presidente,
                is_active,
                partidos ( id, nome, sigla, logo_url )
            `)
            .eq('camara_id', camaraId)
            .order('nome_parlamentar', { ascending: true });

        if (error) throw error;
        res.status(200).json(data);
    } catch (error) {
        logger.error('Erro ao buscar vereadores.', error.message);
        res.status(500).json({ error: 'Erro ao buscar vereadores.' });
    }
};

/**
 * Cria um novo vereador (usuÃ¡rio, perfil e registro de vereador).
 */
const createVereador = async (req, res) => {
    const { camaraId } = req.params;
    const { nome_parlamentar, email, senha, partido_id, is_presidente, is_vice_presidente } = req.body;
    
    // Processar foto se foi enviada
    const foto_url = req.file ? req.file.url : null;
    
    logger.log(`Iniciando cadastro de novo vereador: ${email} para a cÃ¢mara ${camaraId}`);
    let createdAuthUserId = null;

    try {
        // ✅ VALIDAÇÃO CRÍTICA: Verificar conflitos de cargos APENAS quando estamos ATRIBUINDO cargos
        const cargosParaValidar = [];
        if (is_presidente === true) cargosParaValidar.push('presidente');
        if (is_vice_presidente === true) cargosParaValidar.push('vice_presidente');

        if (cargosParaValidar.length > 0) {
            logger.log(`🔍 VALIDANDO CONFLITOS DE CARGO NA CRIAÇÃO para: ${cargosParaValidar.join(', ')}`);
            
            // Query para verificar conflitos existentes
            const { data: conflitos, error: conflitosError } = await supabaseAdmin
                .from('vereadores')
                .select('id, nome_parlamentar, is_presidente, is_vice_presidente')
                .eq('camara_id', camaraId)
                .eq('is_active', true);

            if (conflitosError) {
                logger.error('Erro ao verificar conflitos de cargo:', conflitosError);
                return res.status(500).json({ error: 'Erro interno do servidor ao validar cargos' });
            }

            // Verificar conflitos específicos apenas para os cargos que estamos ATRIBUINDO
            if (is_presidente === true) {
                const conflitoPres = conflitos.find(v => v.is_presidente);
                if (conflitoPres) {
                    logger.error(`❌ CONFLITO DETECTADO: ${conflitoPres.nome_parlamentar} já é Presidente`);
                    return res.status(400).json({ 
                        error: `Conflito de cargo: O vereador "${conflitoPres.nome_parlamentar}" já ocupa o cargo de Presidente. Apenas um vereador pode ocupar este cargo por vez.` 
                    });
                }
            }
            
            if (is_vice_presidente === true) {
                const conflitoVice = conflitos.find(v => v.is_vice_presidente);
                if (conflitoVice) {
                    logger.error(`❌ CONFLITO DETECTADO: ${conflitoVice.nome_parlamentar} já é Vice-Presidente`);
                    return res.status(400).json({ 
                        error: `Conflito de cargo: O vereador "${conflitoVice.nome_parlamentar}" já ocupa o cargo de Vice-Presidente. Apenas um vereador pode ocupar este cargo por vez.` 
                    });
                }
            }

            logger.log(`✅ SEM CONFLITOS: Pode criar vereador com os cargos: ${cargosParaValidar.join(', ')}`);
        } else {
            logger.log(`ℹ️ NENHUM CARGO SENDO ATRIBUÍDO: Pulando validação de conflitos`);
        }
        // 1. Criar usuÃ¡rio no Auth
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password: senha,
            email_confirm: true,
        });
        if (authError) throw new Error(`Falha na criaÃ§Ã£o do Auth User: ${authError.message}`);
        createdAuthUserId = authData.user.id;
        logger.log(`UsuÃ¡rio de Auth criado: ${createdAuthUserId}`);

        // 2. Criar perfil
        const { error: profileError } = await supabaseAdmin.from('profiles').insert({
            id: createdAuthUserId,
            nome: nome_parlamentar,
            role: 'vereador',
            camara_id: camaraId,
        });
        if (profileError) throw new Error(`Falha na criaÃ§Ã£o do Perfil: ${profileError.message}`);
        logger.log(`Perfil criado para ${createdAuthUserId}`);

        // 3. Criar registro do vereador
        const { data: vereadorData, error: vereadorError } = await supabaseAdmin.from('vereadores').insert({
            profile_id: createdAuthUserId,
            camara_id: camaraId,
            nome_parlamentar,
            partido_id,
            foto_url,
            is_presidente,
            is_vice_presidente
        }).select().single();
        if (vereadorError) throw new Error(`Falha na criaÃ§Ã£o do registro de Vereador: ${vereadorError.message}`);
        logger.log(`Registro de vereador criado com ID: ${vereadorData.id}`);

        res.status(201).json({ message: 'Vereador criado com sucesso!', data: vereadorData });

    } catch (error) {
        logger.error('Erro CRÃTICO ao criar vereador.', error.message);
        if (createdAuthUserId) {
            await supabaseAdmin.auth.admin.deleteUser(createdAuthUserId);
            logger.warn(`ROLLBACK: UsuÃ¡rio de Auth ${createdAuthUserId} foi removido devido a erro no processo.`);
        }
        res.status(500).json({ error: 'Erro ao criar vereador.', details: error.message });
    }
};

/**
 * Atualiza os dados de um vereador e seu perfil correspondente.
 */
const updateVereador = async (req, res) => {
    const { id } = req.params; 
    const { nome_parlamentar, partido_id, is_presidente, is_vice_presidente, is_active, email, senha } = req.body;
    
    // Processar foto se foi enviada, senão manter a atual
    const foto_url = req.file ? req.file.url : undefined;
    
    logger.log(`=== INÍCIO UPDATE VEREADOR ID: ${id} ===`);
    logger.log(`Dados recebidos: nome_parlamentar=${nome_parlamentar}, email=${email ? 'FORNECIDO' : 'NÃO FORNECIDO'}, senha=${senha ? 'FORNECIDA' : 'NÃO FORNECIDA'}`);

    try {
        const { data: vereadorInfo, error: findError } = await supabaseAdmin
            .from('vereadores')
            .select('profile_id')
            .eq('id', id)
            .single();

        if (findError) throw new Error(`Vereador não encontrado: ${findError.message}`);
        
        logger.log(`Profile ID encontrado: ${vereadorInfo.profile_id}`);

        // Atualizar credenciais no Auth se fornecidas
        if (email || senha) {
            const authUpdateData = {};
            if (email) authUpdateData.email = email;
            if (senha) authUpdateData.password = senha;
            
            logger.log(`Tentando atualizar Auth com dados:`, JSON.stringify(authUpdateData, null, 2));
            
            try {
                const { data: authUpdateResult, error: authError } = await supabaseAdmin.auth.admin.updateUserById(
                    vereadorInfo.profile_id,
                    authUpdateData
                );
                
                if (authError) {
                    logger.error(`ERRO AUTH:`, authError);
                    throw new Error(`Falha ao atualizar credenciais: ${authError.message}`);
                }
                
                logger.log(`✅ AUTH ATUALIZADO COM SUCESSO:`, JSON.stringify(authUpdateResult, null, 2));
                
            } catch (authException) {
                logger.error(`EXCEÇÃO NA ATUALIZAÇÃO AUTH:`, authException);
                throw authException;
            }
        } else {
            logger.log(`❌ Nenhuma credencial fornecida para atualizar`);
        }

        // ✅ VALIDAÇÃO CRÍTICA: Verificar conflitos de cargos APENAS quando estamos ATRIBUINDO cargos
        const cargosParaValidar = [];
        if (is_presidente === true) cargosParaValidar.push('presidente');
        if (is_vice_presidente === true) cargosParaValidar.push('vice_presidente');

        if (cargosParaValidar.length > 0) {
            logger.log(`🔍 VALIDANDO CONFLITOS DE CARGO para: ${cargosParaValidar.join(', ')}`);
            
            // Buscar vereador atual para pegar sua câmara
            const { data: vereadorAtual, error: vereadorError } = await supabaseAdmin
                .from('vereadores')
                .select('camara_id')
                .eq('id', id)
                .single();
                
            if (vereadorError) throw new Error(`Erro ao buscar vereador atual: ${vereadorError.message}`);
            
            // Buscar todos os vereadores ativos na mesma câmara (exceto o atual)
            const { data: conflitos, error: conflictError } = await supabaseAdmin
                .from('vereadores')
                .select('id, nome_parlamentar, is_presidente, is_vice_presidente')
                .eq('camara_id', vereadorAtual.camara_id)
                .neq('id', id) // Excluir o vereador atual
                .eq('is_active', true);
            
            if (conflictError) throw new Error(`Erro ao verificar conflitos: ${conflictError.message}`);
            
            // Verificar conflitos específicos apenas para os cargos que estamos ATRIBUINDO
            if (is_presidente === true) {
                const conflitoPres = conflitos.find(v => v.is_presidente);
                if (conflitoPres) {
                    logger.error(`❌ CONFLITO DETECTADO: ${conflitoPres.nome_parlamentar} já é Presidente`);
                    return res.status(400).json({ 
                        error: `Conflito de cargo: O vereador "${conflitoPres.nome_parlamentar}" já ocupa o cargo de Presidente. Apenas um vereador pode ocupar este cargo por vez.` 
                    });
                }
            }
            
            if (is_vice_presidente === true) {
                const conflitoVice = conflitos.find(v => v.is_vice_presidente);
                if (conflitoVice) {
                    logger.error(`❌ CONFLITO DETECTADO: ${conflitoVice.nome_parlamentar} já é Vice-Presidente`);
                    return res.status(400).json({ 
                        error: `Conflito de cargo: O vereador "${conflitoVice.nome_parlamentar}" já ocupa o cargo de Vice-Presidente. Apenas um vereador pode ocupar este cargo por vez.` 
                    });
                }
            }
            
            logger.log(`✅ SEM CONFLITOS: Pode atualizar vereador com os cargos: ${cargosParaValidar.join(', ')}`);
        } else {
            logger.log(`ℹ️ NENHUM CARGO SENDO ATRIBUÍDO: Pulando validação de conflitos`);
        }

        // Construir objeto de update dinamicamente
        const updateData = { nome_parlamentar, partido_id, is_presidente, is_vice_presidente, is_active };
        if (foto_url !== undefined) {
            updateData.foto_url = foto_url;
        }

        const { data, error } = await supabaseAdmin
            .from('vereadores')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        if (nome_parlamentar) {
            const { error: profileError } = await supabaseAdmin
                .from('profiles')
                .update({ nome: nome_parlamentar })
                .eq('id', vereadorInfo.profile_id);
            
            if (profileError) logger.error(`Aviso: Falha ao atualizar nome no perfil:`, profileError);
        }

        logger.log(`=== SUCESSO UPDATE VEREADOR ${id} ===`);
        res.status(200).json(data);
        
    } catch (error) {
        logger.error(`=== ERRO CRÍTICO UPDATE VEREADOR ${id} ===`, error.message);
        res.status(500).json({ error: 'Erro ao atualizar vereador.', details: error.message });
    }
};

/**
 * Deleta um vereador (registro, perfil e usuÃ¡rio de auth).
 */
const deleteVereador = async (req, res) => {
    const { id } = req.params; // ID da tabela 'vereadores'
    logger.log(`Iniciando remoÃ§Ã£o do vereador ID: ${id}`);

    try {
        const { data: vereador, error: findError } = await supabaseAdmin
            .from('vereadores')
            .select('profile_id')
            .eq('id', id)
            .single();

        if (findError || !vereador) {
            return res.status(404).json({ error: 'Vereador nÃ£o encontrado para remoÃ§Ã£o.' });
        }
        const { profile_id } = vereador;

        const { error: vereadorError } = await supabaseAdmin.from('vereadores').delete().eq('id', id);
        if (vereadorError) throw new Error(`Falha ao remover da tabela vereadores: ${vereadorError.message}`);
        logger.log(`Registro do vereador ${id} removido.`);

        const { error: profileError } = await supabaseAdmin.from('profiles').delete().eq('id', profile_id);
        if (profileError) throw new Error(`Falha ao remover da tabela profiles: ${profileError.message}`);
        logger.log(`Perfil ${profile_id} removido.`);

        const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(profile_id);
        if (authError) throw new Error(`Falha ao remover usuÃ¡rio do Auth: ${authError.message}`);
        logger.log(`UsuÃ¡rio de Auth ${profile_id} removido.`);

        res.status(204).send();
    } catch (error) {
        logger.error(`Erro na remoÃ§Ã£o em cascata do vereador ${id}.`, error.message);
        res.status(500).json({ error: 'Erro ao remover vereador.', details: error.message });
    }
};

/**
 * Lista vereadores ativos da câmara do usuário logado.
 */
const getVereadoresAtivos = async (req, res) => {
    try {
        const { profile } = req;
        logger.log(`Buscando vereadores ativos da câmara ID: ${profile.camara_id}`);

        const { data, error } = await supabaseAdmin
            .from('vereadores')
            .select(`
                id,
                nome_parlamentar,
                foto_url,
                partidos ( id, nome, sigla, logo_url )
            `)
            .eq('camara_id', profile.camara_id)
            .eq('is_active', true)
            .order('nome_parlamentar', { ascending: true });

        if (error) throw error;
        
        logger.log(`Encontrados ${data.length} vereadores ativos.`);
        res.status(200).json({ data });
    } catch (error) {
        logger.error('Erro ao buscar vereadores ativos.', error.message);
        res.status(500).json({ error: 'Erro ao buscar vereadores ativos.' });
    }
};

/**
 * Lista todos os vereadores da própria câmara (para usuários não super admin).
 */
const getVereadoresDaPropriaCamara = async (req, res) => {
    try {
        const { profile } = req;
        logger.log(`Buscando vereadores da própria câmara ID: ${profile.camara_id}`);

        const { data, error } = await supabaseAdmin
            .from('vereadores')
            .select(`
                id,
                profile_id,
                nome_parlamentar,
                foto_url,
                is_presidente,
                is_vice_presidente,
                is_active,
                partidos ( id, nome, sigla, logo_url )
            `)
            .eq('camara_id', profile.camara_id)
            .order('nome_parlamentar', { ascending: true });

        if (error) throw error;
        res.status(200).json(data);
    } catch (error) {
        logger.error('Erro ao buscar vereadores da própria câmara.', error.message);
        res.status(500).json({ error: 'Erro ao buscar vereadores da própria câmara.' });
    }
};

/**
 * Cria um novo vereador na própria câmara.
 */
const createVereadorNaPropriaCamara = async (req, res) => {
    const { profile } = req;
    const { nome_parlamentar, email, senha, partido_id, is_presidente, is_vice_presidente } = req.body;

    // Validação de campos obrigatórios
    if (!nome_parlamentar || !email || !senha || !partido_id) {
        logger.error('Campos obrigatórios faltando na requisição');
        return res.status(400).json({
            error: 'Campos obrigatórios faltando',
            required: ['nome_parlamentar', 'email', 'senha', 'partido_id']
        });
    }

    // Processar foto se foi enviada
    const foto_url = req.file ? req.file.url : null;

    logger.log(`Iniciando cadastro de novo vereador: ${email} para a câmara ${profile.camara_id}`);
    let createdAuthUserId = null;

    try {
        // 1. Criar usuário no Auth
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password: senha,
            email_confirm: true,
        });
        if (authError) throw new Error(`Falha na criação do Auth User: ${authError.message}`);
        createdAuthUserId = authData.user.id;
        logger.log(`Usuário de Auth criado: ${createdAuthUserId}`);

        // 2. Criar perfil
        const { error: profileError } = await supabaseAdmin.from('profiles').insert({
            id: createdAuthUserId,
            nome: nome_parlamentar,
            role: 'vereador',
            camara_id: profile.camara_id,
        });
        if (profileError) throw new Error(`Falha na criação do Perfil: ${profileError.message}`);
        logger.log(`Perfil criado para ${createdAuthUserId}`);

        // 3. Criar registro do vereador
        const { data: vereadorData, error: vereadorError } = await supabaseAdmin.from('vereadores').insert({
            profile_id: createdAuthUserId,
            camara_id: profile.camara_id,
            nome_parlamentar,
            partido_id,
            foto_url,
            is_presidente,
            is_vice_presidente
        }).select().single();
        if (vereadorError) throw new Error(`Falha na criação do registro de Vereador: ${vereadorError.message}`);
        logger.log(`Registro de vereador criado com ID: ${vereadorData.id}`);

        res.status(201).json({ message: 'Vereador criado com sucesso!', data: vereadorData });

    } catch (error) {
        logger.error('Erro CRÍTICO ao criar vereador na própria câmara.', error.message);
        if (createdAuthUserId) {
            await supabaseAdmin.auth.admin.deleteUser(createdAuthUserId);
            logger.warn(`ROLLBACK: Usuário de Auth ${createdAuthUserId} foi removido devido a erro no processo.`);
        }
        res.status(500).json({ error: 'Erro ao criar vereador na própria câmara.', details: error.message });
    }
};

/**
 * Atualiza um vereador da própria câmara.
 */
const updateVereadorDaPropriaCamara = async (req, res) => {
    const { id } = req.params;
    const { profile } = req;
    const { nome_parlamentar, partido_id, is_presidente, is_vice_presidente, is_active, email, senha } = req.body;
    
    // Processar foto se foi enviada, senão manter a atual
    const foto_url = req.file ? req.file.url : undefined;
    
    logger.log(`=== INÍCIO UPDATE VEREADOR DA PRÓPRIA CÂMARA ID: ${id} ===`);

    try {
        // Verificar se o vereador pertence à mesma câmara do usuário
        const { data: vereadorInfo, error: findError } = await supabaseAdmin
            .from('vereadores')
            .select('profile_id, camara_id')
            .eq('id', id)
            .single();

        if (findError) throw new Error(`Vereador não encontrado: ${findError.message}`);
        
        if (vereadorInfo.camara_id !== profile.camara_id) {
            return res.status(403).json({ error: 'Você não tem permissão para alterar este vereador.' });
        }

        // Atualizar credenciais no Auth se fornecidas
        if (email || senha) {
            const authUpdateData = {};
            if (email) authUpdateData.email = email;
            if (senha) authUpdateData.password = senha;
            
            const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
                vereadorInfo.profile_id,
                authUpdateData
            );
            
            if (authError) {
                throw new Error(`Falha ao atualizar credenciais: ${authError.message}`);
            }
        }

        // ✅ VALIDAÇÃO CRÍTICA: Verificar conflitos de cargos APENAS quando estamos ATRIBUINDO cargos
        const cargosParaValidar = [];
        if (is_presidente === true) cargosParaValidar.push('presidente');
        if (is_vice_presidente === true) cargosParaValidar.push('vice_presidente');

        if (cargosParaValidar.length > 0) {
            logger.log(`🔍 VALIDANDO CONFLITOS DE CARGO NA PRÓPRIA CÂMARA para: ${cargosParaValidar.join(', ')}`);
            
            // Query para verificar conflitos existentes (excluindo o próprio vereador)
            const { data: conflitos, error: conflitosError } = await supabaseAdmin
                .from('vereadores')
                .select('id, nome_parlamentar, is_presidente, is_vice_presidente')
                .eq('camara_id', profile.camara_id)
                .neq('id', id) // Excluir o próprio vereador
                .eq('is_active', true);

            if (conflitosError) {
                logger.error('Erro ao verificar conflitos de cargo:', conflitosError);
                return res.status(500).json({ error: 'Erro interno do servidor ao validar cargos' });
            }

            // Verificar conflitos específicos apenas para os cargos que estamos ATRIBUINDO
            if (is_presidente === true) {
                const conflitoPres = conflitos.find(v => v.is_presidente);
                if (conflitoPres) {
                    logger.error(`❌ CONFLITO DETECTADO: ${conflitoPres.nome_parlamentar} já é Presidente`);
                    return res.status(400).json({ 
                        error: `Conflito de cargo: O vereador "${conflitoPres.nome_parlamentar}" já ocupa o cargo de Presidente. Apenas um vereador pode ocupar este cargo por vez.` 
                    });
                }
            }
            
            if (is_vice_presidente === true) {
                const conflitoVice = conflitos.find(v => v.is_vice_presidente);
                if (conflitoVice) {
                    logger.error(`❌ CONFLITO DETECTADO: ${conflitoVice.nome_parlamentar} já é Vice-Presidente`);
                    return res.status(400).json({ 
                        error: `Conflito de cargo: O vereador "${conflitoVice.nome_parlamentar}" já ocupa o cargo de Vice-Presidente. Apenas um vereador pode ocupar este cargo por vez.` 
                    });
                }
            }

            logger.log(`✅ SEM CONFLITOS: Pode atualizar vereador com os cargos: ${cargosParaValidar.join(', ')}`);
        } else {
            logger.log(`ℹ️ NENHUM CARGO SENDO ATRIBUÍDO: Pulando validação de conflitos`);
        }

        // Construir objeto de update dinamicamente
        const updateData = { nome_parlamentar, partido_id, is_presidente, is_vice_presidente, is_active };
        if (foto_url !== undefined) {
            updateData.foto_url = foto_url;
        }

        const { data, error } = await supabaseAdmin
            .from('vereadores')
            .update(updateData)
            .eq('id', id)
            .eq('camara_id', profile.camara_id) // Garantir que só atualiza da própria câmara
            .select()
            .single();

        if (error) throw error;

        if (nome_parlamentar) {
            const { error: profileError } = await supabaseAdmin
                .from('profiles')
                .update({ nome: nome_parlamentar })
                .eq('id', vereadorInfo.profile_id);
            
            if (profileError) logger.error(`Aviso: Falha ao atualizar nome no perfil:`, profileError);
        }

        logger.log(`=== SUCESSO UPDATE VEREADOR DA PRÓPRIA CÂMARA ${id} ===`);
        res.status(200).json(data);
        
    } catch (error) {
        logger.error(`=== ERRO CRÍTICO UPDATE VEREADOR DA PRÓPRIA CÂMARA ${id} ===`, error.message);
        res.status(500).json({ error: 'Erro ao atualizar vereador da própria câmara.', details: error.message });
    }
};

/**
 * Remove um vereador da própria câmara.
 */
const deleteVereadorDaPropriaCamara = async (req, res) => {
    const { id } = req.params;
    const { profile } = req;
    logger.log(`Iniciando remoção do vereador da própria câmara ID: ${id}`);

    try {
        const { data: vereador, error: findError } = await supabaseAdmin
            .from('vereadores')
            .select('profile_id, camara_id')
            .eq('id', id)
            .single();

        if (findError || !vereador) {
            return res.status(404).json({ error: 'Vereador não encontrado para remoção.' });
        }

        if (vereador.camara_id !== profile.camara_id) {
            return res.status(403).json({ error: 'Você não tem permissão para remover este vereador.' });
        }

        const { profile_id } = vereador;

        const { error: vereadorError } = await supabaseAdmin.from('vereadores').delete().eq('id', id);
        if (vereadorError) throw new Error(`Falha ao remover da tabela vereadores: ${vereadorError.message}`);
        logger.log(`Registro do vereador ${id} removido.`);

        const { error: profileError } = await supabaseAdmin.from('profiles').delete().eq('id', profile_id);
        if (profileError) throw new Error(`Falha ao remover da tabela profiles: ${profileError.message}`);
        logger.log(`Perfil ${profile_id} removido.`);

        const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(profile_id);
        if (authError) throw new Error(`Falha ao remover usuário do Auth: ${authError.message}`);
        logger.log(`Usuário de Auth ${profile_id} removido.`);

        res.status(204).send();
    } catch (error) {
        logger.error(`Erro na remoção em cascata do vereador da própria câmara ${id}.`, error.message);
        res.status(500).json({ error: 'Erro ao remover vereador da própria câmara.', details: error.message });
    }
};

module.exports = {
    getVereadoresByCamara,
    createVereador,
    updateVereador,
    deleteVereador, // Apenas super admin
    getVereadoresAtivos,
    getVereadoresDaPropriaCamara,
    createVereadorNaPropriaCamara,
    updateVereadorDaPropriaCamara
    // deleteVereadorDaPropriaCamara - REMOVIDO POR SEGURANÇA
};