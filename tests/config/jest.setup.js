/**
 * Setup global para os testes Jest
 * Executado antes de todos os testes
 */

// Aumentar timeout global para testes que dependem de API
jest.setTimeout(10000);

// Log de início dos testes
console.log('\n🧪 Iniciando suite de testes LegislaNet\n');

// Configurações globais
global.console = {
  ...console,
  // Suprimir logs desnecessários durante testes
  // Remover esta linha se quiser ver todos os logs
  // log: jest.fn(),
};
