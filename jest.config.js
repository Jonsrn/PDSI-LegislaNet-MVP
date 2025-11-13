/**
 * Configuração do Jest para testes do LegislaNet
 */

module.exports = {
  // Ambiente de teste
  testEnvironment: 'node',

  // Padrão de arquivos de teste
  testMatch: [
    '**/tests/**/*.test.js'
  ],

  // Timeout padrão para testes (10 segundos)
  testTimeout: 10000,

  // Executar testes sequencialmente para evitar problemas de rate limit
  maxWorkers: 1,

  // Cobertura de código
  collectCoverageFrom: [
    'src/**/*.js',
    'Apps/tablet_backend/src/**/*.js',
    '!src/config/**',
    '!**/node_modules/**'
  ],

  // Diretório de saída de cobertura
  coverageDirectory: 'tests/reports/coverage',

  // Reporters
  reporters: [
    'default',
    [
      'jest-html-reporter',
      {
        pageTitle: 'Relatório de Testes - LegislaNet',
        outputPath: 'tests/reports/test-results.html',
        includeFailureMsg: true,
        includeConsoleLog: true
      }
    ]
  ],

  // Verbose output
  verbose: true,

  // Não falhar se não houver testes
  passWithNoTests: true,

  // Setup files
  setupFilesAfterEnv: ['<rootDir>/tests/config/jest.setup.js']
};
