SELECT
  json_build_object(
    'camaraPrincipal', (
      SELECT json_build_object(
        'id', c.id,
        'nome', c.nome_camara,
        'municipio', c.municipio,
        'estado', c.estado,
        'brasao_url', c.brasao_url,
        'is_active', c.is_active,
        'link_facebook', c.link_facebook,
        'link_instagram', c.link_instagram,
        'link_youtube', c.link_youtube,
        'site_oficial', c.site_oficial,
        'telefone', c.telefone,
        'email_contato', c.email_contato,
        'endereco', c.endereco
      )
      FROM camaras c
      WHERE c.id = 'a5df7317-35d5-47e0-955f-668862ed00ac'
    ),
    'camaraSecundaria', (
      SELECT json_build_object(
        'id', c.id,
        'nome', c.nome_camara,
        'municipio', c.municipio,
        'estado', c.estado
      )
      FROM camaras c
      WHERE c.id = 'c01e9faf-a8d7-4943-b058-fc8cc545415d'
    ),
    'usuarios', json_build_object(
      'superAdmin', (
        SELECT json_build_object(
          'id', p.id,
          'email', au.email,
          'nome', p.nome,
          'role', p.role
        )
        FROM profiles p
        JOIN auth.users au ON au.id = p.id
        WHERE p.role = 'super_admin'
        LIMIT 1
      ),
      'adminCamaraPrincipal', (
        SELECT json_build_object(
          'id', p.id,
          'email', au.email,
          'nome', p.nome,
          'role', p.role,
          'camaraId', p.camara_id
        )
        FROM profiles p
        JOIN auth.users au ON au.id = p.id
        WHERE p.role = 'admin_camara'
          AND p.camara_id = 'a5df7317-35d5-47e0-955f-668862ed00ac'
        LIMIT 1
      ),
      'adminCamaraSecundaria', (
        SELECT json_build_object(
          'id', p.id,
          'email', au.email,
          'nome', p.nome,
          'role', p.role,
          'camaraId', p.camara_id
        )
        FROM profiles p
        JOIN auth.users au ON au.id = p.id
        WHERE p.role = 'admin_camara'
          AND p.camara_id = 'c01e9faf-a8d7-4943-b058-fc8cc545415d'
        LIMIT 1
      ),
      'tvCamaraPrincipal', (
        SELECT json_build_object(
          'id', p.id,
          'email', au.email,
          'nome', p.nome,
          'role', p.role,
          'camaraId', p.camara_id
        )
        FROM profiles p
        JOIN auth.users au ON au.id = p.id
        WHERE p.role = 'tv'
          AND p.camara_id = 'a5df7317-35d5-47e0-955f-668862ed00ac'
        LIMIT 1
      ),
      'tvCamaraSecundaria', (
        SELECT json_build_object(
          'id', p.id,
          'email', au.email,
          'nome', p.nome,
          'role', p.role,
          'camaraId', p.camara_id
        )
        FROM profiles p
        JOIN auth.users au ON au.id = p.id
        WHERE p.role = 'tv'
          AND p.camara_id = 'c01e9faf-a8d7-4943-b058-fc8cc545415d'
        LIMIT 1
      ),
      'vereadoresCamaraPrincipal', (
        SELECT json_agg(row_to_json(t))
        FROM (
          SELECT
            p.id,
            au.email,
            p.nome,
            p.role,
            p.camara_id as "camaraId",
            v.id as "vereadorId",
            v.nome_parlamentar as "nomeParlamentar",
            v.is_presidente as "isPresidente",
            v.is_vice_presidente as "isVicePresidente",
            v.is_active as "isActive",
            v.partido_id as "partidoId"
          FROM profiles p
          JOIN auth.users au ON au.id = p.id
          JOIN vereadores v ON v.profile_id = p.id
          WHERE p.role = 'vereador'
            AND p.camara_id = 'a5df7317-35d5-47e0-955f-668862ed00ac'
            AND v.is_active = true
          LIMIT 10
        ) t
      ),
      'vereadoresCamaraSecundaria', (
        SELECT json_agg(row_to_json(t))
        FROM (
          SELECT
            p.id,
            au.email,
            p.nome,
            p.role,
            p.camara_id as "camaraId",
            v.id as "vereadorId",
            v.nome_parlamentar as "nomeParlamentar"
          FROM profiles p
          JOIN auth.users au ON au.id = p.id
          JOIN vereadores v ON v.profile_id = p.id
          WHERE p.role = 'vereador'
            AND p.camara_id = 'c01e9faf-a8d7-4943-b058-fc8cc545415d'
            AND v.is_active = true
          LIMIT 5
        ) t
      )
    ),
    'sessoes', json_build_object(
      'camaraPrincipal', (
        SELECT json_agg(row_to_json(t))
        FROM (
          SELECT
            s.id,
            s.camara_id as "camaraId",
            s.nome,
            s.tipo,
            s.status,
            s.data_sessao as "dataSessao",
            s.created_at as "createdAt"
          FROM sessoes s
          WHERE s.camara_id = 'a5df7317-35d5-47e0-955f-668862ed00ac'
          ORDER BY s.data_sessao DESC
          LIMIT 5
        ) t
      ),
      'camaraSecundaria', (
        SELECT json_agg(row_to_json(t))
        FROM (
          SELECT
            s.id,
            s.camara_id as "camaraId",
            s.nome,
            s.tipo,
            s.status,
            s.data_sessao as "dataSessao"
          FROM sessoes s
          WHERE s.camara_id = 'c01e9faf-a8d7-4943-b058-fc8cc545415d'
          ORDER BY s.data_sessao DESC
          LIMIT 5
        ) t
      )
    ),
    'pautas', json_build_object(
      'camaraPrincipal', (
        SELECT json_agg(row_to_json(t))
        FROM (
          SELECT
            p.id,
            p.sessao_id as "sessaoId",
            p.nome,
            p.descricao,
            p.status,
            p.votacao_simbolica as "votacaoSimbolica",
            p.resultado_votacao as "resultadoVotacao",
            p.autor,
            p.created_at as "createdAt"
          FROM pautas p
          JOIN sessoes s ON s.id = p.sessao_id
          WHERE s.camara_id = 'a5df7317-35d5-47e0-955f-668862ed00ac'
          ORDER BY p.created_at DESC
          LIMIT 10
        ) t
      ),
      'camaraSecundaria', (
        SELECT json_agg(row_to_json(t))
        FROM (
          SELECT
            p.id,
            p.sessao_id as "sessaoId",
            p.nome,
            p.status,
            p.resultado_votacao as "resultadoVotacao"
          FROM pautas p
          JOIN sessoes s ON s.id = p.sessao_id
          WHERE s.camara_id = 'c01e9faf-a8d7-4943-b058-fc8cc545415d'
          ORDER BY p.created_at DESC
          LIMIT 10
        ) t
      )
    ),
    'votos', json_build_object(
      'camaraPrincipal', (
        SELECT json_agg(row_to_json(t))
        FROM (
          SELECT
            vt.id,
            vt.pauta_id as "pautaId",
            vt.vereador_id as "vereadorId",
            vt.voto,
            vt.created_at as "createdAt"
          FROM votos vt
          JOIN pautas p ON p.id = vt.pauta_id
          JOIN sessoes s ON s.id = p.sessao_id
          WHERE s.camara_id = 'a5df7317-35d5-47e0-955f-668862ed00ac'
          ORDER BY vt.created_at DESC
          LIMIT 20
        ) t
      ),
      'camaraSecundaria', (
        SELECT json_agg(row_to_json(t))
        FROM (
          SELECT
            vt.id,
            vt.pauta_id as "pautaId",
            vt.vereador_id as "vereadorId",
            vt.voto
          FROM votos vt
          JOIN pautas p ON p.id = vt.pauta_id
          JOIN sessoes s ON s.id = p.sessao_id
          WHERE s.camara_id = 'c01e9faf-a8d7-4943-b058-fc8cc545415d'
          ORDER BY vt.created_at DESC
          LIMIT 20
        ) t
      )
    ),
    'partidos', (
      SELECT json_agg(row_to_json(t))
      FROM (
        SELECT
          par.id,
          par.nome,
          par.sigla,
          par.logo_url as "logoUrl"
        FROM partidos par
        ORDER BY par.sigla
      ) t
    ),
    'oradores', json_build_object(
      'camaraPrincipal', (
        SELECT json_agg(row_to_json(t))
        FROM (
          SELECT
            o.id,
            o.sessao_id as "sessaoId",
            o.vereador_id as "vereadorId",
            o.ordem,
            o.tempo_fala_minutos as "tempoFalaMinutos"
          FROM oradores o
          JOIN sessoes s ON s.id = o.sessao_id
          WHERE s.camara_id = 'a5df7317-35d5-47e0-955f-668862ed00ac'
          ORDER BY o.ordem
          LIMIT 20
        ) t
      )
    ),
    'tvDisplays', json_build_object(
      'camaraPrincipal', (
        SELECT json_agg(row_to_json(t))
        FROM (
          SELECT
            tv.id,
            tv.profile_id as "profileId",
            tv.camara_id as "camaraId",
            tv.last_seen_at as "lastSeenAt"
          FROM tv_displays tv
          WHERE tv.camara_id = 'a5df7317-35d5-47e0-955f-668862ed00ac'
        ) t
      ),
      'camaraSecundaria', (
        SELECT json_agg(row_to_json(t))
        FROM (
          SELECT
            tv.id,
            tv.camara_id as "camaraId"
          FROM tv_displays tv
          WHERE tv.camara_id = 'c01e9faf-a8d7-4943-b058-fc8cc545415d'
        ) t
      )
    ),
    'livestreams', json_build_object(
      'camaraPrincipal', (
        SELECT row_to_json(t)
        FROM (
          SELECT
            l.id,
            l.camara_id as "camaraId",
            l.youtube_video_id as "youtubeVideoId",
            l.youtube_video_url as "youtubeVideoUrl",
            l.status,
            l.title,
            l.viewer_count as "viewerCount",
            l.is_current as "isCurrent"
          FROM livestreams l
          WHERE l.camara_id = 'a5df7317-35d5-47e0-955f-668862ed00ac'
          ORDER BY l.created_at DESC
          LIMIT 1
        ) t
      )
    )
  ) as dados_completos;
