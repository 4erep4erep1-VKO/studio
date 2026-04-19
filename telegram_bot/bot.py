import asyncio
import logging
from aiogram import Bot, Dispatcher, types
from aiogram.filters import CommandStart
from supabase import create_client, Client

# Включаем логирование
logging.basicConfig(level=logging.INFO)

# Твой НОВЫЙ токен
TELEGRAM_TOKEN = '8534792728:AAFqwRZvDO81l5zzRd1vZDV4iPiw7yi_BAY' 

SUPABASE_URL = 'https://ehrfzwhawnqyocbthjmb.supabase.co'
SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVocmZ6d2hhd25xeW9jYnRoam1iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3MzYzNjIsImV4cCI6MjA5MTMxMjM2Mn0.0iQ7ZNoWFyGbmblkN4O5gwo6x8FWC0msbEsCPo1ghyo'

bot = Bot(token=TELEGRAM_TOKEN)
dp = Dispatcher()
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

@dp.message(CommandStart())
async def command_start_handler(message: types.Message):
    chat_id = message.chat.id
    print(f"✅ Команда /start от ID: {chat_id}")
    text = (
        f"🛠 Привет! Я бот системы Montazhka PRO.\n\n"
        f"Твой ID: `{chat_id}`\n"
        f"Отправь эти цифры мне в чат, чтобы я их запомнил!"
    )
    await message.answer(text, parse_mode="Markdown")

async def main():
    print("🚀 Запускаем бота с новым токеном...")
    try:
        await bot.delete_webhook(drop_pending_updates=True)
        await dp.start_polling(bot)
    except Exception as e:
        print(f"❌ Ошибка при запуске: {e}")

if __name__ == "__main__":
    asyncio.run(main())