import { NextResponse } from 'next/server';
import { supabaseAdmin, sendTelegram, formatOrderLine } from '../lib';

function getAlmatyTodayEnd() {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Almaty' }));
  now.setHours(23, 59, 59, 999);
  return now;
}

export async function GET(request: Request) {
  // Защита от левых вызовов
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const { data: orders, error } = await supabaseAdmin
      .from('orders')
      .select('id, title, department, status, assigned_to, deadline')
      .neq('status', 'completed');

    if (error) {
      console.error('Evening cron order fetch failed:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const todayEnd = getAlmatyTodayEnd();

    const overdueOrders = (orders || []).filter((order: any) => {
      if (!order.deadline) return false;
      const deadlineAt = new Date(order.deadline);
      return !isNaN(deadlineAt.getTime()) && deadlineAt <= todayEnd;
    });

    const assignedIds = Array.from(new Set(overdueOrders.map((order: any) => order.assigned_to).filter(Boolean)));
    const { data: profiles } = await supabaseAdmin.from('profiles').select('id, name, full_name').in('id', assignedIds);
    const assignedNames = (profiles || []).reduce((acc: Record<string, string>, profile: any) => {
      acc[profile.id] = profile.name || profile.full_name || 'Сотрудник';
      return acc;
    }, {});

    const text = overdueOrders.length
      ? `<b>🌙 Вечерняя сводка Montazhka PRO</b>\n\nЗаказы с дедлайном сегодня или просроченные:\n\n${overdueOrders.map((order: any) => formatOrderLine(order, assignedNames)).join('\n\n')}`
      : '🌙 Вечерняя сводка Montazhka PRO\n\nНет заказов с дедлайном сегодня или просроченных заказов.';

    await sendTelegram(text);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Evening cron failed:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}