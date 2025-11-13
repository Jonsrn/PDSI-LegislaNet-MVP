const express = require("express");
const router = express.Router();
const pautaController = require("../controllers/pautaController");
const { uploadSingle } = require("../middleware/uploadMiddleware");
const { canManagePautas } = require("../middleware/authMiddleware");

// GET /api/pautas - Buscar pautas da câmara do usuário logado
router.get("/", canManagePautas, pautaController.getAllPautas);

// POST /api/pautas - Criar nova pauta (com upload de arquivo)
router.post(
  "/",
  canManagePautas,
  uploadSingle("arquivo"),
  pautaController.createPauta
);

// GET /api/pautas/:id - Buscar uma pauta específica
router.get("/:id", canManagePautas, pautaController.getPautaById);

// PUT /api/pautas/:id/status - Atualizar status de uma pauta
router.put("/:id/status", canManagePautas, pautaController.updatePautaStatus);

// PUT /api/pautas/:id/resultado - Atualizar resultado da votação de uma pauta
router.put(
  "/:id/resultado",
  canManagePautas,
  pautaController.updateResultadoVotacao
);

// PUT /api/pautas/:id - Editar uma pauta completa (com upload de arquivo)
router.put(
  "/:id",
  canManagePautas,
  uploadSingle("arquivo"),
  pautaController.updatePauta
);

// DELETE /api/pautas/:id - Remover uma pauta
router.delete("/:id", canManagePautas, pautaController.deletePauta);

module.exports = router;
