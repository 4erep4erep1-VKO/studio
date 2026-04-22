from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton
from aiogram.utils.keyboard import InlineKeyboardBuilder

def get_order_actions(order_id: str, current_status: str) -> InlineKeyboardMarkup:
    builder = InlineKeyboardBuilder()
    
    # Если заказ новый, даем кнопку "В работу"
    if current_status == 'new':
        builder.row(InlineKeyboardButton(
            text="🛠 Взять в работу", 
            callback_data=f"order_status:in_progress:{order_id}")
        )
    
    # Если заказ в работе, даем кнопку "Завершить"
    if current_status == 'in_progress':
        builder.row(InlineKeyboardButton(
            text="✅ Завершить заказ", 
            callback_data=f"order_status:completed:{order_id}")
        )
    
    return builder.as_markup()