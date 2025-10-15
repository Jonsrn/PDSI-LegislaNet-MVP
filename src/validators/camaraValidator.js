// src/validators/camaraValidator.js

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

// Validações para câmara
const camaraValidation = [
    body('municipio')
        .trim()
        .isLength({ min: 2, max: 100 })
        .withMessage('Município deve ter entre 2 e 100 caracteres')
        .matches(/^[a-zA-ZÀ-ÿ\s\-']+$/)
        .withMessage('Município contém caracteres inválidos')
        .customSanitizer(sanitizeString),

    body('estado')
        .isIn(['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'])
        .withMessage('Estado inválido'),

    body('admin_email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Email inválido')
        .isLength({ max: 255 })
        .withMessage('Email muito longo'),

    body('admin_senha')
        .isLength({ min: 8, max: 128 })
        .withMessage('Senha deve ter entre 8 e 128 caracteres')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
        .withMessage('Senha deve conter ao menos: 1 minúscula, 1 maiúscula, 1 número e 1 símbolo'),

    // Validações opcionais para redes sociais (aceita campos vazios)
    body('link_facebook').optional({ checkFalsy: true }).isURL().withMessage('URL do Facebook inválida'),
    body('link_instagram').optional({ checkFalsy: true }).isURL().withMessage('URL do Instagram inválida'),
    body('link_youtube').optional({ checkFalsy: true }).isURL().withMessage('URL do YouTube inválida'),
    body('site_oficial').optional({ checkFalsy: true }).isURL().withMessage('URL do site oficial inválida')
];

module.exports = {
    camaraValidation
};