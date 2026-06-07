import { NextResponse } from 'next/server';
import { supabaseAdmin, sendTelegram, formatOrderLine } from '../lib';

// Функция получения погоды для Риддера (с принудительной метрикой)
async function getRidderWeather(): Promise<string> {
  try {
    // Добавлен флаг ?m для метрической системы (Цельсии, км/ч)
    const res = await fetch('https://wttr.in/Ridder?format=%20Сегодня%20в%20Риддере:%20%25C+%25t,+ветер%20%25w,+осадки%20%25p&lang=ru&m', {
      next: { revalidate: 0 }
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
    const { data: profiles } = await supabaseAdmin.from('profiles').select('id, name, full_name').in('id', assignedIds);
    const assignedNames = (profiles || []).reduce((acc: any, p: any) => {
      acc[p.id] = p.full_name || p.name || 'Сотрудник';
      return acc;
    }, {});

    const weather = await getRidderWeather();
    const weatherLine = weather ? `🌤 <b>Погода:</b> ${weather}\n\n` : '';

    // Логика формирования текста с использованием карт переводов
    const ordersList = (orders || []).map((order: any) => {
      const statusRu = statusMap[order.status] || order.status;
      const deptRu = deptMap[order.department] || order.department;
      const worker = assignedNames[order.assigned_to] || 'Не назначен';
      return `• <b>${order.title}</b>\n${deptRu} | ${statusRu}\nИсполнитель: ${worker}\nДедлайн: ${order.deadline || 'Без срока'}`;
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