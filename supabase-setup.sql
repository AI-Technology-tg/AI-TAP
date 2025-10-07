-- SQL скрипт для настройки базы данных Supabase для AI-TAP
-- Выполните эти команды в SQL Editor вашего Supabase проекта

-- 1. Создание таблицы пользователей
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    telegram_id BIGINT UNIQUE NOT NULL,
    username VARCHAR(50),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Создание таблицы сообщений
CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    telegram_id BIGINT NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Создание таблицы использования API
CREATE TABLE IF NOT EXISTS api_usage (
    id SERIAL PRIMARY KEY,
    telegram_id BIGINT NOT NULL,
    tokens_used INTEGER DEFAULT 0,
    response_time INTEGER DEFAULT 0,
    model VARCHAR(50) DEFAULT 'gpt-3.5-turbo',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Создание индексов для оптимизации запросов
CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id);
CREATE INDEX IF NOT EXISTS idx_messages_telegram_id ON messages(telegram_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_api_usage_telegram_id ON api_usage(telegram_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_created_at ON api_usage(created_at);

-- 5. Создание функции для автоматического обновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 6. Создание триггера для автоматического обновления updated_at
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- 7. Настройка Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_usage ENABLE ROW LEVEL SECURITY;

-- 8. Создание политик безопасности
-- Пользователи могут видеть только свои данные
CREATE POLICY "Users can view own data" ON users
    FOR SELECT USING (true);

CREATE POLICY "Users can insert own data" ON users
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update own data" ON users
    FOR UPDATE USING (true);

-- Сообщения - пользователи могут видеть только свои сообщения
CREATE POLICY "Users can view own messages" ON messages
    FOR SELECT USING (true);

CREATE POLICY "Users can insert own messages" ON messages
    FOR INSERT WITH CHECK (true);

-- API usage - пользователи могут видеть только свою статистику
CREATE POLICY "Users can view own api usage" ON api_usage
    FOR SELECT USING (true);

CREATE POLICY "Users can insert own api usage" ON api_usage
    FOR INSERT WITH CHECK (true);

-- 9. Создание представления для статистики (только для админов)
CREATE OR REPLACE VIEW admin_stats AS
SELECT 
    COUNT(DISTINCT u.telegram_id) as total_users,
    COUNT(DISTINCT CASE WHEN u.last_seen > NOW() - INTERVAL '24 hours' THEN u.telegram_id END) as active_users_24h,
    COUNT(m.id) as total_messages,
    COUNT(au.id) as total_api_requests,
    AVG(au.response_time) as avg_response_time,
    SUM(au.tokens_used) as total_tokens_used
FROM users u
LEFT JOIN messages m ON u.telegram_id = m.telegram_id
LEFT JOIN api_usage au ON u.telegram_id = au.telegram_id;

-- 10. Создание функции для получения статистики пользователя
CREATE OR REPLACE FUNCTION get_user_stats(user_telegram_id BIGINT)
RETURNS TABLE (
    total_messages BIGINT,
    messages_today BIGINT,
    total_api_requests BIGINT,
    total_tokens_used BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(m.id) as total_messages,
        COUNT(CASE WHEN m.created_at > CURRENT_DATE THEN m.id END) as messages_today,
        COUNT(au.id) as total_api_requests,
        COALESCE(SUM(au.tokens_used), 0) as total_tokens_used
    FROM messages m
    LEFT JOIN api_usage au ON m.telegram_id = au.telegram_id
    WHERE m.telegram_id = user_telegram_id;
END;
$$ LANGUAGE plpgsql;

-- 11. Создание функции для очистки старых данных (опционально)
CREATE OR REPLACE FUNCTION cleanup_old_data()
RETURNS void AS $$
BEGIN
    -- Удаляем сообщения старше 30 дней
    DELETE FROM messages WHERE created_at < NOW() - INTERVAL '30 days';
    
    -- Удаляем API usage старше 90 дней
    DELETE FROM api_usage WHERE created_at < NOW() - INTERVAL '90 days';
    
    -- Обновляем last_seen для неактивных пользователей
    UPDATE users SET last_seen = NOW() - INTERVAL '1 day' 
    WHERE last_seen < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- 12. Создание расписания для автоматической очистки (если нужно)
-- ВАЖНО: Это нужно настроить в Supabase Dashboard -> Database -> Extensions -> pg_cron
-- SELECT cron.schedule('cleanup-old-data', '0 2 * * *', 'SELECT cleanup_old_data();');

-- Проверка создания таблиц
SELECT 
    table_name,
    table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('users', 'messages', 'api_usage')
ORDER BY table_name;
