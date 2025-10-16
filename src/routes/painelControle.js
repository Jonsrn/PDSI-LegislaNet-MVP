const express = require('express');
const router = express.Router();
const painelControleController = require('../controllers/painelControleController');
const { hasPermission } = require('../middleware/authMiddleware');

// Middleware para verificar permissões (apenas admin_camara pode acessar)
const canAccessPainelControle = hasPermission(['admin_camara', 'super_admin']);

/**
 * @route GET /api/painel-controle/pautas-em-votacao
 * @desc Busca pautas com status "Em Votação" de sessões válidas
 * @access Admin Câmara, Super Admin
 */
router.get('/pautas-em-votacao', canAccessPainelControle, painelControleController.getPautasEmVotacao);

/**
 * @route GET /api/painel-controle/oradores
 * @desc Busca oradores de sessões válidas
 * @access Admin Câmara, Super Admin
 */
router.get('/oradores', canAccessPainelControle, painelControleController.getOradoresAtivos);

/**
 * @route POST /api/painel-controle/iniciar-votacao/:pautaId
 * @desc Inicia votação e notifica tablets via WebSocket
 * @access Admin Câmara, Super Admin
 */
router.post('/iniciar-votacao/:pautaId', canAccessPainelControle, painelControleController.iniciarVotacao);

/**
 * @route POST /api/painel-controle/iniciar-fala/:oradorId
 * @desc Inicia fala de orador e notifica tablets via WebSocket
 * @access Admin Câmara, Super Admin
 */
router.post('/iniciar-fala/:oradorId', canAccessPainelControle, painelControleController.iniciarFala);

module.exports = router;
