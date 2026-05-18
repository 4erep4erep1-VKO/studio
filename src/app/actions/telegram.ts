'use server';

interface OrderData {
  title: string;
  description?: string;
  department?: string;
  deadline?: string;
  is_general?: boolean;
  assigned_to?: string;
  dimensions?: string;
  material?: string;
  source_link?: string;
  image_urls?: string[];
  creator_id?: string; 
  created_by?: string; 
  creator_full_name?: string;
}

export async function notifyNewOrderToGroup(orderData: OrderData) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const groupChatId = process.env.TELEGRAM_GROUP_CHAT_ID;

  if (!botToken || !groupChatId) {
    console.warn('⚠️ Telegram config missing');
    return { success: false, error: 'Telegram config missing' };
  }

  try {
    let creatorName = orderData.creator_full_name;
    const creatorId = orderData.created_by || orderData.creator_id;
    
    // Умный поиск автора: если пришел Telegram ID (число) или UUID
    if (!creatorName && creatorId) {
      try {
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL || '',
          process.env.SUPABASE_SERVICE_ROLE_KEY || ''
        );
        
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(creatorId));
        let query = supabase.from('profiles').select('full_name, name');
        
        if (isUuid) {
          query = query.eq('id', creatorId);
        } else {
          query = query.eq('telegram_chat_id', String(creatorId));
        }
        
        const { data: profile, error } = await query.single();
        
        if (error) console.error('❌ Ошибка запроса профиля:', error.message);
        if (profile) {
          creatorName = profile.full_name || profile.name;
        }
      } catch (err) {
        console.error('⚠️ Ошибка при подключении к Supabase в Telegram Action:', err);
      }
    }

    const finalCreatorName = creatorName || 'Неизвестный пользователь';
    const departmentLabel = orderData.department === 'installation' ? '🛠 Монтаж' : orderData.department === 'production' ? '🏭 Изготовление' : '🖨 Печать';
    const typeLabel = orderData.is_general ? '🌍 Общий' : '👤 Личный';
    const deadline = orderData.deadline 
      ? new Date(orderData.deadline).toLocaleDateString('ru-RU')
      : 'Не указан';

    // Формируем текст, ОБЯЗАТЕЛЬНО экранируя ссылку на макет через escapeHtml
    const messageText = `
🆕 <b>Новый заказ (создан на сайте)</b>

📦 <b>Название:</b> ${escapeHtml(orderData.title)}
${orderData.description ? `📝 <b>Описание:</b> ${escapeHtml(orderData.description)}` : ''}

🏢 <b>Отдел:</b> ${departmentLabel}
📌 <b>Тип:</b> ${typeLabel}
📅 <b>Дедлайн:</b> ${deadline}

${orderData.dimensions ? `📐 <b>Размеры:</b> ${escapeHtml(orderData.dimensions)}` : ''}
${orderData.material ? `🎨 <b>Материал:</b> ${escapeHtml(orderData.material)}` : ''}
${orderData.source_link ? `🔗 <b>Ссылка на макет:</b> <a href="${escapeHtml(orderData.source_link)}">открыть</a>` : ''}

👤 <b>Создал:</b> ${escapeHtml(finalCreatorName)}
⏱ Время: ${new Date().toLocaleString('ru-RU', { timeZone: 'Asia/Almaty' })}
    `.trim();

    const hasPhoto = Array.isArray(orderData.image_urls) && orderData.image_urls.length > 0 && typeof orderData.image_urls[0] === 'string';
    const endpoint = hasPhoto ? 'sendPhoto' : 'sendMessage';
    const body = hasPhoto
      ? {
          chat_id: groupChatId,
          photo: orderData.image_urls![0],
          caption: messageText,
          parse_mode: 'HTML',
          disable_notification: false,
        }
      : {
          chat_id: groupChatId,
          text: messageText,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        };

    let response = await fetch(`https://api.telegram.org/bot${botToken}/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorResponse = await response.text();
      console.error(`❌ Telegram API Error (${endpoint}):`, errorResponse);

      // Если упала отправка с фото, пробуем отправить хотя бы голый текст
      if (hasPhoto) {
        console.log('🔄 Ошибка при sendPhoto. Пробуем резервную отправку через sendMessage...');
        response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: groupChatId,
            text: messageText,
            parse_mode: 'HTML',
            disable_web_page_preview: true,
          }),
        });
        if (!response.ok) {
          const fallbackError = await response.text();
          console.error('❌ Резервная отправка текста тоже упала:', fallbackError);
        }
      }
    }

    return { success: response.ok };
  } catch (error) {
    console.error('❌ Критическая ошибка экшена Telegram:', error);
    return { success: false, error: 'Internal error' };
  }
}

export async function notifyOrderToUser(chatId: string, title: string) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return { success: false };

  const messageText = `🔔 <b>ЛИЧНЫЙ ЗАКАЗ!</b>\n\nТебе назначили новый объект: <b>${escapeHtml(title)}</b>\n\nЗайди в «📦 Мои заказы».`;

  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: messageText, parse_mode: 'HTML' }),
  });
  return { success: response.ok };
}

function escapeHtml(text: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}