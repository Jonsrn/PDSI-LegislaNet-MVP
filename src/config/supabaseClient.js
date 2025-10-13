const { createClient } = require('@supabase/supabase-js');
// Cliente público, seguro para operações básicas.
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
module.exports = supabase;