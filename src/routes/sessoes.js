const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const sessoesController = require('../controllers/sessoesController');
const vereadorController = require('../controllers/vereadorController');
const oradoresController = require('../controllers/oradoresController');
const { canManageSessoes } = require('../middleware/authMiddleware');
const { handleValidationErrors } = require('../middleware/securityMiddleware');
const { sessaoValidation } = require('../validators/sessaoValidator');



// --- ROTAS PROTEGIDAS PELO MIDDLEWARE ---

// Rota para buscar todas as sessões (protegida)
router.get('/', canManageSessoes, sessoesController.getAllSessoes);

// Rota para buscar sessões disponíveis (agendadas e futuras) para cadastro de pautas
router.get('/disponiveis', canManageSessoes, sessoesController.getSessoesDisponiveis);

// Rota para buscar vereadores ativos da câmara (para cadastro de oradores)
router.get('/vereadores-ativos', canManageSessoes, vereadorController.getVereadoresAtivos);

// --- ROTAS DE ORADORES (ANTES DAS ROTAS COM PARÂMETROS) ---

// Rota para buscar todos os oradores da câmara
router.get('/oradores', canManageSessoes, oradoresController.getAllOradores);

// Rota para criar um novo orador
router.post('/oradores', canManageSessoes, oradoresController.createOrador);

// Rota para atualizar tempo de fala de um orador
router.put('/oradores/:id', canManageSessoes, oradoresController.updateTempoOrador);

// Rota para excluir um orador
router.delete('/oradores/:id', canManageSessoes, oradoresController.deleteOrador);

// Rota para buscar uma sessão específica por ID (protegida)
router.get('/:id', canManageSessoes, sessoesController.getSessaoById);

// Rota para criar uma nova sessão (protegida e com validação)
router.post('/', canManageSessoes, sessaoValidation, handleValidationErrors, sessoesController.createSessao);

// Rota para atualizar uma sessão existente (protegida e com validação)
router.put('/:id', canManageSessoes, sessaoValidation, handleValidationErrors, sessoesController.updateSessao);

// Rota para excluir uma sessão (protegida)
router.delete('/:id', canManageSessoes, sessoesController.deleteSessao);

// Rota para buscar oradores de uma sessão específica
router.get('/:sessaoId/oradores', canManageSessoes, oradoresController.getOradoresBySessao);

module.exports = router;