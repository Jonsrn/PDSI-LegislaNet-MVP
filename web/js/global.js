/*
 * global.js (Versão Modularizada)
 * Este script gerencia o carregamento de componentes de layout,
 * navegação, e interações globais da UI.
 */

// ===================================================================================
// FUNÇÃO PRINCIPAL DE INICIALIZAÇÃO DO LAYOUT
// ===================================================================================

/**
 * Inicializa o layout da página, carregando os componentes corretos (sidebar, header, etc.)
 * e configurando os listeners de eventos necessários.
 * @param {object} pageConfig - Objeto de configuração da página.
 * @param {string} pageConfig.title - O título a ser exibido no cabeçalho.
 * @param {string} pageConfig.icon - A classe do ícone Font Awesome para o cabeçalho.
 * @param {string} pageConfig.navActive - O ID do item de navegação a ser marcado como ativo.
 */
async function initLayout(pageConfig) {
  const path = window.location.pathname;

  // Determina o contexto (admin, app ou portal) com base no caminho do URL
  // CORREÇÃO: Caminhos alterados para absolutos
  if (path.includes("/admin/")) {
    await loadComponent(
      "/components/admin_sidebar.html",
      "sidebar-placeholder"
    );
    await loadComponent("/components/admin_header.html", "header-placeholder");
  } else if (path.includes("/app/")) {
    await loadComponent("/components/app_sidebar.html", "sidebar-placeholder");
    await loadComponent("/components/app_header.html", "header-placeholder");
  } else if (path.includes("/portal/")) {
    await loadComponent("/components/portal_navbar.html", "navbar-placeholder");
    await loadComponent("/components/portal_footer.html", "footer-placeholder");
  }

  // Após carregar os componentes, configura os elementos dinâmicos
  setupDynamicContent(pageConfig);
  autoFixFormSectionLayout(); // Corrige o layout se necessário
  setupEventListeners();
}

// ===================================================================================
// FUNÇÕES AUXILIARES DE CARREGAMENTO E CONFIGURAÇÃO
// ===================================================================================

/**
 * Carrega um componente HTML de um arquivo e o injeta em um elemento alvo.
 * @param {string} componentPath - Caminho para o arquivo HTML do componente.
 * @param {string} targetElementId - ID do elemento onde o componente será inserido.
 */
async function loadComponent(componentPath, targetElementId) {
  const targetElement = document.getElementById(targetElementId);
  if (!targetElement) return; // Não faz nada se o placeholder não existir

  try {
    const response = await fetch(componentPath);
    if (!response.ok) {
      throw new Error(`Componente não encontrado: ${componentPath}`);
    }
    targetElement.innerHTML = await response.text();
  } catch (error) {
    console.error("Erro ao carregar componente:", error);
    targetElement.innerHTML = `<p style="color:red;">Erro ao carregar componente: ${componentPath}</p>`;
  }
}

/**
 * Configura o conteúdo dinâmico da página, como título do cabeçalho e item de navegação ativo.
 * @param {object} pageConfig - Objeto de configuração da página.
 */
function setupDynamicContent(pageConfig) {
  if (!pageConfig) return;

  // Define o título e o ícone do cabeçalho, se existirem
  const headerTitle = document.getElementById("header-title");
  const headerIcon = document.getElementById("header-icon");
  if (headerTitle && pageConfig.title) {
    headerTitle.textContent = pageConfig.title;
  }
  if (headerIcon && pageConfig.icon) {
    headerIcon.className = `fa-solid ${pageConfig.icon}`;
  }

  // Define o item de navegação ativo na sidebar
  if (pageConfig.navActive) {
    const activeNavItem = document.getElementById(pageConfig.navActive);
    if (activeNavItem) {
      activeNavItem.classList.add("active");
    }
  }
}

/**
 * Configura todos os event listeners globais após o carregamento dos componentes.
 * Isso garante que os botões e links dentro dos componentes funcionem corretamente.
 */
function setupEventListeners() {
  // Listener para o dropdown do perfil de usuário
  const profileBtn = document.getElementById("profileBtn");
  const profileDropdown = document.getElementById("profileDropdown");
  if (profileBtn && profileDropdown) {
    profileBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      profileDropdown.classList.toggle("active");
      profileBtn.classList.toggle("active");
    });
  }

  // Listener para fechar o dropdown ao clicar fora
  window.addEventListener("click", () => {
    if (profileDropdown && profileDropdown.classList.contains("active")) {
      profileDropdown.classList.remove("active");
      profileBtn.classList.remove("active");
    }
  });

  // Listeners para os links de navegação da sidebar
  const navLinks = document.querySelectorAll("a[data-page]");
  navLinks.forEach((link) => {
    // Remove listeners antigos para evitar duplicação, se houver
    link.replaceWith(link.cloneNode(true));
  });
  // Adiciona os novos listeners
  document.querySelectorAll("a[data-page]").forEach((link) => {
    link.addEventListener("click", function (e) {
      e.preventDefault();
      const pageName = this.getAttribute("data-page");
      navigateToPage(pageName);
    });
  });

  // Animações de fade-in
  initializeFadeInObserver();
}

// ===================================================================================
// LÓGICA DE NAVEGAÇÃO (ADAPTADA DO SEU ARQUIVO ORIGINAL)
// ===================================================================================

function isAdminContext() {
  return window.location.pathname.includes("/admin/");
}

function navigateToPage(pageName) {
  const mainContent = document.getElementById("mainContent");
  const targetUrl = getPageUrl(pageName);

  if (!targetUrl) {
    console.warn(`URL não encontrada para a página: ${pageName}`);
    return;
  }

  if (mainContent) {
    mainContent.classList.add("transitioning");
    setTimeout(() => {
      window.location.href = targetUrl;
    }, 200);
  } else {
    window.location.href = targetUrl;
  }
}

function getPageUrl(pageName) {
  // CORREÇÃO: Caminhos alterados para absolutos
  const pageMap = {
    // Admin pages
    dashboard_admin: "/admin/dashboard_admin.html",
    "nova-camara": "/admin/nova_camara.html",
    "novo-partido": "/admin/novo_partido.html",
    partidos: "/admin/partidos.html", // ADICIONADO
    configuracoes: "/admin/configuracoes.html", // ADICIONADO
    relatorios: "/admin/relatorios.html", // ADICIONADO
    // App pages
    dashboard: "/app/dashboard.html",
    cadastro: "/app/cadastro_de_pautas.html",
    nova_pauta: "/app/nova_pauta.html",
    editar_pauta: "/app/editar_pauta.html",
    vereadores: "/app/vereadores.html",
    editar_vereador: "/app/editar_vereador.html",
    ordem_do_dia: "/app/ordem_do_dia.html",
    relatorio: "/app/relatorio.html",
    perfil: "/app/perfil_camara.html",
    sessoes: "/app/sessoes.html",
    painel_controle: "/app/painel_controle.html",
  };

  // Adapta a chave de busca para o contexto admin
  const key =
    isAdminContext() && pageName === "dashboard" ? "dashboard_admin" : pageName;

  return pageMap[key];
}

// ===================================================================================
// ANIMAÇÕES (ADAPTADO DO SEU ARQUIVO ORIGINAL)
// ===================================================================================

function initializeFadeInObserver() {
  const elementsToFadeIn = document.querySelectorAll(".fade-in");
  if (elementsToFadeIn.length === 0) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1 }
  );

  elementsToFadeIn.forEach((el) => observer.observe(el));
}

/**
 * Sistema Unificado de Animações Fade-In
 * Suporta: .fade-in, .animate-on-load, .fade-in-section
 */
function initUnifiedAnimations() {
  // 1. Animações imediatas (hero sections)
  const immediateElements = document.querySelectorAll(".animate-on-load");
  immediateElements.forEach((el, index) => {
    setTimeout(() => {
      el.classList.add("visible");
    }, (index + 1) * 200);
  });

  // 2. Animações durante scroll (Intersection Observer)
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          observer.unobserve(entry.target); // Para de observar após animar
        }
      });
    },
    {
      threshold: 0.1,
      rootMargin: "0px 0px -50px 0px", // Ativa um pouco antes
    }
  );

  // Observar todos os tipos de elementos
  const scrollElements = document.querySelectorAll(
    ".fade-in, .fade-in-section"
  );
  scrollElements.forEach((el) => observer.observe(el));
}

// Manter compatibilidade com código existente
function initFadeInAnimations() {
  initUnifiedAnimations();
}

// Adiciona um listener global que espera o DOM carregar, mas não inicia o layout.
// O layout será iniciado por uma chamada explícita em cada página HTML.
document.addEventListener("DOMContentLoaded", () => {
  // Funções que não dependem de componentes podem ser chamadas aqui,
  // mas a maioria agora está em setupEventListeners().
  if (localStorage.getItem("showLoginSuccessToast") === "true") {
    // Se a flag existir, mostra o toast
    showToast("Login bem-sucedido!", "success");
    // E remove a flag para não mostrar novamente ao recarregar a página
    localStorage.removeItem("showLoginSuccessToast");
  }
});

// ===================================================================================
// INICIALIZADOR DE COMPONENTES DE UI (ex: Dropdowns de Tabela)
// ===================================================================================

/**
 * Inicializa a interatividade para os dropdowns de status encontrados na página.
 * Procura por elementos com a classe '.status-dropdown' e adiciona os listeners.
 */
function initStatusDropdowns() {
  const statusDropdowns = document.querySelectorAll(".status-dropdown");
  if (statusDropdowns.length === 0) return;

  const closeAllDropdowns = (exceptThisOne = null) => {
    document.querySelectorAll(".status-dropdown.open").forEach((dropdown) => {
      if (dropdown !== exceptThisOne) {
        dropdown.classList.remove("open");
      }
    });
  };

  statusDropdowns.forEach((dropdown) => {
    const badgeWrapper = dropdown.querySelector(".status-badge-wrapper");
    const dropdownMenu = dropdown.querySelector(".dropdown-menu");

    if (!badgeWrapper || !dropdownMenu) return;

    badgeWrapper.addEventListener("click", (event) => {
      event.stopPropagation();
      const wasOpen = dropdown.classList.contains("open");
      closeAllDropdowns();
      if (!wasOpen) {
        dropdown.classList.add("open");
      }
    });

    dropdownMenu.querySelectorAll(".dropdown-item").forEach((item) => {
      item.addEventListener("click", () => {
        const newValue = item.getAttribute("data-value");
        const newText = item.textContent;
        const mainBadge = dropdown.querySelector(
          ".status-badge-wrapper .status-badge"
        );
        if (mainBadge) {
          mainBadge.className = "status-badge"; // Limpa classes antigas
          mainBadge.classList.add(newValue);
          mainBadge.textContent = newText.toUpperCase();
        }
        console.log(`Status alterado para: ${newValue}`);
      });
    });
  });

  window.addEventListener("click", () => {
    closeAllDropdowns();
  });
}

// ===================================================================================
// SISTEMA DE AUTENTICAÇÃO E PROTEÇÃO DE ROTAS MELHORADO
// ===================================================================================

/**
 * Configuração das rotas por role do usuário
 */
const ROLE_ROUTES = {
  super_admin: {
    module: "admin",
    defaultPage: "/admin/dashboard_admin.html",
    allowedPaths: ["/admin/"],
  },
  admin_camara: {
    module: "app",
    defaultPage: "/app/dashboard.html",
    allowedPaths: ["/app/"],
  },
  tv: {
    module: "tv",
    defaultPage: "/tv/espera.html",
    allowedPaths: ["/tv/"],
  },
  vereador: {
    module: "tablet",
    defaultPage: "/tablet/", // Será usado pelo app tablet
    allowedPaths: ["/tablet/"],
  },
};

/**
 * Decodifica o payload de um token JWT sem validação
 * @param {string} token - O token JWT
 * @returns {object|null} O payload decodificado ou null em caso de erro
 */
function decodeJwtPayload(token) {
  try {
    const payloadBase64 = token.split(".")[1];
    const decodedJson = atob(payloadBase64);
    return JSON.parse(decodedJson);
  } catch (error) {
    console.error("[AUTH_GUARD] Erro ao decodificar token:", error);
    return null;
  }
}

/**
 * Verifica se o token está próximo do vencimento (6 horas antes da expiração)
 * @param {object} tokenPayload - Payload decodificado do token
 * @returns {boolean} true se o token precisa ser validado
 */
function shouldRefreshToken(tokenPayload) {
  if (!tokenPayload || !tokenPayload.exp) return true;

  const now = Math.floor(Date.now() / 1000);
  const timeUntilExpiry = tokenPayload.exp - now;
  const thirtyMinutes = 30 * 60; // 30 minutos em segundos

  // Token dura 3h (10800s), renova quando faltam 30 minutos ou menos
  return timeUntilExpiry <= thirtyMinutes;
}

/**
 * Tenta renovar o token usando o refresh token do Supabase
 * @returns {Promise<boolean>} true se a renovação foi bem-sucedida
 */
async function refreshAuthToken() {
  console.log("[AUTH_GUARD] 🔄 Tentando validar/renovar token...");

  try {
    const authToken = localStorage.getItem("authToken");
    if (!authToken) return false;

    const response = await fetch("/api/auth/refresh", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
    });

    if (response.ok) {
      const data = await response.json();

      // Atualiza os dados no localStorage
      localStorage.setItem("authToken", data.token);
      if (data.user) {
        localStorage.setItem("userData", JSON.stringify(data.user));
        window.currentUser = data.user;
      }

      console.log("[AUTH_GUARD] ✅ Token validado e dados atualizados");
      return true;
    } else {
      console.warn("[AUTH_GUARD] ⚠️ Falha na validação do token");
      return false;
    }
  } catch (error) {
    console.error("[AUTH_GUARD] ❌ Erro ao validar token:", error);
    return false;
  }
}

/**
 * Verifica se o usuário tem permissão para acessar a rota atual
 * @param {string} userRole - Role do usuário
 * @param {string} currentPath - Caminho atual da página
 * @returns {boolean} true se o usuário tem permissão
 */
function hasRoutePermission(userRole, currentPath) {
  const roleConfig = ROLE_ROUTES[userRole];
  if (!roleConfig) return false;

  return roleConfig.allowedPaths.some((allowedPath) =>
    currentPath.startsWith(allowedPath)
  );
}

/**
 * Redireciona o usuário para a página correta baseada no seu role
 * @param {string} userRole - Role do usuário
 * @param {string} currentPath - Caminho atual (opcional)
 */
function redirectToCorrectModule(
  userRole,
  currentPath = window.location.pathname
) {
  const roleConfig = ROLE_ROUTES[userRole];

  if (!roleConfig) {
    console.error(`[AUTH_GUARD] ❌ Role desconhecido: ${userRole}`);
    clearAuthAndRedirectToLogin();
    return;
  }

  // Se já está na rota correta, não redireciona
  if (hasRoutePermission(userRole, currentPath)) {
    console.log(
      `[AUTH_GUARD] ✅ Usuário já está no módulo correto: ${roleConfig.module}`
    );
    return;
  }

  // Redireciona para o módulo correto
  console.log(
    `[AUTH_GUARD] 🔀 Redirecionando ${userRole} para: ${roleConfig.defaultPage}`
  );
  window.location.href = roleConfig.defaultPage;
}

/**
 * Limpa dados de autenticação e redireciona para login
 */
function clearAuthAndRedirectToLogin() {
  console.log(
    "[AUTH_GUARD] 🔄 Limpando autenticação e redirecionando para login..."
  );
  localStorage.removeItem("authToken");
  localStorage.removeItem("userData");
  window.currentUser = null;
  window.location.href = "/app/login.html";
}

/**
 * Função principal de proteção de página com validação completa
 * @param {object} options - Opções de configuração
 * @param {string[]} options.allowedRoles - Roles permitidas para a página (opcional)
 * @param {boolean} options.requireAuth - Se requer autenticação (padrão: true)
 * @param {boolean} options.autoRedirect - Se deve redirecionar automaticamente baseado no role (padrão: true)
 */
async function protectPage(options = {}) {
  const {
    allowedRoles = null,
    requireAuth = true,
    autoRedirect = true,
  } = options;

  console.log("[AUTH_GUARD] 🛡️ Iniciando verificação de autenticação...");

  if (!requireAuth) {
    console.log("[AUTH_GUARD] ℹ️ Página não requer autenticação");
    return true;
  }

  const token = localStorage.getItem("authToken");
  const userData = localStorage.getItem("userData");

  // Verifica se há token
  if (!token) {
    console.warn("[AUTH_GUARD] ❌ Token não encontrado");
    clearAuthAndRedirectToLogin();
    throw new Error("Não autenticado");
  }

  // Decodifica e valida o token
  const tokenPayload = decodeJwtPayload(token);
  if (!tokenPayload) {
    console.warn("[AUTH_GUARD] ❌ Token inválido");
    clearAuthAndRedirectToLogin();
    throw new Error("Token inválido");
  }

  // Verifica se o token expirou
  const now = Math.floor(Date.now() / 1000);
  if (tokenPayload.exp && tokenPayload.exp <= now) {
    console.warn("[AUTH_GUARD] ⏰ Token expirado");

    // Tenta renovar o token
    const refreshSuccess = await refreshAuthToken();
    if (!refreshSuccess) {
      clearAuthAndRedirectToLogin();
      throw new Error("Token expirado e não foi possível renovar");
    }
  }
  // Verifica se precisa renovar em breve
  else if (shouldRefreshToken(tokenPayload)) {
    console.log("[AUTH_GUARD] 🔄 Token próximo do vencimento, renovando...");
    try {
      await refreshAuthToken();
      console.log("[AUTH_GUARD] ✅ Token renovado preventivamente");
    } catch (error) {
      console.warn("[AUTH_GUARD] ⚠️ Renovação automática falhou:", error);
      // Token ainda válido, não bloqueia acesso
    }
  }

  // Valida e carrega dados do usuário
  let currentUser;
  try {
    if (userData) {
      currentUser = JSON.parse(userData);
      window.currentUser = currentUser;
    } else {
      console.warn("[AUTH_GUARD] ⚠️ Dados do usuário não encontrados");
      clearAuthAndRedirectToLogin();
      throw new Error("Dados do usuário não encontrados");
    }
  } catch (error) {
    console.error("[AUTH_GUARD] ❌ Erro ao parsear dados do usuário:", error);
    clearAuthAndRedirectToLogin();
    throw new Error("Dados do usuário corrompidos");
  }

  console.log(
    `[AUTH_GUARD] ✅ Usuário autenticado: ${currentUser.email} (${currentUser.role})`
  );

  // Verifica permissões específicas da página
  if (allowedRoles && !allowedRoles.includes(currentUser.role)) {
    console.error(
      `[AUTH_GUARD] ❌ Acesso negado. Role ${
        currentUser.role
      } não permitido. Permitidos: ${allowedRoles.join(", ")}`
    );

    if (autoRedirect) {
      redirectToCorrectModule(currentUser.role);
    } else {
      throw new Error("Acesso negado");
    }
    return false;
  }

  // Auto-redirecionamento baseado no role (se habilitado)
  if (autoRedirect) {
    const currentPath = window.location.pathname;
    if (!hasRoutePermission(currentUser.role, currentPath)) {
      redirectToCorrectModule(currentUser.role, currentPath);
      return false;
    }
  }

  console.log("[AUTH_GUARD] ✅ Autenticação e autorização bem-sucedidas");
  return true;
}

// ===================================================================================
// INICIALIZAÇÃO AUTOMÁTICA E VERIFICAÇÃO DE SESSÃO
// ===================================================================================

/**
 * Função de inicialização automática da autenticação
 * Verifica periodicamente a validade do token e renova automaticamente
 */
function initializeAuthGuard() {
  console.log("[AUTH_GUARD] 🚀 Inicializando sistema de autenticação...");

  // Verifica token a cada 5 minutos
  const TOKEN_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutos

  setInterval(async () => {
    const token = localStorage.getItem("authToken");
    if (!token) return;

    const tokenPayload = decodeJwtPayload(token);
    if (!tokenPayload) return;

    // Se o token está próximo do vencimento, renova automaticamente
    if (shouldRefreshToken(tokenPayload)) {
      console.log("[AUTH_GUARD] 🔄 Renovação automática de token iniciada...");
      const success = await refreshAuthToken();
      if (!success) {
        console.warn(
          "[AUTH_GUARD] ⚠️ Falha na renovação automática, usuário será deslogado"
        );
        clearAuthAndRedirectToLogin();
      }
    }
  }, TOKEN_CHECK_INTERVAL);

  // Escuta eventos de mudança no localStorage (múltiplas abas)
  window.addEventListener("storage", (e) => {
    if (e.key === "authToken" && !e.newValue) {
      console.log(
        "[AUTH_GUARD] 🔄 Token removido em outra aba, redirecionando..."
      );
      clearAuthAndRedirectToLogin();
    }
  });

  console.log("[AUTH_GUARD] ✅ Sistema de autenticação inicializado");
}

/**
 * Função helper para páginas que precisam de proteção automática
 * @param {object} pageConfig - Configuração da página e autenticação
 */
async function initPageWithAuth(pageConfig) {
  const { auth, ...layoutConfig } = pageConfig;

  // Aplica proteção se configurada
  if (auth) {
    try {
      await protectPage(auth);
    } catch (error) {
      console.error("[AUTH_GUARD] Falha na autenticação da página:", error);
      return false;
    }
  }

  // Inicializa o layout após autenticação bem-sucedida
  if (layoutConfig && Object.keys(layoutConfig).length > 0) {
    await initLayout(layoutConfig);
  }

  return true;
}

// Inicializa o sistema de autenticação quando o DOM estiver pronto
document.addEventListener("DOMContentLoaded", () => {
  initializeAuthGuard();
});

/**
 * Realiza o logout do usuário, invalidando o token no backend e limpando o frontend.
 */
async function logout() {
  // --- LOG DE DEPURAÇÃO ---
  console.log("[DEBUG-FRONTEND] A função logout() foi chamada.");

  const authToken = localStorage.getItem("authToken");

  if (authToken) {
    // --- LOG DE DEPURAÇÃO ---
    console.log(
      "[DEBUG-FRONTEND] Token encontrado. Enviando requisição para /api/auth/logout..."
    );
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      if (!response.ok) {
        console.warn(
          "A invalidação do token no servidor falhou, mas o logout no cliente prosseguirá."
        );
      } else {
        console.log("[AUTH] Token invalidado no servidor com sucesso.");
      }
    } catch (error) {
      console.error("Erro ao contatar o servidor para logout:", error);
    }
  }

  // Limpa os dados locais independentemente da resposta do servidor
  localStorage.removeItem("authToken");
  localStorage.removeItem("userData");

  // Redireciona para a página de login
  window.location.href = "/app/login.html";
}

function autoFixFormSectionLayout() {
  // Procura por containers que precisam de wrappers
  const mainContent = document.querySelector(".main-content");
  if (!mainContent) return;

  // Verifica se já existe .page-content-wrapper
  if (mainContent.querySelector(".page-content-wrapper")) return;

  // Lista de seletores que precisam ser envolvidos pelos wrappers
  const containerSelectors = [
    ".form-section",
    ".pautas-section",
    ".dashboard-section",
    ".content-section",
    ".ordem-dia-section",
    ".oradores-section",
    ".vereadores-section",
    ".votacao-layout", // Adicionado para painel de votação
    ".painel-section", // Adicionado para painel de controle
  ];

  // Procura por qualquer um dos containers diretamente filhos de .main-content
  const containersToWrap = [];
  containerSelectors.forEach((selector) => {
    const elements = mainContent.querySelectorAll(`:scope > ${selector}`);
    elements.forEach((el) => containersToWrap.push(el));
  });

  if (containersToWrap.length === 0) return;

  console.log(
    "🔧 Auto-corrigindo layout: envolvendo containers com wrappers necessários",
    containersToWrap.map((el) => el.className)
  );

  // Cria os wrappers
  const pageContentWrapper = document.createElement("div");
  pageContentWrapper.className = "page-content-wrapper";

  const contentArea = document.createElement("div");
  contentArea.className = "content-area";

  // Move todos os containers encontrados para dentro dos wrappers
  containersToWrap.forEach((container) => {
    contentArea.appendChild(container);
  });

  pageContentWrapper.appendChild(contentArea);
  mainContent.appendChild(pageContentWrapper);
}

// ===================================================================================
// FUNÇÕES DE BADGE INTELIGENTE PARA SIDEBAR
// ===================================================================================

/**
 * Atualiza o badge do Painel de Controle com informações relevantes
 * Badge mostra quantidade de itens que precisam de atenção
 */
async function updatePainelControleBadge() {
  const badge = document.getElementById("painel-badge");
  if (!badge) return;

  try {
    const authToken = localStorage.getItem("authToken");
    if (!authToken) return;

    // Buscar dados que precisam de atenção no painel de controle
    const [sessoesPendentes, pautasPendentes, vereadores] = await Promise.all([
      // Sessões que precisam de atenção (futuras sem pautas)
      fetch("/api/app/sessoes?status=pendente", {
        headers: { Authorization: `Bearer ${authToken}` },
      }).then((r) => (r.ok ? r.json() : { data: [] })),

      // Pautas pendentes de aprovação
      fetch("/api/app/pautas?status=pendente", {
        headers: { Authorization: `Bearer ${authToken}` },
      }).then((r) => (r.ok ? r.json() : { data: [] })),

      // Vereadores inativos (problema que precisa atenção)
      fetch("/api/app/vereadores", {
        headers: { Authorization: `Bearer ${authToken}` },
      }).then((r) => (r.ok ? r.json() : [])),
    ]);

    // Calcular total de itens que precisam atenção
    let totalAtencao = 0;

    // Sessões sem pautas ou problemas
    if (sessoesPendentes.data) {
      totalAtencao += sessoesPendentes.data.length;
    }

    // Pautas pendentes
    if (pautasPendentes.data) {
      totalAtencao += pautasPendentes.data.length;
    }

    // Vereadores inativos
    const vereadoresInativos = vereadores.filter((v) => !v.is_active);
    if (vereadoresInativos.length > 0) {
      totalAtencao += 1; // Conta como 1 problema mesmo que sejam vários vereadores
    }

    // Atualizar badge
    console.log("Atualizando badge do painel de controle:", totalAtencao);
    if (totalAtencao > 0) {
      badge.textContent = totalAtencao > 9 ? "9+" : totalAtencao.toString();
      badge.style.display = "flex";

      // Adicionar cor baseada na urgência
      if (totalAtencao >= 5) {
        badge.style.backgroundColor = "var(--accent-red)";
      } else if (totalAtencao >= 3) {
        badge.style.backgroundColor = "var(--accent-orange)";
      } else {
        badge.style.backgroundColor = "var(--accent-blue)";
      }
    } else {
      badge.style.display = "none";
    }
  } catch (error) {
    console.error("Erro ao atualizar badge do painel de controle:", error);
    // Em caso de erro, esconder o badge
    badge.style.display = "none";
  }
}

// Função para configurar badges "Em breve"
function setupComingSoonBadges() {
  console.log('✨ Badges "Em breve" configurados no sidebar');
}

// Chamar a função de atualização do badge quando a página carregar
document.addEventListener("DOMContentLoaded", () => {
  // Aguardar um pouco para garantir que o sidebar foi carregado
  setTimeout(() => {
    setupComingSoonBadges();
    updatePainelControleBadge();
  }, 1000);

  // Atualizar badge periodicamente (a cada 5 minutos)
  setInterval(updatePainelControleBadge, 5 * 60 * 1000);
});
