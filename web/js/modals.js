/* modals.js */

function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
}

function toggleSwitch(toggleId) {
    const toggle = document.getElementById(toggleId);
    if (toggle) {
        toggle.classList.toggle('active');
    }
}

/**
 * Mostra um modal de confirmação customizado
 * @param {string} message - Mensagem a exibir
 * @param {string} title - Título do modal (opcional)
 * @returns {Promise<boolean>} - true se confirmado, false se cancelado
 */
function showConfirmModal(message, title = 'Confirmação') {
    return new Promise((resolve) => {
        // Criar modal se não existir
        let modal = document.getElementById('confirm-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'confirm-modal';
            modal.className = 'modal-overlay';
            modal.innerHTML = `
                <div class="modal-content" style="max-width: 500px;">
                    <div class="modal-header">
                        <h2 id="confirm-modal-title"></h2>
                        <button class="modal-close" onclick="closeModal('confirm-modal')">
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                    </div>
                    <div class="modal-body">
                        <p id="confirm-modal-message" style="color: var(--secondary-text); line-height: 1.6;"></p>
                    </div>
                    <div class="modal-footer" style="display: flex; gap: 12px; justify-content: flex-end;">
                        <button id="confirm-modal-cancel" class="btn btn-outline">
                            <i class="fa-solid fa-times"></i>
                            Cancelar
                        </button>
                        <button id="confirm-modal-confirm" class="btn btn-primary">
                            <i class="fa-solid fa-check"></i>
                            Confirmar
                        </button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        }

        // Atualizar conteúdo
        document.getElementById('confirm-modal-title').textContent = title;
        document.getElementById('confirm-modal-message').textContent = message;

        // Handlers
        const confirmBtn = document.getElementById('confirm-modal-confirm');
        const cancelBtn = document.getElementById('confirm-modal-cancel');

        const handleConfirm = () => {
            closeModal('confirm-modal');
            cleanup();
            resolve(true);
        };

        const handleCancel = () => {
            closeModal('confirm-modal');
            cleanup();
            resolve(false);
        };

        const cleanup = () => {
            confirmBtn.removeEventListener('click', handleConfirm);
            cancelBtn.removeEventListener('click', handleCancel);
        };

        confirmBtn.addEventListener('click', handleConfirm);
        cancelBtn.addEventListener('click', handleCancel);

        // Abrir modal
        openModal('confirm-modal');
    });
}

// Event listener para fechar o modal ao clicar fora dele
document.addEventListener('DOMContentLoaded', () => {
    const modals = document.querySelectorAll('.modal-overlay');
    modals.forEach(modal => {
        modal.addEventListener('click', (event) => {
            if (event.target === modal) {
                closeModal(modal.id);
            }
        });
    });
});