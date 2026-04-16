import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { email, password, name } = await request.json();

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: { autoRefreshToken: false, persistSession: false }
      }
    );

    // 1. Создаем пользователя в Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true,
      user_metadata: { full_name: name }
    });

    if (authError) return NextResponse.json({ error: authError.message }, { status: 400 });

    if (authData.user) {
      // 2. Используем UPSERT вместо INSERT
      // Это принудительно запишет нужное ИМЯ, даже если строка уже создана базой
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .upsert({
          id: authData.user.id,
          name: name, // Вот тут теперь точно будет ИВАН
          email: email,
          role: 'installer',
          pin_code: password 
        }, { onConflict: 'id' });

      if (profileError) return NextResponse.json({ error: profileError.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}