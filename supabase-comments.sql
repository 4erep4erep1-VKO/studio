-- Создание таблицы комментариев для заказов
CREATE TABLE IF NOT EXISTS comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Индексы для производительности
CREATE INDEX IF NOT EXISTS idx_comments_order_id ON comments(order_id);
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON comments(created_at);

-- Включение RLS (Row Level Security)
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- Политики RLS - все аутентифицированные пользователи могут читать комментарии
CREATE POLICY "Comments are viewable by authenticated users" ON comments
  FOR SELECT USING (auth.role() = 'authenticated');

-- Политики RLS - все аутентифицированные пользователи могут добавлять комментарии
CREATE POLICY "Users can insert their own comments" ON comments
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Включение realtime для таблицы comments
ALTER PUBLICATION supabase_realtime ADD TABLE comments;