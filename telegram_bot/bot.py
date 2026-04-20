import asyncio
import logging
from aiogram import Bot, Dispatcher, types
from aiogram.filters import CommandStart, StateFilter
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from supabase import create_client, Client

# Включаем логирование
logging.basicConfig(level=logging.INFO)

# Токены и ключи
TELEGRAM_TOKEN = '8534792728:AAFqwRZvDO81l5zzRd1vZDV4iPiw7yi_BAY'
SUPABASE_URL = 'https://ehrfzwhawnqyocbthjmb.supabase.co'
SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVocmZ6d2hhd25xeW9jYnRoam1iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3MzYzNjIsImV4cCI6MjA5MTMxMjM2Mn0.0iQ7ZNoWFyGbmblkN4O5gwo6x8FWC0msbEsCPo1ghyo'

# Инициализация
bot = Bot(token=TELEGRAM_TOKEN)
dp = Dispatcher()
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Состояния FSM
class Registration(StatesGroup):
    waiting_for_telegram_id = State()
    waiting_for_email = State()

# Обработчик команды /start
@dp.message(CommandStart())
async def command_start_handler(message: types.Message, state: FSMContext):
    chat_id = message.chat.id
    print(f"✅ Команда /start от ID: {chat_id}")
    
    # Сбрасываем предыдущее состояние, если оно есть
    await state.clear()
    
    text = (
        f"🛠️ Здравствуйте! Я бот системы Montazhka PRO.\n\n"
        f"Ваш ID: `{chat_id}`\n"
        f"Отправьте его в следующем сообщении для подтверждения."
    )
    await message.answer(text, parse_mode="Markdown")
    # Переходим в состояние ожидания Telegram ID
    await state.set_state(Registration.waiting_for_telegram_id)

# Обработчик, который ловит Telegram ID
@dp.message(StateFilter(Registration.waiting_for_telegram_id), lambda message: message.text.isdigit())
async def receive_telegram_id(message: types.Message, state: FSMContext):
    chat_id = message.chat.id
    telegram_id = int(message.text)
    
    if chat_id != telegram_id:
        await message.answer("🤔 Вы уверены, что это ваш ID? Давайте попробуем еще раз.")
        return

    # Сохраняем ID в FSM
    await state.update_data(telegram_id=telegram_id)
    
    print(f"🆔 Получен ID: {telegram_id}. Запрашиваю email.")
    await message.answer("👍 Отлично! Теперь введите email, который вы использовали при регистрации в Montazhka PRO.")
    
    # Переходим в состояние ожидания email
    await state.set_state(Registration.waiting_for_email)

# Обработчик, который ловит email и обновляет профиль
@dp.message(StateFilter(Registration.waiting_for_email))
async def receive_email_and_update(message: types.Message, state: FSMContext):
    email = message.text
    user_data = await state.get_data()
    telegram_id = user_data.get('telegram_id')
    
    print(f"📧 Получен email: {email} для Telegram ID: {telegram_id}. Обновляю профиль...")
    
    try:
        # Ищем профиль по email и обновляем telegram_id
        response = supabase.table('profiles').update({'telegram_id': telegram_id}).eq('email', email).execute()
        
        # Проверяем, что обновление прошло успешно
        if response.data and len(response.data) > 0:
            print(f"✅ Профиль для {email} успешно обновлен.")
            await message.answer("🎉 Готово! Ваш Telegram-аккаунт успешно привязан к системе.")
        else:
            print(f"🟡 Профиль с email {email} не найден.")
            await message.answer("🤷‍♂️ Не могу найти профиль с таким email. Попробуйте еще раз или обратитесь в поддержку.")
    except Exception as e:
        print(f"🔴 Ошибка при обновлении профиля: {e}")
        await message.answer("💥 Произошла ошибка. Попробуйте позже.")
    finally:
        # Сбрасываем состояние
        await state.clear()

# Основная функция запуска
async def main():
    print("🚀 Запускаем бота...")
    try:
        await bot.delete_webhook(drop_pending_updates=True)
        await dp.start_polling(bot)
    except Exception as e:
        print(f"🔴 Ошибка при запуске: {e}")

if __name__ == "__main__":
    asyncio.run(main())