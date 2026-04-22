from aiogram.fsm.state import StatesGroup, State

class AuthStates(StatesGroup):
    waiting_for_pin = State()

class OrderStates(StatesGroup):
    waiting_for_photo = State()