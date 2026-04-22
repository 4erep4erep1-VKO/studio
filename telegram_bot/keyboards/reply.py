from aiogram.types import ReplyKeyboardMarkup, KeyboardButton

def get_main_menu():
    return ReplyKeyboardMarkup(
        keyboard=[
            [KeyboardButton(text="📦 Мои заказы")],
            [KeyboardButton(text="🔎 Свободные заказы")],
            [KeyboardButton(text="👤 Мой профиль")]
        ],
        resize_keyboard=True,
        input_field_placeholder="Выбери действие ниже"
    )