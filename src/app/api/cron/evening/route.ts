import { NextResponse } from 'next/server';
import { supabaseAdmin, sendTelegram, formatOrderLine } from '../lib';
import { logAdminAlert } from '@/lib/admin-logger';

function getAlmatyDateString(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Almaty',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
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
      await logAdminAlert({
        level: 'ERROR',
        source: 'Вечерний Cron',
        message: 'Ошибка загрузки заказов из Supabase',
        details: error.message,
      });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const todayStr = getAlmatyDateString(new Date());

    const overdueOrders = (orders || []).filter((order: any) => {
      if (!order.deadline) return false;
      const rawDeadline = String(order.deadline).trim();
      let deadlineDateStr: string;
      if (/^\d{4}-\d{2}-\d{2}$/.test(rawDeadline)) {
        deadlineDateStr = rawDeadline;
      } else {
        const deadlineAt = new Date(rawDeadline);
        if (isNaN(deadlineAt.getTime())) return false;
        deadlineDateStr = getAlmatyDateString(deadlineAt);
      }
      return deadlineDateStr <= todayStr;
    });

    const assignedIds = Array.from(new Set(overdueOrders.map((order: any) => order.assigned_to).filter(Boolean)));
    const assignedNames: Record<string, string> = {};
    if (assignedIds.length > 0) {
      const { data: profiles } = await supabaseAdmin.from('profiles').select('id, name, full_name').in('id', assignedIds);
      (profiles || []).forEach((profile: any) => {
        assignedNames[profile.id] = profile.name || profile.full_name || 'Сотрудник';
      });
    }

    const text = overdueOrders.length
      ? `<b>🌙 Вечерняя сводка Montazhka PRO</b>\n\nЗаказы с дедлайном сегодня или просроченные:\n\n${overdueOrders.map((order: any) => formatOrderLine(order, assignedNames)).join('\n\n')}`
      : '🌙 Вечерняя сводка Montazhka PRO\n\nНет заказов с дедлайном сегодня или просроченных заказов.';

    await sendTelegram(text);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Evening cron failed:', err);
    await logAdminAlert({
      level: 'ERROR',
      source: 'Вечерний Cron',
      message: 'Сбой выполнения вечерней сводки',
      details: String(err?.message || err),
    });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}