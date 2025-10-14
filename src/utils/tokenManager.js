// src/utils/tokenManager.js

const createLogger = require('./logger');
const logger = createLogger('TOKEN_MANAGER');

// Usaremos um Set para uma busca rápida e eficiente.
// Em produção, isso seria substituído por um banco de dados como Redis.
const tokenBlacklist = new Set();

/**
 * Adiciona um token à blacklist.
 * @param {string} token - O JWT a ser invalidado.
 */
const blacklistToken = (token) => {
    if (token) {
        tokenBlacklist.add(token);
        logger.log(`Token adicionado à blacklist. Tamanho atual: ${tokenBlacklist.size}`);
    }
};

/**
 * Verifica se um token está na blacklist.
 * @param {string} token - O JWT a ser verificado.
 * @returns {boolean} - True se o token estiver na blacklist.
 */
const isBlacklisted = (token) => {
    return tokenBlacklist.has(token);
};

module.exports = {
    blacklistToken,
    isBlacklisted,
};