const express = require("express");
const router = express.Router();
const votacaoAoVivoController = require("../controllers/votacaoAoVivoController");
const {
  canAccessVotacaoStatus,
} = require("../middleware/authMiddleware");

// ============================================================================
// ROTAS INTERNAS (Comunicação Cross-Server)
// Usadas pelo Tablet Backend (:3003) para notificar o Web Backend (:3000)
// SEM AUTENTICAÇÃO - Comunicação direta entre servidores confiáveis
// ============================================================================

// Rota para receber notificações de votação ao vivo (chamada pelo tablet backend)
router.post("/notify", votacaoAoVivoController.notifyVotacaoAoVivo);

// Rota para receber notificações de votos (chamada pelo tablet backend)
router.post("/notify-voto", votacaoAoVivoController.notifyVoto);

// ============================================================================
// ROTAS PÚBLICAS (Protegidas por JWT)
// ============================================================================

// Rota para portal público e TVs consultarem status atual
router.get(
  "/status/:camaraId",
  canAccessVotacaoStatus,
  votacaoAoVivoController.getStatusVotacao
);

module.exports = router;
