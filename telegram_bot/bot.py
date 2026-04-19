import asyncio
from aiogram import Bot, Dispatcher, types
from aiogram.filters import CommandStart
from supabase import create_client, Client

# ##################################################################
# ##                    КОНФИГУРАЦИЯ БОТА                         ##
# ##################################################################

TELEGRAM_TOKEN = '8534792728:AAGYtCW0pMo4Z_nu4ulRmzKUZgWPar8Xxhw'
SUPABASE_URL = 'https://ehrfzwhawnqyocbthjmb.supabase.co'
SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVocmZ6d2hhd25xeW9jYnRoam1iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3MzYzNjIsImV4cCI6MjA5MTMxMjM2Mn0.0iQ7ZNoWFyGbmblkN4O5gwo6x8FWC0msbEsCPo1ghyo'

bot = Bot(token=TELEGRAM_TOKEN)
dp = Dispatcher()
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ##################################################################
# ##                       ОБРАБОТЧИКИ                            ##
# ##################################################################

@dp.message(CommandStart())
async def command_start_handler(message: types.Message):
    """
    Обработка команды /start. 
    Бот приветствует пользователя и выдает его Telegram ID.
    """
    chat_id = message.chat.id
    text = (
        f"🛠 Привет! Я бот-курьер системы Montazhka PRO.\n\n"
        f"Твой секретный Telegram ID: `{chat_id}`\n\n"
        f"Скопируй эти цифры и отправь админу, чтобы он добавил тебя в базу рассылки."
    )
    await message.answer(text, parse_mode="Markdown")

# ##################################################################
# ##                     ЗАПУСК БОТА                              ##
# ##################################################################

async def main():
    print("🚀 Бот успешно запущен! Зайди в Телеграм и напиши ему /start")
    try:
        await dp.start_polling(bot)
    except Exception as e:
        print(f"❌ Ошибка при работе бота: {e}")

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except (KeyboardInterrupt, SystemExit):
        print("🛑 Бот остановлен")