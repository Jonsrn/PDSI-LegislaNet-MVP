const supabaseAdmin = require("../config/supabaseAdminClient");
const createLogger = require("../utils/logger");
const logger = createLogger("CAMARA_CONTROLLER");

/**
 * Busca uma câmara pelo seu ID, incluindo os dados do seu administrador.
 */
const getCamaraById = async (req, res) => {
  const { id } = req.params;
  logger.log(`Buscando dados completos da câmara com ID: ${id}`);

  try {
    // 1. Busca os dados da câmara
    const { data: camaraData, error: camaraError } = await supabaseAdmin
      .from("camaras")
      .select("*")
      .eq("id", id)
      .single();

    if (camaraError) throw camaraError;
    if (!camaraData)
      return res.status(404).json({ error: "Câmara não encontrada." });

    // 2. Busca o perfil do administrador desta câmara
    const { data: adminProfile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id") // Apenas o ID é necessário para buscar o usuário
      .eq("camara_id", id)
      .eq("role", "admin_camara")
      .single();

    if (profileError) {
      logger.warn(
        `Administrador não encontrado para a câmara ${id}, retornando dados parciais.`
      );
      return res.status(200).json({ ...camaraData, admin: null });
    }

    // 3. Busca o email do administrador no Supabase Auth
    const {
      data: { user: adminUser },
      error: userError,
    } = await supabaseAdmin.auth.admin.getUserById(adminProfile.id);
    if (userError) throw userError;

    // 4. Combina os resultados
    const responseData = {
      ...camaraData,
      admin: {
        id: adminUser.id,
        email: adminUser.email,
      },
    };

    // 5. Tenta buscar se existe uma TV registrada para esta câmara
    try {
      const { data: tvProfile, error: tvProfileError } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("camara_id", id)
        .eq("role", "tv")
        .single();

      if (!tvProfileError && tvProfile) {
        const {
          data: { user: tvUser },
          error: tvUserError,
        } = await supabaseAdmin.auth.admin.getUserById(tvProfile.id);
        if (!tvUserError && tvUser) {
          responseData.tv = { id: tvUser.id, email: tvUser.email };
        }
      }
    } catch (err) {
      logger.warn("Falha ao buscar dados da TV para a câmara:", err.message);
    }

    res.status(200).json(responseData);
  } catch (error) {
    logger.error("Erro ao buscar dados completos da câmara.", error.message);
    res.status(500).json({ error: "Erro ao buscar dados da câmara." });
  }
};

/**
 * Atualiza os dados de uma câmara.
 */
const updateCamara = async (req, res) => {
  const { id } = req.params;
  // Remove os campos de admin do corpo para não tentar inseri-los na tabela 'camaras'
  const {
    nome_camara,
    municipio,
    estado,
    is_active,
    link_facebook,
    link_instagram,
    link_youtube,
    site_oficial,
    youtube_stream_key,
    youtube_rtmp_url,
    youtube_channel_id,
    youtube_channel_url,
  } = req.body;

  logger.log(`Atualizando câmara com ID: ${id}`);

  // Processar brasão se foi enviado
  let brasao_url = req.body.brasao_url; // Manter valor atual se não houver novo upload
  if (req.file && req.file.url) {
    brasao_url = req.file.url;
    logger.log("-> Brasão processado pelo novo middleware:", {
      url: brasao_url,
    });
  }

  // Filtra chaves indefinidas para não sobrescrever campos com 'undefined'
  const updateData = Object.entries({
    nome_camara,
    municipio,
    estado,
    is_active,
    brasao_url,
    link_facebook,
    link_instagram,
    link_youtube,
    site_oficial,
    youtube_stream_key,
    youtube_rtmp_url,
    youtube_channel_id,
    youtube_channel_url,
  }).reduce((acc, [key, value]) => {
    if (value !== undefined) {
      acc[key] = value;
    }
    return acc;
  }, {});

  if (Object.keys(updateData).length === 0) {
    return res
      .status(400)
      .json({ error: "Nenhum dado válido para atualização fornecido." });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from("camaras")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    logger.log("Câmara atualizada com sucesso.", data);
    // Se houver credenciais de TV no corpo, tentamos criar/associar a TV
    try {
      const tvEmail = req.body.tv_email;
      const tvSenha = req.body.tv_senha;
      if (tvEmail) {
        // Verifica se já existe profile tv para esta câmara
        const { data: existingTv, error: existingTvError } = await supabaseAdmin
          .from("profiles")
          .select("id")
          .eq("camara_id", id)
          .eq("role", "tv")
          .limit(1)
          .single();

        if (!existingTvError && existingTv && existingTv.id) {
          logger.log("TV já existente para esta câmara, pulando criação.");
        } else {
          // Cria usuário auth para a TV
          const { data: tvAuthData, error: tvAuthError } =
            await supabaseAdmin.auth.admin.createUser({
              email: tvEmail,
              password: tvSenha || Math.random().toString(36).slice(-10),
              email_confirm: true,
            });
          if (tvAuthError)
            throw new Error(
              `Falha ao criar usuário TV: ${tvAuthError.message}`
            );
          // Cria perfil com role 'tv'
          const { error: tvProfileInsertError } = await supabaseAdmin
            .from("profiles")
            .insert([
              {
                id: tvAuthData.user.id,
                nome: `TV ${data.nome_camara}`,
                role: "tv",
                camara_id: id,
              },
            ]);
          if (tvProfileInsertError)
            throw new Error(
              `Falha ao criar profile da TV: ${tvProfileInsertError.message}`
            );
          // Cria entrada em tv_displays
          const { error: tvDisplayError } = await supabaseAdmin
            .from("tv_displays")
            .insert([{ profile_id: tvAuthData.user.id, camara_id: id }]);
          if (tvDisplayError)
            throw new Error(
              `Falha ao criar registro em tv_displays: ${tvDisplayError.message}`
            );
          logger.log("TV criada e associada com sucesso à câmara.");
        }
      }
    } catch (err) {
      logger.error("Erro ao criar/associar TV:", err.message);
      // Não falhar a atualização da câmara por causa da TV, apenas logar o erro
    }

    res.status(200).json({ message: "Câmara atualizada com sucesso!", data });
  } catch (error) {
    logger.error("Erro ao atualizar câmara.", error.message);
    res.status(500).json({ error: "Erro ao atualizar dados da câmara." });
  }
};

module.exports = {
  getCamaraById,
  updateCamara,
};
