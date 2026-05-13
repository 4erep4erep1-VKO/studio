# 🤖 Интеграция Telegram-уведомлений для новых заказов

## 📋 Краткое описание

Реализована автоматическая отправка уведомлений в Telegram-группу при создании нового заказа через веб-форму. Используется Server Action для безопасной обработки запросов на серверной стороне.

---

## 🎯 Что было реализовано

### ✅ **Server Action** (`/app/actions/telegram.ts`)
- `notifyNewOrderToGroup()` - отправляет уведомление о новом заказе в Telegram группу
- `notifyOrderToUser()` - отправляет личное уведомление исполнителю
- Функция экранирования HTML-символов для безопасности
- Обработка ошибок с логированием

### ✅ **Обновленная форма** (`/src/components/orders/OrderForm.tsx`)
- Интегрирован импорт серверной функции
- Добавлен вызов `notifyNewOrderToGroup()` при создании нового заказа
- Обновлен вызов для личного уведомления (теперь использует `notifyOrderToUser()`)

---

## ⚙️ Переменные окружения

### Что добавить в `.env.local`

```env
# Telegram Bot API Token
TELEGRAM_BOT_TOKEN=your_bot_token_here

# Telegram Group Chat ID (где публикуются уведомления о новых заказах)
TELEGRAM_GROUP_CHAT_ID=your_group_chat_id_here
```

### Как получить эти значения?

#### 1️⃣ **TELEGRAM_BOT_TOKEN**
```
1. Откройте Telegram и найдите @BotFather
2. Напишите /start, затем /newbot
3. Следуйте инструкциям для создания бота
4. Получите токен формата: 123456789:ABCDefGhIjKlMnOpQrStUvWxYz...
```

#### 2️⃣ **TELEGRAM_GROUP_CHAT_ID**
```
1. Добавьте бота в группу
2. Напишите в группу сообщение с ботом (@YourBotName)
3. Откройте ссылку: https://api.telegram.org/botYOUR_TOKEN/getUpdates
4. В ответе найдите chat.id (это будет отрицательное число, например: -1001234567890)
5. Скопируйте этот ID в TELEGRAM_GROUP_CHAT_ID
```

---

## 📝 Структура сообщения в группе

При создании нового заказа в группу отправляется сообщение в таком формате:

```
🆕 Новый заказ (создан на сайте)

📦 Название: [название заказа]

📝 Описание: [описание заказа]

🏢 Отдел: 🛠 Монтаж (или 🖨 Печать)
📌 Тип: 🌍 Общий (или 👤 Личный)
📅 Дедлайн: [дата дедлайна]

📐 Размеры: [размеры] (если указаны)
🎨 Материал: [материал] (если указан)
🔗 Ссылка на макет: [ссылка] (если указана)

⏱ Время создания: [текущее время]
```

---

## 🔧 Технические детали

### Server Action (`/app/actions/telegram.ts`)

#### Функция `notifyNewOrderToGroup(orderData)`
```typescript
interface OrderData {
  title: string;
  description?: string;
  department?: string;
  deadline?: string;
  is_general?: boolean;
  dimensions?: string;
  material?: string;
  source_link?: string;
}
```

**Параметры:**
- `title` - название заказа (обязательно)
- `description` - описание заказа
- `department` - отдел ('installation' или 'print')
- `deadline` - дедлайн заказа
- `is_general` - является ли заказ общим
- `dimensions` - размеры
- `material` - материал
- `source_link` - ссылка на макет

**Возвращает:**
```typescript
{
  success: boolean;
  messageId?: string;  // ID сообщения в Telegram
  error?: string;      // Текст ошибки если возникла
}
```

#### Функция `notifyOrderToUser(chatId, title)`
**Параметры:**
- `chatId` - ID чата Telegram пользователя
- `title` - название заказа

**Возвращает:** то же, что и `notifyNewOrderToGroup`

### Form Component (`/src/components/orders/OrderForm.tsx`)

Добавлены два вызова Server Actions:

1. **При создании нового заказа:**
   ```typescript
   if (!orderId) {
     await notifyNewOrderToGroup({
       title: formData.title,
       description: formData.description,
       // ... остальные поля
     }).catch(err => console.error('Failed to send group notification:', err));
   }
   ```

2. **При назначении личного заказа:**
   ```typescript
   if (!orderId && !formData.is_general && formData.assigned_to) {
     const assignedUser = installers.find(i => i.id === formData.assigned_to);
     if (assignedUser && assignedUser.telegram_chat_id) {
       await notifyOrderToUser(assignedUser.telegram_chat_id, formData.title)
         .catch(err => console.error('Failed to send personal notification:', err));
     }
   }
   ```

---

## 🚀 Как использовать

### 1️⃣ Добавьте переменные окружения
```env
# .env.local
TELEGRAM_BOT_TOKEN=ваш_токен_бота
TELEGRAM_GROUP_CHAT_ID=ваш_ID_группы
```

### 2️⃣ Готово!
Система автоматически:
- ✅ Отправит уведомление в группу при создании любого нового заказа
- ✅ Отправит личное уведомление исполнителю при назначении личного заказа
- ✅ Обработает ошибки без блокировки создания заказа

---

## 📊 Логирование

Все события логируются в консоль:

```
✅ Telegram notification sent successfully: 123456789
❌ Telegram API Error: {...}
❌ Error sending Telegram notification: {...}
```

---

## 🔒 Безопасность

- 🔐 Токен бота и ID группы хранятся на сервере (не видны клиенту)
- 🛡️ HTML-символы экранируются перед отправкой
- 💥 Ошибки отправки не блокируют создание заказа

---

## 🐛 Troubleshooting

### Сообщения не приходят в группу?

1. **Проверьте переменные окружения:**
   ```bash
   # В терминале
   echo $TELEGRAM_BOT_TOKEN
   echo $TELEGRAM_GROUP_CHAT_ID
   ```

2. **Убедитесь, что бот добавлен в группу:**
   - Откройте группу в Telegram
   - Добавьте вашего бота в группу
   - Дайте боту права на отправку сообщений

3. **Проверьте логи:**
   - Откройте консоль браузера (F12)
   - Посмотрите вкладку "Network" при создании заказа
   - Проверьте консоль сервера на ошибки

4. **Проверьте правильность токена:**
   ```bash
   # Попробуйте эту команду с вашим токеном:
   curl "https://api.telegram.org/botYOUR_TOKEN/getMe"
   # Должен вернуть информацию о боте
   ```

### Неправильный chat_id?

Используйте этот URL для получения правильного ID:
```
https://api.telegram.org/botYOUR_TOKEN/getUpdates
```

Найдите в ответе `"chat":{"id":YOUR_CHAT_ID}`

---

## 📚 Файлы

| Файл | Описание |
|------|---------|
| `/app/actions/telegram.ts` | 🆕 Server Action для отправки уведомлений |
| `/src/components/orders/OrderForm.tsx` | 📝 Обновленный компонент формы |

---

## ✅ Проверка интеграции

### Шаг 1: Убедитесь, что переменные окружения установлены
```env
TELEGRAM_BOT_TOKEN=ваш_токен
TELEGRAM_GROUP_CHAT_ID=ваш_ID
```

### Шаг 2: Создайте новый заказ через форму
- Заполните форму создания заказа
- Нажмите "Запустить в работу"

### Шаг 3: Проверьте Telegram
- Откройте группу, где должны приходить уведомления
- Вы должны увидеть сообщение о новом заказе

### Шаг 4: Проверьте логи
- Откройте консоль браузера (F12)
- Откройте консоль сервера
- Вы должны увидеть логи об успешной отправке

---

## 🎁 Бонусы

- ✨ HTML-форматирование в сообщениях
- 🌐 Поддержка русского языка
- ⚙️ Автоматический скрепинг ссылок на макеты
- 🔔 Отдельные уведомления для группы и исполнителя
- 💪 Обработка ошибок и логирование

---

## 📞 Поддержка

Если возникли вопросы:
1. Проверьте консоль браузера (F12 → Console)
2. Проверьте логи сервера
3. Убедитесь в правильности переменных окружения
4. Проверьте права бота в группе

---

**Готово! Теперь при создании заказа в группу будут автоматически приходить уведомления! 🚀**
