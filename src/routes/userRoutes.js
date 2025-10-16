const express = require('express');
const router = express.Router({ mergeParams: true });
const userController = require('../controllers/userController');
const { isSuperAdmin } = require('../middleware/authMiddleware');

router.use(isSuperAdmin);

/**
 * @route   GET /api/camaras/:camaraId/users
 * @desc    Lista todas as credenciais (usuários) de uma câmara
 * @access  Private (Super Admin)
 */
router.get('/', userController.getUsersByCamara);


// Router para operações diretas no usuário (ex: atualizar senha)
const singleUserRouter = express.Router();

/**
 * @route   PUT /api/users/:id
 * @desc    Atualiza uma credencial (ex: reseta senha, ativa/desativa)
 * @access  Private (Super Admin)
 */
singleUserRouter.put('/:id', isSuperAdmin, userController.updateUser);


module.exports = { 
    nestedUserRouter: router, 
    singleUserRouter: singleUserRouter 
};