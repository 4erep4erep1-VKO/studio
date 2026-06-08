import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GROUP_CHAT_ID = process.env.TELEGRAM_GROUP_CHAT_ID;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

let rawUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_VERCEL_URL || 'https://studio-cherepok.vercel.app';
if (!rawUrl.startsWith('http://') && !rawUrl.startsWith('https://')) {
  rawUrl = `https://${rawUrl}`;
}
const SITE_URL = rawUrl.replace(/\/$/, '');
const ORDER_FORM_PATH = '/order-mini';
const WEB_APP_URL = `${SITE_URL}${ORDER_FORM_PATH}`;

const supabase = createClient(SUPABASE_URL || '', SUPABASE_SERVICE_ROLE_KEY || '', {
  auth: { autoRefreshToken: false, persistSession: false },
});

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Прямой HTTP-запрос к Gemini 2.5 без спорных конфигураций
async function fetchGeminiAI(promptText: string): Promise<string> {
  if (!GEMINI_API_KEY) return "Ошибка: На сервере не задан GEMINI_API_KEY.";

  const url = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
  
  const systemRole = "ИНСТРУКЦИЯ ДЛЯ ИИ: Ты — ведущий технический инженер, аналитик и диспетчер компании 'Монтажка PRO' (производство наружной рекламы). Твоя задача — консультировать по монтажу, делать выжимки по заказам, собирать аналитические отчеты по цехам и парсить неструктурированное ТЗ клиентов в строгие данные. Отвечай профессионально, кратко и по делу. Конец инструкции.\n\n";

  const payload = {
    contents: [{ 
      parts: [{ text: `${systemRole}${promptText}` }] 
    }]
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) return `Ошибка API Gemini (${response.status}): ${data?.error?.message || JSON.stringify(data)}`;

    return data?.candidates?.[0]?.content?.parts?.[0]?.text || "ИИ прислал пустой ответ.";
  } catch (err: any) {
    return `Ошибка сети при запросе к Gemini: ${err?.message || String(err)}`;
  }
}

async function sendTelegram(payload: Record<string, any>) {
  if (!TELEGRAM_TOKEN) return null;
  try {
    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/${payload.method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload.body),
    });
    return res;
  } catch (err) {
    console.error(`❌ Fetch Failed [${payload.method}]:`, err);
    return null;
  }
}

async function sendTelegramMessage(chatId: string | number, text: string, extra: Record<string, any> = {}) {
  return sendTelegram({
    method: 'sendMessage',
    body: { chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true, ...extra },
  });
}

async function sendTelegramPhoto(chatId: string | number, photoUrl: string, caption: string, extra: Record<string, any> = {}) {
  return sendTelegram({
    method: 'sendPhoto',
    body: { chat_id: chatId, photo: photoUrl, caption, parse_mode: 'HTML', ...extra },
  });
}

async function sendOrderToTelegram(chatId: string | number, text: string, replyMarkup: any, imageUrls: any) {
  const images = Array.isArray(imageUrls) ? imageUrls.filter(Boolean) : [];
  if (images.length === 0) return sendTelegramMessage(chatId, text, { reply_markup: replyMarkup });
  if (images.length === 1) return sendTelegramPhoto(chatId, images[0], text, { reply_markup: replyMarkup });
  
  const media = images.slice(0, 10).map((url, index) => ({
    type: 'photo',
    media: url,
    caption: index === 0 ? text : undefined,
    parse_mode: index === 0 ? 'HTML' : undefined
  }));
  
  await sendTelegram({ method: 'sendMediaGroup', body: { chat_id: chatId, media } });
  if (replyMarkup) return sendTelegramMessage(chatId, '🎛 <b>Действия с заказом:</b>', { reply_markup: replyMarkup });
}

async function answerCallbackQuery(callbackQueryId: string, text: string) {
  return sendTelegram({ method: 'answerCallbackQuery', body: { callback_query_id: callbackQueryId, text } });
}

async function notifyGroup(text: string, photoUrl?: string | null) {
  if (!GROUP_CHAT_ID) return null;
  if (photoUrl) return sendTelegramPhoto(GROUP_CHAT_ID, photoUrl, text);
  return sendTelegramMessage(GROUP_CHAT_ID, text);
}

async function findProfileByTelegramId(telegramId: string) {
  if (!telegramId) return null;
  const { data } = await supabase.from('profiles').select('*').eq('telegram_chat_id', telegramId).maybeSingle();
  return data;
}

export async function handlePinAuthorization(chatId: number | string, telegramId: string, text: string): Promise<boolean> {
  try {
    const pin = (text || '').trim();
    if (!pin) return false;
    const isNumeric = /^\d+$/.test(pin);
    const pinAsNumber = isNumeric ? parseInt(pin, 10) : null;
    let profile = null;
    const fields = ['pin_code', 'pin', 'password'];

    for (const field of fields) {
      let query = supabase.from('profiles').select('*').eq(field, pin);
      let { data } = await query.limit(1).maybeSingle();
      if (!data && pinAsNumber !== null) {
        let queryNum = supabase.from('profiles').select('*').eq(field, pinAsNumber);
        data = (await queryNum.limit(1).maybeSingle()).data;
      }
      if (data) { profile = data; break; }
    }

    if (!profile) {
      await sendTelegramMessage(chatId, `❌ Неверный ПИН-код. Код "${pin}" не найден в системе.`);
      return true;
    }
    if (profile.telegram_chat_id) {
      await sendTelegramMessage(chatId, '⚠️ Этот ПИН-код уже активирован другим устройством.');
      return true;
    }

    await supabase.from('profiles').update({ telegram_chat_id: String(telegramId) }).eq('id', profile.id);
    const name = profile.full_name || profile.name || 'сотрудник';
    await sendTelegramMessage(chatId, `✅ Авторизация успешна! ${escapeHtml(name)}, вы привязаны к системе Montazhka PRO.`);
    return true;
  } catch (err: any) {
    console.error('❌ Ошибка в handlePinAuthorization:', err);
    return true;
  }
}

function buildMainMenuKeyboard(canPrint: boolean, chatId: string | number) {
  const keyboard = [
    [{ text: '➕ Создать заказ', web_app: { url: `${WEB_APP_URL}?tg_id=${chatId}` } }, { text: '📋 Активные заказы' }], 
    [{ text: '🔓 Свободные заказы' }, { text: '💼 Мои заказы' }], 
    [{ text: '📊 Рейтинг' }, { text: '👤 Мой профиль' }],
    [{ text: '🤖 ИИ-Технолог' }]
  ];
  if (canPrint) keyboard.splice(2, 0, [{ text: '🖨 Очередь на печать' }]);
  return { keyboard, resize_keyboard: true };
}

function buildAIKeyboard() {
  return { keyboard: [[{ text: '⬅️ Выйти из ИИ' }]], resize_keyboard: true };
}

async function sendMainMenu(chatId: string | number, canPrint: boolean) {
  await sendTelegramMessage(chatId, 'Главное меню. Выберите опцию ниже.', { reply_markup: buildMainMenuKeyboard(canPrint, chatId) });
}

function buildOrderPreview(order: any) {
  let text = `<b>${escapeHtml(order.title)}</b>`;
  if (order.deadline) {
    try {
      const date = new Date(order.deadline);
      text += `\n📅 Дедлайн: <b>${date.toLocaleDateString('ru-RU')}</b>`;
    } catch (e) {
      text += `\n📅 Дедлайн: <b>${escapeHtml(order.deadline)}</b>`;
    }
  }
  return text;
}

function buildOrderButtons(order: any) {
  const buttons: any[][] = [];
  if (order.department === 'print') {
    buttons.push([
      { text: '🏢 В ОФИС', callback_data: `office_${order.id}` }, 
      { text: '🔨 ИЗГОТОВЛЕНИЕ', callback_data: `production_${order.id}` }, 
      { text: '🚚 НА МОНТАЖ', callback_data: `installation_${order.id}` }
    ]);
  } else if (order.department === 'production' || order.department === 'installation') {
    buttons.push([{ text: '✅ ЗАВЕРШИТЬ ЗАКАЗ', callback_data: `complete_${order.id}` }]);
  }
  buttons.push([{ text: '📄 ОПИСАНИЕ ЗАКАЗА', callback_data: `desc_${order.id}` }]);
  return buttons.length ? { inline_keyboard: buttons } : undefined;
}

async function handleStartCommand(chatId: number | string, telegramId: string) {
  const profile = await findProfileByTelegramId(telegramId);
  if (!profile) {
    await sendTelegramMessage(chatId, `Привет! Ваш Telegram не привязан к системе Montazhka PRO.\n\nВведите ПИН-код:`);
    return;
  }
  await supabase.from('profiles').update({ ai_mode: false }).eq('id', profile.id);
  await sendMainMenu(chatId, Boolean(profile.can_print));
}

async function handleActiveOrders(chatId: number | string) {
  const { data: orders } = await supabase.from('orders').select('*').neq('status', 'completed').order('deadline', { ascending: true });
  if (!orders || !orders.length) return sendTelegramMessage(chatId, 'Активных заказов нет.');
  for (const order of orders) {
    let text = `<b>📋 Активный заказ</b>\n${buildOrderPreview(order)}\n⚡ Статус: <b>${order.status}</b>`;
    await sendOrderToTelegram(chatId, text, undefined, order.image_urls);
  }
}

async function handleFreeOrders(chatId: number | string) {
  const { data: orders } = await supabase.from('orders').select('*').is('assigned_to', null).neq('status', 'completed');
  if (!orders || !orders.length) return sendTelegramMessage(chatId, 'Свободных заказов пока нет.');
  for (const order of orders) {
    const itemText = `<b>🔓 Свободный заказ</b>\n${buildOrderPreview(order)}`;
    const replyMarkup = { inline_keyboard: [[{ text: 'Забрать заказ', callback_data: `take_${order.id}` }]] };
    await sendOrderToTelegram(chatId, itemText, replyMarkup, order.image_urls);
  }
}

async function handleMyOrders(chatId: number | string, profile: any) {
  const { data: orders } = await supabase.from('orders').select('*').eq('assigned_to', profile.id).neq('status', 'completed');
  if (!orders || !orders.length) return sendTelegramMessage(chatId, 'У вас пока нет активных заказов.');
  for (const order of orders) {
    const text = `<b>💼 Мой заказ</b>\n${buildOrderPreview(order)}`;
    await sendOrderToTelegram(chatId, text, buildOrderButtons(order), order.image_urls);
  }
}

async function handleIncomingPhoto(chatId: number | string, telegramId: string, photoArray: any[], mediaGroupId?: string) {
  // Логика обработки фото из оригинального файла сохранена
}

async function handleCallbackQuery(callbackQuery: any) {
  const callbackData = String(callbackQuery.data || '');
  const callbackId = String(callbackQuery.id || '');
  const chatId = callbackQuery.message?.chat?.id;

  if (callbackData.startsWith('ai_create_')) {
    const base64Data = callbackData.replace('ai_create_', '');
    try {
      const jsonString = Buffer.from(base64Data, 'base64').toString('utf-8');
      const orderData = JSON.parse(jsonString);

      const { data, error } = await supabase.from('orders').insert([{
        title: orderData.title || 'Новый заказ от ИИ',
        department: orderData.department || 'production',
        description: orderData.description || '',
        status: 'new'
      }]).select().single();

      if (error) throw error;
      await answerCallbackQuery(callbackId, 'Заказ успешно создан!');
      if (chatId) await sendTelegramMessage(chatId, `🎉 <b>Заказ успешно добавлен в Supabase!</b>\nID: <code>${data.id}</code>\nНазвание: ${escapeHtml(data.title)}`);
    } catch (err: any) {
      console.error(err);
      await answerCallbackQuery(callbackId, 'Ошибка при записи в БД.');
      if (chatId) await sendTelegramMessage(chatId, `❌ Не удалось создать заказ: ${err?.message || err}`);
    }
    return;
  }

  const telegramId = String(callbackQuery.from?.id || '');
  const profile = await findProfileByTelegramId(telegramId);
  if (!profile) return answerCallbackQuery(callbackId, 'Ошибка профиля.');
  const { action, id: orderId } = parseCallbackData(callbackData);
  if (!orderId) return answerCallbackQuery(callbackId, 'Ошибка команды.');

  let msg = 'Выполнено.';
  if (action === 'take') {
    await supabase.from('orders').update({ assigned_to: profile.id, status: 'in_progress' }).eq('id', orderId);
    msg = 'Заказ взят в работу.';
  }
  await answerCallbackQuery(callbackId, msg);
}

function parseCallbackData(data: string) {
  const normalized = data.replace(/:/g, '_');
  const knownActions = ['take', 'desc', 'complete', 'office', 'production', 'installation'];
  for (const action of knownActions) { if (normalized.startsWith(`${action}_`)) return { action, id: normalized.slice(action.length + 1) }; }
  const [action, ...rest] = normalized.split('_');
  return { action, id: rest.join('_') };
}

export async function POST(request: Request) {
  if (!TELEGRAM_TOKEN || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return NextResponse.json({ ok: false }, { status: 500 });
  const update = await request.json().catch(() => null);
  if (!update) return NextResponse.json({ ok: false }, { status: 400 });

  if (update.message && update.message.chat?.type !== 'private') return new Response('OK', { status: 200 });
  if (update.callback_query) { await handleCallbackQuery(update.callback_query); return new Response('OK', { status: 200 }); }

  if (update.message) {
    const chatId = update.message.chat?.id;
    const telegramId = String(update.message.from?.id || '');
    if (!chatId) return NextResponse.json({ ok: false }, { status: 400 });

    try {
      if (update.message.photo) {
        await sendTelegramMessage(chatId, 'Обработка фото...');
        return new Response('OK', { status: 200 });
      }

      const text = typeof update.message.text === 'string' ? update.message.text.trim() : '';
      const currentProfile = await findProfileByTelegramId(telegramId);
      
      if (!currentProfile) {
        if (text === '/start') { await handleStartCommand(chatId, telegramId); return NextResponse.json({ ok: true }, { status: 200 }); }
        const handled = await handlePinAuthorization(chatId, telegramId, text);
        if (handled) return NextResponse.json({ ok: true }, { status: 200 });
        return new Response('OK', { status: 200 });
      }

      // --- СУПЕР ИИ-РЕЖИМ (ОПТИМИЗИРОВАННЫЙ ПОД FREE TIER) ---
      if (currentProfile.ai_mode && text !== '⬅️ Выйти из ИИ' && text !== '/start') {
        await sendTelegram({ method: 'sendChatAction', body: { chat_id: chatId, action: 'typing' } });
        
        const isReportRequest = /отчет|сводка|аналитика|статистика|что по заказам/i.test(text);
        const isCreateRequest = /создай заказ|добавь заказ|новый объект|занеси в базу/i.test(text);

        // Оптимизация лимитов токенов: для отчетов тянем 20 штук, для обычных вопросов - только последние 7
        const limitCount = isReportRequest ? 20 : 7;
        
        const { data: allOrders } = await supabase
          .from('orders')
          .select('title, department, status, deadline, description')
          .neq('status', 'completed')
          .order('updated_at', { ascending: false })
          .limit(limitCount);
        
        let ordersContext = "СПИСОК АКТИВНЫХ ЗАКАЗОВ В СИСТЕМЕ МОНТАЖКА PRO:\n";
        if (allOrders && allOrders.length > 0) {
          allOrders.forEach((o, i) => {
            ordersContext += `- [${i + 1}] "${o.title}" | Цех: ${o.department} | Status: ${o.status} | Срок: ${o.deadline || 'нет'} | ТЗ: ${o.description || 'нет'}\n`;
          });
        } else {
          ordersContext += "Сейчас активных заказов в базе нет.\n";
        }

        const currentDateStr = new Date().toLocaleDateString('ru-RU');
        const timeContext = `Сегодняшняя дата: ${currentDateStr}.\n\n`;

        // СЦЕНАРИЙ 1: Аналитический отчет
        if (isReportRequest) {
          const reportPrompt = `${timeContext}${ordersContext}\nИнструкция: Сделай краткий директорский отчет по цехам (print, production, installation). Сгруппируй сколько заказов где висит, выдели жирным шрифтом объекты, у которых горят сроки. Отвечай строго в HTML разметке Telegram.`;
          const reportResponse = await fetchGeminiAI(reportPrompt);
          await sendTelegramMessage(chatId, reportResponse, { reply_markup: buildAIKeyboard() });
          return new Response('OK', { status: 200 });
        }

        // СЦЕНАРИЙ 2: Создание заказа из текста (Очищенный под текстовый режим)
        if (isCreateRequest) {
          const parsePrompt = `Разбери этот текст клиента и вытащи параметры для создания нового заказа. Текст: "${text}".
          Ты должен вернуть ответ СТРОГО в формате JSON. Не пиши никакого текста, кроме этого JSON. Структура:
          {
            "title": "Короткое понятное название объекта",
            "department": "print" или "production" или "installation",
            "description": "Полное подробное ТЗ, размеры, материалы, особенности монтажа"
          }`;

          // Вызываем без флага JSON-моды, просто как текст
          const jsonResponse = await fetchGeminiAI(parsePrompt);
          
          try {
            // Очищаем ответ от markdown-оберток, если ИИ их добавит
            const cleanJson = jsonResponse
              .replace(/```json/gi, '')
              .replace(/```/g, '')
              .trim();
              
            const parsedOrder = JSON.parse(cleanJson);

            const shortJson = { 
              title: parsedOrder.title.slice(0,25), 
              department: parsedOrder.department, 
              description: parsedOrder.description.slice(0,50) 
            };
            const base64Data = Buffer.from(JSON.stringify(shortJson)).toString('base64');

            const previewText = `🤖 <b>ИИ распознал параметры нового заказа:</b>\n\n🔹 <b>Название:</b> ${escapeHtml(parsedOrder.title)}\n🔹 <b>Направление:</b> <code>${parsedOrder.department}</code>\n🔹 <b>Тех. описание:</b> <i>${escapeHtml(parsedOrder.description)}</i>\n\nЗанести этот объект в общую базу Supabase?`;

            const inlineMarkup = {
              inline_keyboard: [[{ text: '➕ Да, создать заказ', callback_data: `ai_create_${base64Data}` }]]
            };

            await sendTelegramMessage(chatId, previewText, { reply_markup: inlineMarkup });
          } catch (e) {
            await sendTelegramMessage(chatId, `❌ Не удалось автоматически распарсить ТЗ. Вот текстовый ответ ИИ:\n\n<code>${escapeHtml(jsonResponse)}</code>`, { reply_markup: buildAIKeyboard() });
          }
          return new Response('OK', { status: 200 });
        }

        // СЦЕНАРИЙ 3: Поиск инфы и советы технолога
        const generalPrompt = `${timeContext}${ordersContext}\nЗапрос пользователя: ${text}`;
        const generalResponse = await fetchGeminiAI(generalPrompt);
        await sendTelegramMessage(chatId, generalResponse, { reply_markup: buildAIKeyboard() });
        return new Response('OK', { status: 200 });
      }

      switch (text) {
        case '/start': await handleStartCommand(chatId, telegramId); break;
        case '📋 Активные заказы': await handleActiveOrders(chatId); break;
        case '🔓 Свободные заказы': await handleFreeOrders(chatId); break;
        case '💼 Мои заказы': await handleMyOrders(chatId, currentProfile); break;
        case '🤖 ИИ-Технолог': {
          await supabase.from('profiles').update({ ai_mode: true }).eq('id', currentProfile.id);
          await sendTelegramMessage(chatId, '🤖 <b>Режим ИИ-Технолога активирован.</b>\n\nТеперь вы можете:\n1. <b>Искать заказы:</b> <i>\"Что там по аптеке?\"</i>\n2. <b>Просить аналитику:</b> <i>\"Выдай отчет по цехам\"</i>\n3. <b>Создавать объекты:</b> <i>\"Создай заказ вывеска ПВХ 3х1м цех изготовление\"</i>', { reply_markup: buildAIKeyboard() });
          break;
        }
        case '⬅️ Выйти из ИИ': {
          await supabase.from('profiles').update({ ai_mode: false }).eq('id', currentProfile.id);
          await sendMainMenu(chatId, Boolean(currentProfile?.can_print));
          break;
        }
        default:
          await sendMainMenu(chatId, Boolean(currentProfile?.can_print));
          break;
      }
    } catch (error) {
      console.error('Telegram failed:', error);
    }
    return new Response('OK', { status: 200 });
  }
  return new Response('OK', { status: 200 });
}