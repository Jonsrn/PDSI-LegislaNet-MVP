const { createClient } = require('@supabase/supabase-js');
// Cliente ADMIN, usa a chave de serviço. **NUNCA USE NO FRONTEND.**
const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
module.exports = supabaseAdmin;