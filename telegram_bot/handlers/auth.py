from aiogram import Router, types
from aiogram.filters import CommandStart
from aiogram.fsm.context import FSMContext
from states import AuthStates
from database.client import get_supabase
from keyboards.reply import get_main_menu

router = Router()

@router.message(CommandStart())
async def cmd_start(message: types.Message, state: FSMContext):
    await state.clear()
    await message.answer(
        "🛠 Привет! Я бот системы Montazhka PRO.\n\n"
        "Пожалуйста, введи свой PIN-код, который тебе выдал администратор:"
    )
    await state.set_state(AuthStates.waiting_for_pin)

@router.message(AuthStates.waiting_for_pin)
async def process_pin(message: types.Message, state: FSMContext):
    pin = message.text.strip()
    chat_id = str(message.from_user.id)
    
    supabase = await get_supabase()
    
    response = await supabase.table("profiles").select("*").eq("pin_code", pin).execute()
    
    if not response.data:
        await message.answer("❌ Неверный PIN-код. Попробуй еще раз или обратись к администратору.")
        return

    user_data = response.data[0]
    
    await supabase.table("profiles").update({"telegram_chat_id": chat_id}).eq("id", user_data["id"]).execute()
    
    full_name = user_data.get('full_name')
    display_name = full_name if full_name else "Монтажник"
    
    await message.answer(
        f"✅ Авторизация успешна!\n"
        f"Добро пожаловать, {display_name}.",
        reply_markup=get_main_menu()
    )
    await state.clear()