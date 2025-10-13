// src/middleware/securityMiddleware.js

const rateLimit = require('express-rate-limit');
const { body, param, query, validationResult } = require('express-validator');
const createLogger = require('../utils/logger');
const logger = createLogger('SECURITY_MIDDLEWARE');

// Rate limiting para APIs administrativas
const adminRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 10000, // máximo 10000 requests por IP por janela (aumentado para suportar polling intenso e votação ao vivo)
    message: {
        error: 'Muitas requisições. Tente novamente em 15 minutos.',
        code: 'RATE_LIMIT_EXCEEDED'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req, res) => {
        // Skip rate limiting para requests com token válido de super admin
        return req.user && req.user.role === 'super_admin';
    }
});

// Rate limiting mais restritivo para operações de criação/modificação
const strictRateLimit = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutos
    max: 2000, // máximo 2000 requests por IP por janela (aumentado para suportar APKs e votação ao vivo)
    message: {
        error: 'Limite de operações excedido. Aguarde 5 minutos.',
        code: 'STRICT_RATE_LIMIT_EXCEEDED'
    }
});

// Sanitização de strings
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


// Validação de UUID
const uuidValidation = (field = 'id') => [
    param(field)
        .isUUID(4)
        .withMessage(`${field} deve ser um UUID válido`)
];

// Validação de paginação
const paginationValidation = [
    query('page')
        .optional()
        .isInt({ min: 1, max: 1000 })
        .withMessage('Página deve ser um número entre 1 e 1000'),
    
    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Limite deve ser um número entre 1 e 100'),
    
    query('search')
        .optional()
        .isLength({ max: 100 })
        .withMessage('Busca muito longa')
        .customSanitizer(sanitizeString)
];

// Middleware para processar erros de validação
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        logger.error('Erro de validação:', {
            url: req.url,
            method: req.method,
            errors: errors.array(),
            ip: req.ip
        });
        
        return res.status(400).json({
            error: 'Dados inválidos',
            details: errors.array().map(err => ({
                field: err.param,
                message: err.msg
            }))
        });
    }
    next();
};

// Middleware para sanitizar requisições
const sanitizeRequest = (req, res, next) => {
    // Sanitiza body
    if (req.body && typeof req.body === 'object') {
        for (const key in req.body) {
            if (typeof req.body[key] === 'string') {
                req.body[key] = sanitizeString(req.body[key]);
            }
        }
    }
    
    // Sanitiza query params
    if (req.query && typeof req.query === 'object') {
        for (const key in req.query) {
            if (typeof req.query[key] === 'string') {
                req.query[key] = sanitizeString(req.query[key]);
            }
        }
    }
    
    next();
};

// Middleware para logging de operações administrativas
const adminAuditLog = (req, res, next) => {
    const originalSend = res.json;
    
    res.json = function(data) {
        // Log da operação administrativa
        logger.log('Admin Operation:', {
            method: req.method,
            url: req.url,
            user: req.user?.id || 'unknown',
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            timestamp: new Date().toISOString(),
            status: res.statusCode
        });
        
        originalSend.call(this, data);
    };
    
    next();
};




module.exports = {
    adminRateLimit,
    strictRateLimit,
    uuidValidation,
    paginationValidation,
    handleValidationErrors,
    sanitizeRequest,
    adminAuditLog,
    sanitizeString
};