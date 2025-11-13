/**
 * IDs REAIS extraídos do banco de dados
 * Gerado automaticamente por extract-real-ids.js
 * Data: 2025-11-07T22:19:37.361Z
 */

const REAL_IDS = {
  "camaraId": "a5df7317-35d5-47e0-955f-668862ed00ac",
  "vereadorId": "7b1c755a-580e-46e9-9dbf-d6cc6350e076",
  "partidoId": "1ea28cc3-2d6d-473b-a5b9-87ed5d9904dc",
  "sessaoId": "134a1d20-840d-4a65-a8dc-4040230a517c",
  "pautaId": null,
  "oradorId": null,
  "userId": null
};

const CREDENTIALS = {
  "super_admin": {
    "email": "jffilho618@gmail.com",
    "password": "2512"
  },
  "admin_camara": {
    "email": "del@exemplo.com",
    "password": "123456"
  },
  "tv": {
    "email": "tv@del.com",
    "password": "Tvdel123@"
  },
  "vereador": {
    "email": "marcilene@del.com",
    "password": "Marcilene123@"
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
