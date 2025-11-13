/**
 * Dados de teste
 * Este arquivo será substituído pelo script extract-real-ids.js
 * quando os IDs reais forem extraídos do banco
 */

const REAL_IDS = {
  // IDs serão preenchidos após executar: node tests/scripts/extract-real-ids.js
  camaraId: null,
  vereadorId: null,
  partidoId: null,
  sessaoId: null,
  pautaId: null,
  oradorId: null,
  userId: null
};

const CREDENTIALS = {
  super_admin: {
    email: 'jffilho618@gmail.com',
    password: '2512'
  },
  admin_camara: {
    email: 'del@exemplo.com',
    password: '123456'
  },
  tv: {
    email: 'tv@del.com',
    password: 'Tvdel123@'
  },
  vereador: {
    email: 'marcilene@del.com',
    password: 'Marcilene123@'
  }
};

const WEB_BASE_URL = 'http://localhost:3000';
const TABLET_BASE_URL = 'http://localhost:3003';

module.exports = {
  REAL_IDS,
  CREDENTIALS,
  WEB_BASE_URL,
  TABLET_BASE_URL
};
