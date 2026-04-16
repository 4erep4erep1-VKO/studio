import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ehrfzwhawnqyocbthjmb.supabase.co';
const supabaseAnonKey = 'sb_publishable_moDelfX657G_mZF4l5BiFw_em5STZQP';

// 1. Обычный клиент с нашими настройками против зависаний сессии
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

// 2. Тот самый админский клиент, который нужен для работы с профилями
export const supabaseAdmin = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});