from aiogram import Router, types, F
from aiogram.filters import BaseFilter, CommandStart
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from database.client import get_supabase
# Если у тебя клавиатура лежит в другом месте, поправь импорт
from keyboards.reply import get_main_menu 

router = Router()

# Состояние для ожидания ПИН-кода
class AuthStates(StatesGroup):
    waiting_for_pin = State()

class UnauthenticatedFilter(BaseFilter):
    async def __call__(self, message: types.Message) -> bool:
        chat_id = str(message.from_user.id)
        supabase = await get_supabase()
        res = await supabase.table("profiles").select("id").eq("telegram_chat_id", chat_id).execute()
        return not bool(res.data)

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
            "👋 Привет! Ваш Telegram не привязан к системе.\n\n"
            "Введите персональный ПИН-код, который вам выдал администратор:", 
            parse_mode="HTML"
        )
        
    except Exception as e:
        await message.answer(f"❌ Ошибка: {str(e)}")


@router.message(F.text, state=None, UnauthenticatedFilter())
async def request_pin_on_any_message(message: types.Message, state: FSMContext):
    try:
        await state.set_state(AuthStates.waiting_for_pin)
        await message.answer(
            "👋 Привет! Ваш Telegram не привязан к системе.\n\n"
            "Введите персональный ПИН-код, который вам выдал администратор:",
            parse_mode="HTML"
        )
    except Exception as e:
        await message.answer(f"❌ Ошибка: {str(e)}")


@router.message(AuthStates.waiting_for_pin)
async def process_pin(message: types.Message, state: FSMContext):
    try:
        pin = message.text.strip()
        supabase = await get_supabase()

        # Попробуем найти профиль по нескольким возможным названию поля с PIN
        pin_fields = ["pin_code", "pin", "password"]
        user = None

        for field in pin_fields:
            res = await supabase.table("profiles").select("*").eq(field, pin).execute()
            if res.data:
                user = res.data[0]
                break

        if not user:
            await message.answer("❌ Неверный ПИН-код. Проверьте цифры или обратитесь к администратору.")
            return

        # Защита: если профиль уже привязан к другому Telegram
        if user.get("telegram_chat_id"):
            await message.answer("⚠️ Этот ПИН-код уже активирован другим устройством.")
            return

        # Привязываем Telegram ID к профилю
        chat_id = str(message.from_user.id)
        await supabase.table("profiles").update({"telegram_chat_id": chat_id}).eq("id", user["id"]).execute()

        # Очищаем состояние
        await state.clear()

        # Ответ пользователю
        name = user.get("full_name") or user.get("name") or "сотрудник"
        await message.answer(
            f"✅ Авторизация успешна! {name}, вы привязаны к системе Montazhka PRO.",
            reply_markup=get_main_menu()
        )

    except Exception as e:
        await message.answer(f"❌ Ошибка авторизации: {str(e)}")
        await state.clear()