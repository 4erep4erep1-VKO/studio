import uuid
import logging
import traceback
from aiogram import Router, types, F
from aiogram.fsm.context import FSMContext
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton
from keyboards import inline as kb 
from states import OrderStates
from database.client import get_supabase

router = Router()

STATUS_LABELS = {
    "new": "🟢 Новый",
    "in_progress": "🟡 В работе",
    "completed": "✅ Завершен"
}

# --- 1. МОИ ЗАКАЗЫ ---
@router.message(F.text == "📦 Мои заказы")
async def show_my_orders(message: types.Message):
    try:
        chat_id = str(message.from_user.id)
        supabase = await get_supabase()
        
        user_res = await supabase.table("profiles").select("id").eq("telegram_chat_id", chat_id).execute()
        
        if not user_res.data:
            await message.answer("❌ Ошибка: Профиль не найден. Нажми /start")
            return
            
        user_id = user_res.data[0]["id"]
        
        orders_res = await supabase.table("orders") \
            .select("*") \
            .eq("assigned_to", user_id) \
            .in_("status", ["new", "in_progress"]) \
            .execute()
        
        if not orders_res.data:
            await message.answer("☕ У тебя пока нет активных заказов.")
            return

        for order in orders_res.data:
            status_val = order.get('status')
            text = (
                f"📦 <b>{order.get('title', 'Без названия')}</b>\n\n"
                f"📝 {order.get('description') or 'Описание отсутствует'}\n"
                f"📊 Статус: {STATUS_LABELS.get(status_val, status_val)}\n"
            )
            
            if order.get('deadline'):
                text += f"🗓 Дедлайн: {order['deadline'].split('T')[0]}\n"

            preview_url = order.get('preview_url')
            reply_markup = kb.get_order_actions(order['id'], status_val)

            if preview_url:
                try:
                    await message.answer_photo(photo=preview_url, caption=text, parse_mode="HTML", reply_markup=reply_markup)
                except Exception:
                    await message.answer(text, parse_mode="HTML", reply_markup=reply_markup)
            else:
                await message.answer(text, parse_mode="HTML", reply_markup=reply_markup)

    except Exception as e:
        error_text = f"❌ <b>Ошибка в 'Моих заказах':</b>\n<code>{str(e)}</code>"
        logging.error(traceback.format_exc())
        await message.answer(error_text, parse_mode="HTML")


# --- 2. СВОБОДНЫЕ ЗАКАЗЫ (ОБЩИЕ) ---
@router.message(F.text == "🔎 Свободные заказы")
async def show_free_orders(message: types.Message):
    try:
        supabase = await get_supabase()
        
        orders_res = await supabase.table("orders") \
            .select("*") \
            .eq("is_general", True) \
            .eq("status", "new") \
            .execute()
        
        if not orders_res.data:
            await message.answer("☕ Свободных заказов сейчас нет. Загляни позже!")
            return

        for order in orders_res.data:
            text = (
                f"🌍 <b>ОБЩИЙ ЗАКАЗ: {order.get('title', 'Без названия')}</b>\n\n"
                f"{order.get('description') or 'Нет описания'}\n"
            )
            if order.get('deadline'):
                text += f"🗓 Дедлайн: {order['deadline'].split('T')[0]}\n"
            
            claim_kb = InlineKeyboardMarkup(inline_keyboard=[
                [InlineKeyboardButton(text="✋ Забрать себе", callback_data=f"claim_order:{order['id']}")]
            ])

            preview_url = order.get('preview_url')
            if preview_url:
                try:
                    await message.answer_photo(photo=preview_url, caption=text, parse_mode="HTML", reply_markup=claim_kb)
                except:
                    await message.answer(text, parse_mode="HTML", reply_markup=claim_kb)
            else:
                await message.answer(text, parse_mode="HTML", reply_markup=claim_kb)
                
    except Exception as e:
        error_text = f"❌ <b>Ошибка в 'Свободных заказах':</b>\n<code>{str(e)}</code>"
        logging.error(traceback.format_exc())
        await message.answer(error_text, parse_mode="HTML")


# --- 3. КНОПКА "ЗАБРАТЬ СЕБЕ" ---
@router.callback_query(F.data.startswith("claim_order:"))
async def claim_order(callback: types.CallbackQuery):
    try:
        order_id = callback.data.split(":")[1]
        chat_id = str(callback.from_user.id)
        
        supabase = await get_supabase()
        
        user_res = await supabase.table("profiles").select("id").eq("telegram_chat_id", chat_id).execute()
        if not user_res.data:
            await callback.answer("Ошибка авторизации", show_alert=True)
            return
            
        user_id = user_res.data[0]["id"]
        
        await supabase.table("orders").update({
            "assigned_to": user_id,
            "is_general": False,
            "status": "in_progress"
        }).eq("id", order_id).execute()
        
        try:
            await callback.message.edit_reply_markup(reply_markup=None)
        except: pass
        
        await callback.message.answer("✅ Готово! Заказ теперь в твоем списке «📦 Мои заказы».")
        await callback.answer()
    except Exception as e:
        await callback.message.answer(f"❌ Ошибка:\n<code>{str(e)}</code>", parse_mode="HTML")


# --- 4. ИЗМЕНЕНИЕ СТАТУСА ---
@router.callback_query(F.data.startswith("order_status:"))
async def handle_status_change(callback: types.CallbackQuery, state: FSMContext):
    try:
        data_parts = callback.data.split(":")
        new_status = data_parts[1]
        order_id = data_parts[2]
        
        if new_status == 'completed':
            await state.update_data(order_id=order_id)
            await state.set_state(OrderStates.waiting_for_photo)
            
            skip_kb = InlineKeyboardMarkup(inline_keyboard=[
                [InlineKeyboardButton(text="🚫 Завершить без фото", callback_data=f"skip_photo:{order_id}")]
            ])
            
            await callback.message.answer(
                "📸 Пришли фотоотчет или нажми кнопку ниже, если фото не требуется:",
                reply_markup=skip_kb,
                parse_mode="HTML"
            )
            await callback.answer()
            return

        supabase = await get_supabase()
        await supabase.table("orders").update({"status": new_status}).eq("id", order_id).execute()
        
        try:
            await callback.message.edit_reply_markup(reply_markup=kb.get_order_actions(order_id, new_status))
        except Exception: pass
        await callback.answer("Статус обновлен")
    except Exception as e:
        await callback.message.answer(f"❌ Ошибка:\n<code>{str(e)}</code>", parse_mode="HTML")


# --- 5. ЗАКРЫТИЕ БЕЗ ФОТО ---
@router.callback_query(F.data.startswith("skip_photo:"))
async def skip_photo_handler(callback: types.CallbackQuery, state: FSMContext):
    try:
        order_id = callback.data.split(":")[1]
        supabase = await get_supabase()
        
        await supabase.table("orders").update({
            "status": "completed"
        }).eq("id", order_id).execute()
        
        await callback.message.edit_text("✅ Заказ завершен без фотоотчета.")
        await state.clear()
        await callback.answer()
    except Exception as e:
        await callback.message.answer(f"❌ Ошибка:\n<code>{str(e)}</code>", parse_mode="HTML")
        await state.clear()


# --- 6. ФОТООТЧЕТ ПРИ ЗАВЕРШЕНИИ ---
@router.message(OrderStates.waiting_for_photo, F.photo)
async def process_report_photo(message: types.Message, state: FSMContext):
    processing_msg = await message.answer("🔄 Загружаю фото в базу, подожди...")
    try:
        data = await state.get_data()
        order_id = data.get('order_id')
        
        photo = message.photo[-1]
        file_info = await message.bot.get_file(photo.file_id)
        photo_buffer = await message.bot.download_file(file_info.file_path)
        
        supabase = await get_supabase()
        file_name = f"report_{order_id}_{uuid.uuid4()}.jpg"
        storage_path = f"reports/{file_name}"
        
        await supabase.storage.from_("order-photos").upload(
            path=storage_path,
            file=photo_buffer.read(),
            file_options={"content-type": "image/jpeg"}
        )
        
        photo_url = await supabase.storage.from_("order-photos").get_public_url(storage_path)
        
        await supabase.table("orders").update({
            "status": "completed",
            "report_photo": photo_url
        }).eq("id", order_id).execute()
        
        await processing_msg.delete()
        await message.answer("✅ Отчет принят, заказ закрыт!")
        await state.clear()
        
    except Exception as e:
        error_msg = str(e)
        logging.error(f"Ошибка сохранения: {error_msg}")
        await processing_msg.delete()
        await message.answer(f"❌ ОШИБКА:\n<code>{error_msg}</code>", parse_mode="HTML")
        await state.clear()
        # --- 7. ПРОФИЛЬ МОНТАЖНИКА ---
@router.message(F.text == "👤 Мой профиль")
async def show_profile(message: types.Message):
    try:
        chat_id = str(message.from_user.id)
        supabase = await get_supabase()
        
        # Получаем данные профиля
        user_res = await supabase.table("profiles").select("*").eq("telegram_chat_id", chat_id).execute()
        if not user_res.data:
            await message.answer("Профиль не найден. Нажми /start")
            return
            
        user = user_res.data[0]
        
        # Считаем статистику заказов
        orders_res = await supabase.table("orders").select("status").eq("assigned_to", user['id']).execute()
        
        all_orders = orders_res.data or []
        in_progress = len([o for o in all_orders if o['status'] in ['new', 'in_progress']])
        completed = len([o for o in all_orders if o['status'] == 'completed'])

        profile_text = (
            f"<b>👷 Профиль монтажника</b>\n\n"
            f"👤 Имя: <b>{user['full_name']}</b>\n"
            f"🔑 Роль: {user['role']}\n"
            f"🆔 ID: <code>{chat_id}</code>\n\n"
            f"📊 <b>Твоя статистика:</b>\n"
            f"🛠 В работе: <b>{in_progress}</b>\n"
            f"✅ Завершено всего: <b>{completed}</b>\n\n"
            f"<i>Удачной работы!</i>"
        )
        
        await message.answer(profile_text, parse_mode="HTML")
    except Exception as e:
        await message.answer(f"Ошибка загрузки профиля: {str(e)}")