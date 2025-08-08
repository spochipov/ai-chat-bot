-- Инициализация базы данных PostgreSQL для AI Chat Bot

-- Создание расширений
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Создание пользователя для приложения (если не существует)
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'ai_chat_bot_user') THEN
        CREATE ROLE ai_chat_bot_user WITH LOGIN PASSWORD 'secure_password_change_me';
    END IF;
END
$$;

-- Предоставление прав доступа
GRANT CONNECT ON DATABASE ai_chat_bot TO ai_chat_bot_user;
GRANT USAGE ON SCHEMA public TO ai_chat_bot_user;
GRANT CREATE ON SCHEMA public TO ai_chat_bot_user;

-- Создание индексов для оптимизации производительности (будут созданы после миграций Prisma)
-- Эти команды выполнятся только если таблицы уже существуют

-- Функция для создания индексов
CREATE OR REPLACE FUNCTION create_indexes_if_tables_exist()
RETURNS void AS $$
BEGIN
    -- Индексы для таблицы users
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'users') THEN
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_telegram_id ON users(telegram_id);
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_access_key_id ON users(access_key_id);
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_is_admin ON users(is_admin) WHERE is_admin = true;
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_is_active ON users(is_active);
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_created_at ON users(created_at);
    END IF;

    -- Индексы для таблицы access_keys
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'access_keys') THEN
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_access_keys_key ON access_keys(key);
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_access_keys_is_active ON access_keys(is_active);
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_access_keys_created_by ON access_keys(created_by);
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_access_keys_created_at ON access_keys(created_at);
    END IF;

    -- Индексы для таблицы messages
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'messages') THEN
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_user_id ON messages(user_id);
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_role ON messages(role);
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_created_at ON messages(created_at);
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_user_created ON messages(user_id, created_at);
    END IF;

    -- Индексы для таблицы usage
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'usage') THEN
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_usage_user_id ON usage(user_id);
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_usage_date ON usage(date);
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_usage_model ON usage(model);
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_usage_request_type ON usage(request_type);
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_usage_user_date ON usage(user_id, date);
    END IF;

    -- Индексы для таблицы settings
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'settings') THEN
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_settings_key ON settings(key);
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Настройки PostgreSQL для оптимизации производительности
ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements';
ALTER SYSTEM SET pg_stat_statements.track = 'all';
ALTER SYSTEM SET log_statement = 'mod';
ALTER SYSTEM SET log_min_duration_statement = 1000;
ALTER SYSTEM SET checkpoint_completion_target = 0.9;
ALTER SYSTEM SET wal_buffers = '16MB';
ALTER SYSTEM SET default_statistics_target = 100;

-- Создание функции для очистки старых данных
CREATE OR REPLACE FUNCTION cleanup_old_data()
RETURNS void AS $$
BEGIN
    -- Удаление сообщений старше 6 месяцев
    DELETE FROM messages 
    WHERE created_at < NOW() - INTERVAL '6 months';
    
    -- Удаление статистики использования старше 1 года
    DELETE FROM usage 
    WHERE date < NOW() - INTERVAL '1 year';
    
    -- Логирование очистки
    RAISE NOTICE 'Old data cleanup completed at %', NOW();
END;
$$ LANGUAGE plpgsql;

-- Создание функции для получения статистики
CREATE OR REPLACE FUNCTION get_bot_statistics()
RETURNS TABLE(
    total_users bigint,
    active_users_30d bigint,
    total_messages bigint,
    messages_today bigint,
    total_tokens bigint,
    total_cost numeric
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        (SELECT COUNT(*) FROM users WHERE is_active = true) as total_users,
        (SELECT COUNT(DISTINCT user_id) FROM messages WHERE created_at >= NOW() - INTERVAL '30 days') as active_users_30d,
        (SELECT COUNT(*) FROM messages) as total_messages,
        (SELECT COUNT(*) FROM messages WHERE created_at >= CURRENT_DATE) as messages_today,
        (SELECT COALESCE(SUM(tokens), 0) FROM usage) as total_tokens,
        (SELECT COALESCE(SUM(cost), 0) FROM usage) as total_cost;
END;
$$ LANGUAGE plpgsql;

-- Комментарии к функциям
COMMENT ON FUNCTION create_indexes_if_tables_exist() IS 'Создает индексы для оптимизации производительности если таблицы существуют';
COMMENT ON FUNCTION cleanup_old_data() IS 'Очищает старые данные для экономии места';
COMMENT ON FUNCTION get_bot_statistics() IS 'Возвращает общую статистику использования бота';
