import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) throw new Error('ID пользователя не указан');

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: { autoRefreshToken: false, persistSession: false }
      }
    );

    // 1. Удаляем из Auth (это автоматически должно удалить и из profiles, если есть связь)
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(id);
    if (authError) throw authError;

    // 2. На всякий случай удаляем из таблицы profiles напрямую
    await supabaseAdmin.from('profiles').delete().eq('id', id);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}