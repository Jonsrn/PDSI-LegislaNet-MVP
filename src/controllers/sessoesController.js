const { createClient } = require("@supabase/supabase-js");
const { validationResult } = require("express-validator");
const createLogger = require("../utils/logger");
const logger = createLogger("SESSOES_CONTROLLER");

// A função de autenticação foi REMOVIDA daqui e movida para o authMiddleware.

/**
 * POST /api/sessoes - Cria uma nova sessão com blindagem de duplicidade.
 */
const createSessao = async (req, res) => {
  const { user, profile } = req;
  // O frontend agora envia 'numero' em vez de 'nome'.
  const { numero, tipo, data_sessao, status = "Agendada" } = req.body;

  try {
    // --- NOVA LÓGICA DE GERAÇÃO E BLINDAGEM ---

    // 1. Monta o nome da sessão no back-end
    const ano = data_sessao.getFullYear();
    const nomeSessao = `${numero}ª Sessão ${tipo}`;
    logger.log(`Nome da sessão montado: "${nomeSessao}"`);

    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    // 2. BLINDAGEM: Verifica se já existe uma sessão com o mesmo nome gerado para a mesma câmara.
    logger.log(
      `Verificando duplicidade para o nome "${nomeSessao}" na câmara ${profile.camara_id}`
    );
    const { data: sessaoExistente, error: checkError } = await supabaseAdmin
      .from("sessoes")
      .select("id")
      .eq("camara_id", profile.camara_id)
      .eq("nome", nomeSessao)
      .limit(1)
      .single();

    if (checkError && checkError.code !== "PGRST116") {
      // Ignora o erro "0 linhas retornadas"
      logger.error("Erro ao verificar duplicidade de sessão:", checkError);
      throw checkError;
    }

    if (sessaoExistente) {
      logger.warn(`Tentativa de criar sessão duplicada: "${nomeSessao}"`);
      return res.status(409).json({
        error: "Conflito: Já existe uma sessão com este número, tipo e ano.",
        details: `A sessão "${nomeSessao}" já está cadastrada.`,
      });
    }
    logger.log("Nenhuma duplicidade encontrada. Prosseguindo com a criação.");

    // 3. Prepara os dados e insere no banco
    const sessionData = {
      nome: nomeSessao, // Usa o nome gerado
      tipo: tipo,
      status: status,
      data_sessao: data_sessao.toISOString().split("T")[0],
      camara_id: profile.camara_id,
    };

    const { data: novaSessao, error: insertError } = await supabaseAdmin
      .from("sessoes")
      .insert([sessionData])
      .select("*")
      .single();

    if (insertError) {
      logger.error("Erro do Supabase ao criar sessão:", insertError);
      return res
        .status(500)
        .json({ error: "Erro ao salvar a sessão no banco de dados." });
    }

    logger.log(
      `Sessão "${nomeSessao}" criada com sucesso com o ID: ${novaSessao.id}`
    );
    res
      .status(201)
      .json({ message: "Sessão criada com sucesso!", data: novaSessao });
  } catch (error) {
    logger.error("Erro inesperado no controller de criação de sessão:", error);
    res.status(500).json({ error: "Ocorreu um erro interno no servidor." });
  }
};

/**
 * GET /api/sessoes - Busca todas as sessões da câmara do usuário.
 * A autenticação e autorização são tratadas pelo middleware `canManageSessoes`.
 */
const getAllSessoes = async (req, res) => {
  const { profile } = req; // Acessa o perfil injetado pelo middleware
  const { page = 1, limit = 10, status, tipo, search } = req.query;
  const offset = (page - 1) * limit;

  try {
    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    let query = supabaseAdmin
      .from("sessoes")
      .select(`*, camaras (nome_camara, municipio)`, { count: "exact" })
      .eq("camara_id", profile.camara_id) // Filtra pela câmara do usuário autenticado
      .order("data_sessao", { ascending: false });

    if (status) query = query.eq("status", status);
    if (tipo) query = query.eq("tipo", tipo);
    if (search) query = query.ilike("nome", `%${search}%`);

    const {
      data: sessoes,
      error,
      count,
    } = await query.range(offset, offset + parseInt(limit) - 1);

    if (error) {
      logger.error("Erro do Supabase ao buscar sessões:", error);
      return res.status(500).json({ error: "Erro ao buscar sessões." });
    }

    res.status(200).json({
      data: sessoes,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        totalItems: count,
        totalPages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    logger.error("Erro inesperado no controller de busca de sessões:", error);
    res.status(500).json({ error: "Ocorreu um erro interno no servidor." });
  }
};

/**
 * GET /api/sessoes/:id - Busca uma sessão específica.
 * A autenticação e autorização são tratadas pelo middleware `canManageSessoes`.
 */
const getSessaoById = async (req, res) => {
  const { profile } = req;
  const { id } = req.params;

  try {
    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    const { data: sessao, error } = await supabaseAdmin
      .from("sessoes")
      .select(`*, camaras (*)`)
      .eq("id", id)
      .eq("camara_id", profile.camara_id) // Garante que o usuário só possa ver sessões da sua própria câmara
      .single();

    if (error) {
      logger.error(`Erro do Supabase ao buscar sessão ${id}:`, error);
      // 'PGRST116' é o código para '0 linhas retornadas', ou seja, não encontrado.
      if (error.code === "PGRST116") {
        return res.status(404).json({
          error: "Sessão não encontrada ou não pertence à sua câmara.",
        });
      }
      return res.status(500).json({ error: "Erro ao buscar a sessão." });
    }

    res.status(200).json(sessao);
  } catch (error) {
    logger.error(
      "Erro inesperado no controller de busca de sessão por ID:",
      error
    );
    res.status(500).json({ error: "Ocorreu um erro interno no servidor." });
  }
};

/**
 * PUT /api/sessoes/:id - Atualiza uma sessão existente.
 */
const updateSessao = async (req, res) => {
  const { profile } = req;
  const { id } = req.params;
  const { numero, tipo, data_sessao, status } = req.body;

  try {
    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    // Verifica se a sessão existe e pertence à câmara do usuário
    const { data: sessaoExistente, error: checkError } = await supabaseAdmin
      .from("sessoes")
      .select("id, nome")
      .eq("id", id)
      .eq("camara_id", profile.camara_id)
      .single();

    if (checkError) {
      if (checkError.code === "PGRST116") {
        return res.status(404).json({
          error: "Sessão não encontrada ou não pertence à sua câmara.",
        });
      }
      logger.error("Erro ao verificar sessão existente:", checkError);
      return res.status(500).json({ error: "Erro ao verificar a sessão." });
    }

    // Gera o novo nome se os dados relevantes mudaram
    const ano = new Date(data_sessao).getFullYear();
    const novoNome = `${numero}ª Sessão ${tipo} de ${ano}`;

    // Verifica duplicidade apenas se o nome mudou
    if (novoNome !== sessaoExistente.nome) {
      const { data: duplicata, error: dupError } = await supabaseAdmin
        .from("sessoes")
        .select("id")
        .eq("camara_id", profile.camara_id)
        .eq("nome", novoNome)
        .neq("id", id) // Exclui a própria sessão
        .limit(1);

      if (dupError && dupError.code !== "PGRST116") {
        logger.error("Erro ao verificar duplicidade:", dupError);
        return res
          .status(500)
          .json({ error: "Erro ao verificar duplicidade." });
      }

      if (duplicata && duplicata.length > 0) {
        return res.status(409).json({
          error: "Conflito: Já existe uma sessão com este número, tipo e ano.",
          details: `A sessão "${novoNome}" já está cadastrada.`,
        });
      }
    }

    // Atualiza a sessão
    const updateData = {
      nome: novoNome,
      tipo: tipo,
      status: status,
      data_sessao: new Date(data_sessao).toISOString().split("T")[0],
    };

    const { data: sessaoAtualizada, error: updateError } = await supabaseAdmin
      .from("sessoes")
      .update(updateData)
      .eq("id", id)
      .eq("camara_id", profile.camara_id)
      .select("*")
      .single();

    if (updateError) {
      logger.error("Erro ao atualizar sessão:", updateError);
      return res.status(500).json({ error: "Erro ao atualizar a sessão." });
    }

    logger.log(`Sessão ${id} atualizada com sucesso`);
    res.status(200).json({
      message: "Sessão atualizada com sucesso!",
      data: sessaoAtualizada,
    });
  } catch (error) {
    logger.error("Erro inesperado ao atualizar sessão:", error);
    res.status(500).json({ error: "Ocorreu um erro interno no servidor." });
  }
};

/**
 * DELETE /api/sessoes/:id - Exclui uma sessão.
 */
const deleteSessao = async (req, res) => {
  const { profile } = req;
  const { id } = req.params;

  try {
    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    // Verifica se a sessão existe e pertence à câmara do usuário
    const { data: sessaoExistente, error: checkError } = await supabaseAdmin
      .from("sessoes")
      .select("id, nome")
      .eq("id", id)
      .eq("camara_id", profile.camara_id)
      .single();

    if (checkError) {
      if (checkError.code === "PGRST116") {
        return res.status(404).json({
          error: "Sessão não encontrada ou não pertence à sua câmara.",
        });
      }
      logger.error("Erro ao verificar sessão existente:", checkError);
      return res.status(500).json({ error: "Erro ao verificar a sessão." });
    }

    // Exclui a sessão
    const { error: deleteError } = await supabaseAdmin
      .from("sessoes")
      .delete()
      .eq("id", id)
      .eq("camara_id", profile.camara_id);

    if (deleteError) {
      logger.error("Erro ao excluir sessão:", deleteError);
      return res.status(500).json({ error: "Erro ao excluir a sessão." });
    }

    logger.log(`Sessão "${sessaoExistente.nome}" (${id}) excluída com sucesso`);
    res.status(200).json({ message: "Sessão excluída com sucesso!" });
  } catch (error) {
    logger.error("Erro inesperado ao excluir sessão:", error);
    res.status(500).json({ error: "Ocorreu um erro interno no servidor." });
  }
};

// GET /api/sessoes/disponiveis - Buscar sessões agendadas e futuras
const getSessoesDisponiveis = async (req, res) => {
  try {
    const { user, profile } = req;
    
    logger.log(`Buscando sessões disponíveis para usuário ${user.id}...`);
    
    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );
    
    // Data atual para filtrar sessões futuras
    const agora = new Date().toISOString();
    
    let query = supabaseAdmin
      .from('sessoes')
      .select(`
        id,
        nome,
        tipo,
        status,
        data_sessao,
        camaras (nome_camara)
      `)
      .eq('status', 'Agendada')
      .gte('data_sessao', agora)
      .order('data_sessao', { ascending: true });
    
    // Para admin_camara, filtrar apenas sessões da sua câmara
    if (profile.role === 'admin_camara' && profile.camara_id) {
      query = query.eq('camara_id', profile.camara_id);
    }
    
    const { data: sessoes, error } = await query;
    
    if (error) {
      logger.error('Erro ao buscar sessões disponíveis:', error);
      return res.status(500).json({ error: 'Erro ao buscar sessões disponíveis' });
    }
    
    logger.log(`Encontradas ${sessoes.length} sessões disponíveis.`);
    
    res.json({ data: sessoes });
    
  } catch (error) {
    logger.error('Erro no endpoint de sessões disponíveis:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

module.exports = {
  createSessao,
  getAllSessoes,
  getSessaoById,
  updateSessao,
  deleteSessao,
  getSessoesDisponiveis,
};
