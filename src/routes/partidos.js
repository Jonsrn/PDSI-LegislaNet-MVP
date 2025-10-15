const express = require('express');
const router = express.Router();
const partidoController = require('../controllers/partidoController');

// Rota pública para listar todos os partidos para os formulários
router.get('/', partidoController.getAllPartidos);

module.exports = router;