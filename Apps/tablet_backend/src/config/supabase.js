const { createClient } = require('@supabase/supabase-js');

// Cliente para operações administrativas
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Cliente público (para autenticação)
const supabasePublic = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

module.exports = {
  supabaseAdmin,
  supabasePublic
};