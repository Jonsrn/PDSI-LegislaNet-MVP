const multer = require('multer');
const path = require('path');
const supabaseAdmin = require('../config/supabaseAdminClient');
const createLogger = require('../utils/logger');

const logger = createLogger('UPLOAD_MIDDLEWARE');

// Função para upload de PDF no Supabase Storage
const uploadPdfToSupabase = async (file) => {
    const bucketName = 'pdfs-pautas';
    
    // Gerar nome único para o arquivo
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const filename = `pauta-${uniqueSuffix}${path.extname(file.originalname)}`;
    const filePath = `public/${filename}`;
    
    logger.log(`📤 Uploading PDF para Supabase Storage - Bucket: ${bucketName}, Arquivo: ${filename}`);
    
    // Upload para Supabase Storage
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
        .from(bucketName)
        .upload(filePath, file.buffer, { 
            contentType: file.mimetype,
            upsert: false 
        });

    if (uploadError) {
        logger.error('❌ Erro no upload PDF Supabase:', uploadError.message);
        throw new Error(`Falha no upload: ${uploadError.message}`);
    }

    // Gerar URL pública
    const publicUrl = supabaseAdmin.storage.from(bucketName).getPublicUrl(uploadData.path).data.publicUrl;
    
    logger.log(`✅ Upload PDF concluído - URL: ${publicUrl}`);
    
    return {
        filename: filename,
        path: uploadData.path,
        url: publicUrl,
        bucket: bucketName
    };
};

// Filtro para aceitar apenas PDFs
const fileFilter = (req, file, cb) => {
    logger.log(`🔍 Verificando tipo do arquivo: ${file.mimetype}`);
    logger.log(`📄 Nome original: ${file.originalname}`);
    
    if (file.mimetype === 'application/pdf') {
        logger.log('✅ Arquivo PDF aceito');
        cb(null, true);
    } else {
        logger.error(`❌ Tipo de arquivo não permitido: ${file.mimetype}`);
        cb(new Error('Apenas arquivos PDF são permitidos'), false);
    }
};

// Middleware para upload de PDF único no Supabase Storage
const uploadSingle = (fieldName = 'arquivo') => {
    const upload = multer({
        storage: multer.memoryStorage(),
        limits: {
            fileSize: 10 * 1024 * 1024, // 10MB limite
        },
        fileFilter: fileFilter
    });

    return (req, res, next) => {
        logger.log(`📤 Iniciando upload de PDF para Supabase Storage - Campo: ${fieldName}`);
        
        upload.single(fieldName)(req, res, async (err) => {
            if (err) {
                logger.error('❌ Erro no processamento multer:', err.message);
                
                if (err instanceof multer.MulterError) {
                    if (err.code === 'LIMIT_FILE_SIZE') {
                        return res.status(400).json({ 
                            error: 'Arquivo muito grande. Tamanho máximo: 10MB' 
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
                    const uploadResult = await uploadPdfToSupabase(req.file);
                    
                    // Adicionar informações do upload ao request
                    req.file.url = uploadResult.url;
                    req.file.path = uploadResult.path;
                    req.file.filename = uploadResult.filename;
                    req.file.bucket = uploadResult.bucket;
                    
                    logger.log('✅ Upload de PDF concluído:', {
                        originalName: req.file.originalname,
                        filename: uploadResult.filename,
                        size: req.file.size,
                        url: uploadResult.url,
                        bucket: uploadResult.bucket
                    });
                    
                } catch (uploadError) {
                    logger.error('❌ Erro no upload PDF para Supabase:', uploadError.message);
                    return res.status(500).json({ 
                        error: `Falha no upload: ${uploadError.message}` 
                    });
                }
            } else {
                logger.log('ℹ️ Nenhum arquivo enviado no upload');
            }
            
            next();
        });
    };
};

module.exports = {
    uploadSingle,
    uploadPdfToSupabase
};