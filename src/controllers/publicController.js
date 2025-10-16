const supabaseAdmin = require("../config/supabaseAdminClient");
const createLogger = require("../utils/logger");
const logger = createLogger("PUBLIC_CONTROLLER");

/**
 * Lista câmaras ativas para seleção pública
 * Baseado na função getCamarasPaginado do adminController, mas apenas com câmaras ativas
 */
const getCamarasPublicas = async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 8; // Mesmo limite do sistema de sessões
  const search = req.query.search || "";
  const offset = (page - 1) * limit;

  logger.log(
    `Buscando câmaras públicas - Página: ${page}, Limite: ${limit}, Busca: ${search}`
  );

  try {
    // Contar total de câmaras ativas (com busca se fornecida)
    let countQuery = supabaseAdmin
      .from("camaras")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true); // Apenas câmaras ativas

    if (search) {
      const searchQuery = `nome_camara.ilike.%${search}%,municipio.ilike.%${search}%`;
      countQuery = countQuery.or(searchQuery);
    }

    const { count: totalItems, error: countError } = await countQuery;
    if (countError) throw countError;

    // Buscar câmaras ativas com informações básicas
    let query = supabaseAdmin
      .from("camaras")
      .select(
        `
                id,
                nome_camara,
                municipio,
                estado,
                brasao_url
            `
      )
      .eq("is_active", true); // Apenas câmaras ativas

    if (search) {
      const searchQuery = `nome_camara.ilike.%${search}%,municipio.ilike.%${search}%`;
      query = query.or(searchQuery);
    }

    const { data: camaras, error } = await query
      .order("nome_camara", { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    // Buscar contagens separadamente para cada câmara
    const processedCamaras = await Promise.all(
      camaras.map(async (camara) => {
        try {
          // Buscar contagem de vereadores ativos
          const { count: vereadores_count } = await supabaseAdmin
            .from("vereadores")
            .select("id", { count: "exact", head: true })
            .eq("camara_id", camara.id)
            .eq("is_active", true);

          // Buscar contagem total de sessões
          const { count: sessoes_totais } = await supabaseAdmin
            .from("sessoes")
            .select("id", { count: "exact", head: true })
            .eq("camara_id", camara.id);

          return {
            id: camara.id,
            nome_camara: camara.nome_camara,
            municipio: camara.municipio,
            estado: camara.estado,
            brasao_url: camara.brasao_url,
            vereadores_count: vereadores_count || 0,
            sessoes_totais: sessoes_totais || 0,
          };
        } catch (err) {
          // Em caso de erro nas contagens, retornar dados básicos
          console.warn(
            `Erro ao buscar estatísticas da câmara ${camara.id}:`,
            err.message
          );
          return {
            id: camara.id,
            nome_camara: camara.nome_camara,
            municipio: camara.municipio,
            estado: camara.estado,
            brasao_url: camara.brasao_url,
            vereadores_count: 0,
            sessoes_totais: 0,
          };
        }
      })
    );

    logger.log(
      `Câmaras encontradas: ${processedCamaras.length} de ${totalItems} total`
    );

    res.status(200).json({
      camaras: processedCamaras,
      pagination: {
        total: totalItems,
        totalPages: Math.ceil(totalItems / limit),
        currentPage: page,
        limit,
        hasNextPage: page < Math.ceil(totalItems / limit),
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    logger.error("Erro ao buscar câmaras públicas:", error.message);
    res.status(500).json({
      error: "Erro ao buscar câmaras",
      message:
        "Não foi possível carregar a lista de câmaras. Tente novamente mais tarde.",
    });
  }
};

/**
 * Busca informações públicas de uma câmara específica
 */
const getCamaraPublicInfo = async (req, res) => {
  const { id } = req.params;

  logger.log(`Buscando informações públicas da câmara: ${id}`);

  try {
    // Buscar dados básicos da câmara
    const { data: camara, error: camaraError } = await supabaseAdmin
      .from("camaras")
      .select(
        `
                id,
                nome_camara,
                municipio,
                estado,
                brasao_url,
                is_active,
                link_facebook,
                link_instagram,
                link_youtube,
                site_oficial
            `
      )
      .eq("id", id)
      .eq("is_active", true) // Apenas câmaras ativas
      .single();

    if (camaraError || !camara) {
      return res.status(404).json({
        error: "Câmara não encontrada",
        message: "A câmara solicitada não foi encontrada ou não está ativa.",
      });
    }

    // Buscar estatísticas adicionais
    const [vereadorResult, sessaoResult] = await Promise.all([
      // Contar vereadores ativos
      supabaseAdmin
        .from("vereadores")
        .select("id", { count: "exact", head: true })
        .eq("camara_id", id)
        .eq("is_active", true),

      // Contar sessões ativas
      supabaseAdmin
        .from("sessoes")
        .select("id", { count: "exact", head: true })
        .eq("camara_id", id)
        .eq("status", "ativa"),
    ]);

    // Buscar pautas recentes separadamente (mais simples)
    let pautasRecentes = 0;
    try {
      const { count } = await supabaseAdmin
        .from("pautas")
        .select("id", { count: "exact", head: true })
        .gte(
          "created_at",
          new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
        )
        .in("status", ["Em Votação", "Finalizada"]);
      pautasRecentes = count || 0;
    } catch (pautaError) {
      console.warn("Erro ao buscar pautas recentes:", pautaError.message);
      pautasRecentes = 0;
    }

    const responseData = {
      info: camara,
      estatisticas: {
        vereadores_ativos: vereadorResult.count || 0,
        sessoes_ativas: sessaoResult.count || 0,
        pautas_recentes: pautasRecentes,
      },
    };

    logger.log(`Informações da câmara ${id} carregadas com sucesso`);

    res.status(200).json(responseData);
  } catch (error) {
    logger.error(`Erro ao buscar informações da câmara ${id}:`, error.message);
    res.status(500).json({
      error: "Erro interno",
      message: "Não foi possível carregar as informações da câmara.",
    });
  }
};

/**
 * Busca sessões futuras de uma câmara específica
 */
const getSessoesFuturas = async (req, res) => {
  const { id } = req.params;

  logger.log(`Buscando sessões futuras da câmara: ${id}`);

  try {
    // Buscar apenas câmaras ativas
    const { data: camara } = await supabaseAdmin
      .from("camaras")
      .select("id")
      .eq("id", id)
      .eq("is_active", true)
      .single();

    if (!camara) {
      return res.status(404).json({
        error: "Câmara não encontrada",
        message: "A câmara solicitada não foi encontrada ou não está ativa.",
      });
    }

    // Buscar sessões futuras (data_sessao > hoje)
    const agora = new Date().toISOString();
    const { data: sessoes, error } = await supabaseAdmin
      .from("sessoes")
      .select(
        `
                id,
                nome,
                tipo,
                data_sessao,
                status
            `
      )
      .eq("camara_id", id)
      .gt("data_sessao", agora)
      .in("status", ["Agendada", "Em Andamento"]) // Apenas sessões agendadas ou em andamento
      .order("data_sessao", { ascending: true })
      .limit(10); // Limitar a 10 próximas sessões

    if (error) throw error;

    logger.log(`Sessões futuras encontradas: ${sessoes.length}`);

    res.status(200).json({
      sessoes: sessoes || [],
      total: sessoes.length,
    });
  } catch (error) {
    logger.error(
      `Erro ao buscar sessões futuras da câmara ${id}:`,
      error.message
    );
    res.status(500).json({
      error: "Erro interno",
      message: "Não foi possível carregar as sessões futuras.",
    });
  }
};

/**
 * Calcula estatísticas de votações para um vereador
 * Conta todas as pautas finalizadas em que o vereador votou
 */
const calcularVotacoes = async (vereadorId, camaraId) => {
  try {
    // Primeiro, buscar todas as sessões da câmara
    const { data: sessoes, error: sessoesError } = await supabaseAdmin
      .from("sessoes")
      .select("id")
      .eq("camara_id", camaraId);

    if (sessoesError) {
      console.warn(
        `Erro ao buscar sessões para votações:`,
        sessoesError.message
      );
      return 0;
    }

    if (!sessoes || sessoes.length === 0) {
      return 0;
    }

    const sessaoIds = sessoes.map((s) => s.id);

    // Buscar pautas finalizadas dessas sessões
    const { data: pautas, error: pautasError } = await supabaseAdmin
      .from("pautas")
      .select("id")
      .eq("status", "Finalizada")
      .in("sessao_id", sessaoIds);

    if (pautasError) {
      console.warn(`Erro ao buscar pautas finalizadas:`, pautasError.message);
      return 0;
    }

    if (!pautas || pautas.length === 0) {
      return 0;
    }

    const pautaIds = pautas.map((p) => p.id);

    // Contar votos do vereador nessas pautas
    const { count: totalVotacoes, error: votosError } = await supabaseAdmin
      .from("votos")
      .select("id", { count: "exact", head: true })
      .eq("vereador_id", vereadorId)
      .in("pauta_id", pautaIds);

    if (votosError) {
      console.warn(
        `Erro ao contar votos do vereador ${vereadorId}:`,
        votosError.message
      );
      return 0;
    }

    console.log(
      `Vereador ${vereadorId}: ${totalVotacoes || 0} votações em ${
        pautas.length
      } pautas finalizadas`
    );
    return totalVotacoes || 0;
  } catch (error) {
    console.warn(
      `Erro ao calcular votações do vereador ${vereadorId}:`,
      error.message
    );
    return 0;
  }
};

/**
 * Calcula estatísticas de presença para um vereador
 * Lógica: Se vereador votou em pelo menos uma pauta FINALIZADA de uma sessão NÃO FUTURA = presença
 */
const calcularPresenca = async (vereadorId, camaraId) => {
  try {
    // Buscar todas as sessões NÃO FUTURAS da câmara (independente do status da sessão)
    const agora = new Date().toISOString();
    console.log(`🕐 Data atual para filtro: ${agora}`);

    const { data: sessoes, error: sessoesError } = await supabaseAdmin
      .from("sessoes")
      .select("id, nome, data_sessao, status")
      .eq("camara_id", camaraId)
      .lt("data_sessao", agora); // Apenas sessões passadas (independente do status)

    if (sessoesError) {
      console.warn(
        `Erro ao buscar sessões para presença:`,
        sessoesError.message
      );
      return { sessoes_presentes: 0, total_sessoes: 0, percentual: 0 };
    }

    console.log(
      `🎯 Sessões não futuras encontradas (${sessoes?.length || 0}):`
    );
    if (sessoes) {
      sessoes.forEach((s) => {
        console.log(`  - ${s.nome}: ${s.data_sessao} (${s.status})`);
      });
    }

    if (!sessoes || sessoes.length === 0) {
      console.log(`⚠️ Nenhuma sessão passada encontrada`);
      return { sessoes_presentes: 0, total_sessoes: 0, percentual: 0 };
    }

    const totalSessoes = sessoes.length;
    let sessoesPresentes = 0;

    console.log(
      `\n📊 Analisando presença em ${totalSessoes} sessões para vereador ${vereadorId}`
    );

    // Para cada sessão, verificar se o vereador votou em pelo menos uma pauta FINALIZADA
    for (const sessao of sessoes) {
      console.log(`\n🔍 Sessão: ${sessao.nome} (${sessao.data_sessao})`);

      // Buscar apenas pautas FINALIZADAS desta sessão
      const { data: pautasFinalizadas, error: pautasError } =
        await supabaseAdmin
          .from("pautas")
          .select("id, nome, status")
          .eq("sessao_id", sessao.id)
          .eq("status", "Finalizada"); // APENAS pautas finalizadas

      if (pautasError) {
        console.warn(
          `❌ Erro ao buscar pautas finalizadas:`,
          pautasError.message
        );
        continue;
      }

      console.log(
        `   📝 Pautas FINALIZADAS: ${pautasFinalizadas?.length || 0}`
      );
      if (pautasFinalizadas && pautasFinalizadas.length > 0) {
        pautasFinalizadas.forEach((p) => {
          console.log(`      - ${p.nome} (${p.status})`);
        });
      }

      if (!pautasFinalizadas || pautasFinalizadas.length === 0) {
        console.log(`   ⚠️ Sessão sem pautas finalizadas, vereador ausente`);
        continue;
      }

      const pautaIds = pautasFinalizadas.map((p) => p.id);

      // Verificar se vereador votou em alguma pauta finalizada
      const { count: votosEmPautasFinalizadas, error: votosError } =
        await supabaseAdmin
          .from("votos")
          .select("id", { count: "exact", head: true })
          .eq("vereador_id", vereadorId)
          .in("pauta_id", pautaIds);

      if (votosError) {
        console.warn(`❌ Erro ao verificar votos:`, votosError.message);
        continue;
      }

      console.log(
        `   🗳️ Votos em pautas finalizadas: ${votosEmPautasFinalizadas || 0}`
      );

      // Se votou em pelo menos uma pauta finalizada = presença
      if (votosEmPautasFinalizadas && votosEmPautasFinalizadas > 0) {
        sessoesPresentes++;
        console.log(
          `   ✅ PRESENTE (votou em ${votosEmPautasFinalizadas} pautas finalizadas)`
        );
      } else {
        console.log(`   ❌ AUSENTE (não votou em nenhuma pauta finalizada)`);
      }
    }

    const percentual =
      totalSessoes > 0
        ? Math.round((sessoesPresentes / totalSessoes) * 100)
        : 0;

    console.log(
      `\n📋 RESULTADO - Vereador ${vereadorId}: ${sessoesPresentes}/${totalSessoes} sessões = ${percentual}%`
    );

    return {
      sessoes_presentes: sessoesPresentes,
      total_sessoes: totalSessoes,
      percentual: percentual,
    };
  } catch (error) {
    console.warn(
      `Erro ao calcular presença do vereador ${vereadorId}:`,
      error.message
    );
    return { sessoes_presentes: 0, total_sessoes: 0, percentual: 0 };
  }
};

/**
 * Busca estatísticas de todos os vereadores de uma vez com consulta otimizada
 */
const calcularEstatisticasOtimizadas = async (camaraId) => {
  try {
    const agora = new Date().toISOString();
    console.log(
      `🚀 Calculando estatísticas otimizadas para câmara: ${camaraId}`
    );

    // Consulta otimizada que busca todas as estatísticas de uma vez
    const { data: estatisticas, error } = await supabaseAdmin.rpc(
      "calcular_estatisticas_vereadores",
      {
        p_camara_id: camaraId,
        p_data_atual: agora,
      }
    );

    if (error) {
      console.warn(
        "Erro na função RPC, usando consulta alternativa:",
        error.message
      );
      return await calcularEstatisticasAlternativa(camaraId);
    }

    const statsMap = {};
    estatisticas.forEach((stat) => {
      statsMap[stat.vereador_id] = {
        total_votacoes: stat.total_votacoes || 0,
        percentual_presenca: stat.percentual_presenca || 0,
        sessoes_presentes: stat.sessoes_presentes || 0,
        total_sessoes: stat.total_sessoes || 0,
      };
    });

    console.log(
      `✅ Estatísticas calculadas para ${
        Object.keys(statsMap).length
      } vereadores`
    );
    return statsMap;
  } catch (error) {
    console.warn("Erro ao calcular estatísticas otimizadas:", error.message);
    return await calcularEstatisticasAlternativa(camaraId);
  }
};

/**
 * Consulta alternativa usando LEFT JOINs diretamente no Supabase
 */
const calcularEstatisticasAlternativa = async (camaraId) => {
  try {
    const agora = new Date().toISOString();
    console.log(`🔄 Usando consulta alternativa para câmara: ${camaraId}`);

    // Primeiro buscar vereadores ativos
    const { data: vereadores } = await supabaseAdmin
      .from("vereadores")
      .select("id")
      .eq("camara_id", camaraId)
      .eq("is_active", true);

    if (!vereadores || vereadores.length === 0) {
      return {};
    }

    const vereadorIds = vereadores.map((v) => v.id);
    const statsMap = {};

    // Calcular votações para todos os vereadores
    const { data: votacoes } = await supabaseAdmin
      .from("votos")
      .select(
        `
                vereador_id,
                pautas!inner (
                    status,
                    sessoes!inner (
                        camara_id
                    )
                )
            `
      )
      .in("vereador_id", vereadorIds)
      .eq("pautas.status", "Finalizada")
      .eq("pautas.sessoes.camara_id", camaraId);

    // Agrupar votações por vereador
    votacoes?.forEach((voto) => {
      if (!statsMap[voto.vereador_id]) {
        statsMap[voto.vereador_id] = {
          total_votacoes: 0,
          sessoes_presentes: new Set(),
        };
      }
      statsMap[voto.vereador_id].total_votacoes++;
    });

    // Calcular presença: votos em pautas finalizadas de sessões não futuras
    const { data: presencas } = await supabaseAdmin
      .from("votos")
      .select(
        `
                vereador_id,
                pautas!inner (
                    status,
                    sessao_id,
                    sessoes!inner (
                        camara_id,
                        data_sessao
                    )
                )
            `
      )
      .in("vereador_id", vereadorIds)
      .eq("pautas.status", "Finalizada")
      .eq("pautas.sessoes.camara_id", camaraId)
      .lt("pautas.sessoes.data_sessao", agora);

    // Agrupar presenças por vereador
    presencas?.forEach((presenca) => {
      if (!statsMap[presenca.vereador_id]) {
        statsMap[presenca.vereador_id] = {
          total_votacoes: 0,
          sessoes_presentes: new Set(),
        };
      }
      statsMap[presenca.vereador_id].sessoes_presentes.add(
        presenca.pautas.sessao_id
      );
    });

    // Buscar total de sessões não futuras
    const { count: totalSessoes } = await supabaseAdmin
      .from("sessoes")
      .select("id", { count: "exact", head: true })
      .eq("camara_id", camaraId)
      .lt("data_sessao", agora);

    // Finalizar cálculos
    const finalStats = {};
    vereadores.forEach((vereador) => {
      const stats = statsMap[vereador.id] || {
        total_votacoes: 0,
        sessoes_presentes: new Set(),
      };
      const sessoesPresentes = stats.sessoes_presentes?.size || 0;
      const percentual =
        totalSessoes > 0
          ? Math.round((sessoesPresentes / totalSessoes) * 100)
          : 0;

      finalStats[vereador.id] = {
        total_votacoes: stats.total_votacoes || 0,
        percentual_presenca: percentual,
        sessoes_presentes: sessoesPresentes,
        total_sessoes: totalSessoes || 0,
      };
    });

    console.log(
      `✅ Estatísticas alternativas calculadas para ${
        Object.keys(finalStats).length
      } vereadores`
    );
    return finalStats;
  } catch (error) {
    console.warn("Erro na consulta alternativa:", error.message);
    return {};
  }
};

/**
 * Busca vereadores ativos de uma câmara específica com partidos e estatísticas otimizadas
 */
const getVereadores = async (req, res) => {
  const { id } = req.params;

  logger.log(`Buscando vereadores ativos da câmara: ${id}`);

  try {
    // Buscar apenas câmaras ativas
    const { data: camara } = await supabaseAdmin
      .from("camaras")
      .select("id")
      .eq("id", id)
      .eq("is_active", true)
      .single();

    if (!camara) {
      return res.status(404).json({
        error: "Câmara não encontrada",
        message: "A câmara solicitada não foi encontrada ou não está ativa.",
      });
    }

    // Buscar vereadores e estatísticas em paralelo
    const [vereadoresResult, estatisticas] = await Promise.all([
      supabaseAdmin
        .from("vereadores")
        .select(
          `
                    id,
                    nome_parlamentar,
                    foto_url,
                    is_presidente,
                    is_vice_presidente,
                    partidos!inner (
                        id,
                        nome,
                        sigla,
                        logo_url
                    )
                `
        )
        .eq("camara_id", id)
        .eq("is_active", true)
        .order("nome_parlamentar", { ascending: true }),
      calcularEstatisticasOtimizadas(id),
    ]);

    if (vereadoresResult.error) throw vereadoresResult.error;

    // Formatar dados com estatísticas
    const vereadoresComEstatisticas = vereadoresResult.data.map((vereador) => {
      let cargo = "Vereador";

      if (vereador.is_presidente) {
        cargo = "Presidente da Câmara";
      } else if (vereador.is_vice_presidente) {
        cargo = "Vice-Presidente";
      }

      const stats = estatisticas[vereador.id] || {
        total_votacoes: 0,
        percentual_presenca: 0,
        sessoes_presentes: 0,
        total_sessoes: 0,
      };

      return {
        id: vereador.id,
        nome: vereador.nome_parlamentar,
        foto_url: vereador.foto_url,
        cargo: cargo,
        partido: {
          id: vereador.partidos.id,
          nome: vereador.partidos.nome,
          sigla: vereador.partidos.sigla,
          logo_url: vereador.partidos.logo_url,
        },
        estatisticas: stats,
      };
    });

    logger.log(
      `Vereadores ativos encontrados: ${vereadoresComEstatisticas.length}`
    );

    res.status(200).json({
      vereadores: vereadoresComEstatisticas,
      total: vereadoresComEstatisticas.length,
    });
  } catch (error) {
    logger.error(`Erro ao buscar vereadores da câmara ${id}:`, error.message);
    res.status(500).json({
      error: "Erro interno",
      message: "Não foi possível carregar os vereadores.",
    });
  }
};

/**
 * Busca as últimas 9 pautas finalizadas de uma câmara com informações de votação
 */
const getVotacoesRecentes = async (req, res) => {
  const { id } = req.params;

  logger.log(`Buscando votações recentes da câmara: ${id}`);

  try {
    // Verificar se câmara existe e está ativa
    const { data: camara } = await supabaseAdmin
      .from("camaras")
      .select("id")
      .eq("id", id)
      .eq("is_active", true)
      .single();

    if (!camara) {
      return res.status(404).json({
        error: "Câmara não encontrada",
        message: "A câmara solicitada não foi encontrada ou não está ativa.",
      });
    }

    // Consulta otimizada: tentar buscar últimas 9 pautas finalizadas ordenando por updated_at.
    // Se a coluna updated_at não existir no schema (fallback), recuar para created_at.
    let pautas = null;
    try {
      const resp = await supabaseAdmin
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
                        id,
                        nome,
                        data_sessao,
                        camara_id
                    )
                `
        )
        .eq("status", "Finalizada")
        .eq("sessoes.camara_id", id)
        .order("updated_at", { ascending: false })
        .limit(9);

      if (resp.error) throw resp.error;
      pautas = resp.data;
    } catch (err) {
      logger.warn(
        "updated_at não disponível ou erro ao ordenar por updated_at, recuando para created_at:",
        err.message || err
      );
      // Fallback: ordenar por created_at (compatível com schema atual)
      const resp2 = await supabaseAdmin
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
                        id,
                        nome,
                        data_sessao,
                        camara_id
                    )
                `
        )
        .eq("status", "Finalizada")
        .eq("sessoes.camara_id", id)
        .order("created_at", { ascending: false })
        .limit(9);

      if (resp2.error) throw resp2.error;
      pautas = resp2.data;
    }

    // Formatar dados para o portal público
    const votacoesFormatadas = pautas.map((pauta) => {
      // Determinar status baseado no resultado da votação para pautas finalizadas
      let status = "Pendente";
      let statusClass = "pending";

      if (pauta.resultado_votacao === "Aprovada") {
        status = "APROVADA";
        statusClass = "approved";
      } else if (pauta.resultado_votacao === "Reprovada") {
        status = "REPROVADA";
        statusClass = "rejected";
      } else if (pauta.resultado_votacao === "Não Votada") {
        status = "NÃO VOTADA";
        statusClass = "not-voted";
      }

      return {
        id: pauta.id,
        nome: pauta.nome,
        descricao: pauta.descricao || "Descrição não informada",
        autor: pauta.autor || "Autor não informado",
        status: status,
        statusClass: statusClass,
        sessao: {
          nome: pauta.sessoes.nome,
          data: pauta.sessoes.data_sessao,
        },
        data_criacao: pauta.created_at,
        data_finalizacao: pauta.updated_at,
      };
    });

    logger.log(`Votações recentes encontradas: ${votacoesFormatadas.length}`);

    res.status(200).json({
      pautas: votacoesFormatadas,
      total: votacoesFormatadas.length,
    });
  } catch (error) {
    logger.error(
      `Erro ao buscar votações recentes da câmara ${id}:`,
      error.message
    );
    res.status(500).json({
      error: "Erro interno",
      message: "Não foi possível carregar as votações recentes.",
    });
  }
};

/**
 * Busca informações públicas de uma pauta específica
 */
const getPautaPublica = async (req, res) => {
  const { id } = req.params;

  logger.log(`Buscando pauta pública: ${id}`);

  try {
    const { data: pauta, error } = await supabaseAdmin
      .from("pautas")
      .select(
        `
                id,
                nome,
                descricao,
                autor,
                status,
                resultado_votacao,
        created_at,
        updated_at,
                sessoes!inner (
                    id,
                    nome,
                    data_sessao,
                    camaras!inner (
                        id,
                        nome_camara,
                        is_active
                    )
                )
            `
      )
      .eq("id", id)
      .eq("sessoes.camaras.is_active", true)
      .single();

    if (error || !pauta) {
      return res.status(404).json({
        error: "Pauta não encontrada",
        message:
          "A pauta solicitada não foi encontrada ou não está disponível publicamente.",
      });
    }

    logger.log(`Pauta pública encontrada: ${pauta.nome}`);

    res.status(200).json(pauta);
  } catch (error) {
    logger.error(`Erro ao buscar pauta pública ${id}:`, error.message);
    res.status(500).json({
      error: "Erro interno",
      message: "Não foi possível carregar as informações da pauta.",
    });
  }
};

/**
 * Busca votos públicos de uma pauta específica com estatísticas
 */
const getVotosPublicos = async (req, res) => {
  const { id } = req.params;

  logger.log(`Buscando votos públicos da pauta: ${id}`);

  try {
    // Verificar se a pauta existe e é de câmara ativa
    const { data: pauta } = await supabaseAdmin
      .from("pautas")
      .select(
        `
                id,
                nome,
                sessoes!inner (
                    camaras!inner (
                        id,
                        is_active
                    )
                )
            `
      )
      .eq("id", id)
      .eq("sessoes.camaras.is_active", true)
      .single();

    if (!pauta) {
      return res.status(404).json({
        error: "Pauta não encontrada",
        message:
          "A pauta solicitada não foi encontrada ou não está disponível publicamente.",
      });
    }

    // Buscar votos com informações dos vereadores e partidos
    const { data: votos, error: votosError } = await supabaseAdmin
      .from("votos")
      .select(
        `
                id,
                voto,
                created_at,
                era_presidente_no_voto,
                vereadores!inner (
                    id,
                    nome_parlamentar,
                    foto_url,
                    partidos (
                        id,
                        nome,
                        sigla,
                        logo_url
                    )
                )
            `
      )
      .eq("pauta_id", id)
      .order("created_at", { ascending: true });

    if (votosError) throw votosError;

    // Calcular estatísticas
    let estatisticas = {
      sim: 0,
      nao: 0,
      abstencao: 0,
      total: 0,
    };

    if (votos && votos.length > 0) {
      votos.forEach((voto) => {
        switch (voto.voto) {
          case "SIM":
            estatisticas.sim++;
            break;
          case "NÃO":
            estatisticas.nao++;
            break;
          case "ABSTENÇÃO":
            estatisticas.abstencao++;
            break;
        }
      });
      estatisticas.total = votos.length;
    }

    logger.log(`Votos públicos encontrados: ${votos?.length || 0}`);

    res.status(200).json({
      votos: votos || [],
      estatisticas: estatisticas,
    });
  } catch (error) {
    logger.error(
      `Erro ao buscar votos públicos da pauta ${id}:`,
      error.message
    );
    res.status(500).json({
      error: "Erro interno",
      message: "Não foi possível carregar os votos da pauta.",
    });
  }
};

/**
 * Busca todas as pautas de uma câmara específica com paginação
 */
const getAllPautasPublicas = async (req, res) => {
  const { id } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 12;
  const offset = (page - 1) * limit;

  logger.log(
    `Buscando todas as pautas da câmara ${id} - Página: ${page}, Limite: ${limit}`
  );

  try {
    // Verificar se a câmara existe e está ativa
    const { data: camara } = await supabaseAdmin
      .from("camaras")
      .select("id, nome_camara")
      .eq("id", id)
      .eq("is_active", true)
      .single();

    if (!camara) {
      return res.status(404).json({
        error: "Câmara não encontrada",
        message: "A câmara solicitada não foi encontrada ou não está ativa.",
      });
    }

    // Buscar total de pautas para cálculo de páginas
    const { count: totalPautas } = await supabaseAdmin
      .from("pautas")
      .select("id, sessoes!inner(camara_id)", { count: "exact", head: true })
      .eq("sessoes.camara_id", id)
      .neq("status", "Arquivada");

    // Buscar pautas com dados das sessões
    const { data: pautas, error: pautasError } = await supabaseAdmin
      .from("pautas")
      .select(
        `
                id,
                nome,
                descricao,
                autor,
                status,
                resultado_votacao,
                created_at,
                sessoes!inner (
                    id,
                    nome,
                    tipo,
                    data_sessao,
                    camara_id
                )
            `
      )
      .eq("sessoes.camara_id", id)
      .neq("status", "Arquivada")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (pautasError) throw pautasError;

    // Buscar estatísticas de votos para cada pauta finalizada
    const pautasComEstatisticas = await Promise.all(
      pautas.map(async (pauta) => {
        if (pauta.status === "Finalizada") {
          try {
            const { data: votos } = await supabaseAdmin
              .from("votos")
              .select("voto")
              .eq("pauta_id", pauta.id);

            const estatisticas = {
              total: votos?.length || 0,
              sim: votos?.filter((v) => v.voto === "SIM").length || 0,
              nao: votos?.filter((v) => v.voto === "NÃO").length || 0,
              abstencao:
                votos?.filter((v) => v.voto === "ABSTENÇÃO").length || 0,
            };

            return { ...pauta, estatisticas };
          } catch (error) {
            logger.error(
              `Erro ao buscar estatísticas da pauta ${pauta.id}:`,
              error
            );
            return pauta;
          }
        }
        return pauta;
      })
    );

    const totalPages = Math.ceil(totalPautas / limit);

    const responseData = {
      camara: {
        id: camara.id,
        nome: camara.nome_camara,
      },
      pautas: pautasComEstatisticas,
      paginacao: {
        current_page: page,
        total_pages: totalPages,
        total_items: totalPautas,
        items_per_page: limit,
        has_next: page < totalPages,
        has_prev: page > 1,
      },
    };

    logger.log(
      `${pautasComEstatisticas.length} pautas encontradas para câmara ${id}`
    );
    res.status(200).json(responseData);
  } catch (error) {
    logger.error(`Erro ao buscar pautas da câmara ${id}:`, error.message);
    res.status(500).json({
      error: "Erro interno",
      message: "Não foi possível carregar as pautas da câmara.",
    });
  }
};

module.exports = {
  getCamarasPublicas,
  getCamaraPublicInfo,
  getSessoesFuturas,
  getVereadores,
  getVotacoesRecentes,
  getPautaPublica,
  getVotosPublicos,
  getAllPautasPublicas,
};
