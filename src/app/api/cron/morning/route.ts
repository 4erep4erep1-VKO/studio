import { NextResponse } from 'next/server';
import { supabaseAdmin, sendTelegram, escapeHtml } from '../lib';

// Функция получения погоды для Риддера (с принудительной метрикой)
async function getRidderWeather(): Promise<string> {
  try {
    // Добавлен флаг ?m для метрической системы (Цельсии, км/ч)
    const res = await fetch('https://wttr.in/Ridder?format=%20Сегодня%20в%20Риддере:%20%25C+%25t,+ветер%20%25w,+осадки%20%25p&lang=ru&m', {
      next: { revalidate: 0 },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return '';
    const text = await res.text();
    return text.trim();
  } catch (err) {
    console.error('Ошибка получения погоды:', err);
    return '';
  }
}

// Переводчики для статусов и отделов
const statusMap: Record<string, string> = {
  'new': '🆕 Новые',
  'in_progress': '⏳ В работе',
  'awaiting_photos': '📸 Ожидание фото',
  'completed': '✅ Готово'
};

const deptMap: Record<string, string> = {
  'print': '🖨 Печать',
  'production': '🏭 Изготовление',
  'installation': '🛠 Монтаж'
};

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const { data: orders, error } = await supabaseAdmin
      .from('orders')
      .select('id, title, department, status, assigned_to, deadline')
      .neq('status', 'completed')
      .order('deadline', { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const assignedIds = Array.from(new Set((orders || []).map((order: any) => order.assigned_to).filter(Boolean)));
    const assignedNames: Record<string, string> = {};
    if (assignedIds.length > 0) {
      const { data: profiles } = await supabaseAdmin.from('profiles').select('id, name, full_name').in('id', assignedIds);
      (profiles || []).forEach((p: any) => {
        assignedNames[p.id] = p.full_name || p.name || 'Сотрудник';
      });
    }

    const weather = await getRidderWeather();
    const weatherLine = weather ? `🌤 <b>Погода:</b> ${escapeHtml(weather)}\n\n` : '';

    // Логика формирования текста с использованием карт переводов
    const ordersList = (orders || []).map((order: any) => {
      const statusRu = statusMap[order.status] || order.status || 'В работе';
      const deptRu = deptMap[order.department] || order.department || 'Не указан';
      const worker = assignedNames[order.assigned_to] || 'Не назначен';
      const deadlineText = order.deadline ? escapeHtml(String(order.deadline)) : 'Без срока';
      return `• <b>${escapeHtml(order.title)}</b>\n${escapeHtml(deptRu)} | ${escapeHtml(statusRu)}\nИсполнитель: ${escapeHtml(worker)}\nДедлайн: ${deadlineText}`;
    }).join('\n\n');

    const text = (orders || []).length
      ? `<b>☀️ Утренняя сводка Montazhka PRO</b>\n\n${weatherLine}${ordersList}`
      : `<b>☀️ Утренняя сводка Montazhka PRO</b>\n\n${weatherLine}Активных заказов на сегодня нет.`;

    await sendTelegram(text);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}