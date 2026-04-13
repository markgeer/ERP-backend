// user/src/supabase.js
const { createClient } = require('@supabase/supabase-js');
const config = require('./config');

// Usamos la ANON KEY para el cliente
const supabase = createClient(config.supabaseUrl, config.supabaseAnonKey);

module.exports = supabase;