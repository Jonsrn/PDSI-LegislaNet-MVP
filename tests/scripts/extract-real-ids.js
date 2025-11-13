/**
 * Script para extrair IDs REAIS do banco de dados
 * Garante que os testes usem apenas dados válidos
 */

const request = require('supertest');

// URLs dos servidores
const WEB_BASE_URL = 'http://localhost:3000';
const TABLET_BASE_URL = 'http://localhost:3003';

// Credenciais de teste (do backup_completo.sql)
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

/**
 * Faz login e retorna o token
 */
async function login(role, baseUrl = WEB_BASE_URL) {
  const credentials = CREDENTIALS[role];

  console.log(`  Fazendo login como ${role}...`);

  const response = await request(baseUrl)
    .post('/api/auth/login')
    .send(credentials);

  if (response.status !== 200) {
    throw new Error(`Login falhou para ${role}: ${response.status} - ${JSON.stringify(response.body)}`);
  }

  console.log(`  ✅ Login ${role} bem-sucedido`);
  return response.body.token;
}

/**
 * Extrai IDs reais do banco via API
 */
async function extractRealIds() {
  console.log('🔍 Extraindo IDs REAIS do banco de dados...\n');

  const realIds = {};

  try {
    // 1. Login com cada role
    console.log('📍 PASSO 1: Autenticação');
    const tokens = {
      super_admin: await login('super_admin'),
      admin_camara: await login('admin_camara'),
      tv: await login('tv')
    };

    // Tentar login vereador (tablet) - não crítico
    try {
      tokens.vereador = await login('vereador', TABLET_BASE_URL);
    } catch (error) {
      console.log('  ⚠️  Servidor tablet (3003) não disponível - pularemos endpoints do tablet');
      tokens.vereador = null;
    }
    console.log('');

    // 2. Buscar Câmara (Del)
    console.log('📍 PASSO 2: Buscando Câmara Municipal de Del');
    const camarasResp = await request(WEB_BASE_URL)
      .get('/api/admin/camaras')
      .set('Authorization', `Bearer ${tokens.super_admin}`);

    if (camarasResp.status !== 200 || !camarasResp.body.data) {
      throw new Error('Falha ao buscar câmaras');
    }

    const camaraDel = camarasResp.body.data.find(c =>
      c.nome_camara && c.nome_camara.includes('Del')
    );

    if (!camaraDel) {
      throw new Error('Câmara Municipal de Del não encontrada');
    }

    realIds.camaraId = camaraDel.id;
    console.log(`  ✅ Câmara: ${camaraDel.nome_camara} (ID: ${realIds.camaraId})`);
    console.log('');

    // 3. Buscar Vereador da câmara Del
    console.log('📍 PASSO 3: Buscando Vereador');
    const vereadoresResp = await request(WEB_BASE_URL)
      .get(`/api/camaras/${realIds.camaraId}/vereadores`)
      .set('Authorization', `Bearer ${tokens.super_admin}`);

    if (vereadoresResp.status !== 200 || !vereadoresResp.body.vereadores) {
      throw new Error('Falha ao buscar vereadores');
    }

    const vereador = vereadoresResp.body.vereadores[0];
    if (!vereador) {
      throw new Error('Nenhum vereador encontrado');
    }

    realIds.vereadorId = vereador.id;
    console.log(`  ✅ Vereador: ${vereador.nome_parlamentar} (ID: ${realIds.vereadorId})`);
    console.log('');

    // 4. Buscar Partido
    console.log('📍 PASSO 4: Buscando Partido');
    const partidosResp = await request(WEB_BASE_URL)
      .get('/api/partidos/')
      .set('Authorization', `Bearer ${tokens.super_admin}`);

    if (partidosResp.status !== 200 || !partidosResp.body.data) {
      throw new Error('Falha ao buscar partidos');
    }

    const partido = partidosResp.body.data[0];
    if (!partido) {
      throw new Error('Nenhum partido encontrado');
    }

    realIds.partidoId = partido.id;
    console.log(`  ✅ Partido: ${partido.sigla} (ID: ${realIds.partidoId})`);
    console.log('');

    // 5. Buscar Sessão
    console.log('📍 PASSO 5: Buscando Sessão');
    const sessoesResp = await request(WEB_BASE_URL)
      .get('/api/sessoes/')
      .set('Authorization', `Bearer ${tokens.admin_camara}`);

    if (sessoesResp.status !== 200 || !sessoesResp.body.data) {
      throw new Error('Falha ao buscar sessões');
    }

    const sessao = sessoesResp.body.data[0];
    if (!sessao) {
      throw new Error('Nenhuma sessão encontrada');
    }

    realIds.sessaoId = sessao.id;
    console.log(`  ✅ Sessão: ${sessao.tipo} - ${sessao.data_sessao} (ID: ${realIds.sessaoId})`);
    console.log('');

    // 6. Buscar Pauta (do backend tablet - estrutura completa)
    console.log('📍 PASSO 6: Buscando Pauta');
    if (tokens.vereador) {
      const pautasResp = await request(TABLET_BASE_URL)
        .get('/api/pautas/')
        .set('Authorization', `Bearer ${tokens.vereador}`);

      if (pautasResp.status === 200 && pautasResp.body.data) {
        // Estrutura: { data: { pendentes: [...], em_andamento: [...], finalizadas: [...] } }
        const allPautas = [
          ...(pautasResp.body.data.pendentes || []),
          ...(pautasResp.body.data.em_andamento || []),
          ...(pautasResp.body.data.finalizadas || [])
        ];

        const pauta = allPautas[0];
        if (pauta) {
          realIds.pautaId = pauta.id;
          console.log(`  ✅ Pauta: ${pauta.nome} (ID: ${realIds.pautaId})`);
        } else {
          console.log(`  ⚠️  Nenhuma pauta encontrada`);
          realIds.pautaId = null;
        }
      } else {
        console.log(`  ⚠️  Falha ao buscar pautas`);
        realIds.pautaId = null;
      }
    } else {
      console.log(`  ⚠️  Servidor tablet indisponível - pulando busca de pautas`);
      realIds.pautaId = null;
    }
    console.log('');

    // 7. Buscar Orador
    console.log('📍 PASSO 7: Buscando Orador');
    const oradoresResp = await request(WEB_BASE_URL)
      .get('/api/sessoes/oradores')
      .set('Authorization', `Bearer ${tokens.admin_camara}`);

    if (oradoresResp.status === 200 && oradoresResp.body.data && oradoresResp.body.data.length > 0) {
      const orador = oradoresResp.body.data[0];
      realIds.oradorId = orador.id;
      console.log(`  ✅ Orador encontrado (ID: ${realIds.oradorId})`);
    } else {
      console.log(`  ⚠️  Nenhum orador encontrado (não é crítico)`);
      realIds.oradorId = null;
    }
    console.log('');

    // 8. Buscar User ID (para testes de users)
    console.log('📍 PASSO 8: Buscando User ID');
    const usersResp = await request(WEB_BASE_URL)
      .get(`/api/camaras/${realIds.camaraId}/users/`)
      .set('Authorization', `Bearer ${tokens.super_admin}`);

    if (usersResp.status === 200 && usersResp.body.users && usersResp.body.users.length > 0) {
      const user = usersResp.body.users[0];
      realIds.userId = user.id;
      console.log(`  ✅ User: ${user.nome} (ID: ${realIds.userId})`);
    } else {
      console.log(`  ⚠️  Nenhum user encontrado (não é crítico)`);
      realIds.userId = null;
    }
    console.log('');

    // 9. Salvar em arquivo
    console.log('💾 Salvando IDs em arquivo...');
    const fs = require('fs');
    const path = require('path');

    const outputPath = path.join(__dirname, '../config/testData.js');
    const content = `/**
 * IDs REAIS extraídos do banco de dados
 * Gerado automaticamente por extract-real-ids.js
 * Data: ${new Date().toISOString()}
 */

const REAL_IDS = ${JSON.stringify(realIds, null, 2)};

const CREDENTIALS = ${JSON.stringify(CREDENTIALS, null, 2)};

const WEB_BASE_URL = '${WEB_BASE_URL}';
const TABLET_BASE_URL = '${TABLET_BASE_URL}';

module.exports = {
  REAL_IDS,
  CREDENTIALS,
  WEB_BASE_URL,
  TABLET_BASE_URL
};
`;

    fs.writeFileSync(outputPath, content, 'utf8');
    console.log(`  ✅ Arquivo salvo: ${outputPath}`);
    console.log('');

    // 10. Resumo
    console.log('=' .repeat(80));
    console.log('📋 RESUMO DOS IDs EXTRAÍDOS:');
    console.log('=' .repeat(80));
    console.log(JSON.stringify(realIds, null, 2));
    console.log('=' .repeat(80));
    console.log('\n✅ Extração concluída com sucesso!\n');

    return realIds;

  } catch (error) {
    console.error('\n❌ ERRO durante extração de IDs:');
    console.error(`   ${error.message}`);
    console.error('\n⚠️  Verifique se:');
    console.error('   1. Os servidores estão rodando (porta 3000 e 3003)');
    console.error('   2. O banco de dados foi restaurado com backup_completo.sql');
    console.error('   3. As credenciais estão corretas\n');
    process.exit(1);
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  extractRealIds()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Erro fatal:', err);
      process.exit(1);
    });
}

module.exports = { extractRealIds };
