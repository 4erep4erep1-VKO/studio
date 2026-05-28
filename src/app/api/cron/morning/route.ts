import { NextResponse } from 'next/server';
import { supabaseAdmin, sendTelegram, formatOrderLine } from '../lib';

// Функция получения погоды для Риддера
async function getRidderWeather(): Promise<string> {
  try {
    // Запрашиваем погоду в формате: Состояние, Температура, Ветер, Осадки на русском языке
    const res = await fetch('https://wttr.in/Ridder?format=%20%20%D0%A1%D0%B5%D0%B3%D0%BE%D0%B4%D0%BD%D1%8F%20%D0%B2%20%D0%A0%D0%B8%D0%B4%D0%B4%D0%B5%D1%80%D0%B5:%20%25C+%25t,+%D0%B2%D0%B5%D1%82%D0%B5%D1%80%20%25w,+%D0%BE%D1%81%D0%B0%D0%B4%D0%BA%D0%B8%20%25p&lang=ru', {
      next: { revalidate: 0 } // Отключаем кэш, чтобы всегда была свежая погода
    });
    if (!res.ok) return '';
    const text = await res.text();
    return text.trim();
  } catch (err) {
    console.error('Ошибка получения погоды:', err);
    return '';
  }
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

    // Получаем погоду
    const weather = await getRidderWeather();
    const weatherLine = weather ? `🌤 <b>Погода:</b> ${weather}\n\n` : '';

    const text = (orders || []).length
      ? `<b>☀️ Утренняя сводка Montazhka PRO</b>\n\n${weatherLine}${(orders || []).map((order: any) => formatOrderLine(order, assignedNames)).join('\n\n')}`
      : `<b>☀️ Утренняя сводка Montazhka PRO</b>\n\n${weatherLine}Активных заказов на сегодня нет.`;

    await sendTelegram(text);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Morning cron failed:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}