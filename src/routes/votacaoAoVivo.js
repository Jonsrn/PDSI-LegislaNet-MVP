const express = require("express");
const router = express.Router();
const votacaoAoVivoController = require("../controllers/votacaoAoVivoController");
const {
  canManagePautas,
  canAccessVotacaoStatus,
} = require("../middleware/authMiddleware");

// Rota para receber notificações de votação ao vivo (chamada pelo tablet backend)
router.post(
  "/notify",
  canManagePautas,
  votacaoAoVivoController.notifyVotacaoAoVivo
);

// Rota para receber notificações de votos (chamada pelo tablet backend)
router.post(
  "/notify-voto",
  canManagePautas,
  votacaoAoVivoController.notifyVoto
);

// Rota para portal público consultar status atual - agora protegida para tv+
router.get(
  "/status/:camaraId",
  canAccessVotacaoStatus,
  votacaoAoVivoController.getStatusVotacao
);

module.exports = router;
