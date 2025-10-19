// web/js/formValidator.js - Sistema completo de validação de formulários

class FormValidator {
    constructor() {
        this.rules = {};
        this.messages = {};
        this.errors = {};
        
        // Padrões de validação
        this.patterns = {
            email: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
            password: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
            strongPassword: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
            municipio: /^[a-zA-ZÀ-ÿ\s\-']{2,100}$/,
            partidoNome: /^[a-zA-ZÀ-ÿ\s\-]{2,100}$/,
            partidoSigla: /^[A-Z0-9]{2,10}$/,
            nomeParlamentar: /^[a-zA-ZÀ-ÿ\s\-']{2,100}$/,
            url: /^https?:\/\/([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/,
            telefone: /^[\(\)\d\s\-\+]{10,20}$/
        };
        
        // Mensagens de erro padrão
        this.defaultMessages = {
            required: 'Este campo é obrigatório',
            email: 'Formato de email inválido',
            password: 'Senha deve ter ao menos 1 minúscula, 1 maiúscula, 1 número e 1 símbolo',
            strongPassword: 'Senha deve ter ao menos 8 caracteres com 1 minúscula, 1 maiúscula, 1 número e 1 símbolo',
            minLength: 'Deve ter pelo menos {min} caracteres',
            maxLength: 'Deve ter no máximo {max} caracteres',
            min: 'Valor mínimo é {min}',
            max: 'Valor máximo é {max}',
            pattern: 'Formato inválido',
            url: 'URL deve começar com http:// ou https://',
            partidoSigla: 'Sigla deve ter 2-10 caracteres maiúsculos e números',
            municipio: 'Município deve conter apenas letras, espaços e hífens',
            telefone: 'Formato de telefone inválido'
        };
    }

    /**
     * Define regras de validação para um campo
     */
    setRules(fieldName, rules, customMessages = {}) {
        this.rules[fieldName] = rules;
        this.messages[fieldName] = { ...this.defaultMessages, ...customMessages };
        return this;
    }

    /**
     * Valida um único campo
     */
    validateField(fieldName, value, showError = true) {
        const rules = this.rules[fieldName];
        if (!rules) return true;

        const errors = [];
        
        // Trim string values
        if (typeof value === 'string') {
            value = value.trim();
        }

        // Required validation
        if (rules.required && this.isEmpty(value)) {
            errors.push(this.messages[fieldName].required);
        }

        // Se está vazio e não é obrigatório, pula outras validações
        if (this.isEmpty(value) && !rules.required) {
            this.clearFieldError(fieldName);
            return true;
        }

        // Type validations
        if (rules.email && !this.patterns.email.test(value)) {
            errors.push(this.messages[fieldName].email);
        }

        if (rules.password && !this.patterns.password.test(value)) {
            errors.push(this.messages[fieldName].password);
        }

        if (rules.strongPassword && !this.patterns.strongPassword.test(value)) {
            errors.push(this.messages[fieldName].strongPassword);
        }

        if (rules.url && value && !this.patterns.url.test(value)) {
            errors.push(this.messages[fieldName].url);
        }

        // Length validations
        if (rules.minLength && value.length < rules.minLength) {
            errors.push(this.messages[fieldName].minLength.replace('{min}', rules.minLength));
        }

        if (rules.maxLength && value.length > rules.maxLength) {
            errors.push(this.messages[fieldName].maxLength.replace('{max}', rules.maxLength));
        }

        // Numeric validations
        if (rules.min !== undefined) {
            const numValue = parseFloat(value);
            if (isNaN(numValue) || numValue < rules.min) {
                errors.push(this.messages[fieldName].min.replace('{min}', rules.min));
            }
        }

        if (rules.max !== undefined) {
            const numValue = parseFloat(value);
            if (isNaN(numValue) || numValue > rules.max) {
                errors.push(this.messages[fieldName].max.replace('{max}', rules.max));
            }
        }

        // Pattern validations
        if (rules.pattern && !rules.pattern.test(value)) {
            errors.push(this.messages[fieldName].pattern);
        }

        // Custom validations
        if (rules.custom && typeof rules.custom === 'function') {
            const customError = rules.custom(value);
            if (customError) errors.push(customError);
        }

        // Specific patterns
        if (rules.municipio && !this.patterns.municipio.test(value)) {
            errors.push(this.messages[fieldName].municipio);
        }

        if (rules.partidoNome && !this.patterns.partidoNome.test(value)) {
            errors.push('Nome deve conter apenas letras, espaços e hífens');
        }

        if (rules.partidoSigla && !this.patterns.partidoSigla.test(value)) {
            errors.push(this.messages[fieldName].partidoSigla);
        }

        if (rules.nomeParlamentar && !this.patterns.nomeParlamentar.test(value)) {
            errors.push('Nome deve conter apenas letras, espaços, hífens e apóstrofes');
        }

        if (rules.telefone && value && !this.patterns.telefone.test(value)) {
            errors.push(this.messages[fieldName].telefone);
        }

        // Update field state
        if (errors.length > 0) {
            this.errors[fieldName] = errors;
            if (showError) this.showFieldError(fieldName, errors[0]);
            return false;
        } else {
            delete this.errors[fieldName];
            if (showError) this.clearFieldError(fieldName);
            return true;
        }
    }

    /**
     * Valida um formulário completo
     */
    validateForm(formSelector) {
        const form = document.querySelector(formSelector);
        if (!form) return false;

        let isValid = true;
        this.errors = {};

        // Valida todos os campos com regras definidas
        for (const fieldName in this.rules) {
            const field = form.querySelector(`[name="${fieldName}"], #${fieldName}`);
            if (!field) continue;

            let value = field.value;
            
            // Tratamento especial para diferentes tipos de input
            if (field.type === 'checkbox') {
                value = field.checked;
            } else if (field.type === 'radio') {
                const checked = form.querySelector(`[name="${fieldName}"]:checked`);
                value = checked ? checked.value : '';
            } else if (field.type === 'file') {
                value = field.files.length > 0 ? field.files[0] : null;
            }

            if (!this.validateField(fieldName, value)) {
                isValid = false;
            }
        }

        return isValid;
    }

    /**
     * Mostra erro em um campo específico
     */
    showFieldError(fieldName, message) {
        const field = document.querySelector(`[name="${fieldName}"], #${fieldName}`);
        if (!field) return;

        // Remove erro anterior
        this.clearFieldError(fieldName);

        // Adiciona classe de erro ao campo
        field.classList.add('form-input-error');

        // Cria elemento de erro
        const errorElement = document.createElement('div');
        errorElement.className = 'form-field-error';
        errorElement.textContent = message;
        errorElement.id = `error-${fieldName}`;

        // Insere erro após o campo ou após o wrapper
        const wrapper = field.closest('.form-group') || field.closest('.custom-select-wrapper');
        if (wrapper) {
            wrapper.appendChild(errorElement);
        } else {
            field.parentNode.insertBefore(errorElement, field.nextSibling);
        }

        // Scroll para o primeiro erro se não estiver visível
        if (Object.keys(this.errors).length === 1) {
            this.scrollToField(field);
        }
    }

    /**
     * Remove erro de um campo
     */
    clearFieldError(fieldName) {
        const field = document.querySelector(`[name="${fieldName}"], #${fieldName}`);
        if (!field) return;

        // Remove classe de erro
        field.classList.remove('form-input-error');

        // Remove elemento de erro
        const errorElement = document.getElementById(`error-${fieldName}`);
        if (errorElement) {
            errorElement.remove();
        }
    }

    /**
     * Limpa todos os erros do formulário
     */
    clearAllErrors() {
        this.errors = {};
        
        // Remove todas as classes de erro
        document.querySelectorAll('.form-input-error').forEach(el => {
            el.classList.remove('form-input-error');
        });

        // Remove todos os elementos de erro
        document.querySelectorAll('.form-field-error').forEach(el => {
            el.remove();
        });
    }

    /**
     * Faz scroll até o campo com erro
     */
    scrollToField(field) {
        const rect = field.getBoundingClientRect();
        const isVisible = rect.top >= 0 && rect.bottom <= window.innerHeight;
        
        if (!isVisible) {
            field.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        
        // Foca no campo após um pequeno delay
        setTimeout(() => {
            field.focus();
        }, 300);
    }

    /**
     * Verifica se um valor está vazio
     */
    isEmpty(value) {
        if (value === null || value === undefined) return true;
        if (typeof value === 'string') return value.trim() === '';
        if (typeof value === 'boolean') return false;
        if (typeof value === 'number') return isNaN(value);
        if (value instanceof File) return false;
        if (Array.isArray(value)) return value.length === 0;
        return false;
    }

    /**
     * Sanitiza um valor
     */
    sanitize(value) {
        if (typeof value !== 'string') return value;
        
        return value
            .trim()
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
            .replace(/javascript:/gi, '')
            .replace(/on\w+\s*=/gi, '');
    }

    /**
     * Obtém todos os erros atuais
     */
    getErrors() {
        return { ...this.errors };
    }

    /**
     * Verifica se há erros
     */
    hasErrors() {
        return Object.keys(this.errors).length > 0;
    }

    /**
     * Mostra resumo de erros
     */
    showErrorSummary(container = '.form-errors') {
        const errorContainer = document.querySelector(container);
        if (!errorContainer || !this.hasErrors()) return;

        const errorList = Object.entries(this.errors)
            .map(([field, errors]) => errors[0])
            .join('<br>');

        errorContainer.innerHTML = `
            <div class="alert alert-error">
                <strong>Corrija os seguintes erros:</strong><br>
                ${errorList}
            </div>
        `;

        errorContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

// Instância global
window.formValidator = new FormValidator();

// Auto-aplicar validação em tempo real
document.addEventListener('DOMContentLoaded', () => {
    // Validação em tempo real nos inputs
    document.addEventListener('input', (e) => {
        const field = e.target;
        if (field.hasAttribute('data-validate')) {
            const fieldName = field.name || field.id;
            if (fieldName && window.formValidator.rules[fieldName]) {
                window.formValidator.validateField(fieldName, field.value);
            }
        }
    });

    // Validação ao sair do campo
    document.addEventListener('blur', (e) => {
        const field = e.target;
        if (field.classList.contains('form-input') || field.classList.contains('form-select')) {
            const fieldName = field.name || field.id;
            if (fieldName && window.formValidator.rules[fieldName]) {
                window.formValidator.validateField(fieldName, field.value);
            }
        }
    });
});