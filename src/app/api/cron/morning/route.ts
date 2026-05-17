import { NextResponse } from 'next/server';
import { supabaseAdmin, sendTelegram, formatOrderLine } from '../lib';

export async function GET() {
  try {
    const { data: orders, error } = await supabaseAdmin
      .from('orders')
      .select('id, title, department, status, assigned_to, deadline')
      .neq('status', 'completed')
      .order('deadline', { ascending: true });

    if (error) {
      console.error('Morning cron order fetch failed:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const assignedIds = Array.from(new Set((orders || []).map((order: any) => order.assigned_to).filter(Boolean)));
    const { data: profiles } = await supabaseAdmin.from('profiles').select('id, name, full_name').in('id', assignedIds);
    const assignedNames = (profiles || []).reduce((acc: Record<string, string>, profile: any) => {
      acc[profile.id] = profile.name || profile.full_name || 'Сотрудник';
      return acc;
    }, {});

    const text = (orders || []).length
      ? `<b>☀️ Утренняя сводка Montazhka PRO</b>\n\n${(orders || []).map((order: any) => formatOrderLine(order, assignedNames)).join('\n\n')}`
      : '☀️ Утренняя сводка Montazhka PRO\n\nАктивных заказов на сегодня нет.';

    await sendTelegram(text);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Morning cron failed:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
