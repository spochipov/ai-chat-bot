import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  try {
    // Создание начальных настроек
    const settings = [
      {
        key: 'bot_version',
        value: '1.0.0',
        description: 'Current version of the bot',
      },
      {
        key: 'max_context_messages',
        value: '20',
        description: 'Maximum number of messages to keep in context',
      },
      {
        key: 'default_model',
        value: 'openai/gpt-4',
        description: 'Default AI model to use',
      },
      {
        key: 'max_file_size',
        value: '20971520',
        description: 'Maximum file size in bytes (20MB)',
      },
      {
        key: 'allowed_file_types',
        value: 'txt,pdf,docx,jpg,jpeg,png,gif,webp',
        description: 'Allowed file types for upload',
      },
    ];

    for (const setting of settings) {
      await prisma.settings.upsert({
        where: { key: setting.key },
        update: { value: setting.value, description: setting.description },
        create: setting,
      });
      console.log(`✅ Setting created/updated: ${setting.key}`);
    }

    // Создание первого администратора (если указан ADMIN_TELEGRAM_ID)
    const adminTelegramId = process.env['ADMIN_TELEGRAM_ID'];
    
    if (adminTelegramId) {
      const adminTelegramIdBigInt = BigInt(adminTelegramId);
      
      // Проверяем, существует ли уже администратор
      const existingAdmin = await prisma.user.findUnique({
        where: { telegramId: adminTelegramIdBigInt },
      });

      if (!existingAdmin) {
        // Генерируем ключ доступа для админа
        const adminKey = `ACK_${crypto.randomBytes(16).toString('hex').toUpperCase()}`;
        
        // Создаем ключ доступа
        const accessKey = await prisma.accessKey.create({
          data: {
            key: adminKey,
            createdBy: adminTelegramId,
            isActive: true,
          },
        });
        
        // Создаем пользователя-администратора
        await prisma.user.create({
          data: {
            telegramId: adminTelegramIdBigInt,
            username: 'admin',
            firstName: 'Administrator',
            isAdmin: true,
            isActive: true,
            accessKeyId: accessKey.id,
          },
        });
        
        console.log('👑 Admin user created successfully:');
        console.log(`   Telegram ID: ${adminTelegramId}`);
        console.log(`   Access Key: ${adminKey}`);
        console.log(`   Status: Administrator`);
        console.log('   ✅ You can now use the bot as admin!');
      } else {
        console.log('ℹ️  Admin user already exists');
        console.log(`   Telegram ID: ${adminTelegramId}`);
        console.log(`   Status: ${existingAdmin.isAdmin ? 'Administrator' : 'Regular User'}`);
        
        // Если пользователь существует, но не админ, делаем его админом
        if (!existingAdmin.isAdmin) {
          await prisma.user.update({
            where: { id: existingAdmin.id },
            data: { isAdmin: true },
          });
          console.log('   ✅ User promoted to administrator!');
        }
      }
    } else {
      console.log('⚠️  ADMIN_TELEGRAM_ID not set, skipping admin creation');
      console.log('   Set ADMIN_TELEGRAM_ID environment variable and run: npm run seed');
      console.log('   Or create an admin key using: npm run generate-key <admin_id>');
    }

    console.log('🎉 Database seeding completed successfully!');
  } catch (error) {
    console.error('❌ Error during seeding:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
