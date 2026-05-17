import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const GROUP_CHAT_ID = process.env.TELEGRAM_GROUP_CHAT_ID;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PHOTO_BUCKET = process.env.SUPABASE_ORDER_PHOTO_BUCKET || 'order-photos';

const supabase = createClient(SUPABASE_URL || '', SUPABASE_SERVICE_ROLE_KEY || '', {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function sendTelegram(chatId: string | number, text: string, extra: Record<string, any> = {}) {
  if (!TELEGRAM_TOKEN) {
    console.error('Telegram token missing');
    return null;
  }

  const payload = {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    ...extra,
  };

  const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  return response.ok ? await response.json() : null;
}

async function answerCallbackQuery(callbackQueryId: string, text?: string) {
  if (!TELEGRAM_TOKEN) return null;
  return fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: callbackQueryId, text, show_alert: false }),
  });
}

function escapeHtml(text: string) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function normalizeDepartment(text: string) {
  const normalized = text.trim().toLowerCase();
  if (['print', 'печать', 'пк', 'печатник'].includes(normalized)) return 'print';
  if (['production', 'изготовление', 'цех', 'продакшн'].includes(normalized)) return 'production';
  if (['installation', 'монтаж', 'монтажник', 'установка'].includes(normalized)) return 'installation';
  return null;
}

function extractOrderDraft(replyText: string) {
  const titleMatch = /Название:\s*«([^»]+)»/.exec(replyText);
  const descriptionMatch = /Описание:\s*«([^»]+)»/.exec(replyText);
  const deadlineMatch = /Дедлайн:\s*([^\n]+)/.exec(replyText);

  return {
    title: titleMatch?.[1]?.trim() || null,
    description: descriptionMatch?.[1]?.trim() || null,
    deadline: deadlineMatch?.[1]?.trim() || null,
  };
}

function parseDeadline(text: string) {
  const raw = text.trim().replace(/\./g, '-').replace(/\s+/g, ' ');
  const parsed = new Date(raw);
  if (!isNaN(parsed.getTime())) return parsed.toISOString();
  return null;
}

async function findProfileByTelegramId(telegramId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, role, name, full_name')
    .eq('telegram_chat_id', telegramId)
    .single();

  if (error) {
    console.error('Supabase profile lookup error:', error.message);
    return null;
  }

  return data;
}

function buildMenuKeyboard(role: string | null) {
  const keyboard = [
    [{ text: '➕ Создать заказ' }, { text: '📋 Активные заказы' }],
    [{ text: '🔓 Свободные заказы' }, { text: '💼 Мои заказы' }],
    [{ text: '📊 Рейтинг' }, { text: '👤 Мой профиль' }],
  ];

  if (role === 'printer') {
    keyboard.splice(2, 0, [{ text: '🖨 Очередь на печать' }]);
  }

  return {
    keyboard,
    resize_keyboard: true,
    one_time_keyboard: false,
  };
}

function formatOrderSummary(order: any, assignedName: string | null) {
  const departmentLabel = order.department === 'installation'
    ? '🛠 Монтаж'
    : order.department === 'production'
      ? '🏭 Изготовление'
      : '🖨 Печать';
  const statusLabel = order.status === 'completed' ? '✅ Завершен' : order.status === 'awaiting_photos' ? '📷 Ждёт фото' : '⏳ В работе';
  const assignedLabel = assignedName ? escapeHtml(assignedName) : 'Общий';
  const deadline = order.deadline ? new Date(order.deadline).toLocaleDateString('ru-RU') : 'Не указан';

  return `
<b>№${escapeHtml(order.id)}</b>
${escapeHtml(order.title)}
${departmentLabel} (${statusLabel})
В работе: ${assignedLabel}
Дедлайн: ${escapeHtml(deadline)}
`.trim();
}

async function sendMainMenu(chatId: string | number, role: string | null) {
  await sendTelegram(chatId, 'Главное меню Montazhka PRO. Выберите действие.', {
    reply_markup: buildMenuKeyboard(role),
  });
}

async function handleOrderCreateReply(message: any, profile: any, chatId: number | string) {
  const prompt = message.reply_to_message?.text || '';
  const promptParts = extractOrderDraft(prompt);
  const text = message.text?.trim();

  if (!text) {
    await sendTelegram(chatId, 'Пожалуйста, отправьте текст в ответ на запрос.');
    return;
  }

  if (prompt.includes('Название заказа')) {
    const title = text;
    await sendTelegram(chatId, `📝 Отлично! Название сохранено.\nНазвание: «${escapeHtml(title)}»\n\nОтправьте <b>краткое описание заказа</b> в ответ на это сообщение.`, {
      reply_markup: { force_reply: true },
    });
    return;
  }

  if (prompt.includes('Описание заказа')) {
    const title = promptParts.title;
    if (!title) {
      await sendTelegram(chatId, 'Не удалось прочитать название заказа. Начните создание заново.');
      return;
    }

    const description = text;
    await sendTelegram(chatId, `📅 Отлично! Описание сохранено.
Название: «${escapeHtml(title)}»
Описание: «${escapeHtml(description)}»

Отправьте <b>дедлайн</b> в формате 2025-01-15 или 15.01.2025 в ответ на это сообщение.`, {
      reply_markup: { force_reply: true },
    });
    return;
  }

  if (prompt.includes('Дедлайн заказа')) {
    const { title, description } = promptParts;
    if (!title || !description) {
      await sendTelegram(chatId, 'Не удалось прочитать предыдущие данные. Начните создание заново.');
      return;
    }

    const deadline = parseDeadline(text);
    if (!deadline) {
      await sendTelegram(chatId, 'Неверный формат даты. Укажите дедлайн как 2025-01-15 или 15.01.2025.');
      return;
    }

    await sendTelegram(chatId, `🏢 Отлично! Дедлайн сохранен.
Название: «${escapeHtml(title)}»
Описание: «${escapeHtml(description)}»
Дедлайн: ${new Date(deadline).toLocaleDateString('ru-RU')}

Выберите отдел заказа, отправив одну из кнопок ниже.`, {
      reply_markup: {
        keyboard: [
          [{ text: 'Печать' }, { text: 'Изготовление' }, { text: 'Монтаж' }],
        ],
        resize_keyboard: true,
        one_time_keyboard: true,
      },
    });
    return;
  }

  if (prompt.includes('Выберите отдел заказа')) {
    const { title, description, deadline } = promptParts;
    if (!title || !description || !deadline) {
      await sendTelegram(chatId, 'Не удалось прочитать предыдущие данные. Начните создание заново.');
      return;
    }

    const department = normalizeDepartment(text);
    if (!department) {
      await sendTelegram(chatId, 'Неверный отдел. Выберите: Печать, Изготовление или Монтаж.');
      return;
    }

    const { data, error } = await supabase.from('orders').insert({
      title,
      description,
      deadline,
      department,
      status: 'new',
      assigned_to: null,
      image_urls: [],
    }).select().single();

    if (error) {
      console.error('Order creation error:', error.message);
      await sendTelegram(chatId, 'Не удалось создать заказ. Попробуйте позже.');
      return;
    }

    await sendTelegram(chatId, `✅ Заказ создан: №${escapeHtml(data.id)}
<b>${escapeHtml(data.title)}</b>
Отдел: ${escapeHtml(department)}
Дедлайн: ${new Date(deadline).toLocaleDateString('ru-RU')}`);
    await notifyGroup(`🆕 <b>Новый заказ</b>

<b>№${escapeHtml(data.id)}</b>: ${escapeHtml(data.title)}
Отдел: ${escapeHtml(department)}
Дедлайн: ${new Date(deadline).toLocaleDateString('ru-RU')}

Создан пользователем: ${escapeHtml(profile.name || profile.full_name || 'Неизвестный')}`);
    await sendMainMenu(chatId, profile.role);
    return;
  }

  await sendMainMenu(chatId, profile.role);
}

async function notifyGroup(text: string) {
  if (!GROUP_CHAT_ID) {
    console.error('Group chat ID missing');
    return null;
  }

  return sendTelegram(GROUP_CHAT_ID, text, { disable_web_page_preview: false });
}

async function getAssignedNames(orders: any[]) {
  const assignedTo = Array.from(new Set(orders.map(o => o.assigned_to).filter(Boolean)));
  if (!assignedTo.length) return {};

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, name, full_name')
    .in('id', assignedTo);

  return (profiles || []).reduce((acc: Record<string, string>, profile: any) => {
    acc[profile.id] = profile.name || profile.full_name || 'Сотрудник';
    return acc;
  }, {});
}

async function handleMyOrders(chatId: number | string, profile: any) {
  const { data: orders, error } = await supabase
    .from('orders')
    .select('*')
    .eq('assigned_to', profile.id)
    .neq('status', 'completed')
    .order('deadline', { ascending: true });

  if (error) {
    console.error('My orders query failed:', error.message);
    await sendTelegram(chatId, 'Ошибка при получении ваших заказов. Попробуйте позже.');
    return;
  }

  if (!orders?.length) {
    await sendTelegram(chatId, 'У вас пока нет заказов в работе.');
    return;
  }

  for (const order of orders) {
    const text = formatOrderSummary(order, profile.name || profile.full_name);
    let reply_markup;

    if (order.department === 'print') {
      reply_markup = {
        inline_keyboard: [[
          { text: '🏢 В ОФИС', callback_data: `print_to_office:${order.id}` },
          { text: '🔨 ИЗГОТОВЛЕНИЕ', callback_data: `print_to_production:${order.id}` },
          { text: '🚚 НА МОНТАЖ', callback_data: `print_to_installation:${order.id}` },
        ]],
      };
    } else if (['installation', 'production'].includes(order.department)) {
      reply_markup = {
        inline_keyboard: [[
          { text: '✅ ЗАВЕРШИТЬ ЗАКАЗ', callback_data: `finish_with_photo:${order.id}` },
          { text: '🚫 ЗАВЕРШИТЬ БЕЗ ФОТО', callback_data: `finish_without_photo:${order.id}` },
        ]],
      };
    }

    await sendTelegram(chatId, text, { reply_markup });
  }
}

async function handleActiveOrders(chatId: number | string) {
  const { data: orders, error } = await supabase
    .from('orders')
    .select('*')
    .neq('status', 'completed')
    .order('deadline', { ascending: true });

  if (error) {
    console.error('Active orders query failed:', error.message);
    await sendTelegram(chatId, 'Ошибка при получении активных заказов.');
    return;
  }

  if (!orders?.length) {
    await sendTelegram(chatId, 'Активных заказов нет.');
    return;
  }

  const assignedNames = await getAssignedNames(orders);
  const text = orders.map(order => [
    `<b>№${escapeHtml(order.id)}</b>: ${escapeHtml(order.title)}`,
    `${order.department === 'installation' ? '🛠 Монтаж' : order.department === 'production' ? '🏭 Изготовление' : '🖨 Печать'} (${escapeHtml(order.status)})`,
    `В работе: ${escapeHtml(assignedNames[order.assigned_to] || 'Общий')}`,
    `Дедлайн: ${order.deadline ? escapeHtml(new Date(order.deadline).toLocaleDateString('ru-RU')) : 'Не указан'}`,
  ].join('\n')).join('\n\n');

  await sendTelegram(chatId, `<b>📋 Активные заказы</b>

${text}`);
}

async function handleFreeOrders(chatId: number | string) {
  const { data: orders, error } = await supabase
    .from('orders')
    .select('*')
    .is('assigned_to', null)
    .neq('status', 'completed')
    .order('deadline', { ascending: true });

  if (error) {
    console.error('Free orders query failed:', error.message);
    await sendTelegram(chatId, 'Ошибка при получении свободных заказов.');
    return;
  }

  if (!orders?.length) {
    await sendTelegram(chatId, 'Свободных заказов пока нет.');
    return;
  }

  const text = orders.map(order => [
    `<b>№${escapeHtml(order.id)}</b>: ${escapeHtml(order.title)}`,
    `${order.department === 'installation' ? '🛠 Монтаж' : order.department === 'production' ? '🏭 Изготовление' : '🖨 Печать'}`,
    `Дедлайн: ${order.deadline ? escapeHtml(new Date(order.deadline).toLocaleDateString('ru-RU')) : 'Не указан'}`,
  ].join('\n')).join('\n\n');

  await sendTelegram(chatId, `<b>🔓 Свободные заказы</b>

${text}`);
}

async function handleRating(chatId: number | string) {
  const { data, error } = await supabase
    .from('orders')
    .select('assigned_to')
    .eq('status', 'completed');

  if (error) {
    console.error('Rating query failed:', error.message);
    await sendTelegram(chatId, 'Ошибка при подсчете рейтинга.');
    return;
  }

  const counts = (data || []).reduce((acc: Record<string, number>, order: any) => {
    if (!order.assigned_to) return acc;
    acc[order.assigned_to] = (acc[order.assigned_to] || 0) + 1;
    return acc;
  }, {});

  const sorted = Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10);

  if (!sorted.length) {
    await sendTelegram(chatId, 'Рейтинг пока пуст. Ни один заказ ещё не завершен.');
    return;
  }

  const ids = sorted.map(([id]) => id);
  const { data: profiles } = await supabase.from('profiles').select('id, name, full_name').in('id', ids);
  const byId = (profiles || []).reduce((acc: Record<string, string>, profile: any) => {
    acc[profile.id] = profile.name || profile.full_name || 'Сотрудник';
    return acc;
  }, {});

  const text = sorted.map(([id, count], index) => `${index + 1}. ${escapeHtml(byId[id] || 'Сотрудник')} — ${count}`).join('\n');
  await sendTelegram(chatId, `<b>📊 Рейтинг сотрудников</b>

${text}`);
}

async function handleProfile(chatId: number | string, profile: any) {
  const { data: activeOrders, error } = await supabase
    .from('orders')
    .select('id, deadline')
    .eq('assigned_to', profile.id)
    .neq('status', 'completed')
    .order('deadline', { ascending: true });

  if (error) {
    console.error('Profile query failed:', error.message);
    await sendTelegram(chatId, 'Ошибка при получении профиля.');
    return;
  }

  const { data: completedOrders, error: completedError } = await supabase
    .from('orders')
    .select('id')
    .eq('assigned_to', profile.id)
    .eq('status', 'completed');

  if (completedError) {
    console.error('Completed count error:', completedError.message);
    await sendTelegram(chatId, 'Ошибка при подсчете завершенных заказов.');
    return;
  }

  const nearestDeadlines = (activeOrders || [])
    .filter((order: any) => order.deadline)
    .map((order: any) => new Date(order.deadline))
    .filter(date => !isNaN(date.getTime()))
    .sort((a, b) => a.getTime() - b.getTime())
    .slice(0, 3)
    .map(date => date.toLocaleDateString('ru-RU'));

  const deadlineText = nearestDeadlines.length
    ? nearestDeadlines.join('\n')
    : 'Нет ближайших дедлайнов.';

  await sendTelegram(chatId, `<b>👤 Мой профиль</b>

В работе сейчас: ${activeOrders?.length || 0}
Всего изготовлено: ${completedOrders?.length || 0}

<b>Ближайшие дедлайны</b>:
${escapeHtml(deadlineText)}`);
}

async function handlePrintQueue(chatId: number | string) {
  const { data: orders, error } = await supabase
    .from('orders')
    .select('*')
    .eq('department', 'print')
    .is('assigned_to', null)
    .neq('status', 'completed')
    .order('deadline', { ascending: true });

  if (error) {
    console.error('Print queue query failed:', error.message);
    await sendTelegram(chatId, 'Ошибка при получении очереди на печать.');
    return;
  }

  if (!orders?.length) {
    await sendTelegram(chatId, 'Очередь на печать сейчас пуста.');
    return;
  }

  for (const order of orders) {
    const text = `
<b>№${escapeHtml(order.id)}</b>
${escapeHtml(order.title)}
Дедлайн: ${order.deadline ? escapeHtml(new Date(order.deadline).toLocaleDateString('ru-RU')) : 'Не указан'}
`.trim();
    await sendTelegram(chatId, text, {
      reply_markup: {
        inline_keyboard: [[{ text: 'Взять в работу', callback_data: `take_print:${order.id}` }]],
      },
    });
  }
}

async function handleCallbackQuery(callback: any) {
  const chatId = callback.from?.id || callback.message?.chat?.id;
  const profile = await findProfileByTelegramId(String(callback.from?.id || ''));
  const data = callback.data || '';

  if (!chatId || !profile) {
    await answerCallbackQuery(callback.id, 'Профиль не найден. Обратитесь к администратору.');
    return NextResponse.json({ ok: false, error: 'profile not found' }, { status: 404 });
  }

  const [action, orderId] = data.split(':');
  let answerText = 'Действие не распознано.';

  switch (action) {
    case 'take_print':
      answerText = await takePrintOrder(orderId, profile);
      break;
    case 'print_to_office':
      answerText = await movePrintOrder(orderId, profile, 'office');
      break;
    case 'print_to_production':
      answerText = await movePrintOrder(orderId, profile, 'production');
      break;
    case 'print_to_installation':
      answerText = await movePrintOrder(orderId, profile, 'installation');
      break;
    case 'finish_with_photo':
      answerText = await requestPhotoReport(orderId, profile);
      break;
    case 'finish_without_photo':
      answerText = await completeOrderWithoutPhoto(orderId, profile);
      break;
    default:
      break;
  }

  await answerCallbackQuery(callback.id, answerText);
  return NextResponse.json({ ok: true });
}

async function takePrintOrder(orderId: string, profile: any) {
  if (profile.role !== 'printer') {
    return 'Только печатник может брать заказы из этой очереди.';
  }

  const { data: order, error } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .single();

  if (error || !order) {
    console.error('Print order lookup failed:', error?.message);
    return 'Заказ не найден.';
  }

  if (order.assigned_to) {
    return 'Этот заказ уже в работе.';
  }

  if (order.department !== 'print') {
    return 'Этот заказ уже не в очереди на печать.';
  }

  const { error: updateError } = await supabase
    .from('orders')
    .update({ assigned_to: profile.id, status: 'in_progress' })
    .eq('id', orderId);

  if (updateError) {
    console.error('Assign print order failed:', updateError.message);
    return 'Не удалось взять заказ в работу. Попробуйте позже.';
  }

  await notifyGroup(`🖨 <b>Заказ №${escapeHtml(order.id)}</b> взят в работу печатником ${escapeHtml(profile.name || profile.full_name || 'Сотрудник')}.`);
  return 'Вы взяли заказ в работу. Он появился в «Мои заказы».' ;
}

async function movePrintOrder(orderId: string, profile: any, target: 'office' | 'production' | 'installation') {
  const { data: order, error } = await supabase.from('orders').select('*').eq('id', orderId).single();
  if (error || !order) {
    console.error('Move print order lookup failed:', error?.message);
    return 'Заказ не найден.';
  }

  if (order.assigned_to !== profile.id) {
    return 'Этот заказ не закреплен за вами.';
  }

  if (order.department !== 'print') {
    return 'Этот заказ уже не находится в отделе печати.';
  }

  if (target === 'office') {
    const { error: updateError } = await supabase
      .from('orders')
      .update({ status: 'completed' })
      .eq('id', orderId);

    if (updateError) {
      console.error('Complete print order failed:', updateError.message);
      return 'Не удалось завершить заказ. Попробуйте позже.';
    }

    await notifyGroup(`🏢 <b>Печать по заказу №${escapeHtml(order.id)}</b> готова, передан в офис.`);
    return 'Заказ завершен и отправлен в офис.';
  }

  const newDepartment = target === 'production' ? 'production' : 'installation';
  const text = target === 'production'
    ? `🔨 Заказ №${escapeHtml(order.id)} передан в цех на изготовление.`
    : `🚚 Заказ №${escapeHtml(order.id)} передан в монтаж.`;

  const { error: updateError } = await supabase
    .from('orders')
    .update({ department: newDepartment, assigned_to: null, status: 'new' })
    .eq('id', orderId);

  if (updateError) {
    console.error('Forward print order failed:', updateError.message);
    return 'Не удалось передать заказ. Попробуйте позже.';
  }

  await notifyGroup(text);
  return 'Заказ передан дальше и теперь доступен для следующего отдела.';
}

async function requestPhotoReport(orderId: string, profile: any) {
  const { data: order, error } = await supabase.from('orders').select('*').eq('id', orderId).single();
  if (error || !order) {
    console.error('Request photo report lookup failed:', error?.message);
    return 'Заказ не найден.';
  }

  if (order.assigned_to !== profile.id) {
    return 'Этот заказ не закреплен за вами.';
  }

  if (!['installation', 'production'].includes(order.department)) {
    return 'Фотографический отчет возможен только для монтажных или производственных заказов.';
  }

  const { error: updateError } = await supabase
    .from('orders')
    .update({ status: 'awaiting_photos' })
    .eq('id', orderId);

  if (updateError) {
    console.error('Request photo report failed:', updateError.message);
    return 'Не удалось войти в режим фотоотчета. Попробуйте позже.';
  }

  return 'Отправьте, пожалуйста, пакет фотографий в ответ на это сообщение. Когда загрузка завершится, заказ будет отмечен как завершенный.';
}

async function completeOrderWithoutPhoto(orderId: string, profile: any) {
  const { data: order, error } = await supabase.from('orders').select('*').eq('id', orderId).single();
  if (error || !order) {
    console.error('Complete without photo lookup failed:', error?.message);
    return 'Заказ не найден.';
  }

  if (order.assigned_to !== profile.id) {
    return 'Этот заказ не закреплен за вами.';
  }

  if (!['installation', 'production'].includes(order.department)) {
    return 'Эта команда доступна только для монтажников и сборщиков.';
  }

  const { error: updateError } = await supabase
    .from('orders')
    .update({ status: 'completed' })
    .eq('id', orderId);

  if (updateError) {
    console.error('Complete without photo update failed:', updateError.message);
    return 'Не удалось завершить заказ. Попробуйте позже.';
  }

  await notifyGroup(`✅ <b>Заказ №${escapeHtml(order.id)}</b> завершен без фотоотчета.`);
  return 'Заказ завершен без фото.';
}

async function handlePhotoMessage(message: any, profile: any, chatId: number | string) {
  const { data: order, error } = await supabase
    .from('orders')
    .select('*')
    .eq('assigned_to', profile.id)
    .eq('status', 'awaiting_photos')
    .order('updated_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !order) {
    await sendTelegram(chatId, 'Нет заказа, ожидающего фотоотчет. Нажмите «Мои заказы» и выберите правильный заказ.');
    return;
  }

  const photos = message.photo || [];
  if (!photos.length) {
    await sendTelegram(chatId, 'Отправьте фотографии, пожалуйста.');
    return;
  }

  const uploadedUrls: string[] = [];

  for (const photo of photos) {
    const fileId = photo.file_id;
    const filePathResponse = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/getFile?file_id=${fileId}`);
    const filePathData = await filePathResponse.json();
    const filePath = filePathData?.result?.file_path;
    if (!filePath) continue;

    const fileResponse = await fetch(`https://api.telegram.org/file/bot${TELEGRAM_TOKEN}/${filePath}`);
    const buffer = await fileResponse.arrayBuffer();
    const fileName = `order-${order.id}/${Date.now()}-${fileId}.jpg`;
    const { error: uploadError } = await supabase.storage
      .from(PHOTO_BUCKET)
      .upload(fileName, new Uint8Array(buffer), { contentType: 'image/jpeg', upsert: false });

    if (uploadError) {
      console.error('Photo upload failed:', uploadError.message);
      continue;
    }

    const { data: publicUrlData } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(fileName);
    if (publicUrlData?.publicUrl) {
      uploadedUrls.push(publicUrlData.publicUrl);
    }
  }

  const existingImages = Array.isArray(order.image_urls) ? order.image_urls : [];
  const finalUrls = [...existingImages, ...uploadedUrls];

  const { error: updateError } = await supabase
    .from('orders')
    .update({ image_urls: finalUrls, status: 'completed' })
    .eq('id', order.id);

  if (updateError) {
    console.error('Order completion update failed:', updateError.message);
    await sendTelegram(chatId, 'Не удалось сохранить фотоотчет. Повторите попытку.');
    return;
  }

  if (uploadedUrls.length) {
    await notifyGroup(`📷 <b>Фотоотчет по заказу №${escapeHtml(order.id)}</b>

${uploadedUrls.map(url => escapeHtml(url)).join('\n')}`);
  }

  await sendTelegram(chatId, 'Фотографии приняты, заказ завершен. Спасибо!');
}

export async function POST(request: Request) {
  if (!TELEGRAM_TOKEN || !GROUP_CHAT_ID || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ ok: false, error: 'Chatbot configuration missing' }, { status: 500 });
  }

  const update = await request.json().catch(() => null);
  if (!update) {
    return NextResponse.json({ ok: false, error: 'Invalid request body' }, { status: 400 });
  }

  if (update.callback_query) {
    return handleCallbackQuery(update.callback_query);
  }

  if (update.message) {
    const message = update.message;
    const chatId = message.chat?.id;
    const telegramId = String(message.from?.id || '');
    const profile = await findProfileByTelegramId(telegramId);

    if (!chatId) {
      return NextResponse.json({ ok: false, error: 'Chat ID missing' }, { status: 400 });
    }

    if (!profile) {
      await sendTelegram(chatId, 'Ваш профиль не найден в системе. Попросите администратора зарегистрировать ваш telegram_chat_id в Supabase.');
      return NextResponse.json({ ok: false, error: 'profile not found' }, { status: 404 });
    }

    const text = message.text?.trim();
    const replyTo = message.reply_to_message?.text || '';

    if (message.photo?.length && profile) {
      await handlePhotoMessage(message, profile, chatId);
      return NextResponse.json({ ok: true });
    }

    if (replyTo) {
      await handleOrderCreateReply(message, profile, chatId);
      return NextResponse.json({ ok: true });
    }

    switch (text) {
      case '/start':
      case 'Главное меню':
      case 'Меню':
        await sendMainMenu(chatId, profile.role);
        break;
      case '➕ Создать заказ':
        await sendTelegram(chatId, '📝 Начинаем создание заказа. В ответ на это сообщение отправьте название заказа.', {
          reply_markup: { force_reply: true },
        });
        break;
      case '📋 Активные заказы':
        await handleActiveOrders(chatId);
        break;
      case '🔓 Свободные заказы':
        await handleFreeOrders(chatId);
        break;
      case '💼 Мои заказы':
        await handleMyOrders(chatId, profile);
        break;
      case '📊 Рейтинг':
        await handleRating(chatId);
        break;
      case '👤 Мой профиль':
        await handleProfile(chatId, profile);
        break;
      case '🖨 Очередь на печать':
        if (profile.role === 'printer') {
          await handlePrintQueue(chatId);
        } else {
          await sendMainMenu(chatId, profile.role);
        }
        break;
      default:
        await sendMainMenu(chatId, profile.role);
    }

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true });
}
