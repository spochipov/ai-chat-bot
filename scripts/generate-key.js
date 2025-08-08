"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateAccessKey = generateAccessKey;
exports.createAccessKey = createAccessKey;
const crypto_1 = __importDefault(require("crypto"));
const database_1 = require("../src/services/database");
const logger_1 = require("../src/utils/logger");
function generateAccessKey() {
    const prefix = 'ACK';
    const randomBytes = crypto_1.default.randomBytes(16);
    const key = randomBytes.toString('hex').toUpperCase();
    return `${prefix}_${key}`;
}
async function createAccessKey(createdBy) {
    let attempts = 0;
    const maxAttempts = 5;
    while (attempts < maxAttempts) {
        const key = generateAccessKey();
        try {
            const existingKey = await database_1.DatabaseService.findAccessKeyByKey(key);
            if (!existingKey) {
                await database_1.DatabaseService.createAccessKey({
                    key,
                    createdBy,
                });
                logger_1.logger.info('Access key created successfully', { key, createdBy });
                return key;
            }
            attempts++;
            logger_1.logger.warn('Generated key already exists, retrying...', { key, attempt: attempts });
        }
        catch (error) {
            logger_1.logger.error('Error creating access key', error);
            throw error;
        }
    }
    throw new Error('Failed to generate unique access key after maximum attempts');
}
async function main() {
    try {
        await database_1.DatabaseService.initialize();
        const adminId = process.argv[2] || process.env.ADMIN_TELEGRAM_ID;
        if (!adminId) {
            console.error('Error: Admin ID is required');
            console.log('Usage: npm run generate-key <admin_telegram_id>');
            console.log('Or set ADMIN_TELEGRAM_ID environment variable');
            process.exit(1);
        }
        const accessKey = await createAccessKey(adminId);
        console.log('✅ Access key generated successfully!');
        console.log('🔑 Key:', accessKey);
        console.log('👤 Created by:', adminId);
        console.log('📅 Created at:', new Date().toISOString());
        console.log('');
        console.log('📋 Share this key with the user to grant them access to the bot.');
        console.log('⚠️  Keep this key secure and do not share it publicly.');
    }
    catch (error) {
        logger_1.logger.error('Failed to generate access key', error);
        console.error('❌ Error:', error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
    }
    finally {
        await database_1.DatabaseService.disconnect();
    }
}
if (require.main === module) {
    main().catch((error) => {
        console.error('❌ Unexpected error:', error);
        process.exit(1);
    });
}
//# sourceMappingURL=generate-key.js.map