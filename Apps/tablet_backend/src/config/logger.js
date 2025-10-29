const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');

// Configuração dos logs com rotação diária
const createLogger = (context) => {
  const logsDir = path.join(__dirname, '../../logs');

  const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
      winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss'
      }),
      winston.format.errors({ stack: true }),
      winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
        let log = `[${timestamp}] [${context}] [${level.toUpperCase()}] ${message}`;

        // Adicionar stack trace se houver erro
        if (stack) {
          log += `\nStack: ${stack}`;
        }

        // Adicionar metadados se houver
        if (Object.keys(meta).length > 0) {
          log += `\nMeta: ${JSON.stringify(meta, null, 2)}`;
        }

        return log;
      })
    ),
    transports: [
      // Console para desenvolvimento
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.simple()
        )
      }),

      // Arquivo de log geral com rotação
      new DailyRotateFile({
        filename: path.join(logsDir, 'tablet_backend_%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        maxSize: process.env.LOG_MAX_SIZE || '20m',
        maxFiles: process.env.LOG_MAX_FILES || '14d',
        level: 'info'
      }),

      // Arquivo específico para erros
      new DailyRotateFile({
        filename: path.join(logsDir, 'tablet_errors_%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        maxSize: process.env.LOG_MAX_SIZE || '20m',
        maxFiles: process.env.LOG_MAX_FILES || '14d',
        level: 'error'
      }),

      // Arquivo específico para autenticação
      new DailyRotateFile({
        filename: path.join(logsDir, 'tablet_auth_%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        maxSize: process.env.LOG_MAX_SIZE || '20m',
        maxFiles: process.env.LOG_MAX_FILES || '14d',
        level: 'info'
      })
    ]
  });

  return {
    info: (message, meta = {}) => logger.info(message, meta),
    error: (message, meta = {}) => logger.error(message, meta),
    warn: (message, meta = {}) => logger.warn(message, meta),
    debug: (message, meta = {}) => logger.debug(message, meta),
    log: (message, meta = {}) => logger.info(message, meta) // Alias para compatibilidade
  };
};

module.exports = createLogger;