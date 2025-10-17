// src/services/adminService.js

const supabaseAdmin = require('../config/supabaseAdminClient');
const createLogger = require('../utils/logger');
const auditLogger = require('../utils/auditLogger');
const logger = createLogger('ADMIN_SERVICE');

class AdminService {
    /**
     * Verifica se um partido já existe
     */
    async checkPartidoExists(nome, sigla) {
        try {
            const { data, error } = await supabaseAdmin
                .from('partidos')
                .select('id, nome, sigla')
                .or(`nome.ilike.${nome},sigla.ilike.${sigla}`)
                .limit(1);

            if (error) {
                logger.error('Error checking partido existence:', error.message);
                throw new Error('Erro ao verificar existência do partido');
            }

            return {
                exists: data.length > 0,
                existing: data[0] || null
            };
        } catch (error) {
            logger.error('Service error in checkPartidoExists:', error.message);
            throw error;
        }
    }

    /**
     * Cria um novo partido com validações
     */
    async createPartido(partidoData, user, logoFile = null) {
        const { nome, sigla } = partidoData;
        
        try {
            // Verifica duplicação
            const existsCheck = await this.checkPartidoExists(nome, sigla);
            if (existsCheck.exists) {
                const existing = existsCheck.existing;
                const duplicateField = existing.nome.toLowerCase() === nome.toLowerCase() ? 'nome' : 'sigla';
                throw new Error(`Partido com ${duplicateField} "${existing[duplicateField]}" já existe`);
            }

            let logo_url = null;
            
            // Upload da logo se fornecida
            if (logoFile) {
                const timestamp = Date.now();
                const fileExtension = logoFile.originalname.split('.').pop();
                const fileName = `${sigla.toLowerCase()}-${timestamp}.${fileExtension}`;
                const filePath = `public/logos-partidos/${fileName}`;
                
                const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
                    .from('logos-partidos')
                    .upload(filePath, logoFile.buffer, { 
                        contentType: logoFile.mimetype,
                        upsert: false 
                    });

                if (uploadError) {
                    logger.error('Logo upload failed:', uploadError.message);
                    throw new Error('Falha no upload da logo do partido');
                }
                
                const { data: urlData } = supabaseAdmin.storage
                    .from('logos-partidos')
                    .getPublicUrl(uploadData.path);
                    
                logo_url = urlData.publicUrl;
            }

            // Cria o partido
            const { data: newPartido, error: createError } = await supabaseAdmin
                .from('partidos')
                .insert([{ 
                    nome: nome.trim(), 
                    sigla: sigla.trim().toUpperCase(), 
                    logo_url 
                }])
                .select()
                .single();

            if (createError) {
                logger.error('Error creating partido:', createError.message);
                
                // Remove logo se o partido não foi criado
                if (logo_url) {
                    await supabaseAdmin.storage
                        .from('logos-partidos')
                        .remove([filePath]);
                }
                
                throw new Error('Erro ao criar partido no banco de dados');
            }

            // Log de auditoria
            await auditLogger.logAdminOperation('CREATE_PARTIDO', user, {
                partidoId: newPartido.id,
                nome,
                sigla,
                hasLogo: !!logo_url
            });

            logger.log('Partido created successfully:', {
                id: newPartido.id,
                nome,
                sigla
            });

            return newPartido;
            
        } catch (error) {
            logger.error('Service error in createPartido:', error.message);
            throw error;
        }
    }

    /**
     * Atualiza um partido existente
     */
    async updatePartido(partidoId, updateData, user, newLogoFile = null) {
        const { nome, sigla } = updateData;
        
        try {
            // Busca partido atual
            const { data: currentPartido, error: fetchError } = await supabaseAdmin
                .from('partidos')
                .select('*')
                .eq('id', partidoId)
                .single();

            if (fetchError || !currentPartido) {
                throw new Error('Partido não encontrado');
            }

            // Verifica duplicação (excluindo o próprio partido)
            const { data: duplicates, error: dupError } = await supabaseAdmin
                .from('partidos')
                .select('id, nome, sigla')
                .neq('id', partidoId)
                .or(`nome.ilike.${nome},sigla.ilike.${sigla}`);

            if (dupError) {
                logger.error('Error checking duplicates:', dupError.message);
                throw new Error('Erro ao verificar duplicações');
            }

            if (duplicates && duplicates.length > 0) {
                const duplicate = duplicates[0];
                const duplicateField = duplicate.nome.toLowerCase() === nome.toLowerCase() ? 'nome' : 'sigla';
                throw new Error(`Partido com ${duplicateField} "${duplicate[duplicateField]}" já existe`);
            }

            let logo_url = currentPartido.logo_url;

            // Handle logo update
            if (newLogoFile) {
                const timestamp = Date.now();
                const fileExtension = newLogoFile.originalname.split('.').pop();
                const fileName = `${sigla.toLowerCase()}-${timestamp}.${fileExtension}`;
                const newFilePath = `public/logos-partidos/${fileName}`;
                
                const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
                    .from('logos-partidos')
                    .upload(newFilePath, newLogoFile.buffer, { 
                        contentType: newLogoFile.mimetype 
                    });

                if (uploadError) {
                    logger.error('New logo upload failed:', uploadError.message);
                    throw new Error('Falha no upload da nova logo');
                }
                
                const { data: urlData } = supabaseAdmin.storage
                    .from('logos-partidos')
                    .getPublicUrl(uploadData.path);
                    
                logo_url = urlData.publicUrl;

                // Remove logo antiga
                if (currentPartido.logo_url) {
                    try {
                        const oldFileName = currentPartido.logo_url.split('/logos-partidos/').pop();
                        if (oldFileName) {
                            await supabaseAdmin.storage
                                .from('logos-partidos')
                                .remove([oldFileName]);
                        }
                    } catch (removeError) {
                        logger.warn('Failed to remove old logo:', removeError.message);
                    }
                }
            }

            // Atualiza o partido
            const { data: updatedPartido, error: updateError } = await supabaseAdmin
                .from('partidos')
                .update({ 
                    nome: nome.trim(), 
                    sigla: sigla.trim().toUpperCase(), 
                    logo_url 
                })
                .eq('id', partidoId)
                .select()
                .single();

            if (updateError) {
                logger.error('Error updating partido:', updateError.message);
                throw new Error('Erro ao atualizar partido');
            }

            // Log de auditoria
            await auditLogger.logDataOperation('UPDATE', 'partidos', partidoId, user, {
                oldData: { nome: currentPartido.nome, sigla: currentPartido.sigla },
                newData: { nome, sigla },
                logoUpdated: !!newLogoFile
            });

            logger.log('Partido updated successfully:', {
                id: partidoId,
                nome,
                sigla
            });

            return updatedPartido;
            
        } catch (error) {
            logger.error('Service error in updatePartido:', error.message);
            throw error;
        }
    }

    /**
     * Deleta um partido com verificações
     */
    async deletePartido(partidoId, user) {
        try {
            // Verifica se partido existe
            const { data: partido, error: fetchError } = await supabaseAdmin
                .from('partidos')
                .select('*')
                .eq('id', partidoId)
                .single();

            if (fetchError || !partido) {
                throw new Error('Partido não encontrado');
            }

            // Verifica se partido está em uso
            const { data: vereadores, error: vereadorError } = await supabaseAdmin
                .from('vereadores')
                .select('id')
                .eq('partido_id', partidoId)
                .limit(1);

            if (vereadorError) {
                logger.error('Error checking partido usage:', vereadorError.message);
                throw new Error('Erro ao verificar uso do partido');
            }

            if (vereadores && vereadores.length > 0) {
                throw new Error('Não é possível excluir partido que possui vereadores associados');
            }

            // Remove logo do storage
            if (partido.logo_url) {
                try {
                    const fileName = partido.logo_url.split('/logos-partidos/').pop();
                    if (fileName) {
                        await supabaseAdmin.storage
                            .from('logos-partidos')
                            .remove([fileName]);
                    }
                } catch (removeError) {
                    logger.warn('Failed to remove logo during deletion:', removeError.message);
                }
            }

            // Deleta o partido
            const { error: deleteError } = await supabaseAdmin
                .from('partidos')
                .delete()
                .eq('id', partidoId);

            if (deleteError) {
                logger.error('Error deleting partido:', deleteError.message);
                throw new Error('Erro ao deletar partido');
            }

            // Log de auditoria
            await auditLogger.logDataOperation('DELETE', 'partidos', partidoId, user, {
                deletedData: { nome: partido.nome, sigla: partido.sigla }
            });

            logger.log('Partido deleted successfully:', {
                id: partidoId,
                nome: partido.nome,
                sigla: partido.sigla
            });

            return { success: true, deleted: partido };
            
        } catch (error) {
            logger.error('Service error in deletePartido:', error.message);
            throw error;
        }
    }

    /**
     * Lista câmaras com paginação e filtros
     */
    async getCamarasWithPagination(options = {}) {
        const {
            page = 1,
            limit = 10,
            search = '',
            status = 'all' // 'active', 'inactive', 'all'
        } = options;

        const offset = (page - 1) * limit;

        try {
            let query = supabaseAdmin
                .from('camaras')
                .select(`
                    id,
                    nome_camara,
                    municipio,
                    estado,
                    is_active,
                    created_at,
                    brasao_url
                `, { count: 'exact' });

            // Filtro por status
            if (status !== 'all') {
                query = query.eq('is_active', status === 'active');
            }

            // Filtro de busca
            if (search && search.trim()) {
                const searchTerm = search.trim();
                query = query.or(`municipio.ilike.%${searchTerm}%,nome_camara.ilike.%${searchTerm}%,estado.ilike.%${searchTerm}%`);
            }

            // Paginação e ordenação
            query = query
                .order('created_at', { ascending: false })
                .range(offset, offset + limit - 1);

            const { data: camaras, error, count } = await query;

            if (error) {
                logger.error('Error fetching camaras:', error.message);
                throw new Error('Erro ao buscar câmaras');
            }

            const totalPages = Math.ceil(count / limit);

            return {
                data: camaras || [],
                pagination: {
                    page,
                    limit,
                    totalItems: count,
                    totalPages,
                    hasNext: page < totalPages,
                    hasPrev: page > 1
                }
            };
            
        } catch (error) {
            logger.error('Service error in getCamarasWithPagination:', error.message);
            throw error;
        }
    }

    /**
     * Verifica se email já existe no sistema
     */
    async checkEmailExists(email) {
        try {
            const { data, error } = await supabaseAdmin.auth.admin.listUsers();
            
            if (error) {
                logger.error('Error checking email existence:', error.message);
                throw new Error('Erro ao verificar email');
            }

            const emailExists = data.users.some(user => 
                user.email && user.email.toLowerCase() === email.toLowerCase()
            );

            return { exists: emailExists };
            
        } catch (error) {
            logger.error('Service error in checkEmailExists:', error.message);
            throw error;
        }
    }
}

module.exports = new AdminService();