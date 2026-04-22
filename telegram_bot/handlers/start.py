from aiogram import Router, types, F
from aiogram.filters import CommandStart
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from database.client import get_supabase
# Если у тебя клавиатура лежит в другом месте, поправь импорт
from keyboards.reply import get_main_menu 

router = Router()

# Состояние для ожидания ПИН-кода
class AuthStates(StatesGroup):
    waiting_for_pin = State()

@router.message(CommandStart())
async def cmd_start(message: types.Message, state: FSMContext):
    try:
        chat_id = str(message.from_user.id)
        supabase = await get_supabase()

        # 1. Проверяем, есть ли уже этот пользователь в базе
        res = await supabase.table("profiles").select("*").eq("telegram_chat_id", chat_id).execute()
        
        # Если профиль найден — пускаем без пин-кода (он уже авторизован)
        if res.data:
            user_name = res.data[0]['full_name']
            await message.answer(
                f"Привет, <b>{user_name}</b>! С возвращением 👷\nВыбирай действие в меню ниже:", 
                parse_mode="HTML", 
                reply_markup=get_main_menu()
            )
            return

        # 2. Если профиля нет — просим ПИН-код
        await state.set_state(AuthStates.waiting_for_pin)
        await message.answer(
            "👋 Привет! Это система Montazhka PRO.\n\n"
            "Пожалуйста, введи свой <b>ПИН-код</b> (его выдает администратор):", 
            parse_mode="HTML"
        )
        
    except Exception as e:
        await message.answer(f"❌ Ошибка: {str(e)}")


@router.message(AuthStates.waiting_for_pin)
async def process_pin(message: types.Message, state: FSMContext):
    try:
        pin = message.text.strip()
        supabase = await get_supabase()

        # 3. Ищем профиль с таким ПИН-кодом в базе
        res = await supabase.table("profiles").select("*").eq("pin_code", pin).execute()

        if not res.data:
            await message.answer("❌ ПИН-код не найден. Проверь цифры или обратись к админу.")
            return

        user = res.data[0]

        # 4. Защита от перехвата: проверяем, не привязан ли уже этот профиль к кому-то другому
        if user.get("telegram_chat_id"):
            await message.answer("⚠️ Этот ПИН-код уже активирован другим устройством.")
            return

        # 5. Привязываем Telegram ID к профилю
        chat_id = str(message.from_user.id)
        await supabase.table("profiles").update({"telegram_chat_id": chat_id}).eq("id", user["id"]).execute()

        # Очищаем состояние (больше пин не ждем)
        await state.clear()
        
        # Выдаем меню
        await message.answer(
            f"✅ Отлично! Твой профиль успешно привязан.\n"
            f"Добро пожаловать в команду, <b>{user['full_name']}</b>!", 
            parse_mode="HTML", 
            reply_markup=get_main_menu()
        )
        
    except Exception as e:
        await message.answer(f"❌ Ошибка авторизации: {str(e)}")
        await state.clear()