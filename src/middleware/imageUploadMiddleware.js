const multer = require('multer');
const path = require('path');
const supabaseAdmin = require('../config/supabaseAdminClient');
const createLogger = require('../utils/logger');

const logger = createLogger('IMAGE_UPLOAD_MIDDLEWARE');

// Mapeamento de tipos para buckets do Supabase
const getBucketName = (type, fieldname) => {
    // Para múltiplos arquivos, determinar bucket baseado no fieldname
    if (type === 'multiple') {
        if (fieldname === 'brasao') return 'brasoes-camara';
        if (fieldname === 'vereador_fotos') return 'fotos-vereadores';
        return 'fotos-vereadores'; // default
    }
    
    // Para arquivos únicos
    switch (type) {
        case 'vereador': return 'fotos-vereadores';
        case 'partido': return 'logos-partidos';
        case 'camara': return 'brasoes-camara';
        default: return 'fotos-vereadores';
    }
};

// Função para upload no Supabase Storage
const uploadToSupabase = async (file, type) => {
    const bucketName = getBucketName(type, file.fieldname);
    
    // Gerar nome único para o arquivo
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    let prefix;
    
    // Determinar prefixo baseado no tipo
    if (type === 'multiple') {
        if (file.fieldname === 'brasao') {
            prefix = 'camara';
        } else if (file.fieldname === 'vereador_fotos') {
            prefix = 'vereador';
        } else {
            prefix = 'file';
        }
    } else {
        switch (type) {
            case 'vereador': prefix = 'vereador'; break;
            case 'partido': prefix = 'partido'; break;
            case 'camara': prefix = 'camara'; break;
            default: prefix = 'image';
        }
    }
    
    const filename = `${prefix}-${uniqueSuffix}${path.extname(file.originalname)}`;
    const filePath = `public/${filename}`;
    
    logger.log(`📤 Uploading para Supabase Storage - Bucket: ${bucketName}, Arquivo: ${filename}`);
    
    // Upload para Supabase Storage
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
        .from(bucketName)
        .upload(filePath, file.buffer, { 
            contentType: file.mimetype,
            upsert: false 
        });

    if (uploadError) {
        logger.error('❌ Erro no upload Supabase:', uploadError.message);
        throw new Error(`Falha no upload: ${uploadError.message}`);
    }

    // Gerar URL pública
    const publicUrl = supabaseAdmin.storage.from(bucketName).getPublicUrl(uploadData.path).data.publicUrl;
    
    logger.log(`✅ Upload concluído - URL: ${publicUrl}`);
    
    return {
        filename: filename,
        path: uploadData.path,
        url: publicUrl,
        bucket: bucketName
    };
};

// Filtro para aceitar apenas imagens
const fileFilter = (req, file, cb) => {
    logger.log(`🔍 Verificando tipo do arquivo: ${file.mimetype}`);
    logger.log(`📄 Nome original: ${file.originalname}`);
    
    if (file.mimetype.startsWith('image/')) {
        logger.log('✅ Arquivo de imagem aceito');
        cb(null, true);
    } else {
        logger.error(`❌ Tipo de arquivo não permitido: ${file.mimetype}`);
        cb(new Error('Apenas arquivos de imagem são permitidos'), false);
    }
};

// Função para criar configuração do multer
const createUpload = (type) => {
    return multer({
        storage: createStorage(type),
        limits: {
            fileSize: 5 * 1024 * 1024, // 5MB limite para imagens
        },
        fileFilter: fileFilter
    });
};

// Middleware para upload de imagem única no Supabase Storage
const uploadImage = (type = 'vereador', fieldName = 'foto') => {
    // Brasão de câmara sem limite de tamanho
    const limitSize = type === 'camara' ? undefined : 5 * 1024 * 1024;
    
    const upload = multer({
        storage: multer.memoryStorage(),
        limits: limitSize ? { fileSize: limitSize } : {},
        fileFilter: fileFilter
    });
    
    return (req, res, next) => {
        logger.log(`📤 Iniciando upload de imagem (${type}) para Supabase Storage - Campo: ${fieldName} ${limitSize ? `(limite: ${limitSize/1024/1024}MB)` : '(sem limite)'}`);
        
        const uploadHandler = upload.single(fieldName);
        
        uploadHandler(req, res, async (err) => {
            if (err) {
                logger.error('❌ Erro no processamento multer:', err.message);
                
                if (err instanceof multer.MulterError) {
                    if (err.code === 'LIMIT_FILE_SIZE') {
                        return res.status(400).json({ 
                            error: 'Imagem muito grande. Tamanho máximo: 5MB' 
                        });
                    }
                    return res.status(400).json({ 
                        error: `Erro no upload: ${err.message}` 
                    });
                }
                
                return res.status(400).json({ 
                    error: err.message 
                });
            }
            
            if (req.file) {
                try {
                    // Upload para Supabase Storage
                    const uploadResult = await uploadToSupabase(req.file, type);
                    
                    // Adicionar informações do upload ao request
                    req.file.url = uploadResult.url;
                    req.file.path = uploadResult.path;
                    req.file.filename = uploadResult.filename;
                    req.file.bucket = uploadResult.bucket;
                    
                    logger.log('✅ Upload de imagem concluído:', {
                        originalName: req.file.originalname,
                        filename: uploadResult.filename,
                        size: req.file.size,
                        url: uploadResult.url,
                        bucket: uploadResult.bucket
                    });
                    
                } catch (uploadError) {
                    logger.error('❌ Erro no upload para Supabase:', uploadError.message);
                    return res.status(500).json({ 
                        error: `Falha no upload: ${uploadError.message}` 
                    });
                }
            } else {
                logger.log('ℹ️ Nenhuma imagem enviada no upload');
            }
            
            next();
        });
    };
};

// Middleware para múltiplos arquivos no Supabase Storage
const uploadMultiple = (fields) => {
    const upload = multer({
        storage: multer.memoryStorage(),
        limits: {
            fileSize: 5 * 1024 * 1024,
            files: 10
        },
        fileFilter: fileFilter
    });
    
    return (req, res, next) => {
        upload.fields(fields)(req, res, async (err) => {
            if (err) {
                logger.error('❌ Erro no processamento multer (múltiplos):', err.message);
                return res.status(400).json({ error: err.message });
            }
            
            // Processar arquivos para upload no Supabase
            if (req.files) {
                try {
                    // Processar brasão
                    if (req.files.brasao && req.files.brasao[0]) {
                        const brasaoFile = req.files.brasao[0];
                        const uploadResult = await uploadToSupabase(brasaoFile, 'multiple');
                        req.files.brasao[0].url = uploadResult.url;
                        req.files.brasao[0].path = uploadResult.path;
                        req.files.brasao[0].bucket = uploadResult.bucket;
                    }
                    
                    // Processar fotos de vereadores
                    if (req.files.vereador_fotos) {
                        for (let i = 0; i < req.files.vereador_fotos.length; i++) {
                            const file = req.files.vereador_fotos[i];
                            const uploadResult = await uploadToSupabase(file, 'multiple');
                            file.url = uploadResult.url;
                            file.path = uploadResult.path;
                            file.bucket = uploadResult.bucket;
                        }
                    }
                    
                    logger.log('✅ Upload múltiplo concluído para Supabase Storage');
                    
                } catch (uploadError) {
                    logger.error('❌ Erro no upload múltiplo para Supabase:', uploadError.message);
                    return res.status(500).json({ 
                        error: `Falha no upload: ${uploadError.message}` 
                    });
                }
            }
            
            next();
        });
    };
};

// Middleware compatível com sistema antigo (memoryStorage para compatibilidade)
const uploadMultipleCompat = (fields) => {
    const upload = multer({
        storage: multer.memoryStorage(),
        limits: {
            fileSize: 5 * 1024 * 1024,
            files: 10
        },
        fileFilter: fileFilter
    });
    
    return upload.fields(fields);
};

module.exports = {
    uploadImage,
    uploadMultiple,
    uploadMultipleCompat,
    uploadToSupabase,
    getBucketName
};