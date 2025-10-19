// web/js/auth.js - Sistema de autenticação seguro para o frontend

class AuthManager {
    constructor() {
        this.tokenKey = 'authToken';
        this.userKey = 'userData';
        this.sessionTimeout = 24 * 60 * 60 * 1000; // 24 horas
        this.refreshThreshold = 15 * 60 * 1000; // 15 minutos
        this.initialized = false;
        
        // Bind methods
        this.init = this.init.bind(this);
        this.checkAuth = this.checkAuth.bind(this);
        this.logout = this.logout.bind(this);
    }

    /**
     * Inicializa o sistema de autenticação
     */
    init() {
        if (this.initialized) return;
        
        // Verifica autenticação na inicialização
        this.checkAuth();
        
        // Monitora mudanças no localStorage (múltiplas abas)
        window.addEventListener('storage', (e) => {
            if (e.key === this.tokenKey && !e.newValue) {
                this.logout();
            }
        });
        
        // Verifica token periodicamente
        setInterval(() => {
            this.checkTokenValidity();
        }, 5 * 60 * 1000); // A cada 5 minutos
        
        this.initialized = true;
    }

    /**
     * Verifica se o usuário está autenticado
     */
    checkAuth() {
        const token = this.getToken();
        const user = this.getUser();
        
        if (!token || !user) {
            this.redirectToLogin();
            return false;
        }
        
        // Verifica se o token está próximo do vencimento
        if (this.isTokenNearExpiration(token)) {
            this.showTokenWarning();
        }
        
        return true;
    }

    /**
     * Obtém o token do localStorage
     */
    getToken() {
        try {
            const token = localStorage.getItem(this.tokenKey);
            
            if (!token) return null;
            
            // Verifica formato básico
            if (!this.isValidTokenFormat(token)) {
                this.clearAuth();
                return null;
            }
            
            return token;
        } catch (error) {
            console.error('Error getting token:', error);
            this.clearAuth();
            return null;
        }
    }

    /**
     * Obtém dados do usuário
     */
    getUser() {
        try {
            const userData = localStorage.getItem(this.userKey);
            return userData ? JSON.parse(userData) : null;
        } catch (error) {
            console.error('Error getting user data:', error);
            return null;
        }
    }

    /**
     * Salva dados de autenticação
     */
    setAuthData(token, userData) {
        try {
            localStorage.setItem(this.tokenKey, token);
            localStorage.setItem(this.userKey, JSON.stringify({
                ...userData,
                loginTime: Date.now()
            }));
        } catch (error) {
            console.error('Error saving auth data:', error);
            throw new Error('Não foi possível salvar dados de autenticação');
        }
    }

    /**
     * Limpa dados de autenticação
     */
    clearAuth() {
        try {
            localStorage.removeItem(this.tokenKey);
            localStorage.removeItem(this.userKey);
        } catch (error) {
            console.error('Error clearing auth data:', error);
        }
    }

    /**
     * Faz logout do usuário
     */
    logout(showMessage = true) {
        this.clearAuth();
        
        if (showMessage) {
            this.showMessage('Sessão encerrada com sucesso', 'info');
        }
        
        this.redirectToLogin();
    }

    /**
     * Redireciona para login
     */
    redirectToLogin() {
        const currentPath = window.location.pathname;
        const loginPath = '/app/login.html';
        
        if (currentPath !== loginPath) {
            window.location.href = loginPath;
        }
    }

    /**
     * Verifica formato básico do token JWT
     */
    isValidTokenFormat(token) {
        if (!token || typeof token !== 'string') return false;
        
        const parts = token.split('.');
        if (parts.length !== 3) return false;
        
        try {
            // Tenta decodificar o payload
            const payload = JSON.parse(atob(parts[1]));
            return payload && typeof payload === 'object';
        } catch {
            return false;
        }
    }

    /**
     * Extrai informações do token
     */
    getTokenInfo(token) {
        try {
            const parts = token.split('.');
            const payload = JSON.parse(atob(parts[1]));
            
            return {
                exp: payload.exp,
                iat: payload.iat,
                sub: payload.sub,
                email: payload.email,
                role: payload.role
            };
        } catch {
            return null;
        }
    }

    /**
     * Verifica se o token está próximo do vencimento
     */
    isTokenNearExpiration(token) {
        const tokenInfo = this.getTokenInfo(token);
        if (!tokenInfo || !tokenInfo.exp) return false;
        
        const now = Math.floor(Date.now() / 1000);
        const threshold = 15 * 60; // 15 minutos
        
        return (tokenInfo.exp - now) <= threshold;
    }

    /**
     * Verifica validade do token periodicamente
     */
    checkTokenValidity() {
        const token = this.getToken();
        if (!token) return;
        
        const tokenInfo = this.getTokenInfo(token);
        if (!tokenInfo || !tokenInfo.exp) {
            this.logout();
            return;
        }
        
        const now = Math.floor(Date.now() / 1000);
        
        // Token expirado
        if (now >= tokenInfo.exp) {
            this.showMessage('Sessão expirada. Faça login novamente.', 'warning');
            this.logout(false);
            return;
        }
        
        // Token próximo do vencimento
        if (this.isTokenNearExpiration(token)) {
            this.showTokenWarning();
        }
    }

    /**
     * Mostra aviso de token próximo ao vencimento
     */
    showTokenWarning() {
        if (document.querySelector('.token-warning')) return;
        
        this.showMessage(
            'Sua sessão expirará em breve. Salve seu trabalho.',
            'warning',
            10000
        );
    }

    /**
     * Faz requisição autenticada
     */
    async authenticatedFetch(url, options = {}) {
        const token = this.getToken();
        
        if (!token) {
            this.redirectToLogin();
            throw new Error('Token não disponível');
        }

        const authHeaders = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            ...options.headers
        };

        try {
            const response = await fetch(url, {
                ...options,
                headers: authHeaders
            });

            // Token inválido ou expirado
            if (response.status === 401) {
                const errorData = await response.json().catch(() => ({}));
                
                if (errorData.code === 'BLACKLISTED_TOKEN' || 
                    errorData.code === 'MALFORMED_TOKEN') {
                    this.showMessage('Token inválido. Faça login novamente.', 'error');
                    this.logout(false);
                    throw new Error('Token inválido');
                }
                
                this.logout();
                throw new Error('Sessão expirada');
            }

            // Verifica aviso de token próximo ao vencimento
            const tokenWarning = response.headers.get('X-Token-Warning');
            if (tokenWarning) {
                this.showTokenWarning();
            }

            return response;
            
        } catch (error) {
            if (error.message.includes('Failed to fetch')) {
                this.showMessage('Erro de conexão. Verifique sua internet.', 'error');
            }
            throw error;
        }
    }

    /**
     * Verifica se é super admin
     */
    isSuperAdmin() {
        const user = this.getUser();
        return user && user.role === 'super_admin';
    }

    /**
     * Verifica se é admin de câmara
     */
    isAdminCamara() {
        const user = this.getUser();
        return user && user.role === 'admin_camara';
    }

    /**
     * Mostra mensagem para o usuário
     */
    showMessage(message, type = 'info', duration = 5000) {
        // Remove mensagem existente
        const existing = document.querySelector('.auth-message');
        if (existing) existing.remove();

        const messageEl = document.createElement('div');
        messageEl.className = `auth-message auth-message-${type}`;
        messageEl.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 16px;
            border-radius: 6px;
            color: white;
            font-weight: 500;
            z-index: 10000;
            max-width: 300px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            ${type === 'error' ? 'background-color: #da3633;' : ''}
            ${type === 'warning' ? 'background-color: #f08833;' : ''}
            ${type === 'info' ? 'background-color: #58a6ff;' : ''}
            ${type === 'success' ? 'background-color: #2ea043;' : ''}
        `;
        messageEl.textContent = message;

        document.body.appendChild(messageEl);

        // Remove após duração especificada
        setTimeout(() => {
            if (messageEl.parentNode) {
                messageEl.remove();
            }
        }, duration);
    }
}

// Instância global
const authManager = new AuthManager();

// Auto-inicializar quando DOM carregar
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', authManager.init);
} else {
    authManager.init();
}

// Expor globalmente
window.authManager = authManager;