import asyncio
import logging
import os
from dotenv import load_dotenv
from aiogram import Bot, Dispatcher

# Импортируем наши файлы с логикой
from handlers import start, orders

# Загружаем токен из .env файла
load_dotenv()
BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN") or "8534792728:AAFqwRZvDO81l5zzRd1vZDV4iPiw7yi_BAY"

async def main():
    # Настраиваем логирование, чтобы видеть ошибки в терминале
    logging.basicConfig(level=logging.INFO)
    
    # Инициализируем бота и диспетчер
    bot = Bot(token=BOT_TOKEN)
    dp = Dispatcher()

    # ПОДКЛЮЧАЕМ РОУТЕРЫ
    dp.include_router(start.router)
    dp.include_router(orders.router)

    print("🚀 Бот успешно запущен и готов к работе!")
    
    # Пропускаем старые обновления и запускаем бота
    await bot.delete_webhook(drop_pending_updates=True)
    await dp.start_polling(bot)

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("Бот остановлен вручную.")