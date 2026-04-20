-- =====================================================
-- ОЧИСТКА И ПЕРЕСОЗДАНИЕ БАЗЫ ДАННЫХ
-- MontazhkaPRO - Полная настройка Supabase
-- =====================================================

-- ШАГ 1: Удаляем все существующие объекты
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP TABLE IF EXISTS comments CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- ШАГ 2: Создаем таблицы заново
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  telegram_id BIGINT UNIQUE,
  role TEXT NOT NULL DEFAULT 'installer' CHECK (role IN ('admin', 'installer')),
  pin TEXT DEFAULT '0000',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'В работе',
  image_urls TEXT[] DEFAULT '{}',
  assigned_to TEXT DEFAULT 'general',
  due_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ШАГ 3: Создаем функцию триггера с подробной отладкой
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_name TEXT;
  user_role TEXT;
  user_email TEXT;
BEGIN
  -- Логируем входные данные для отладки
  RAISE LOG 'handle_new_user triggered for user ID: %', NEW.id;
  RAISE LOG 'raw_user_meta_data: %', NEW.raw_user_meta_data;
  RAISE LOG 'email: %', NEW.email;

  -- Извлекаем данные из метаданных
  user_name := COALESCE(NEW.raw_user_meta_data->>'name', 'Пользователь');
  user_role := COALESCE(NEW.raw_user_meta_data->>'role', 'installer');
  user_email := NEW.email;

  -- Проверяем обязательные поля
  IF user_email IS NULL OR user_email = '' THEN
    RAISE EXCEPTION 'Email is required but was null or empty';
  END IF;

  IF user_name IS NULL OR user_name = '' THEN
    user_name := 'Пользователь';
  END IF;

  -- Логируем что будем вставлять
  RAISE LOG 'Inserting profile: id=%, name=%, email=%, role=%', NEW.id, user_name, user_email, user_role;

  -- Создаем профиль
  INSERT INTO public.profiles (id, name, email, role, pin)
  VALUES (NEW.id, user_name, user_email, user_role, '0000');

  RAISE LOG 'Profile created successfully for user %', NEW.id;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Подробное логирование ошибки
    RAISE LOG 'Error in handle_new_user: %', SQLERRM;
    RAISE LOG 'SQLSTATE: %', SQLSTATE;
    RAISE LOG 'User ID: %, Email: %, Meta: %', NEW.id, NEW.email, NEW.raw_user_meta_data;
    RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ШАГ 4: Создаем триггер
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ШАГ 5: Создаем индексы
CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_orders_created_at ON orders(created_at);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_comments_order_id ON comments(order_id);
CREATE INDEX idx_comments_created_at ON comments(created_at);

-- ШАГ 6: Включаем RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- ШАГ 7: Создаем политики RLS
CREATE POLICY "Users can view their own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles" ON profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Authenticated users can view orders" ON orders
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert orders" ON orders
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update orders" ON orders
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Comments are viewable by authenticated users" ON comments
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can insert their own comments" ON comments
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- ШАГ 8: Включаем realtime
ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE comments;

-- ШАГ 9: Проверяем что все создалось
SELECT 'Profiles table created' as status UNION ALL
SELECT 'Orders table created' UNION ALL
SELECT 'Comments table created' UNION ALL
SELECT 'Trigger created' UNION ALL
SELECT 'RLS enabled';