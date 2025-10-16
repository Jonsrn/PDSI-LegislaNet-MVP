const express = require('express');
// A opção mergeParams é essencial para que a rota aninhada receba o :camaraId da rota pai
const router = express.Router({ mergeParams: true }); 
const vereadorController = require('../controllers/vereadorController');
const { isSuperAdmin, hasPermission } = require('../middleware/authMiddleware');
const { uploadImage } = require('../middleware/imageUploadMiddleware');

// Garante que todas as rotas neste arquivo são protegidas
router.use(isSuperAdmin);

/**
 * @route   GET /api/camaras/:camaraId/vereadores
 * @desc    Lista todos os vereadores de uma câmara específica
 * @access  Private (Super Admin)
 */
router.get('/', vereadorController.getVereadoresByCamara);

/**
 * @route   POST /api/camaras/:camaraId/vereadores
 * @desc    Cria um novo vereador para a câmara
 * @access  Private (Super Admin)
 */
router.post('/', uploadImage('vereador', 'foto_url_vereador'), vereadorController.createVereador);


// --- Rota para operações diretas no vereador (Update, Delete) ---
// Criamos um novo router para não herdar o :camaraId
const singleVereadorRouter = express.Router();

/**
 * @route   PUT /api/vereadores/:id
 * @desc    Atualiza um vereador específico
 * @access  Private (Super Admin)
 */
singleVereadorRouter.put('/:id', uploadImage('vereador', 'foto_url_vereador'), isSuperAdmin, vereadorController.updateVereador);

/**
 * @route   DELETE /api/vereadores/:id
 * @desc    Remove um vereador específico
 * @access  Private (Super Admin)
 */
singleVereadorRouter.delete('/:id', isSuperAdmin, vereadorController.deleteVereador);


// --- Router para usuários comuns da câmara (não super admin) ---
const appVereadorRouter = express.Router();

// Middleware para usuários da câmara (admin_camara e vereador)
const isUsuarioCamara = hasPermission(['admin_camara', 'vereador']);

/**
 * @route   GET /api/app/vereadores
 * @desc    Lista todos os vereadores da câmara do usuário logado
 * @access  Private (Usuários da câmara)
 */
appVereadorRouter.get('/', isUsuarioCamara, vereadorController.getVereadoresDaPropriaCamara);

/**
 * @route   POST /api/app/vereadores
 * @desc    Cria um novo vereador na câmara do usuário logado
 * @access  Private (Usuários da câmara)
 */
appVereadorRouter.post('/', uploadImage('vereador', 'foto'), isUsuarioCamara, vereadorController.createVereadorNaPropriaCamara);

/**
 * @route   PUT /api/app/vereadores/:id
 * @desc    Atualiza um vereador da própria câmara
 * @access  Private (Usuários da câmara)
 */
appVereadorRouter.put('/:id', uploadImage('vereador', 'foto'), isUsuarioCamara, vereadorController.updateVereadorDaPropriaCamara);

// ROTA REMOVIDA POR SEGURANÇA: Admins da câmara não podem remover vereadores
// Apenas o super admin pode remover vereadores através das rotas /api/vereadores/:id
// /**
//  * @route   DELETE /api/app/vereadores/:id
//  * @desc    Remove um vereador da própria câmara
//  * @access  Private (Usuários da câmara)
//  */
// appVereadorRouter.delete('/:id', isUsuarioCamara, vereadorController.deleteVereadorDaPropriaCamara);

module.exports = { 
    nestedVereadorRouter: router, 
    singleVereadorRouter: singleVereadorRouter,
    appVereadorRouter: appVereadorRouter 
};