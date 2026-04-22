import os
from dotenv import load_dotenv
from supabase import create_async_client, AsyncClient

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

async def get_supabase() -> AsyncClient:
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise ValueError("Ошибка: SUPABASE_URL и SUPABASE_KEY должны быть указаны в .env")
    
    return await create_async_client(SUPABASE_URL, SUPABASE_KEY)
