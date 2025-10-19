// src/utils/auditLogger.js

const fs = require('fs').promises;
const path = require('path');
const createLogger = require('./logger');

class AuditLogger {
    constructor() {
        this.logger = createLogger('AUDIT');
        this.auditDir = path.join(__dirname, '../../logs/audit');
        this.ensureAuditDir();
    }

    async ensureAuditDir() {
        try {
            await fs.mkdir(this.auditDir, { recursive: true });
        } catch (error) {
            this.logger.error('Failed to create audit directory:', error.message);
        }
    }

    /**
     * Registra uma operação administrativa
     */
    async logAdminOperation(operation, user, details = {}) {
        const auditEntry = {
            timestamp: new Date().toISOString(),
            type: 'ADMIN_OPERATION',
            operation,
            user: {
                id: user.id,
                email: user.email,
                role: user.role || 'unknown'
            },
            details,
            ip: details.ip,
            userAgent: details.userAgent,
            sessionId: this.generateSessionId(user.id)
        };

        await this.writeAuditLog(auditEntry);
        this.logger.log(`Admin Operation: ${operation}`, auditEntry);
    }

    /**
     * Registra tentativas de autenticação
     */
    async logAuthAttempt(type, email, success, details = {}) {
        const auditEntry = {
            timestamp: new Date().toISOString(),
            type: 'AUTH_ATTEMPT',
            authType: type,
            email,
            success,
            details,
            ip: details.ip,
            userAgent: details.userAgent
        };

        await this.writeAuditLog(auditEntry);
        this.logger.log(`Auth Attempt: ${type} - ${success ? 'SUCCESS' : 'FAILED'}`, auditEntry);
    }

    /**
     * Registra violações de segurança
     */
    async logSecurityViolation(violation, details = {}) {
        const auditEntry = {
            timestamp: new Date().toISOString(),
            type: 'SECURITY_VIOLATION',
            violation,
            details,
            severity: details.severity || 'MEDIUM',
            ip: details.ip,
            userAgent: details.userAgent
        };

        await this.writeAuditLog(auditEntry);
        this.logger.error(`Security Violation: ${violation}`, auditEntry);
    }

    /**
     * Registra operações em dados sensíveis
     */
    async logDataOperation(operation, tableName, recordId, user, changes = {}) {
        const auditEntry = {
            timestamp: new Date().toISOString(),
            type: 'DATA_OPERATION',
            operation,
            table: tableName,
            recordId,
            user: {
                id: user.id,
                email: user.email
            },
            changes,
            sessionId: this.generateSessionId(user.id)
        };

        await this.writeAuditLog(auditEntry);
        this.logger.log(`Data Operation: ${operation} on ${tableName}`, auditEntry);
    }

    /**
     * Escreve entrada de auditoria no arquivo
     */
    async writeAuditLog(entry) {
        try {
            const fileName = `audit-${new Date().toISOString().split('T')[0]}.log`;
            const filePath = path.join(this.auditDir, fileName);
            const logLine = JSON.stringify(entry) + '\n';
            
            await fs.appendFile(filePath, logLine, 'utf8');
        } catch (error) {
            this.logger.error('Failed to write audit log:', error.message);
        }
    }

    /**
     * Gera um ID de sessão baseado no usuário e timestamp
     */
    generateSessionId(userId) {
        const timestamp = Date.now();
        return `${userId}-${timestamp}`.substring(0, 32);
    }

    /**
     * Busca logs de auditoria por filtros
     */
    async searchAuditLogs(filters = {}) {
        try {
            const { startDate, endDate, type, userId, operation } = filters;
            const logs = [];
            
            const files = await fs.readdir(this.auditDir);
            const logFiles = files.filter(file => file.endsWith('.log'));
            
            for (const file of logFiles) {
                const filePath = path.join(this.auditDir, file);
                const content = await fs.readFile(filePath, 'utf8');
                const lines = content.trim().split('\n');
                
                for (const line of lines) {
                    if (!line.trim()) continue;
                    
                    try {
                        const entry = JSON.parse(line);
                        
                        // Aplicar filtros
                        if (startDate && new Date(entry.timestamp) < new Date(startDate)) continue;
                        if (endDate && new Date(entry.timestamp) > new Date(endDate)) continue;
                        if (type && entry.type !== type) continue;
                        if (userId && entry.user?.id !== userId) continue;
                        if (operation && entry.operation !== operation) continue;
                        
                        logs.push(entry);
                    } catch (parseError) {
                        this.logger.error('Failed to parse audit log line:', parseError.message);
                    }
                }
            }
            
            return logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        } catch (error) {
            this.logger.error('Failed to search audit logs:', error.message);
            return [];
        }
    }

    /**
     * Limpa logs antigos (mais de X dias)
     */
    async cleanOldLogs(daysToKeep = 90) {
        try {
            const files = await fs.readdir(this.auditDir);
            const now = new Date();
            const cutoffDate = new Date(now.getTime() - (daysToKeep * 24 * 60 * 60 * 1000));
            
            let cleaned = 0;
            for (const file of files) {
                if (!file.endsWith('.log')) continue;
                
                const filePath = path.join(this.auditDir, file);
                const stats = await fs.stat(filePath);
                
                if (stats.mtime < cutoffDate) {
                    await fs.unlink(filePath);
                    cleaned++;
                }
            }
            
            if (cleaned > 0) {
                this.logger.log(`Cleaned ${cleaned} old audit log files`);
            }
            
            return cleaned;
        } catch (error) {
            this.logger.error('Failed to clean old audit logs:', error.message);
            return 0;
        }
    }

    /**
     * Gera relatório de atividade
     */
    async generateActivityReport(startDate, endDate) {
        const logs = await this.searchAuditLogs({ startDate, endDate });
        
        const report = {
            period: { start: startDate, end: endDate },
            totalEvents: logs.length,
            byType: {},
            byUser: {},
            byOperation: {},
            securityEvents: 0,
            failedAuth: 0
        };
        
        for (const log of logs) {
            // Por tipo
            report.byType[log.type] = (report.byType[log.type] || 0) + 1;
            
            // Por usuário
            if (log.user?.email) {
                report.byUser[log.user.email] = (report.byUser[log.user.email] || 0) + 1;
            }
            
            // Por operação
            if (log.operation) {
                report.byOperation[log.operation] = (report.byOperation[log.operation] || 0) + 1;
            }
            
            // Eventos de segurança
            if (log.type === 'SECURITY_VIOLATION') {
                report.securityEvents++;
            }
            
            // Autenticações falhadas
            if (log.type === 'AUTH_ATTEMPT' && !log.success) {
                report.failedAuth++;
            }
        }
        
        return report;
    }
}

// Singleton instance
const auditLogger = new AuditLogger();

module.exports = auditLogger;