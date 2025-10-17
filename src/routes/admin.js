const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { isSuperAdmin } = require('../middleware/authMiddleware');
const {
    adminRateLimit,
    strictRateLimit,
    uuidValidation,
    paginationValidation,
    handleValidationErrors,
    sanitizeRequest,
    adminAuditLog
} = require('../middleware/securityMiddleware');
const { partidoValidation } = require('../validators/partidoValidator');
const { camaraValidation } = require('../validators/camaraValidator');
const { uploadImage, uploadMultiple } = require('../middleware/imageUploadMiddleware');
const multer = require('multer');

// Configuração do Multer para processar arquivos em memória
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB max
        files: 10 // máximo 10 arquivos
    }
});

// Middleware global para admin
router.use(adminRateLimit);
router.use(sanitizeRequest);
router.use(isSuperAdmin);
router.use(adminAuditLog);

// --- Rotas de Câmaras ---
router.get('/camaras', 
    paginationValidation,
    handleValidationErrors,
    adminController.getCamarasPaginado
);

router.get('/check-email', adminController.checkEmailExists);

router.post('/camaras',
    strictRateLimit,
    uploadMultiple([
        { name: 'brasao', maxCount: 1 },
        { name: 'vereador_fotos' } 
    ]),
    camaraValidation,
    handleValidationErrors,
    adminController.createCamaraCompleta
);

// --- Rotas de Partidos ---

// ROTA: Verifica se um partido já existe pelo nome ou sigla
router.get('/partidos/check', adminController.checkPartidoExists);

// ROTA: Cria um novo partido
router.post('/partidos',
    strictRateLimit,
    uploadImage('partido', 'logo'),
    partidoValidation,
    handleValidationErrors,
    adminController.createPartido
);

// ROTA: Atualiza um partido
router.put('/partidos/:id',
    strictRateLimit,
    uploadImage('partido', 'logo'),
    uuidValidation('id'),
    partidoValidation,
    handleValidationErrors,
    adminController.updatePartido
);

// ROTA: Deleta um partido
router.delete('/partidos/:id',
    strictRateLimit,
    uuidValidation('id'),
    handleValidationErrors,
    adminController.deletePartido
);

// ROTA: Lista todos os vereadores de uma câmara (ativos e inativos)
router.get('/camaras/:camaraId/vereadores',
    uuidValidation('camaraId'),
    handleValidationErrors,
    adminController.getVereadoresByCamaraAdmin
);

module.exports = router;