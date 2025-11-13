// test_middleware_debug.js - Script para debugar os middlewares de autorização
const fetch = require("node-fetch");
const chalk = require("chalk");

const BASE_URL = "http://localhost:3000";

// Usuários de teste
const TEST_USERS = {
  super_admin: {
    email: "jffilho618@gmail.com",
    password: "2512",
    expectedRole: "super_admin",
  },
  admin_camara: {
    email: "del@exemplo.com",
    password: "123456",
    expectedRole: "admin_camara",
  },
  tv: {
    email: "tv@del.com",
    password: "Tvdel123@",
    expectedRole: "tv",
  },
  vereador: {
    email: "ramon@del.com",
    password: "Ramon123@",
    expectedRole: "vereador",
  },
};

async function makeRequest(url, options = {}) {
  try {
    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      ...options,
    });

    const data = await response.text();
    let jsonData;
    try {
      jsonData = JSON.parse(data);
    } catch {
      jsonData = { message: data };
    }

    return {
      status: response.status,
      ok: response.ok,
      data: jsonData,
      headers: response.headers,
    };
  } catch (error) {
    return {
      status: 0,
      ok: false,
      error: error.message,
    };
  }
}

async function testSpecificEndpoint() {
  console.log(chalk.blue("🔍 TESTE ESPECÍFICO DE MIDDLEWARE DE AUTORIZAÇÃO"));
  console.log("=".repeat(60));

  // 1. Fazer login com vereador
  console.log(chalk.yellow("1. Fazendo login como VEREADOR..."));
  const loginResponse = await makeRequest(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    body: JSON.stringify(TEST_USERS.vereador),
  });

  if (!loginResponse.ok) {
    console.log(chalk.red("❌ Falha no login do vereador"));
    return;
  }

  const token = loginResponse.data.token;
  console.log(chalk.green(`✅ Login realizado com sucesso`));
  console.log(chalk.gray(`Token: ${token.substring(0, 30)}...`));

  // 2. Testar acesso a /api/pautas (deve ser negado agora)
  console.log(chalk.yellow("\n2. Testando acesso a /api/pautas..."));
  const pautasResponse = await makeRequest(`${BASE_URL}/api/pautas`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  console.log(chalk.blue(`Status: ${pautasResponse.status}`));
  console.log(
    chalk.blue(`Response: ${JSON.stringify(pautasResponse.data, null, 2)}`)
  );

  if (pautasResponse.status === 403) {
    console.log(chalk.green("✅ SUCESSO: Acesso negado corretamente (403)"));
  } else if (pautasResponse.status === 401) {
    console.log(
      chalk.yellow("⚠️  Token inválido ou middleware não aplicado (401)")
    );
  } else if (pautasResponse.status === 200) {
    console.log(
      chalk.red("❌ PROBLEMA: Acesso permitido quando deveria ser negado (200)")
    );
  } else {
    console.log(chalk.orange(`🤔 Status inesperado: ${pautasResponse.status}`));
  }

  // 3. Testar acesso a /api/votacao-ao-vivo/status (deve ser negado agora)
  console.log(
    chalk.yellow("\n3. Testando acesso a /api/votacao-ao-vivo/status...")
  );
  const votacaoResponse = await makeRequest(
    `${BASE_URL}/api/votacao-ao-vivo/status/a5df7317-35d5-47e0-955f-668862ed00ac`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  console.log(chalk.blue(`Status: ${votacaoResponse.status}`));
  console.log(
    chalk.blue(`Response: ${JSON.stringify(votacaoResponse.data, null, 2)}`)
  );

  if (votacaoResponse.status === 403) {
    console.log(chalk.green("✅ SUCESSO: Acesso negado corretamente (403)"));
  } else if (votacaoResponse.status === 401) {
    console.log(
      chalk.yellow("⚠️  Token inválido ou middleware não aplicado (401)")
    );
  } else if (votacaoResponse.status === 200) {
    console.log(
      chalk.red("❌ PROBLEMA: Acesso permitido quando deveria ser negado (200)")
    );
  } else {
    console.log(
      chalk.orange(`🤔 Status inesperado: ${votacaoResponse.status}`)
    );
  }

  // 4. Testar com admin_camara para verificar se funciona
  console.log(
    chalk.yellow("\n4. Testando com ADMIN_CAMARA para comparação...")
  );
  const adminLoginResponse = await makeRequest(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    body: JSON.stringify(TEST_USERS.admin_camara),
  });

  if (adminLoginResponse.ok) {
    const adminToken = adminLoginResponse.data.token;
    const adminPautasResponse = await makeRequest(`${BASE_URL}/api/pautas`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });

    console.log(chalk.blue(`Admin Status: ${adminPautasResponse.status}`));
    if (adminPautasResponse.status === 200) {
      console.log(
        chalk.green("✅ ADMIN_CAMARA tem acesso correto a /api/pautas")
      );
    } else {
      console.log(
        chalk.red(
          `❌ ADMIN_CAMARA não consegue acessar /api/pautas: ${adminPautasResponse.status}`
        )
      );
    }
  }

  console.log(chalk.cyan("\n📋 RESUMO:"));
  console.log(
    chalk.gray(
      "- Se VEREADOR tem acesso (200), o middleware não está funcionando"
    )
  );
  console.log(
    chalk.gray("- Se VEREADOR é negado (403), o middleware está funcionando")
  );
  console.log(chalk.gray("- ADMIN_CAMARA deve sempre ter acesso (200)"));
}

if (require.main === module) {
  testSpecificEndpoint().catch((error) => {
    console.error(chalk.red("Erro no teste:"), error);
  });
}
