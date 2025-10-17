const express = require('express');
const router = express.Router();
const votacaoAoVivoController = require('../controllers/votacaoAoVivoController');

// Rota para receber notificações de votação ao vivo (chamada pelo tablet backend)
router.post('/notify', votacaoAoVivoController.notifyVotacaoAoVivo);

// Rota para receber notificações de votos (chamada pelo tablet backend)
router.post('/notify-voto', votacaoAoVivoController.notifyVoto);

// Rota para portal público consultar status atual
router.get('/status/:camaraId', votacaoAoVivoController.getStatusVotacao);

module.exports = router;
