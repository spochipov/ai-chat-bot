import crypto from 'crypto';
import { DatabaseService } from '../src/services/database';
import { logger } from '../src/utils/logger';

// Функция для генерации уникального ключа доступа
function generateAccessKey(): string {
  const prefix = 'ACK';
  const randomBytes = crypto.randomBytes(16);
  const key = randomBytes.toString('hex').toUpperCase();
  return `${prefix}_${key}`;
}

// Функция для создания ключа доступа в базе данных
async function createAccessKey(createdBy: string): Promise<string> {
  let attempts = 0;
  const maxAttempts = 5;

  while (attempts < maxAttempts) {
    const key = generateAccessKey();
    
    try {
      // Проверяем, что ключ уникален
      const existingKey = await DatabaseService.findAccessKeyByKey(key);
      
      if (!existingKey) {
        // Создаем новый ключ
        await DatabaseService.createAccessKey({
          key,
          createdBy,
        });
        
        logger.info('Access key created successfully', { key, createdBy });
        return key;
      }
      
      attempts++;
      logger.warn('Generated key already exists, retrying...', { key, attempt: attempts });
    } catch (error) {
      logger.error('Error creating access key', error);
      throw error;
    }
  }
  
  throw new Error('Failed to generate unique access key after maximum attempts');
}

// Основная функция для CLI
async function main() {
  try {
    // Инициализация базы данных
    await DatabaseService.initialize();
    
    // Получаем ID администратора из аргументов командной строки или переменной окружения
    const adminId = process.argv[2] || process.env.ADMIN_TELEGRAM_ID;
    
    if (!adminId) {
      console.error('Error: Admin ID is required');
      console.log('Usage: npm run generate-key <admin_telegram_id>');
      console.log('Or set ADMIN_TELEGRAM_ID environment variable');
      process.exit(1);
    }
    
    // Генерируем ключ
    const accessKey = await createAccessKey(adminId);
    
    console.log('✅ Access key generated successfully!');
    console.log('🔑 Key:', accessKey);
    console.log('👤 Created by:', adminId);
    console.log('📅 Created at:', new Date().toISOString());
    console.log('');
    console.log('📋 Share this key with the user to grant them access to the bot.');
    console.log('⚠️  Keep this key secure and do not share it publicly.');
    
  } catch (error) {
    logger.error('Failed to generate access key', error);
    console.error('❌ Error:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  } finally {
    // Закрываем соединение с базой данных
    await DatabaseService.disconnect();
  }
}

// Запуск скрипта только если он вызван напрямую
if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  });
}

export { generateAccessKey, createAccessKey };
