require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.log('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
    console.log('Probando conexion a:', supabaseUrl);
    const { error } = await supabase.from('users').select('count', { count: 'exact', head: true });

    if (error) {
        console.error('Error de conexion API:', error.message);
    } else {
        console.log('Conexion API exitosa.');
    }
}

testConnection();
