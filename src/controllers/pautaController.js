const { createClient } = require("@supabase/supabase-js");
const createLogger = require("../utils/logger");

const logger = createLogger("PAUTA_CONTROLLER");

// Middleware de autenticação usando Supabase tokens (mesmo padrão do projeto)
const authenticateToken = async (req) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    throw new Error("Token de acesso requerido");
  }

  try {
    // Criar cliente Supabase com o token do usuário
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );

    // Verificar token e obter usuário
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      logger.error("Erro ao verificar usuário:", userError);
      throw new Error("Token inválido ou expirado");
    }

    // Buscar perfil do usuário com service role (para bypass RLS)
    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("*, camaras(nome_camara)")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      logger.error("Erro ao buscar perfil:", profileError);
      throw new Error("Perfil não encontrado");
    }

    return {
      id: user.id,
      email: user.email,
      role: profile.role,
      camara_id: profile.camara_id,
      profile: profile,
    };
  } catch (error) {
    logger.error("Erro na autenticação:", error);
    throw new Error("Token inválido");
  }
};

// GET /api/pautas - Buscar pautas da câmara do usuário logado
const getAllPautas = async (req, res) => {
  try {
    // Autenticar usuário
    const user = await authenticateToken(req);

    const { page = 1, limit = 8, status, search } = req.query;
    const offset = (page - 1) * limit;

    logger.log(
      `Buscando pautas para usuário ${user.id}... Página: ${page}, Limite: ${limit}, Status: "${status}", Busca: "${search}"`
    );

    // Criar cliente Supabase
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    // Construir query base - consulta simplificada para evitar conflitos de alias
    let query = supabase
      .from("pautas")
      .select(
        `
                id,
                nome,
                descricao,
                anexo_url,
                status,
                votacao_simbolica,
                autor,
                created_at,
                resultado_votacao,
                sessoes!inner (
                    id,
                    nome,
                    tipo,
                    status,
                    data_sessao,
                    camara_id,
                    camaras (nome_camara)
                )
            `,
        { count: "exact" }
      )
      .order("created_at", { ascending: false });

    // Filtro por câmara - admin_camara e vereador só veem da sua câmara
    if (
      (user.role === "admin_camara" || user.role === "vereador") &&
      user.camara_id
    ) {
      query = query.eq("sessoes.camara_id", user.camara_id);
    }

    // Filtros opcionais
    if (status) {
      query = query.eq("status", status);
    }

    if (search) {
      query = query.or(`nome.ilike.%${search}%,descricao.ilike.%${search}%`);
    }

    // Verificar se é uma consulta de duplicidade (nome + sessao_id específicos)
    if (req.query.nome && req.query.sessao_id) {
      logger.log(
        `🔍 Verificando duplicidade: "${req.query.nome}" na sessão ${req.query.sessao_id}`
      );
      query = query
        .eq("nome", req.query.nome)
        .eq("sessao_id", req.query.sessao_id);

      const { data: duplicatas, error: duplicataError } = await query;

      if (duplicataError) {
        logger.error("Erro ao verificar duplicidade:", duplicataError);
        return res.status(500).json({ error: "Erro ao verificar duplicidade" });
      }

      logger.log(
        `📊 Resultado duplicidade: ${duplicatas.length} pauta(s) encontrada(s)`
      );
      return res.json({ data: duplicatas });
    }

    // Aplicar paginação
    const {
      data: pautas,
      error: pautasError,
      count,
    } = await query.range(offset, offset + parseInt(limit) - 1);

    if (pautasError) {
      logger.error("Erro ao buscar pautas:", pautasError);
      return res.status(500).json({ error: "Erro ao buscar pautas" });
    }

    // Processar dados das pautas
    const processedPautas = pautas.map((pauta) => ({
      id: pauta.id,
      nome: pauta.nome,
      descricao: pauta.descricao || "",
      anexo_url: pauta.anexo_url,
      status: pauta.status,
      votacao_simbolica: pauta.votacao_simbolica,
      created_at: pauta.created_at,
      autor: pauta.autor || "Não informado",
      resultado_votacao: pauta.resultado_votacao,
      sessoes: {
        id: pauta.sessoes?.id,
        nome: pauta.sessoes?.nome,
        tipo: pauta.sessoes?.tipo,
        status: pauta.sessoes?.status,
        data_sessao: pauta.sessoes?.data_sessao,
        camaras: {
          nome_camara: pauta.sessoes?.camaras?.nome_camara,
        },
      },
    }));

    logger.log(
      `Encontradas ${processedPautas.length} pautas de um total de ${count} para o usuário ${user.role}.`
    );

    res.json({
      data: processedPautas,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    logger.error("Erro no endpoint de pautas:", error);

    if (error.message === "Token de acesso requerido") {
      return res.status(401).json({ error: error.message });
    }
    if (
      error.message === "Usuário não encontrado" ||
      error.message === "Token inválido"
    ) {
      return res.status(401).json({ error: error.message });
    }

    res.status(500).json({ error: "Erro interno do servidor" });
  }
};

// GET /api/pautas/:id - Buscar uma pauta específica
const getPautaById = async (req, res) => {
  try {
    // Autenticar usuário
    const user = await authenticateToken(req);

    const { id } = req.params;

    logger.log(`Buscando pauta ${id} para usuário ${user.id}...`);

    // Criar cliente Supabase
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    let query = supabase
      .from("pautas")
      .select(
        `
                *,
                sessoes!inner (
                    *,
                    camaras (nome_camara)
                ),
                votos (
                    id,
                    voto,
                    vereadores (nome_parlamentar)
                )
            `
      )
      .eq("id", id);

    // Filtro por câmara para admin_camara e vereador
    if (
      (user.role === "admin_camara" || user.role === "vereador") &&
      user.camara_id
    ) {
      query = query.eq("sessoes.camara_id", user.camara_id);
    }

    const { data: pauta, error } = await query.single();

    if (error) {
      logger.error("Erro ao buscar pauta:", error);
      if (error.code === "PGRST116") {
        return res.status(404).json({ error: "Pauta não encontrada" });
      }
      return res.status(500).json({ error: "Erro ao buscar pauta" });
    }

    logger.log(`Pauta ${id} encontrada com sucesso.`);

    res.json(pauta);
  } catch (error) {
    logger.error("Erro no endpoint de pauta específica:", error);

    if (error.message === "Token de acesso requerido") {
      return res.status(401).json({ error: error.message });
    }
    if (
      error.message === "Usuário não encontrado" ||
      error.message === "Token inválido"
    ) {
      return res.status(401).json({ error: error.message });
    }

    res.status(500).json({ error: "Erro interno do servidor" });
  }
};

// POST /api/pautas - Criar nova pauta
const createPauta = async (req, res) => {
  logger.log("📝 === INÍCIO DO PROCESSO DE CADASTRO DE PAUTA ===");

  try {
    // Autenticar usuário
    logger.log("🔐 Autenticando usuário...");
    const user = await authenticateToken(req);
    logger.log(
      `✅ Usuário autenticado: ${user.id} (${user.email}) - Role: ${user.role}`
    );

    const {
      nome,
      descricao,
      status = "Pendente",
      sessao_id,
      autor,
      votacao_simbolica,
    } = req.body;

    // Converter string boolean para boolean real
    const criarVotacaoSimbolica =
      votacao_simbolica === "true" || votacao_simbolica === true;

    // Verificar se há arquivo enviado
    let anexo_url = null;
    if (req.file) {
      anexo_url = req.file.url;
      logger.log(
        `📎 Arquivo anexado: ${req.file.originalname} -> ${anexo_url}`
      );
    }

    logger.log("📋 Dados recebidos:", {
      nome: nome || "[não informado]",
      autor: autor || "[não informado]",
      status,
      sessao_id: sessao_id || "[não informado]",
      criarVotacaoSimbolica: criarVotacaoSimbolica
        ? "SIM (2 pautas)"
        : "NÃO (1 pauta)",
      descricao: descricao ? `${descricao.length} caracteres` : "[vazia]",
      arquivo: req.file ? req.file.originalname : "[não enviado]",
      anexo_url: anexo_url || "[nenhum]",
    });

    // Validações básicas
    logger.log("🔍 Validando campos obrigatórios...");
    if (!nome) {
      logger.error("❌ Validação falhou: Nome da pauta não informado");
      return res.status(400).json({ error: "Nome da pauta é obrigatório" });
    }

    if (!sessao_id) {
      logger.error("❌ Validação falhou: Sessão não informada");
      return res.status(400).json({ error: "Sessão é obrigatória" });
    }
    logger.log("✅ Campos obrigatórios validados com sucesso");

    logger.log(`🚀 Iniciando criação de pauta para usuário ${user.id}...`);

    // Criar cliente Supabase
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    // Verificar se a sessão existe e pertence à câmara do usuário (para admin_camara)
    logger.log(`🔍 Verificando sessão ${sessao_id}...`);
    const { data: sessao, error: sessaoError } = await supabase
      .from("sessoes")
      .select("id, camara_id, nome, status, data_sessao")
      .eq("id", sessao_id)
      .single();

    if (sessaoError || !sessao) {
      logger.error(`❌ Sessão não encontrada: ${sessao_id}`, sessaoError);
      return res.status(404).json({ error: "Sessão não encontrada" });
    }
    logger.log(
      `✅ Sessão encontrada: "${sessao.nome}" - Status: ${sessao.status} - Câmara: ${sessao.camara_id}`
    );

    // Para admin_camara e vereador, verificar se a sessão pertence à sua câmara
    if (
      (user.role === "admin_camara" || user.role === "vereador") &&
      user.camara_id &&
      sessao.camara_id !== user.camara_id
    ) {
      logger.error(
        `❌ Acesso negado: Usuário ${user.id} tentou criar pauta para sessão de outra câmara`
      );
      logger.error(
        `   Câmara do usuário: ${user.camara_id} | Câmara da sessão: ${sessao.camara_id}`
      );
      return res.status(403).json({
        error: "Você só pode criar pautas para sessões da sua câmara",
      });
    }
    logger.log("✅ Verificação de permissões aprovada");

    // Autor é opcional, mas se fornecido deve ser um texto
    if (autor && typeof autor !== "string") {
      logger.error("❌ Validação falhou: Autor deve ser texto");
      return res.status(400).json({ error: "Autor deve ser um texto" });
    }
    logger.log("✅ Validação do autor aprovada");

    // Criar as pautas
    logger.log("💾 Inserindo pauta(s) no banco de dados...");

    const pautasParaCriar = [];

    // 1. Pauta principal (sempre criada)
    const pautaPrincipal = {
      nome,
      descricao,
      anexo_url,
      status,
      sessao_id,
      autor,
      votacao_simbolica: false, // Pauta principal sempre false
      resultado_votacao: "Não Votada",
      created_by: user.id,
    };
    pautasParaCriar.push(pautaPrincipal);
    logger.log("📊 Pauta principal:", pautaPrincipal);

    // 2. Pauta para votação simbólica (se solicitada)
    if (criarVotacaoSimbolica) {
      const pautaSimbolica = {
        nome: `${nome} - Votação Simbólica`,
        descricao: descricao
          ? `${descricao} (Votação Simbólica)`
          : "Votação Simbólica",
        anexo_url, // Mesmo arquivo
        status,
        sessao_id,
        autor,
        votacao_simbolica: true,
        resultado_votacao: "Não Votada",
        created_by: user.id,
      };
      pautasParaCriar.push(pautaSimbolica);
      logger.log("📊 Pauta simbólica:", pautaSimbolica);
    }

    logger.log(`🔢 Total de pautas a criar: ${pautasParaCriar.length}`);

    // Inserir as pautas no banco
    const { data: pautas, error: pautaError } = await supabase
      .from("pautas")
      .insert(pautasParaCriar).select(`
                id,
                nome,
                descricao,
                anexo_url,
                status,
                votacao_simbolica,
                autor,
                created_at,
                resultado_votacao,
                sessoes (
                    id,
                    nome,
                    tipo,
                    status,
                    data_sessao,
                    camaras (nome_camara)
                )
            `);

    if (pautaError) {
      logger.error("❌ ERRO ao inserir pauta(s) no banco:", pautaError);
      logger.error("📊 Dados que causaram o erro:", pautasParaCriar);
      return res.status(500).json({ error: "Erro ao criar pauta(s)" });
    }

    logger.log(`✅ SUCESSO! ${pautas.length} pauta(s) criada(s)`);
    pautas.forEach((pauta, index) => {
      logger.log(`📋 Pauta ${index + 1}:`, {
        id: pauta.id,
        nome: pauta.nome,
        autor: pauta.autor,
        status: pauta.status,
        votacao_simbolica: pauta.votacao_simbolica,
        sessao: pauta.sessoes?.nome,
        created_at: pauta.created_at,
      });
    });
    logger.log("🎉 === CADASTRO DE PAUTA(S) CONCLUÍDO COM SUCESSO ===");

    res.status(201).json({
      message: `${pautas.length} pauta(s) criada(s) com sucesso`,
      data: pautas,
      info: {
        total: pautas.length,
        principal: pautas.find((p) => !p.votacao_simbolica),
        simbolica: pautas.find((p) => p.votacao_simbolica) || null,
      },
    });
  } catch (error) {
    logger.error(
      "💥 ERRO CRÍTICO no endpoint de criação de pauta:",
      error.message
    );
    logger.error("📊 Stack trace:", error.stack);
    logger.error("❌ === CADASTRO DE PAUTA FALHOU ===");

    if (error.message === "Token de acesso requerido") {
      logger.error("🔐 Erro de autenticação: Token ausente");
      return res.status(401).json({ error: error.message });
    }
    if (
      error.message === "Usuário não encontrado" ||
      error.message === "Token inválido"
    ) {
      logger.error(
        "🔐 Erro de autenticação: Token inválido ou usuário não encontrado"
      );
      return res.status(401).json({ error: error.message });
    }

    logger.error("💀 Erro interno não tratado, retornando erro 500");
    res.status(500).json({ error: "Erro interno do servidor" });
  }
};

// PUT /api/pautas/:id/resultado - Atualizar resultado da votação
const updateResultadoVotacao = async (req, res) => {
  logger.log("📝 === INÍCIO DA ATUALIZAÇÃO DE RESULTADO DE VOTAÇÃO ===");

  try {
    // Autenticar usuário
    logger.log("🔐 Autenticando usuário...");
    const user = await authenticateToken(req);
    logger.log(
      `✅ Usuário autenticado: ${user.id} (${user.email}) - Role: ${user.role}`
    );

    const { id } = req.params;
    const { resultado_votacao } = req.body;

    logger.log("📋 Dados recebidos:", {
      pauta_id: id,
      novo_resultado: resultado_votacao,
      usuario: user.id,
    });

    // Validações básicas
    if (!id) {
      logger.error("❌ Validação falhou: ID da pauta não informado");
      return res.status(400).json({ error: "ID da pauta é obrigatório" });
    }

    if (!resultado_votacao) {
      logger.error("❌ Validação falhou: Resultado da votação não informado");
      return res
        .status(400)
        .json({ error: "Resultado da votação é obrigatório" });
    }

    // Validar resultados permitidos
    const resultadosPermitidos = ["Não Votada", "Aprovada", "Reprovada"];
    if (!resultadosPermitidos.includes(resultado_votacao)) {
      logger.error(
        "❌ Validação falhou: Resultado inválido",
        resultado_votacao
      );
      return res.status(400).json({
        error:
          "Resultado inválido. Permitidos: " + resultadosPermitidos.join(", "),
      });
    }

    logger.log(
      `🚀 Atualizando resultado da pauta ${id} para "${resultado_votacao}"...`
    );

    // Criar cliente Supabase
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    // Verificar se a pauta existe e o usuário tem permissão
    logger.log(`🔍 Verificando pauta ${id}...`);
    const { data: pauta, error: pautaError } = await supabase
      .from("pautas")
      .select(
        `
                id,
                nome,
                resultado_votacao,
                sessao_id,
                sessoes!inner (
                    id,
                    camara_id
                )
            `
      )
      .eq("id", id)
      .single();

    if (pautaError || !pauta) {
      logger.error(`❌ Pauta não encontrada: ${id}`, pautaError);
      return res.status(404).json({ error: "Pauta não encontrada" });
    }

    logger.log(
      `✅ Pauta encontrada: "${pauta.nome}" - Resultado atual: ${pauta.resultado_votacao}`
    );

    // Para admin_camara e vereador, verificar se a pauta pertence à sua câmara
    if (
      (user.role === "admin_camara" || user.role === "vereador") &&
      user.camara_id &&
      pauta.sessoes.camara_id !== user.camara_id
    ) {
      logger.error(
        `❌ Acesso negado: Usuário ${user.id} tentou alterar pauta de outra câmara`
      );
      return res
        .status(403)
        .json({ error: "Você só pode alterar pautas da sua câmara" });
    }

    // Atualizar resultado no banco
    logger.log("💾 Atualizando resultado no banco de dados...");
    const { data: pautaAtualizada, error: updateError } = await supabase
      .from("pautas")
      .update({
        resultado_votacao: resultado_votacao,
      })
      .eq("id", id)
      .select(
        `
                id,
                nome,
                resultado_votacao,
                created_at
            `
      )
      .single();

    if (updateError) {
      logger.error("❌ ERRO ao atualizar resultado da votação:", updateError);
      return res
        .status(500)
        .json({ error: "Erro ao atualizar resultado da votação" });
    }

    logger.log(`✅ SUCESSO! Resultado da votação atualizado:`, {
      id: pautaAtualizada.id,
      nome: pautaAtualizada.nome,
      resultado_anterior: pauta.resultado_votacao,
      resultado_novo: pautaAtualizada.resultado_votacao,
      created_at: pautaAtualizada.created_at,
    });

    logger.log(
      "🎉 === ATUALIZAÇÃO DE RESULTADO DE VOTAÇÃO CONCLUÍDA COM SUCESSO ==="
    );

    res.json({
      message: "Resultado da votação atualizado com sucesso",
      data: pautaAtualizada,
    });
  } catch (error) {
    logger.error("💥 ERRO CRÍTICO na atualização de resultado:", error.message);
    logger.error("📊 Stack trace:", error.stack);
    logger.error("❌ === ATUALIZAÇÃO DE RESULTADO FALHOU ===");

    if (error.message === "Token de acesso requerido") {
      return res.status(401).json({ error: error.message });
    }
    if (
      error.message === "Usuário não encontrado" ||
      error.message === "Token inválido"
    ) {
      return res.status(401).json({ error: error.message });
    }

    res.status(500).json({ error: "Erro interno do servidor" });
  }
};

// PUT /api/pautas/:id/status - Atualizar status da pauta
const updatePautaStatus = async (req, res) => {
  logger.log("📝 === INÍCIO DA ATUALIZAÇÃO DE STATUS DE PAUTA ===");

  try {
    // Autenticar usuário
    logger.log("🔐 Autenticando usuário...");
    const user = await authenticateToken(req);
    logger.log(
      `✅ Usuário autenticado: ${user.id} (${user.email}) - Role: ${user.role}`
    );

    const { id } = req.params;
    const { status } = req.body;

    logger.log("📋 Dados recebidos:", {
      pauta_id: id,
      novo_status: status,
      usuario: user.id,
    });

    // Validações básicas
    if (!id) {
      logger.error("❌ Validação falhou: ID da pauta não informado");
      return res.status(400).json({ error: "ID da pauta é obrigatório" });
    }

    if (!status) {
      logger.error("❌ Validação falhou: Status não informado");
      return res.status(400).json({ error: "Status é obrigatório" });
    }

    // Validar status permitidos
    const statusPermitidos = ["Pendente", "Em Votação", "Finalizada"];
    if (!statusPermitidos.includes(status)) {
      logger.error("❌ Validação falhou: Status inválido", status);
      return res.status(400).json({
        error: "Status inválido. Permitidos: " + statusPermitidos.join(", "),
      });
    }

    logger.log(`🚀 Atualizando status da pauta ${id} para "${status}"...`);

    // Criar cliente Supabase
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    // Verificar se a pauta existe e o usuário tem permissão
    logger.log(`🔍 Verificando pauta ${id}...`);
    const { data: pauta, error: pautaError } = await supabase
      .from("pautas")
      .select(
        `
                id,
                nome,
                status,
                sessao_id,
                sessoes!inner (
                    id,
                    camara_id
                )
            `
      )
      .eq("id", id)
      .single();

    if (pautaError || !pauta) {
      logger.error(`❌ Pauta não encontrada: ${id}`, pautaError);
      return res.status(404).json({ error: "Pauta não encontrada" });
    }

    logger.log(
      `✅ Pauta encontrada: "${pauta.nome}" - Status atual: ${pauta.status}`
    );

    // Para admin_camara e vereador, verificar se a pauta pertence à sua câmara
    if (
      (user.role === "admin_camara" || user.role === "vereador") &&
      user.camara_id &&
      pauta.sessoes.camara_id !== user.camara_id
    ) {
      logger.error(
        `❌ Acesso negado: Usuário ${user.id} tentou alterar pauta de outra câmara`
      );
      return res
        .status(403)
        .json({ error: "Você só pode alterar pautas da sua câmara" });
    }

    // Atualizar status no banco
    logger.log("💾 Atualizando status no banco de dados...");
    let { data: pautaAtualizada, error: updateError } = await supabase
      .from("pautas")
      .update({
        status: status,
      })
      .eq("id", id)
      .select(
        `
                id,
                nome,
                status,
                created_at,
                updated_at
            `
      )
      .single();

    if (updateError) {
      logger.error("❌ ERRO ao atualizar status da pauta:", updateError);
      return res
        .status(500)
        .json({ error: "Erro ao atualizar status da pauta" });
    }

    // Se o status mudou para "Finalizada", calcular resultado da votação
    if (status === "Finalizada") {
      logger.log("🗳️ Pauta finalizada - iniciando contagem de votos...");
      await _calcularResultadoVotacao(supabase, id, logger);

      // Buscar a pauta atualizada com resultado
      const { data: pautaFinalizada } = await supabase
        .from("pautas")
        .select("*, sessoes!inner(camara_id)")
        .eq("id", id)
        .single();

      if (pautaFinalizada) {
        pautaAtualizada = pautaFinalizada;
      }
    }

    // Notificar mudança de status via WebSocket
    try {
      const notificationPayload = {
        pautaId: id,
        pautaNome: pautaAtualizada.nome,
        oldStatus: pauta.status,
        newStatus: pautaAtualizada.status,
        resultado: pautaAtualizada.resultado_votacao || null,
        camaraId: pautaAtualizada.sessoes?.camara_id,
      };

      // Notificar tablet backend
      const http = require("http");
      const postData = JSON.stringify(notificationPayload);

      const options = {
        hostname: "localhost",
        port: 3003,
        path: "/api/notify/pauta-status-change",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(postData),
        },
      };

      const req = http.request(options, (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          logger.log("📡 Notificação para tablet backend enviada com sucesso");
        } else {
          logger.warn(
            "⚠️ Falha ao enviar notificação para tablet backend:",
            res.statusCode
          );
        }
      });

      req.on("error", (error) => {
        logger.warn("⚠️ Erro ao notificar tablet backend:", error.message);
      });

      req.write(postData);
      req.end();

      // Notificar portal público via WebSocket quando pauta for finalizada
      if (
        status === "Finalizada" &&
        typeof global !== "undefined" &&
        global.io
      ) {
        logger.log(
          "📡 Emitindo notificação para portal público: pauta finalizada"
        );

        // Tentar buscar informações completas da pauta finalizada (preferir updated_at)
        let pautaCompleta = null;
        try {
          const resp = await supabase
            .from("pautas")
            .select(
              `
                            id,
                            nome,
                            descricao,
                            autor,
                            resultado_votacao,
                            created_at,
                            updated_at,
                            sessoes!inner (
                                nome,
                                data_sessao,
                                camara_id
                            )
                        `
            )
            .eq("id", id)
            .single();

          if (resp.error) throw resp.error;
          pautaCompleta = resp.data;
        } catch (err) {
          logger.warn(
            "updated_at não disponível ou erro ao buscar pauta com updated_at, recuando para select sem updated_at:",
            err.message || err
          );
          // Fallback: buscar sem updated_at
          const resp2 = await supabase
            .from("pautas")
            .select(
              `
                            id,
                            nome,
                            descricao,
                            autor,
                            resultado_votacao,
                            created_at,
                            sessoes!inner (
                                nome,
                                data_sessao,
                                camara_id
                            )
                        `
            )
            .eq("id", id)
            .single();

          if (resp2.error) {
            logger.warn(
              "Erro ao buscar pauta completa para notificação do portal:",
              resp2.error.message || resp2.error
            );
          } else {
            pautaCompleta = resp2.data;
          }
        }

        if (pautaCompleta) {
          const eventData = {
            camaraId: pautaCompleta.sessoes.camara_id,
            pauta: {
              id: pautaCompleta.id,
              nome: pautaCompleta.nome,
              descricao: pautaCompleta.descricao,
              autor: pautaCompleta.autor,
              resultado_votacao: pautaCompleta.resultado_votacao,
              created_at: pautaCompleta.created_at,
              updated_at: pautaCompleta.updated_at || pautaCompleta.created_at,
              sessao: {
                nome: pautaCompleta.sessoes.nome,
                data_sessao: pautaCompleta.sessoes.data_sessao,
              },
            },
            timestamp: new Date().toISOString(),
          };

          // Emitir para todos os usuários conectados ao portal da câmara
          global.io
            .to(`portal-camara-${pautaCompleta.sessoes.camara_id}`)
            .emit("pauta-finalizada", eventData);

          // 📺 EMITIR EVENTO PARA TVS DA CÂMARA
          global.io
            .to(`tv-camara-${pautaCompleta.sessoes.camara_id}`)
            .emit("tv:encerrar-votacao", {
              pautaId: pautaCompleta.id,
              camaraId: pautaCompleta.sessoes.camara_id,
              timestamp: new Date().toISOString(),
            });

          // Também emitir o evento padrão de votação finalizada para compatibilidade
          global.io
            .to(`tv-camara-${pautaCompleta.sessoes.camara_id}`)
            .emit("votacao-finalizada", { pautaId: pautaCompleta.id });

          logger.log(
            `📡 Notificação emitida para portal da câmara ${pautaCompleta.sessoes.camara_id}`
          );
          logger.log(
            `📺 Notificação de encerramento emitida para TVs da câmara ${pautaCompleta.sessoes.camara_id}`
          );
        } else {
          logger.warn(
            "⚠️ Não foi possível buscar dados completos da pauta para notificação do portal"
          );
        }
      }
    } catch (notificationError) {
      logger.warn(
        "⚠️ Erro ao notificar via WebSocket:",
        notificationError.message
      );
      // Não falhar a operação principal por erro de notificação
    }

    logger.log(`✅ SUCESSO! Status da pauta atualizado:`, {
      id: pautaAtualizada.id,
      nome: pautaAtualizada.nome,
      status_anterior: pauta.status,
      status_novo: pautaAtualizada.status,
      resultado_votacao: pautaAtualizada.resultado_votacao,
      created_at: pautaAtualizada.created_at,
    });

    logger.log("🎉 === ATUALIZAÇÃO DE STATUS CONCLUÍDA COM SUCESSO ===");

    res.json({
      message: "Status da pauta atualizado com sucesso",
      data: pautaAtualizada,
    });
  } catch (error) {
    logger.error("💥 ERRO CRÍTICO na atualização de status:", error.message);
    logger.error("📊 Stack trace:", error.stack);
    logger.error("❌ === ATUALIZAÇÃO DE STATUS FALHOU ===");

    if (error.message === "Token de acesso requerido") {
      return res.status(401).json({ error: error.message });
    }
    if (
      error.message === "Usuário não encontrado" ||
      error.message === "Token inválido"
    ) {
      return res.status(401).json({ error: error.message });
    }

    res.status(500).json({ error: "Erro interno do servidor" });
  }
};

// DELETE /api/pautas/:id - Remover pauta
const deletePauta = async (req, res) => {
  logger.log("🗑️ === INÍCIO DO PROCESSO DE REMOÇÃO DE PAUTA ===");

  try {
    // Autenticar usuário
    logger.log("🔐 Autenticando usuário...");
    const user = await authenticateToken(req);
    logger.log(
      `✅ Usuário autenticado: ${user.id} (${user.email}) - Role: ${user.role}`
    );

    const { id } = req.params;

    logger.log("📋 Dados recebidos:", {
      pauta_id: id,
      usuario: user.id,
    });

    // Validações básicas
    if (!id) {
      logger.error("❌ Validação falhou: ID da pauta não informado");
      return res.status(400).json({ error: "ID da pauta é obrigatório" });
    }

    logger.log(`🚀 Iniciando remoção da pauta ${id}...`);

    // Criar cliente Supabase
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    // Verificar se a pauta existe e o usuário tem permissão
    logger.log(`🔍 Verificando pauta ${id}...`);
    const { data: pauta, error: pautaError } = await supabase
      .from("pautas")
      .select(
        `
                id,
                nome,
                status,
                sessao_id,
                votacao_simbolica,
                sessoes!inner (
                    id,
                    camara_id,
                    nome
                ),
                votos (
                    id,
                    voto
                )
            `
      )
      .eq("id", id)
      .single();

    if (pautaError || !pauta) {
      logger.error(`❌ Pauta não encontrada: ${id}`, pautaError);
      return res.status(404).json({ error: "Pauta não encontrada" });
    }

    logger.log(
      `✅ Pauta encontrada: "${pauta.nome}" - Status: ${pauta.status}`
    );
    logger.log(`📊 Votos registrados: ${pauta.votos ? pauta.votos.length : 0}`);

    // Para admin_camara e vereador, verificar se a pauta pertence à sua câmara
    if (
      (user.role === "admin_camara" || user.role === "vereador") &&
      user.camara_id &&
      pauta.sessoes.camara_id !== user.camara_id
    ) {
      logger.error(
        `❌ Acesso negado: Usuário ${user.id} tentou remover pauta de outra câmara`
      );
      return res
        .status(403)
        .json({ error: "Você só pode remover pautas da sua câmara" });
    }

    // VALIDAÇÃO CRÍTICA: Verificar se há votos registrados
    if (pauta.votos && pauta.votos.length > 0) {
      logger.error(
        `❌ Remoção bloqueada: Pauta possui ${pauta.votos.length} voto(s) registrado(s)`
      );
      return res.status(400).json({
        error:
          "Não é possível remover uma pauta que já possui votos registrados",
        details: `Esta pauta possui ${pauta.votos.length} voto(s) registrado(s)`,
      });
    }

    logger.log("✅ Validação de votos aprovada - nenhum voto encontrado");

    // Remover pauta do banco
    logger.log("🗑️ Removendo pauta do banco de dados...");
    const { error: deleteError } = await supabase
      .from("pautas")
      .delete()
      .eq("id", id);

    if (deleteError) {
      logger.error("❌ ERRO ao remover pauta:", deleteError);
      return res.status(500).json({ error: "Erro ao remover pauta" });
    }

    logger.log(`✅ SUCESSO! Pauta removida:`, {
      id: pauta.id,
      nome: pauta.nome,
      status: pauta.status,
      sessao: pauta.sessoes.nome,
      votacao_simbolica: pauta.votacao_simbolica,
    });

    logger.log("🎉 === REMOÇÃO DE PAUTA CONCLUÍDA COM SUCESSO ===");

    res.json({
      message: "Pauta removida com sucesso",
      data: {
        id: pauta.id,
        nome: pauta.nome,
        sessao: pauta.sessoes.nome,
      },
    });
  } catch (error) {
    logger.error("💥 ERRO CRÍTICO na remoção de pauta:", error.message);
    logger.error("📊 Stack trace:", error.stack);
    logger.error("❌ === REMOÇÃO DE PAUTA FALHOU ===");

    if (error.message === "Token de acesso requerido") {
      return res.status(401).json({ error: error.message });
    }
    if (
      error.message === "Usuário não encontrado" ||
      error.message === "Token inválido"
    ) {
      return res.status(401).json({ error: error.message });
    }

    res.status(500).json({ error: "Erro interno do servidor" });
  }
};

// PUT /api/pautas/:id - Editar pauta completa
const updatePauta = async (req, res) => {
  logger.log("✏️ === INÍCIO DO PROCESSO DE EDIÇÃO DE PAUTA ===");

  try {
    // Autenticar usuário
    logger.log("🔐 Autenticando usuário...");
    const user = await authenticateToken(req);
    logger.log(
      `✅ Usuário autenticado: ${user.id} (${user.email}) - Role: ${user.role}`
    );

    const { id } = req.params;
    const {
      nome,
      descricao,
      status,
      autor,
      sessao_id, // Permitir mudança de sessão se necessário
    } = req.body;

    // Verificar se há arquivo enviado
    let anexo_url = undefined; // undefined = não atualizar, null = remover arquivo
    if (req.file) {
      anexo_url = req.file.url;
      logger.log(
        `📎 Novo arquivo anexado: ${req.file.originalname} -> ${anexo_url}`
      );
    }

    logger.log("📋 Dados recebidos para edição:", {
      pauta_id: id,
      nome: nome || "[não alterado]",
      autor: autor || "[não alterado]",
      status: status || "[não alterado]",
      sessao_id: sessao_id || "[não alterado]",
      descricao: descricao
        ? `${descricao.length} caracteres`
        : "[não alterado]",
      arquivo: req.file ? req.file.originalname : "[não alterado]",
      usuario: user.id,
    });

    // Validações básicas
    logger.log("🔍 Validando campos...");
    if (!id) {
      logger.error("❌ Validação falhou: ID da pauta não informado");
      return res.status(400).json({ error: "ID da pauta é obrigatório" });
    }

    if (nome && nome.trim().length === 0) {
      logger.error("❌ Validação falhou: Nome da pauta não pode estar vazio");
      return res
        .status(400)
        .json({ error: "Nome da pauta não pode estar vazio" });
    }

    if (status && !["Pendente", "Em Votação", "Finalizada"].includes(status)) {
      logger.error("❌ Validação falhou: Status inválido", status);
      return res.status(400).json({ error: "Status inválido" });
    }
    logger.log("✅ Campos validados com sucesso");

    logger.log(`🚀 Iniciando edição da pauta ${id}...`);

    // Criar cliente Supabase
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    // Buscar pauta atual com informações de sessão e votos
    logger.log(`🔍 Verificando pauta ${id}...`);
    const { data: pautaAtual, error: pautaError } = await supabase
      .from("pautas")
      .select(
        `
                id,
                nome,
                descricao,
                status,
                autor,
                anexo_url,
                votacao_simbolica,
                resultado_votacao,
                sessao_id,
                sessoes!inner (
                    id,
                    nome,
                    camara_id,
                    data_sessao,
                    status
                ),
                votos (
                    id,
                    voto
                )
            `
      )
      .eq("id", id)
      .single();

    if (pautaError || !pautaAtual) {
      logger.error(`❌ Pauta não encontrada: ${id}`, pautaError);
      return res.status(404).json({ error: "Pauta não encontrada" });
    }

    logger.log(
      `✅ Pauta encontrada: "${pautaAtual.nome}" - Status: ${pautaAtual.status}`
    );
    logger.log(
      `📊 Votos registrados: ${pautaAtual.votos ? pautaAtual.votos.length : 0}`
    );
    logger.log(`📅 Data da sessão: ${pautaAtual.sessoes?.data_sessao}`);

    // Para admin_camara e vereador, verificar se a pauta pertence à sua câmara
    if (
      (user.role === "admin_camara" || user.role === "vereador") &&
      user.camara_id &&
      pautaAtual.sessoes.camara_id !== user.camara_id
    ) {
      logger.error(
        `❌ Acesso negado: Usuário ${user.id} tentou editar pauta de outra câmara`
      );
      return res
        .status(403)
        .json({ error: "Você só pode editar pautas da sua câmara" });
    }

    // VALIDAÇÕES DE EDIÇÃO CRÍTICAS
    logger.log("🔒 Aplicando validações de edição...");

    // 1. Verificar se a data da sessão já passou
    const agora = new Date();
    const dataSessao = new Date(pautaAtual.sessoes.data_sessao);

    if (agora > dataSessao) {
      logger.error(
        `❌ Edição bloqueada: Data da sessão já passou (${dataSessao.toISOString()} < ${agora.toISOString()})`
      );
      return res.status(400).json({
        error: "Não é possível editar uma pauta após o término da sessão",
        details: `A sessão ocorreu em ${dataSessao.toLocaleDateString(
          "pt-BR"
        )} às ${dataSessao.toLocaleTimeString("pt-BR")}`,
      });
    }
    logger.log("✅ Validação de data aprovada - sessão ainda não ocorreu");

    // 2. Verificar se pauta finalizada tem votos (só pode editar se não tiver votos)
    if (
      pautaAtual.status === "Finalizada" &&
      pautaAtual.votos &&
      pautaAtual.votos.length > 0
    ) {
      logger.error(
        `❌ Edição bloqueada: Pauta finalizada possui ${pautaAtual.votos.length} voto(s) registrado(s)`
      );
      return res.status(400).json({
        error:
          "Não é possível editar uma pauta finalizada que já possui votos registrados",
        details: `Esta pauta possui ${pautaAtual.votos.length} voto(s) registrado(s)`,
      });
    }
    logger.log("✅ Validação de status/votos aprovada");

    // 3. Se está mudando de sessão, verificar se nova sessão é válida
    if (sessao_id && sessao_id !== pautaAtual.sessao_id) {
      logger.log(
        `🔄 Validando mudança de sessão: ${pautaAtual.sessao_id} → ${sessao_id}`
      );

      const { data: novaSessao, error: sessaoError } = await supabase
        .from("sessoes")
        .select("id, nome, camara_id, data_sessao, status")
        .eq("id", sessao_id)
        .single();

      if (sessaoError || !novaSessao) {
        logger.error(
          `❌ Nova sessão não encontrada: ${sessao_id}`,
          sessaoError
        );
        return res.status(404).json({ error: "Sessão não encontrada" });
      }

      // Verificar se nova sessão pertence à mesma câmara
      if (
        (user.role === "admin_camara" || user.role === "vereador") &&
        novaSessao.camara_id !== user.camara_id
      ) {
        logger.error(`❌ Nova sessão pertence a outra câmara`);
        return res.status(403).json({
          error: "Você só pode mover pautas para sessões da sua câmara",
        });
      }

      // Verificar se nova sessão não passou
      const novaDataSessao = new Date(novaSessao.data_sessao);
      if (agora > novaDataSessao) {
        logger.error(
          `❌ Nova sessão já ocorreu: ${novaDataSessao.toISOString()}`
        );
        return res.status(400).json({
          error: "Não é possível mover pauta para uma sessão que já ocorreu",
        });
      }

      logger.log(`✅ Nova sessão aprovada: "${novaSessao.nome}"`);
    }

    // Preparar dados para atualização (só atualiza campos fornecidos)
    const dadosParaAtualizar = {};
    if (nome !== undefined) dadosParaAtualizar.nome = nome.trim();
    if (descricao !== undefined)
      dadosParaAtualizar.descricao = descricao?.trim() || "";
    if (status !== undefined) dadosParaAtualizar.status = status;
    if (autor !== undefined) dadosParaAtualizar.autor = autor?.trim() || "";
    if (sessao_id !== undefined) dadosParaAtualizar.sessao_id = sessao_id;
    if (anexo_url !== undefined) dadosParaAtualizar.anexo_url = anexo_url;

    logger.log("💾 Atualizando pauta no banco de dados...");
    logger.log("📋 Campos a atualizar:", Object.keys(dadosParaAtualizar));

    const { data: pautaAtualizada, error: updateError } = await supabase
      .from("pautas")
      .update(dadosParaAtualizar)
      .eq("id", id)
      .select(
        `
                id,
                nome,
                descricao,
                status,
                autor,
                anexo_url,
                votacao_simbolica,
                resultado_votacao,
                created_at,
                sessoes (
                    id,
                    nome,
                    tipo,
                    status,
                    data_sessao,
                    camaras (nome_camara)
                )
            `
      )
      .single();

    if (updateError) {
      logger.error("❌ ERRO ao atualizar pauta:", updateError);
      return res.status(500).json({ error: "Erro ao atualizar pauta" });
    }

    logger.log(`✅ SUCESSO! Pauta atualizada:`, {
      id: pautaAtualizada.id,
      nome: pautaAtualizada.nome,
      status: pautaAtualizada.status,
      autor: pautaAtualizada.autor,
      sessao: pautaAtualizada.sessoes?.nome,
      created_at: pautaAtualizada.created_at,
    });

    logger.log("🎉 === EDIÇÃO DE PAUTA CONCLUÍDA COM SUCESSO ===");

    res.json({
      message: "Pauta atualizada com sucesso",
      data: pautaAtualizada,
    });
  } catch (error) {
    logger.error("💥 ERRO CRÍTICO na edição de pauta:", error.message);
    logger.error("📊 Stack trace:", error.stack);
    logger.error("❌ === EDIÇÃO DE PAUTA FALHOU ===");

    if (error.message === "Token de acesso requerido") {
      return res.status(401).json({ error: error.message });
    }
    if (
      error.message === "Usuário não encontrado" ||
      error.message === "Token inválido"
    ) {
      return res.status(401).json({ error: error.message });
    }

    res.status(500).json({ error: "Erro interno do servidor" });
  }
};

// Função auxiliar para calcular resultado da votação
const _calcularResultadoVotacao = async (supabase, pautaId, logger) => {
  try {
    logger.log("📊 Buscando votos da pauta...");

    // Buscar todos os votos da pauta
    const { data: votos, error: votosError } = await supabase
      .from("votos")
      .select(
        `
                id,
                voto,
                era_presidente_no_voto,
                vereadores (
                    id,
                    nome_parlamentar
                )
            `
      )
      .eq("pauta_id", pautaId);

    if (votosError) {
      logger.error("❌ Erro ao buscar votos:", votosError);
      return;
    }

    logger.log(`📋 Total de votos encontrados: ${votos.length}`);

    // Buscar voto do presidente primeiro
    const votoPresidente = votos.find((v) => v.era_presidente_no_voto);

    // Contar votos EXCLUINDO o presidente (abstencao não entra na soma)
    const votosNaoPresidentes = votos.filter((v) => !v.era_presidente_no_voto);
    const votosSim = votosNaoPresidentes.filter((v) => v.voto === "SIM").length;
    const votosNao = votosNaoPresidentes.filter((v) => v.voto === "NÃO").length;
    const abstencoes = votosNaoPresidentes.filter(
      (v) => v.voto === "ABSTENÇÃO"
    ).length;

    logger.log("📊 Contagem de votos (sem presidente):", {
      sim: votosSim,
      nao: votosNao,
      abstencoes: abstencoes,
      voto_presidente: votoPresidente?.voto || "Não votou",
    });

    let resultado;

    // Regras de decisão (sem considerar voto do presidente inicialmente)
    if (votosSim > votosNao) {
      resultado = "Aprovada";
      logger.log("✅ Resultado: APROVADA (maioria simples dos vereadores)");
    } else if (votosSim < votosNao) {
      resultado = "Reprovada";
      logger.log("❌ Resultado: REPROVADA (maioria simples dos vereadores)");
    } else {
      // Empate entre vereadores - voto do presidente decide
      if (votoPresidente) {
        if (votoPresidente.voto === "SIM") {
          resultado = "Aprovada";
          logger.log(
            "✅ Resultado: APROVADA (empate + voto de minerva do presidente: SIM)"
          );
        } else if (votoPresidente.voto === "NÃO") {
          resultado = "Reprovada";
          logger.log(
            "❌ Resultado: REPROVADA (empate + voto de minerva do presidente: NÃO)"
          );
        } else {
          // Presidente se absteve no empate
          resultado = "Reprovada";
          logger.log(
            "❌ Resultado: REPROVADA (empate + presidente se absteve)"
          );
        }
      } else {
        // Não há voto do presidente registrado
        resultado = "Reprovada";
        logger.log("❌ Resultado: REPROVADA (empate + presidente não votou)");
      }
    }

    // Atualizar resultado na pauta
    const { error: updateError } = await supabase
      .from("pautas")
      .update({
        resultado_votacao: resultado,
      })
      .eq("id", pautaId);

    if (updateError) {
      logger.error("❌ Erro ao atualizar resultado da votação:", updateError);
    } else {
      logger.log(`✅ Resultado da votação atualizado: ${resultado}`);
    }
  } catch (error) {
    logger.error("💥 Erro no cálculo do resultado:", error);
  }
};

module.exports = {
  getAllPautas,
  getPautaById,
  createPauta,
  updateResultadoVotacao,
  updatePautaStatus,
  deletePauta,
  updatePauta,
};
