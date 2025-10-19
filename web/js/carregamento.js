// public/js/carregamento.js

/**
// ==================================
//     OVERLAY DE CARREGAMENTO
// ==================================
 * @param {HTMLElement} containerElement - O elemento onde o carregamento será exibido (ex: o grid).
 * @param {string} [message='Carregando...'] - A mensagem a ser exibida abaixo do spinner.
 */
function renderLoadingState(containerElement, message = "Carregando...") {
  if (!containerElement) {
    console.error(
      "Elemento container para o estado de carregamento não foi fornecido."
    );
    return;
  }

  const loadingHTML = `
        <div class="loading-state">
            <div class="loading-spinner"></div>
            <p>${message}</p>
        </div>
    `;
  containerElement.innerHTML = loadingHTML;
  // ESSENCIAL: Define o contêiner como um bloco simples durante o carregamento.
  containerElement.style.display = "block";
}

/**
 * Renderiza um estado de "vazio" (nenhum item encontrado) em um container.
 * @param {HTMLElement} containerElement - O elemento container.
 * @param {string} [message='Nenhum item encontrado.'] - A mensagem principal.
 * @param {string} [iconClass='fa-solid fa-inbox'] - A classe do ícone Font Awesome.
 */
function renderEmptyState(
  containerElement,
  message = "Nenhum item encontrado.",
  iconClass = "fa-solid fa-inbox"
) {
  if (!containerElement) return;
  containerElement.innerHTML = `
        <div class="empty-state">
            <i class="${iconClass}"></i>
            <p>${message}</p>
        </div>
    `;
  // ESSENCIAL: Garante que o contêiner seja um bloco simples.
  containerElement.style.display = "block";
}

/**
 * Renderiza um estado de erro em um container.
 * @param {HTMLElement} containerElement - O elemento container.
 * @param {string} [message='Ocorreu um erro ao carregar os dados.'] - A mensagem de erro.
 */
function renderErrorState(
  containerElement,
  message = "Ocorreu um erro ao carregar os dados."
) {
  if (!containerElement) return;
  containerElement.innerHTML = `
        <div class="empty-state">
            <i class="fa-solid fa-exclamation-triangle"></i>
            <p style="color: var(--accent-red);">${message}</p>
        </div>
    `;
  // ESSENCIAL: Garante que o contêiner seja um bloco simples.
  containerElement.style.display = "block";
}
