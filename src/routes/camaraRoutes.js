const express = require('express');
const router = express.Router();
const camaraController = require('../controllers/camaraController');
const { isSuperAdmin } = require('../middleware/authMiddleware');
const { uploadImage } = require('../middleware/imageUploadMiddleware');

// Aplica o middleware para garantir que apenas Super Admins possam gerenciar câmaras
router.use(isSuperAdmin);

/**
 * @route   GET /api/camaras/:id
 * @desc    Busca os detalhes de uma câmara específica
 * @access  Private (Super Admin)
 */
router.get('/:id', camaraController.getCamaraById);

/**
 * @route   PUT /api/camaras/:id
 * @desc    Atualiza as informações de uma câmara
 * @access  Private (Super Admin)
 */
router.put('/:id', uploadImage('camara', 'brasao'), camaraController.updateCamara);


module.exports = router;