const express = require("express");
const router = express.Router();
const publicController = require("../controllers/publicController");
const authController = require("../controllers/authController");

/**
 * @route   GET /api/camaras/publicas
 * @desc    Lista câmaras ativas para seleção pública
 * @access  Public (sem autenticação)
 */
router.get("/camaras/publicas", publicController.getCamarasPublicas);

/**
 * @route   GET /api/camaras/:id/info
 * @desc    Busca informações públicas de uma câmara específica
 * @access  Public (sem autenticação)
 */
router.get("/camaras/:id/info", publicController.getCamaraPublicInfo);

/**
 * @route   GET /api/camaras/:id/sessoes-futuras
 * @desc    Busca sessões futuras de uma câmara específica
 * @access  Public (sem autenticação)
 */
router.get("/camaras/:id/sessoes-futuras", publicController.getSessoesFuturas);

/**
 * @route   GET /api/camaras/:id/vereadores
 * @desc    Busca vereadores ativos de uma câmara específica com partidos
 * @access  Public (sem autenticação)
 */
router.get("/camaras/:id/vereadores", publicController.getVereadores);

/**
 * @route   GET /api/camaras/:id/votacoes-recentes
 * @desc    Busca as últimas 6 pautas finalizadas de uma câmara
 * @access  Public (sem autenticação)
 */
router.get(
  "/camaras/:id/votacoes-recentes",
  publicController.getVotacoesRecentes
);

/**
 * @route   GET /api/pautas/:id/publica
 * @desc    Busca informações públicas de uma pauta específica
 * @access  Public (sem autenticação)
 */
router.get("/pautas/:id/publica", publicController.getPautaPublica);

/**
 * @route   GET /api/votos/pauta/:id/publico
 * @desc    Busca votos de uma pauta específica para visualização pública
 * @access  Public (sem autenticação)
 */
router.get("/votos/pauta/:id/publico", publicController.getVotosPublicos);

/**
 * @route   GET /api/camaras/:id/todas-pautas
 * @desc    Busca todas as pautas de uma câmara específica com paginação
 * @access  Public (sem autenticação)
 */
router.get("/camaras/:id/todas-pautas", publicController.getAllPautasPublicas);

/**
 * @route   GET /api/me
 * @desc    Retorna informações do usuário logado (profile + camara)
 * @access  Protected via token (Bearer) handled inside controller
 */
router.get("/me", authController.getMe);

module.exports = router;
