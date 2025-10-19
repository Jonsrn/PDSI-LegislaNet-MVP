// public/js/pagination.js

function createPaginationControls({
    containerId,
    currentPage,
    totalItems,
    itemsPerPage,
    onPageChange
}) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = '';
    const totalPages = Math.ceil(totalItems / itemsPerPage);

    if (totalPages <= 1) {
        // Oculta o container se não houver páginas
        const paginationWrapper = container.closest('.pagination-container');
        if (paginationWrapper) paginationWrapper.style.display = 'none';
        return;
    }
    
    // Garante que o container está visível
    const paginationWrapper = container.closest('.pagination-container');
    if (paginationWrapper) paginationWrapper.style.display = 'flex';

    const createButton = (text, page, isDisabled = false, isActive = false) => {
        const btn = document.createElement('button');
        btn.innerHTML = text;
        btn.disabled = isDisabled;
        if (isActive) btn.classList.add('active');
        btn.addEventListener('click', () => {
            if (!isDisabled) onPageChange(page);
        });
        return btn;
    };

    const createEllipsis = () => {
        const span = document.createElement('span');
        span.className = 'pagination-ellipsis';
        span.textContent = '...';
        return span;
    };

    const pagesToShow = new Set();

    // Lógica para adicionar páginas de forma inteligente
    pagesToShow.add(1);
    pagesToShow.add(totalPages);
    pagesToShow.add(currentPage);
    if (currentPage > 1) pagesToShow.add(currentPage - 1);
    if (currentPage < totalPages) pagesToShow.add(currentPage + 1);

    const sortedPages = Array.from(pagesToShow).sort((a, b) => a - b);

    // Adiciona botão "Anterior"
    container.appendChild(createButton('&laquo;', currentPage - 1, currentPage === 1));

    let lastPage = 0;
    for (const page of sortedPages) {
        if (page > lastPage + 1) {
            container.appendChild(createEllipsis());
        }
        container.appendChild(createButton(page, page, false, page === currentPage));
        lastPage = page;
    }

    // Adiciona botão "Próximo"
    container.appendChild(createButton('&raquo;', currentPage + 1, currentPage === totalPages));
}