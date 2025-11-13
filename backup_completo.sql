
-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.auth_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  last_used_at timestamp with time zone,
  expires_at timestamp with time zone,
  device_type text,
  refresh_token_hash text NOT NULL,
  revoked boolean NOT NULL DEFAULT false,
  ip text,
  user_agent text,
  CONSTRAINT auth_sessions_pkey PRIMARY KEY (id)
);
CREATE TABLE public.camaras (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nome_camara text NOT NULL,
  municipio text NOT NULL,
  estado character NOT NULL,
  brasao_url text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  link_facebook text,
  link_instagram text,
  link_youtube text,
  site_oficial text,
  telefone text,
  email_contato text,
  endereco text,
  youtube_stream_key text,
  youtube_rtmp_url text,
  youtube_channel_id text,
  youtube_channel_url text,
  current_livestream_id uuid,
  last_livestream_id uuid,
  CONSTRAINT camaras_pkey PRIMARY KEY (id),
  CONSTRAINT camaras_current_livestream_id_fkey FOREIGN KEY (current_livestream_id) REFERENCES public.livestreams(id),
  CONSTRAINT camaras_last_livestream_id_fkey FOREIGN KEY (last_livestream_id) REFERENCES public.livestreams(id)
);
CREATE TABLE public.livestreams (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  camara_id uuid NOT NULL,
  youtube_video_id text UNIQUE,
  youtube_video_url text,
  status text NOT NULL CHECK (status = ANY (ARRAY['live'::text, 'upcoming'::text, 'ended'::text, 'scheduled'::text])),
  title text,
  description text,
  thumbnail_url text,
  scheduled_start_time timestamp with time zone,
  actual_start_time timestamp with time zone,
  actual_end_time timestamp with time zone,
  viewer_count integer DEFAULT 0,
  is_current boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT livestreams_pkey PRIMARY KEY (id),
  CONSTRAINT livestreams_camara_id_fkey FOREIGN KEY (camara_id) REFERENCES public.camaras(id)
);
CREATE TABLE public.oradores (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  sessao_id uuid NOT NULL,
  vereador_id uuid NOT NULL,
  ordem integer NOT NULL,
  tempo_fala_minutos integer,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT oradores_pkey PRIMARY KEY (id),
  CONSTRAINT oradores_sessao_id_fkey FOREIGN KEY (sessao_id) REFERENCES public.sessoes(id),
  CONSTRAINT oradores_vereador_id_fkey FOREIGN KEY (vereador_id) REFERENCES public.vereadores(id)
);
CREATE TABLE public.partidos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  sigla character varying NOT NULL,
  logo_url text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT partidos_pkey PRIMARY KEY (id)
);
CREATE TABLE public.pautas (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  sessao_id uuid NOT NULL,
  nome text NOT NULL,
  descricao text,
  anexo_url text,
  status USER-DEFINED NOT NULL DEFAULT 'Pendente'::pauta_status,
  votacao_simbolica boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  autor text,
  created_by uuid,
  resultado_votacao USER-DEFINED NOT NULL DEFAULT 'Não Votada'::resultado_votacao,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT pautas_pkey PRIMARY KEY (id),
  CONSTRAINT pautas_sessao_id_fkey FOREIGN KEY (sessao_id) REFERENCES public.sessoes(id),
  CONSTRAINT pautas_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.profiles (
  id uuid NOT NULL,
  nome text NOT NULL,
  role USER-DEFINED NOT NULL DEFAULT 'admin_camara'::user_role,
  camara_id uuid,
  min_token_iat integer DEFAULT 0,
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id),
  CONSTRAINT profiles_camara_id_fkey FOREIGN KEY (camara_id) REFERENCES public.camaras(id)
);
CREATE TABLE public.sessoes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  camara_id uuid NOT NULL,
  nome text NOT NULL,
  tipo USER-DEFINED NOT NULL,
  status USER-DEFINED NOT NULL DEFAULT 'Agendada'::sessao_status,
  data_sessao timestamp with time zone NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT sessoes_pkey PRIMARY KEY (id),
  CONSTRAINT sessoes_camara_id_fkey FOREIGN KEY (camara_id) REFERENCES public.camaras(id)
);
CREATE TABLE public.tv_displays (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  profile_id uuid,
  camara_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  last_seen_at timestamp with time zone,
  CONSTRAINT tv_displays_pkey PRIMARY KEY (id),
  CONSTRAINT tv_displays_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id),
  CONSTRAINT tv_displays_camara_id_fkey FOREIGN KEY (camara_id) REFERENCES public.camaras(id)
);
CREATE TABLE public.vereadores (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL UNIQUE,
  camara_id uuid NOT NULL,
  partido_id uuid,
  nome_parlamentar text NOT NULL,
  foto_url text,
  is_presidente boolean DEFAULT false,
  is_vice_presidente boolean DEFAULT false,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT vereadores_pkey PRIMARY KEY (id),
  CONSTRAINT vereadores_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id),
  CONSTRAINT vereadores_camara_id_fkey FOREIGN KEY (camara_id) REFERENCES public.camaras(id),
  CONSTRAINT vereadores_partido_id_fkey FOREIGN KEY (partido_id) REFERENCES public.partidos(id)
);
CREATE TABLE public.votos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  pauta_id uuid NOT NULL,
  vereador_id uuid NOT NULL,
  voto USER-DEFINED NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  partido_id_no_voto uuid,
  era_presidente_no_voto boolean DEFAULT false,
  era_vice_presidente_no_voto boolean DEFAULT false,
  CONSTRAINT votos_pkey PRIMARY KEY (id),
  CONSTRAINT votos_pauta_id_fkey FOREIGN KEY (pauta_id) REFERENCES public.pautas(id),
  CONSTRAINT votos_vereador_id_fkey FOREIGN KEY (vereador_id) REFERENCES public.vereadores(id),
  CONSTRAINT votos_partido_id_no_voto_fkey FOREIGN KEY (partido_id_no_voto) REFERENCES public.partidos(id)
);


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."pauta_status" AS ENUM (
    'Pendente',
    'Em Votação',
    'Finalizada',
    'Arquivada'
);


ALTER TYPE "public"."pauta_status" OWNER TO "postgres";


CREATE TYPE "public"."sessao_status" AS ENUM (
    'Agendada',
    'Em Andamento',
    'Finalizada'
);


ALTER TYPE "public"."sessao_status" OWNER TO "postgres";


CREATE TYPE "public"."sessao_tipo" AS ENUM (
    'Ordinária',
    'Extraordinária',
    'Solene'
);


ALTER TYPE "public"."sessao_tipo" OWNER TO "postgres";


CREATE TYPE "public"."user_role" AS ENUM (
    'super_admin',
    'admin_camara',
    'vereador'
);


ALTER TYPE "public"."user_role" OWNER TO "postgres";


CREATE TYPE "public"."voto_tipo" AS ENUM (
    'SIM',
    'NÃO',
    'ABSTENÇÃO'
);


ALTER TYPE "public"."voto_tipo" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."email_exists"("email_to_check" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Retorna TRUE se encontrar algum registro na tabela auth.users com o email_to_check
  -- Retorna FALSE caso contrário
  RETURN EXISTS (SELECT 1 FROM auth.users WHERE email = email_to_check);
END;
$$;


ALTER FUNCTION "public"."email_exists"("email_to_check" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_camara_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE
    AS $$
  SELECT camara_id
  FROM public.profiles
  WHERE id = auth.uid();
$$;


ALTER FUNCTION "public"."get_my_camara_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_claims"() RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    jsonb_build_object(
      'role', COALESCE(role::text, 'anon'),
      'camara_id', camara_id
    )
  FROM public.profiles
  WHERE id = auth.uid()
$$;


ALTER FUNCTION "public"."get_my_claims"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_role"() RETURNS "text"
    LANGUAGE "sql" STABLE
    AS $$
  SELECT role::text
  FROM public.profiles
  WHERE id = auth.uid();
$$;


ALTER FUNCTION "public"."get_my_role"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, role, camara_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1)),
    'admin_camara',
    NULL
  );
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log do erro, mas não falha a criação do usuário
    RAISE WARNING 'Erro ao criar perfil: %', SQLERRM;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."camaras" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nome_camara" "text" NOT NULL,
    "municipio" "text" NOT NULL,
    "estado" character(2) NOT NULL,
    "brasao_url" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "link_facebook" "text",
    "link_instagram" "text",
    "link_youtube" "text",
    "site_oficial" "text",
    "telefone" "text",
    "email_contato" "text",
    "endereco" "text"
);


ALTER TABLE "public"."camaras" OWNER TO "postgres";


COMMENT ON TABLE "public"."camaras" IS 'Armazena as informações de cada câmara municipal cadastrada na plataforma.';



COMMENT ON COLUMN "public"."camaras"."brasao_url" IS 'URL para o arquivo do brasão no Supabase Storage.';



CREATE TABLE IF NOT EXISTS "public"."oradores" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sessao_id" "uuid" NOT NULL,
    "vereador_id" "uuid" NOT NULL,
    "ordem" integer NOT NULL,
    "tempo_fala_minutos" integer,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."oradores" OWNER TO "postgres";


COMMENT ON TABLE "public"."oradores" IS 'Gerencia a lista e a ordem dos oradores inscritos em uma sessão.';



CREATE TABLE IF NOT EXISTS "public"."partidos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nome" "text" NOT NULL,
    "sigla" character varying(20) NOT NULL,
    "logo_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."partidos" OWNER TO "postgres";


COMMENT ON TABLE "public"."partidos" IS 'Partidos políticos cadastrados para cada câmara.';



COMMENT ON COLUMN "public"."partidos"."logo_url" IS 'URL para o logo do partido no Supabase Storage.';



CREATE TABLE IF NOT EXISTS "public"."pautas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sessao_id" "uuid" NOT NULL,
    "autor_id" "uuid",
    "nome" "text" NOT NULL,
    "descricao" "text",
    "anexo_url" "text",
    "status" "public"."pauta_status" DEFAULT 'Pendente'::"public"."pauta_status" NOT NULL,
    "votacao_simbolica" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."pautas" OWNER TO "postgres";


COMMENT ON TABLE "public"."pautas" IS 'Armazena as pautas, projetos de lei e outros itens de votação.';



COMMENT ON COLUMN "public"."pautas"."anexo_url" IS 'URL para o documento PDF da pauta no Supabase Storage.';



COMMENT ON COLUMN "public"."pautas"."votacao_simbolica" IS 'Indica se a votação é nominal (false) ou simbólica (true).';



CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "nome" "text" NOT NULL,
    "role" "public"."user_role" DEFAULT 'admin_camara'::"public"."user_role" NOT NULL,
    "camara_id" "uuid",
    CONSTRAINT "check_camara_id_for_roles" CHECK (((("role" = 'super_admin'::"public"."user_role") AND ("camara_id" IS NULL)) OR (("role" = ANY (ARRAY['admin_camara'::"public"."user_role", 'vereador'::"public"."user_role"])) AND ("camara_id" IS NOT NULL))))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


COMMENT ON TABLE "public"."profiles" IS 'Tabela de perfis que estende auth.users com dados da aplicação.';



COMMENT ON COLUMN "public"."profiles"."camara_id" IS 'Vincula o usuário a uma câmara específica. Nulo apenas para super_admin.';



CREATE TABLE IF NOT EXISTS "public"."sessoes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "camara_id" "uuid" NOT NULL,
    "nome" "text" NOT NULL,
    "tipo" "public"."sessao_tipo" NOT NULL,
    "status" "public"."sessao_status" DEFAULT 'Agendada'::"public"."sessao_status" NOT NULL,
    "data_sessao" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."sessoes" OWNER TO "postgres";


COMMENT ON TABLE "public"."sessoes" IS 'Registra as sessões legislativas (ordinárias, extraordinárias, etc.).';



CREATE TABLE IF NOT EXISTS "public"."vereadores" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "camara_id" "uuid" NOT NULL,
    "partido_id" "uuid",
    "nome_parlamentar" "text" NOT NULL,
    "foto_url" "text",
    "is_presidente" boolean DEFAULT false,
    "is_vice_presidente" boolean DEFAULT false,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."vereadores" OWNER TO "postgres";


COMMENT ON TABLE "public"."vereadores" IS 'Dados dos parlamentares de cada câmara.';



COMMENT ON COLUMN "public"."vereadores"."profile_id" IS 'Link para o usuário de login do vereador.';



CREATE TABLE IF NOT EXISTS "public"."votos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pauta_id" "uuid" NOT NULL,
    "vereador_id" "uuid" NOT NULL,
    "voto" "public"."voto_tipo" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."votos" OWNER TO "postgres";


COMMENT ON TABLE "public"."votos" IS 'Registro individual de cada voto por pauta e vereador.';



ALTER TABLE ONLY "public"."camaras"
    ADD CONSTRAINT "camaras_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."oradores"
    ADD CONSTRAINT "oradores_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."oradores"
    ADD CONSTRAINT "oradores_sessao_id_ordem_key" UNIQUE ("sessao_id", "ordem");



ALTER TABLE ONLY "public"."oradores"
    ADD CONSTRAINT "oradores_sessao_id_vereador_id_key" UNIQUE ("sessao_id", "vereador_id");



ALTER TABLE ONLY "public"."partidos"
    ADD CONSTRAINT "partidos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pautas"
    ADD CONSTRAINT "pautas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sessoes"
    ADD CONSTRAINT "sessoes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vereadores"
    ADD CONSTRAINT "vereadores_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vereadores"
    ADD CONSTRAINT "vereadores_profile_id_key" UNIQUE ("profile_id");



ALTER TABLE ONLY "public"."votos"
    ADD CONSTRAINT "votos_pauta_id_vereador_id_key" UNIQUE ("pauta_id", "vereador_id");



ALTER TABLE ONLY "public"."votos"
    ADD CONSTRAINT "votos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."oradores"
    ADD CONSTRAINT "oradores_sessao_id_fkey" FOREIGN KEY ("sessao_id") REFERENCES "public"."sessoes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."oradores"
    ADD CONSTRAINT "oradores_vereador_id_fkey" FOREIGN KEY ("vereador_id") REFERENCES "public"."vereadores"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pautas"
    ADD CONSTRAINT "pautas_autor_id_fkey" FOREIGN KEY ("autor_id") REFERENCES "public"."vereadores"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."pautas"
    ADD CONSTRAINT "pautas_sessao_id_fkey" FOREIGN KEY ("sessao_id") REFERENCES "public"."sessoes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_camara_id_fkey" FOREIGN KEY ("camara_id") REFERENCES "public"."camaras"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sessoes"
    ADD CONSTRAINT "sessoes_camara_id_fkey" FOREIGN KEY ("camara_id") REFERENCES "public"."camaras"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vereadores"
    ADD CONSTRAINT "vereadores_camara_id_fkey" FOREIGN KEY ("camara_id") REFERENCES "public"."camaras"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vereadores"
    ADD CONSTRAINT "vereadores_partido_id_fkey" FOREIGN KEY ("partido_id") REFERENCES "public"."partidos"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."vereadores"
    ADD CONSTRAINT "vereadores_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."votos"
    ADD CONSTRAINT "votos_pauta_id_fkey" FOREIGN KEY ("pauta_id") REFERENCES "public"."pautas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."votos"
    ADD CONSTRAINT "votos_vereador_id_fkey" FOREIGN KEY ("vereador_id") REFERENCES "public"."vereadores"("id") ON DELETE CASCADE;



CREATE POLICY "Acesso total para super admins" ON "public"."pautas" USING (("public"."get_my_role"() = 'super_admin'::"text"));



CREATE POLICY "Acesso total para super admins" ON "public"."profiles" USING (("public"."get_my_role"() = 'super_admin'::"text"));



CREATE POLICY "Acesso total para super admins" ON "public"."sessoes" USING (("public"."get_my_role"() = 'super_admin'::"text"));



CREATE POLICY "Admins de câmara podem adicionar vereadores" ON "public"."vereadores" FOR INSERT WITH CHECK ((("camara_id" = "public"."get_my_camara_id"()) AND ("public"."get_my_role"() = 'admin_camara'::"text")));



CREATE POLICY "Admins de câmara podem editar vereadores" ON "public"."vereadores" FOR UPDATE USING ((("camara_id" = "public"."get_my_camara_id"()) AND ("public"."get_my_role"() = 'admin_camara'::"text")));



CREATE POLICY "Admins podem gerir oradores da sua câmara" ON "public"."oradores" USING (((("public"."get_my_claims"() ->> 'role'::"text") = 'super_admin'::"text") OR ((("public"."get_my_claims"() ->> 'role'::"text") = 'admin_camara'::"text") AND ((("public"."get_my_claims"() ->> 'camara_id'::"text"))::"uuid" = ( SELECT "sessoes"."camara_id"
   FROM "public"."sessoes"
  WHERE ("sessoes"."id" = "oradores"."sessao_id"))))));



CREATE POLICY "Admins podem gerir pautas da sua câmara" ON "public"."pautas" USING (((("public"."get_my_claims"() ->> 'role'::"text") = 'super_admin'::"text") OR ((("public"."get_my_claims"() ->> 'role'::"text") = 'admin_camara'::"text") AND ((("public"."get_my_claims"() ->> 'camara_id'::"text"))::"uuid" = ( SELECT "sessoes"."camara_id"
   FROM "public"."sessoes"
  WHERE ("sessoes"."id" = "pautas"."sessao_id"))))));



CREATE POLICY "Admins podem gerir sessões da sua câmara" ON "public"."sessoes" WITH CHECK (((("public"."get_my_claims"() ->> 'role'::"text") = 'super_admin'::"text") OR ((("public"."get_my_claims"() ->> 'role'::"text") = 'admin_camara'::"text") AND ((("public"."get_my_claims"() ->> 'camara_id'::"text"))::"uuid" = "camara_id"))));



CREATE POLICY "Admins podem gerir vereadores da sua câmara" ON "public"."vereadores" WITH CHECK (((("public"."get_my_claims"() ->> 'role'::"text") = 'super_admin'::"text") OR ((("public"."get_my_claims"() ->> 'role'::"text") = 'admin_camara'::"text") AND ((("public"."get_my_claims"() ->> 'camara_id'::"text"))::"uuid" = "camara_id"))));



CREATE POLICY "Admins podem gerir votos da sua câmara" ON "public"."votos" WITH CHECK (((("public"."get_my_claims"() ->> 'role'::"text") = 'super_admin'::"text") OR ((("public"."get_my_claims"() ->> 'role'::"text") = 'admin_camara'::"text") AND ((("public"."get_my_claims"() ->> 'camara_id'::"text"))::"uuid" = ( SELECT "s"."camara_id"
   FROM ("public"."pautas" "p"
     JOIN "public"."sessoes" "s" ON (("p"."sessao_id" = "s"."id")))
  WHERE ("p"."id" = "votos"."pauta_id"))))));



CREATE POLICY "Admins podem ver perfis da sua câmara" ON "public"."profiles" FOR SELECT USING (("camara_id" = "public"."get_my_camara_id"()));



CREATE POLICY "Câmaras são visíveis publicamente" ON "public"."camaras" FOR SELECT USING (true);



CREATE POLICY "Oradores são visíveis publicamente" ON "public"."oradores" FOR SELECT USING (true);



CREATE POLICY "Pautas são visíveis publicamente" ON "public"."pautas" FOR SELECT USING (true);



CREATE POLICY "Sessões são visíveis publicamente" ON "public"."sessoes" FOR SELECT USING (true);



CREATE POLICY "Super admins podem gerenciar partidos" ON "public"."partidos" USING (("public"."get_my_role"() = 'super_admin'::"text"));



CREATE POLICY "Super admins podem gerir câmaras" ON "public"."camaras" TO "authenticated" WITH CHECK ((("public"."get_my_claims"() ->> 'role'::"text") = 'super_admin'::"text"));



CREATE POLICY "Super admins têm acesso total aos perfis" ON "public"."profiles" USING (("public"."get_my_role"() = 'super_admin'::"text"));



CREATE POLICY "Super admins têm acesso total aos vereadores" ON "public"."vereadores" USING (("public"."get_my_role"() = 'super_admin'::"text"));



CREATE POLICY "Usuários autenticados podem ler partidos" ON "public"."partidos" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Usuários da câmara podem ver vereadores" ON "public"."vereadores" FOR SELECT USING (("camara_id" = "public"."get_my_camara_id"()));



CREATE POLICY "Usuários podem acessar seu próprio perfil" ON "public"."profiles" FOR SELECT USING (("id" = "auth"."uid"()));



CREATE POLICY "Usuários podem atualizar seu próprio perfil" ON "public"."profiles" FOR UPDATE USING (("id" = "auth"."uid"())) WITH CHECK (("id" = "auth"."uid"()));



CREATE POLICY "Usuários podem gerir pautas da sua câmara" ON "public"."pautas" USING (("sessao_id" IN ( SELECT "sessoes"."id"
   FROM "public"."sessoes"
  WHERE ("sessoes"."camara_id" = "public"."get_my_camara_id"()))));



CREATE POLICY "Usuários podem gerir sessões da sua câmara" ON "public"."sessoes" USING (("camara_id" = "public"."get_my_camara_id"())) WITH CHECK (("camara_id" = "public"."get_my_camara_id"()));



CREATE POLICY "Usuários podem ver/editar seu próprio perfil" ON "public"."profiles" USING (("id" = "auth"."uid"()));



CREATE POLICY "Vereadores são visíveis publicamente" ON "public"."vereadores" FOR SELECT USING (true);



CREATE POLICY "Votos são visíveis publicamente" ON "public"."votos" FOR SELECT USING (true);



ALTER TABLE "public"."camaras" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."oradores" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."partidos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pautas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sessoes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vereadores" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."votos" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."email_exists"("email_to_check" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."email_exists"("email_to_check" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."email_exists"("email_to_check" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_my_camara_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_camara_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_camara_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_my_claims"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_claims"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_claims"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_my_role"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_role"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_role"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";


















GRANT ALL ON TABLE "public"."camaras" TO "anon";
GRANT ALL ON TABLE "public"."camaras" TO "authenticated";
GRANT ALL ON TABLE "public"."camaras" TO "service_role";



GRANT ALL ON TABLE "public"."oradores" TO "anon";
GRANT ALL ON TABLE "public"."oradores" TO "authenticated";
GRANT ALL ON TABLE "public"."oradores" TO "service_role";



GRANT ALL ON TABLE "public"."partidos" TO "anon";
GRANT ALL ON TABLE "public"."partidos" TO "authenticated";
GRANT ALL ON TABLE "public"."partidos" TO "service_role";



GRANT ALL ON TABLE "public"."pautas" TO "anon";
GRANT ALL ON TABLE "public"."pautas" TO "authenticated";
GRANT ALL ON TABLE "public"."pautas" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."sessoes" TO "anon";
GRANT ALL ON TABLE "public"."sessoes" TO "authenticated";
GRANT ALL ON TABLE "public"."sessoes" TO "service_role";



GRANT ALL ON TABLE "public"."vereadores" TO "anon";
GRANT ALL ON TABLE "public"."vereadores" TO "authenticated";
GRANT ALL ON TABLE "public"."vereadores" TO "service_role";



GRANT ALL ON TABLE "public"."votos" TO "anon";
GRANT ALL ON TABLE "public"."votos" TO "authenticated";
GRANT ALL ON TABLE "public"."votos" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";






























RESET ALL;
