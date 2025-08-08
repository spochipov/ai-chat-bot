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

    // Создание первого ключа доступа для администратора (если указан ADMIN_TELEGRAM_ID)
    const adminTelegramId = process.env.ADMIN_TELEGRAM_ID;
    
    if (adminTelegramId) {
      // Генерируем ключ доступа для админа
      const adminKey = `ACK_${crypto.randomBytes(16).toString('hex').toUpperCase()}`;
      
      const existingAdminKey = await prisma.accessKey.findFirst({
        where: { createdBy: adminTelegramId },
      });

      if (!existingAdminKey) {
        await prisma.accessKey.create({
          data: {
            key: adminKey,
            createdBy: adminTelegramId,
            isActive: true,
          },
        });
        
        console.log('🔑 Admin access key created:');
        console.log(`   Key: ${adminKey}`);
        console.log(`   Admin ID: ${adminTelegramId}`);
        console.log('   ⚠️  Save this key securely!');
      } else {
        console.log('ℹ️  Admin access key already exists');
      }
    } else {
      console.log('⚠️  ADMIN_TELEGRAM_ID not set, skipping admin key creation');
      console.log('   You can create an admin key later using: npm run generate-key <admin_id>');
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
