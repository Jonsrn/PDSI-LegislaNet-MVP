#!/usr/bin/env node

/**
 * Script de migração automática para atualizar a autenticação em todas as páginas
 *
 * Este script atualiza automaticamente as chamadas antigas de protectPage()
 * para a nova implementação com validação de roles.
 */

const fs = require("fs");
const path = require("path");

// Mapeamento de páginas e seus roles permitidos
const PAGE_ROLES = {
  // Páginas de Admin (Super Admin apenas)
  "admin\\dashboard_admin.html": ["super_admin"],
  "admin\\nova_camara.html": ["super_admin"],
  "admin\\novo_partido.html": ["super_admin"],
  "admin\\partidos.html": ["super_admin"],
  "admin\\configuracoes.html": ["super_admin"],
  "admin\\relatorios.html": ["super_admin"],
  "admin\\gerenciar_camara.html": ["super_admin"],

  // Páginas de App (Admin de Câmara apenas)
  "app\\dashboard.html": ["admin_camara"],
  "app\\cadastro_de_pautas.html": ["admin_camara"],
  "app\\nova_pauta.html": ["admin_camara"],
  "app\\editar_pauta.html": ["admin_camara"],
  "app\\vereadores.html": ["admin_camara"],
  "app\\editar_vereador.html": ["admin_camara"],
  "app\\ordem_do_dia.html": ["admin_camara"],
  "app\\relatorio.html": ["admin_camara"],
  "app\\perfil_camara.html": ["admin_camara"],
  "app\\sessoes.html": ["admin_camara"],
  "app\\painel_controle.html": ["admin_camara"],
  "app\\nova_sessao.html": ["admin_camara"],
  "app\\painel_votacao.html": ["admin_camara"],

  // Páginas de TV (TV apenas)
  "tv\\espera.html": ["tv"],
  "tv\\votacao_tv.html": ["tv"],

  // Páginas públicas (sem autenticação)
  "portal\\portal_publico.html": null,
  "portal\\selecionar_camara.html": null,
  "portal\\todas_pautas.html": null,
  "portal\\votacao_publica.html": null,
  "index.html": null,
  "app\\login.html": null,

  // Componentes (pular)
  "components\\": "skip",
};

/**
 * Padrão antigo de protectPage
 */
const OLD_PATTERN =
  /try\s*{\s*protectPage\(\)\s*;\s*}\s*catch\s*\([^}]+}\s*catch[^}]+}/g;

const OLD_SIMPLE_PATTERN = /protectPage\(\)\s*;/g;

/**
 * Gera o novo código de autenticação baseado nos roles
 */
function generateNewAuthCode(roles) {
  if (!roles) {
    return `        // Página pública - sem autenticação necessária
        console.log('[PAGE] Página pública carregada');`;
  }

  const rolesStr = roles.map((r) => `'${r}'`).join(", ");

  return `        // === NOVA AUTENTICAÇÃO COM VALIDAÇÃO DE ROLE ===
        try {
          await protectPage({
            allowedRoles: [${rolesStr}],
            requireAuth: true,
            autoRedirect: true
          });
        } catch (error) {
          console.error('[AUTH] Falha na autenticação:', error);
          return;
        }`;
}

/**
 * Processa um arquivo HTML
 */
function processFile(filePath) {
  const relativePath = path
    .relative(path.join(__dirname, "web"), filePath)
    .replace(/\//g, "\\");

  // Verifica se é um componente (pular)
  if (relativePath.startsWith("components\\")) {
    console.log(`   ℹ️  Componente, pulando...`);
    return false;
  }

  const roles = PAGE_ROLES[relativePath];

  console.log(`📄 Processando: ${relativePath}`);

  if (roles === undefined) {
    console.log(`   ⚠️  Página não mapeada, pulando...`);
    return false;
  }

  if (roles === "skip") {
    console.log(`   ℹ️  Configurado para pular`);
    return false;
  }

  let content = fs.readFileSync(filePath, "utf8");
  let modified = false;

  // Padrão complexo (try/catch) - mais robusto
  const complexPattern =
    /try\s*{\s*protectPage\(\)\s*;\s*}\s*catch\s*\([^}]*\)\s*{[^}]*return[^}]*}/g;
  if (content.match(complexPattern)) {
    content = content.replace(complexPattern, generateNewAuthCode(roles));
    modified = true;
    console.log(`   ✅ Atualizou padrão try/catch complexo`);
  }

  // Padrão simples
  const simplePattern = /protectPage\(\)\s*;/g;
  if (content.match(simplePattern)) {
    content = content.replace(simplePattern, generateNewAuthCode(roles));
    modified = true;
    console.log(`   ✅ Atualizou padrão simples`);
  }

  // Verifica se precisa converter função síncrona para assíncrona
  if (
    modified &&
    !content.includes("async () => {") &&
    !content.includes("async function")
  ) {
    content = content.replace(
      /document\.addEventListener\(["']DOMContentLoaded["'],\s*\(\) => \{/g,
      'document.addEventListener("DOMContentLoaded", async () => {'
    );
    content = content.replace(
      /document\.addEventListener\(["']DOMContentLoaded["'],\s*function\s*\(\)\s*\{/g,
      'document.addEventListener("DOMContentLoaded", async function() {'
    );
    console.log(`   ✅ Converteu para função assíncrona`);
  }

  if (modified) {
    fs.writeFileSync(filePath, content, "utf8");
    console.log(`   💾 Arquivo salvo com sucesso`);
    return true;
  } else {
    console.log(`   ℹ️  Nenhuma alteração necessária`);
    return false;
  }
}

/**
 * Procura recursivamente por arquivos HTML
 */
function findHtmlFiles(dir) {
  const files = [];

  function scan(currentDir) {
    const entries = fs.readdirSync(currentDir);

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        scan(fullPath);
      } else if (entry.endsWith(".html")) {
        files.push(fullPath);
      }
    }
  }

  scan(dir);
  return files;
}

/**
 * Função principal
 */
function main() {
  console.log("🚀 Iniciando migração da autenticação...\n");

  const webDir = path.join(__dirname, "web");
  if (!fs.existsSync(webDir)) {
    console.error("❌ Diretório web/ não encontrado!");
    process.exit(1);
  }

  const htmlFiles = findHtmlFiles(webDir);
  console.log(`📁 Encontrados ${htmlFiles.length} arquivos HTML\n`);

  let processedCount = 0;
  let modifiedCount = 0;

  for (const file of htmlFiles) {
    try {
      const wasModified = processFile(file);
      processedCount++;
      if (wasModified) modifiedCount++;
    } catch (error) {
      console.error(`❌ Erro processando ${file}:`, error.message);
    }
    console.log(""); // Linha em branco
  }

  console.log("📊 RESUMO DA MIGRAÇÃO:");
  console.log(`   📄 Arquivos processados: ${processedCount}`);
  console.log(`   ✅ Arquivos modificados: ${modifiedCount}`);
  console.log(`   ➡️  Arquivos inalterados: ${processedCount - modifiedCount}`);

  if (modifiedCount > 0) {
    console.log("\n🎉 Migração concluída com sucesso!");
    console.log("\n📋 PRÓXIMOS PASSOS:");
    console.log("   1. Revisar as alterações nos arquivos modificados");
    console.log("   2. Testar o login e navegação entre páginas");
    console.log("   3. Verificar se os roles estão corretos para cada página");
    console.log(
      "   4. Consultar o arquivo AUTH_USAGE_GUIDE.md para mais detalhes"
    );
  } else {
    console.log("\nℹ️ Nenhum arquivo precisou ser modificado.");
  }
}

// Executar apenas se chamado diretamente
if (require.main === module) {
  main();
}

module.exports = { processFile, generateNewAuthCode, PAGE_ROLES };
