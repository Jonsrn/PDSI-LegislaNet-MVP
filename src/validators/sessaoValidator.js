// src/validators/sessaoValidator.js

const { body } = require('express-validator');

// Validações para sessão
const sessaoValidation = [
    // Nova validação para 'numero'
    body('numero')
        .isInt({ min: 1, max: 999 })
        .withMessage('O número da sessão deve ser um inteiro entre 1 e 999.'),

    body('tipo')
        .isIn(['Ordinária', 'Extraordinária', 'Solene'])
        .withMessage('O tipo de sessão é inválido.'),

    body('status')
        .optional()
        .isIn(['Agendada', 'Em Andamento', 'Finalizada'])
        .withMessage('O status da sessão é inválido.'),

    body('data_sessao')
        .isISO8601({ strict: true, strictSeparator: true })
        .withMessage('A data e hora devem estar no formato ISO 8601 (AAAA-MM-DDTHH:MM).')
        .toDate()
        .custom((value) => {
            // Agora compara com a data e hora atuais
            if (value < new Date()) {
                throw new Error('A data e hora da sessão não podem ser no passado.');
            }
            return true;
        })
];

module.exports = {
    sessaoValidation
};