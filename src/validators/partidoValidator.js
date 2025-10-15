// src/validators/partidoValidator.js

const { body } = require('express-validator');

// Sanitização de strings (reutilizada do securityMiddleware)
const sanitizeString = (str) => {
    if (typeof str !== 'string') return str;

    return str
        .trim()
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove scripts
        .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '') // Remove iframes
        .replace(/javascript:/gi, '') // Remove javascript: URLs
        .replace(/on\w+\s*=/gi, '') // Remove event handlers
        .substring(0, 1000); // Limita tamanho
};

// Validações para partido
const partidoValidation = [
    body('nome')
        .trim()
        .isLength({ min: 2, max: 100 })
        .withMessage('Nome deve ter entre 2 e 100 caracteres')
        .matches(/^[a-zA-ZÀ-ÿ\s\-]+$/)
        .withMessage('Nome só pode conter letras, espaços e hífens')
        .customSanitizer(sanitizeString),

    body('sigla')
        .trim()
        .customSanitizer(value => value ? value.toUpperCase() : value) // Converte para maiúscula
        .isLength({ min: 2, max: 10 })
        .withMessage('Sigla deve ter entre 2 e 10 caracteres')
        .matches(/^[A-Z0-9]+$/)
        .withMessage('Sigla só pode conter letras maiúsculas e números')
        .customSanitizer(sanitizeString)
];

module.exports = {
    partidoValidation
};