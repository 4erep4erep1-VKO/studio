import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { userId, newPin } = await request.json();

    if (!userId || !newPin) {
      return NextResponse.json({ error: 'ID или ПИН не переданы' }, { status: 400 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // 1. Меняем пароль для ВХОДА
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { password: newPin }
    );
    if (authError) throw authError;

    // 2. Меняем ПИН в таблице профилей
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ pin_code: newPin })
      .eq('id', userId);
    if (profileError) throw profileError;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}