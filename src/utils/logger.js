// Sistema de logs padronizado para ser usado nos controllers.
const fs = require('fs');
const path = require('path');

// Criar diretório de logs se não existir
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

const createLogger = (context) => {
    const logFile = path.join(logsDir, `${context.toLowerCase()}.log`);
    const errorFile = path.join(logsDir, 'errors.log');

    const writeLog = (file, level, message, data = '') => {
        const timestamp = new Date().toISOString();
        const logEntry = `[${level}] [${context}] ${timestamp} - ${message} ${data ? JSON.stringify(data) : ''}\n`;

        // Escrever no console
        if (level === 'ERROR') {
            console.error(`[${context} ERROR] ${timestamp} - ${message}`, data);
        } else {
            console.log(`[${context}] ${timestamp} - ${message}`, data);
        }

        // Escrever no arquivo
        try {
            fs.appendFileSync(file, logEntry);
        } catch (err) {
            console.error(`Erro ao escrever no arquivo de log: ${err.message}`);
        }
    };

    return {
        log: (message, data = '') => writeLog(logFile, 'INFO', message, data),
        error: (message, error = '') => {
            writeLog(errorFile, 'ERROR', message, error);
            writeLog(logFile, 'ERROR', message, error);
        }
    };
};

module.exports = createLogger;