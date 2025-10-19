/* customSelect.js - Sistema de seleção customizada modular */

class CustomSelect {
    constructor(config) {
        console.log('CustomSelect constructor chamado com config:', config);
        this.wrapper = document.getElementById(config.wrapperId);
        console.log('Wrapper encontrado:', this.wrapper);
        
        if (!this.wrapper) {
            console.error('Wrapper não encontrado para ID:', config.wrapperId);
            return;
        }
        
        this.hiddenInput = this.wrapper.querySelector(config.hiddenInputSelector || 'input[type="hidden"]');
        this.trigger = this.wrapper.querySelector(config.triggerSelector || '.custom-select-trigger');
        this.optionsContainer = this.wrapper.querySelector(config.optionsSelector || '.custom-options');
        
        console.log('Elementos encontrados:', {
            hiddenInput: this.hiddenInput,
            trigger: this.trigger,
            optionsContainer: this.optionsContainer
        });
        
        this.placeholder = config.placeholder || 'Selecione...';
        this.onSelect = config.onSelect || (() => {});
        
        if (this.trigger && this.optionsContainer) {
            this.init();
        } else {
            console.error('Elementos necessários não encontrados');
        }
    }
    
    init() {
        console.log('CustomSelect init() chamado');
        // Event listener para abrir/fechar dropdown
        this.trigger.addEventListener('click', (e) => {
            console.log('CustomSelect trigger clicado');
            e.stopPropagation();
            const isOpen = this.optionsContainer.classList.contains('open');
            console.log('Dropdown aberto?', isOpen);
            this.closeAllDropdowns();
            if (!isOpen) {
                this.optionsContainer.classList.add('open');
                console.log('Dropdown aberto');
            }
        });
        
        // Event listener global para fechar dropdowns ao clicar fora
        if (!CustomSelect.globalListenerAdded) {
            document.addEventListener('click', (e) => {
                if (!e.target.closest('.custom-select-wrapper')) {
                    this.closeAllDropdowns();
                }
            });
            CustomSelect.globalListenerAdded = true;
        }
    }
    
    closeAllDropdowns() {
        document.querySelectorAll('.custom-options.open').forEach(dropdown => {
            dropdown.classList.remove('open');
        });
    }
    
    populateOptions(options) {
        this.optionsContainer.innerHTML = '';
        
        if (!options || options.length === 0) {
            this.optionsContainer.innerHTML = '<div class="custom-option-placeholder">Nenhuma opção disponível</div>';
            return;
        }
        
        options.forEach(option => {
            const optionElement = document.createElement('div');
            optionElement.className = 'custom-option';
            optionElement.dataset.value = option.value;
            
            // Se tem imagem, adicionar
            if (option.image) {
                optionElement.innerHTML = `<img src="${option.image}" alt="${option.alt || ''}">${option.text}`;
            } else {
                optionElement.innerHTML = `<span>${option.text}</span>`;
            }
            
            // Event listener para seleção
            optionElement.addEventListener('click', () => {
                this.selectOption(option);
            });
            
            this.optionsContainer.appendChild(optionElement);
        });
    }
    
    selectOption(option) {
        // Atualizar valor do input hidden
        this.hiddenInput.value = option.value;
        
        // Atualizar visual do trigger
        if (option.image) {
            this.trigger.innerHTML = `<img src="${option.image}" alt="${option.alt || ''}">${option.text}`;
        } else {
            this.trigger.innerHTML = `<span>${option.text}</span>`;
        }
        
        // Atualizar classes de seleção
        this.optionsContainer.querySelectorAll('.custom-option').forEach(opt => {
            opt.classList.remove('selected');
        });
        const selectedElement = this.optionsContainer.querySelector(`[data-value="${option.value}"]`);
        if (selectedElement) {
            selectedElement.classList.add('selected');
        }
        
        // Fechar dropdown
        this.optionsContainer.classList.remove('open');
        
        // Callback customizado
        this.onSelect(option);
    }
    
    setValue(value) {
        const option = this.optionsContainer.querySelector(`[data-value="${value}"]`);
        if (option) {
            // Encontrar a opção correspondente e selecionar
            const optionData = {
                value: value,
                text: option.textContent,
                image: option.querySelector('img')?.src,
                alt: option.querySelector('img')?.alt
            };
            this.selectOption(optionData);
        } else {
            this.reset();
        }
    }
    
    reset() {
        this.hiddenInput.value = '';
        this.trigger.innerHTML = `<span>${this.placeholder}</span>`;
        this.optionsContainer.querySelectorAll('.custom-option').forEach(opt => {
            opt.classList.remove('selected');
        });
    }
    
    getValue() {
        return this.hiddenInput.value;
    }
}

// Inicialização automática com atributo data
document.addEventListener('DOMContentLoaded', () => {
    // Auto-inicializar selects com data-custom-select
    document.querySelectorAll('[data-custom-select]').forEach(wrapper => {
        const config = JSON.parse(wrapper.dataset.customSelect || '{}');
        config.wrapperId = wrapper.id;
        new CustomSelect(config);
    });
});

// Exportar classe para uso manual
window.CustomSelect = CustomSelect;