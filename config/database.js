const config = {
  development: {
    MONGO_URI: process.env.MONGO_URI_DEV || process.env.MONGO_URI,
    REDIS_URL: process.env.REDIS_URL_DEV || 'redis://localhost:6379',
    REDIS_ENABLED: process.env.REDIS_ENABLED_DEV || process.env.REDIS_ENABLED || 'true',
    JWT_SECRET: process.env.JWT_SECRET_DEV || process.env.JWT_SECRET,
    JWT_SECRET_PREVIOUS: process.env.JWT_SECRET_PREVIOUS_DEV || process.env.JWT_SECRET_PREVIOUS || '',
    JWT_EXPIRE: process.env.JWT_EXPIRE_DEV || process.env.JWT_EXPIRE || '7d',
    PORT: process.env.PORT_DEV || 5000,
    LOG_REQUESTS: process.env.LOG_REQUESTS_DEV || 'true',
    ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS_DEV || 'http://localhost:3000,http://localhost:3001',
    HEALTH_MONITOR_INTERVAL_MS: process.env.HEALTH_MONITOR_INTERVAL_MS || 0,
    MONITOR_REPEAT_ALERTS: process.env.MONITOR_REPEAT_ALERTS || 'false',
    MONITOR_REPEAT_ALERT_MS: process.env.MONITOR_REPEAT_ALERT_MS || 900000,
    CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME_DEV || process.env.CLOUDINARY_CLOUD_NAME,
    CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY_DEV || process.env.CLOUDINARY_API_KEY,
    CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET_DEV || process.env.CLOUDINARY_API_SECRET,
    APP_NAME: process.env.APP_NAME_DEV || process.env.APP_NAME || 'DRY API',
    FRONTEND_URL: process.env.FRONTEND_URL_DEV || process.env.FRONTEND_URL || 'http://localhost:4200',
    EMAIL_FROM: process.env.EMAIL_FROM_DEV || process.env.EMAIL_FROM || process.env.FROM_EMAIL || 'onboarding@resend.dev',
    SEND_WELCOME_EMAIL_ON_REGISTER: process.env.SEND_WELCOME_EMAIL_ON_REGISTER_DEV || process.env.SEND_WELCOME_EMAIL_ON_REGISTER || 'true',
    EMAIL_PROVIDER: process.env.EMAIL_PROVIDER_DEV || process.env.EMAIL_PROVIDER || 'auto',
    ALERT_WEBHOOK_URL: process.env.ALERT_WEBHOOK_URL_DEV || process.env.ALERT_WEBHOOK_URL || '',
    SLACK_WEBHOOK_URL: process.env.SLACK_WEBHOOK_URL_DEV || process.env.SLACK_WEBHOOK_URL || '',
    DISCORD_WEBHOOK_URL: process.env.DISCORD_WEBHOOK_URL_DEV || process.env.DISCORD_WEBHOOK_URL || '',
    ALERT_EMAIL_TO: process.env.ALERT_EMAIL_TO_DEV || process.env.ALERT_EMAIL_TO || '',
    ALERT_API_ERRORS: process.env.ALERT_API_ERRORS_DEV || process.env.ALERT_API_ERRORS || 'true',
    ALERT_API_CLIENT_ERRORS: process.env.ALERT_API_CLIENT_ERRORS_DEV || process.env.ALERT_API_CLIENT_ERRORS || 'false',
    ALERT_DEDUP_WINDOW_MS: process.env.ALERT_DEDUP_WINDOW_MS_DEV || process.env.ALERT_DEDUP_WINDOW_MS || 60000,
    ALERT_MAX_STACK_LINES: process.env.ALERT_MAX_STACK_LINES_DEV || process.env.ALERT_MAX_STACK_LINES || 20,
    ALERT_MAX_VALUE_LENGTH: process.env.ALERT_MAX_VALUE_LENGTH_DEV || process.env.ALERT_MAX_VALUE_LENGTH || 1500,
    CRASH_ON_UNHANDLED_REJECTION: process.env.CRASH_ON_UNHANDLED_REJECTION_DEV || process.env.CRASH_ON_UNHANDLED_REJECTION || 'false',
    FATAL_ERROR_EXIT_DELAY_MS: process.env.FATAL_ERROR_EXIT_DELAY_MS_DEV || process.env.FATAL_ERROR_EXIT_DELAY_MS || 3500,
    EMAIL_HOST: process.env.EMAIL_HOST_DEV || process.env.EMAIL_HOST || 'smtp.gmail.com',
    EMAIL_PORT: process.env.EMAIL_PORT_DEV || process.env.EMAIL_PORT || 587,
    EMAIL_SECURE: process.env.EMAIL_SECURE_DEV || process.env.EMAIL_SECURE || 'false',
    VIEW_IP_SALT: process.env.VIEW_IP_SALT_DEV || process.env.VIEW_IP_SALT || 'dry',
    EMAIL_USER: process.env.EMAIL_USER_DEV || process.env.EMAIL_USER,
    EMAIL_PASS: process.env.EMAIL_PASS_DEV || process.env.EMAIL_PASS,
    RESEND_API_KEY: process.env.RESEND_API_KEY_DEV || process.env.RESEND_API_KEY,
    MAX_LOGIN_ATTEMPTS: process.env.MAX_LOGIN_ATTEMPTS_DEV || process.env.MAX_LOGIN_ATTEMPTS || 5,
    LOCK_TIME: process.env.LOCK_TIME_DEV || process.env.LOCK_TIME || 2,
    PURGE_ENABLED: process.env.PURGE_ENABLED_DEV || process.env.PURGE_ENABLED || 'true',
    PURGE_AFTER_DAYS: process.env.PURGE_AFTER_DAYS_DEV || process.env.PURGE_AFTER_DAYS || '14',
    PURGE_CRON: process.env.PURGE_CRON_DEV || process.env.PURGE_CRON || '0 3 * * *',
    YT_COOKIE: process.env.YT_COOKIE_DEV || process.env.YT_COOKIE || '',
    YT_USER_AGENT: process.env.YT_USER_AGENT_DEV || process.env.YT_USER_AGENT || '',
    APP_VERSION: process.env.npm_package_version || '1.0.0',
    MEDIA_FILE_TTL_MINUTES: process.env.MEDIA_FILE_TTL_MINUTES_DEV || process.env.MEDIA_FILE_TTL_MINUTES || '5',
    ADMIN_BROADCAST_LIMIT: process.env.ADMIN_BROADCAST_LIMIT_DEV || process.env.ADMIN_BROADCAST_LIMIT || '200',
    SCIM_TZ_OFFSET_MINUTES: process.env.SCIM_TZ_OFFSET_MINUTES_DEV || process.env.SCIM_TZ_OFFSET_MINUTES || '60',
    SCIM_CONTACT_EMAIL: process.env.SCIM_CONTACT_EMAIL_DEV || process.env.SCIM_CONTACT_EMAIL || 'scim@example.com',
    SCIM_WHATSAPP_PHONE: process.env.SCIM_WHATSAPP_PHONE_DEV || process.env.SCIM_WHATSAPP_PHONE || '',
    SCIM_RESERVATION_SLA_MINUTES: process.env.SCIM_RESERVATION_SLA_MINUTES_DEV || process.env.SCIM_RESERVATION_SLA_MINUTES || '30',
    SCIM_RESERVATION_REMINDER_MINUTES: process.env.SCIM_RESERVATION_REMINDER_MINUTES_DEV || process.env.SCIM_RESERVATION_REMINDER_MINUTES || '30',
    SCIM_REMINDER_ENABLED: process.env.SCIM_REMINDER_ENABLED_DEV || process.env.SCIM_REMINDER_ENABLED || 'true',
    SCIM_REMINDER_CRON: process.env.SCIM_REMINDER_CRON_DEV || process.env.SCIM_REMINDER_CRON || '*/1 * * * *',
    SCIM_REMINDER_BATCH_SIZE: process.env.SCIM_REMINDER_BATCH_SIZE_DEV || process.env.SCIM_REMINDER_BATCH_SIZE || '50',
    SCIM_ENABLE_EMAIL_NOTIFICATIONS: process.env.SCIM_ENABLE_EMAIL_NOTIFICATIONS_DEV || process.env.SCIM_ENABLE_EMAIL_NOTIFICATIONS || 'false',
    SCIM_ENABLE_SMS_NOTIFICATIONS: process.env.SCIM_ENABLE_SMS_NOTIFICATIONS_DEV || process.env.SCIM_ENABLE_SMS_NOTIFICATIONS || 'false',
    SCIM_ENABLE_WHATSAPP_NOTIFICATIONS: process.env.SCIM_ENABLE_WHATSAPP_NOTIFICATIONS_DEV || process.env.SCIM_ENABLE_WHATSAPP_NOTIFICATIONS || 'false',
    SCIM_DEFAULT_COUNTRY_CODE: process.env.SCIM_DEFAULT_COUNTRY_CODE_DEV || process.env.SCIM_DEFAULT_COUNTRY_CODE || '+242',
    SCIM_TWILIO_ACCOUNT_SID: process.env.SCIM_TWILIO_ACCOUNT_SID_DEV || process.env.SCIM_TWILIO_ACCOUNT_SID || '',
    SCIM_TWILIO_AUTH_TOKEN: process.env.SCIM_TWILIO_AUTH_TOKEN_DEV || process.env.SCIM_TWILIO_AUTH_TOKEN || '',
    SCIM_TWILIO_SMS_FROM: process.env.SCIM_TWILIO_SMS_FROM_DEV || process.env.SCIM_TWILIO_SMS_FROM || '',
    SCIM_TWILIO_WHATSAPP_FROM: process.env.SCIM_TWILIO_WHATSAPP_FROM_DEV || process.env.SCIM_TWILIO_WHATSAPP_FROM || '',
    FFMPEG_PATH: process.env.FFMPEG_PATH_DEV || process.env.FFMPEG_PATH || '',
    YTDL_NO_UPDATE: process.env.YTDL_NO_UPDATE_DEV || process.env.YTDL_NO_UPDATE || '',
    MEDIA_DIR: process.env.MEDIA_DIR_DEV || process.env.MEDIA_DIR || 'downloads',
    MEDIA_VERBOSE: process.env.MEDIA_VERBOSE_DEV || process.env.MEDIA_VERBOSE || 'false',
  },
  
  production: {
    MONGO_URI: process.env.MONGO_URI,
    REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
    REDIS_ENABLED: process.env.REDIS_ENABLED || 'true',
    JWT_SECRET: process.env.JWT_SECRET,
    JWT_SECRET_PREVIOUS: process.env.JWT_SECRET_PREVIOUS || '',
    JWT_EXPIRE: process.env.JWT_EXPIRE || '7d',
    PORT: process.env.PORT || 5000,
    LOG_REQUESTS: process.env.LOG_REQUESTS || 'false',
    ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS || '*',
    HEALTH_MONITOR_INTERVAL_MS: process.env.HEALTH_MONITOR_INTERVAL_MS || 0,
    MONITOR_REPEAT_ALERTS: process.env.MONITOR_REPEAT_ALERTS || 'false',
    MONITOR_REPEAT_ALERT_MS: process.env.MONITOR_REPEAT_ALERT_MS || 900000,
    CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
    CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
    CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
    APP_NAME: process.env.APP_NAME || 'DRY API',
    FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:4200',
    EMAIL_FROM: process.env.EMAIL_FROM || process.env.FROM_EMAIL || 'onboarding@resend.dev',
    SEND_WELCOME_EMAIL_ON_REGISTER: process.env.SEND_WELCOME_EMAIL_ON_REGISTER || 'true',
    EMAIL_PROVIDER: process.env.EMAIL_PROVIDER || 'auto',
    ALERT_WEBHOOK_URL: process.env.ALERT_WEBHOOK_URL || '',
    SLACK_WEBHOOK_URL: process.env.SLACK_WEBHOOK_URL || '',
    DISCORD_WEBHOOK_URL: process.env.DISCORD_WEBHOOK_URL || '',
    ALERT_EMAIL_TO: process.env.ALERT_EMAIL_TO || '',
    ALERT_API_ERRORS: process.env.ALERT_API_ERRORS || 'true',
    ALERT_API_CLIENT_ERRORS: process.env.ALERT_API_CLIENT_ERRORS || 'false',
    ALERT_DEDUP_WINDOW_MS: process.env.ALERT_DEDUP_WINDOW_MS || 60000,
    ALERT_MAX_STACK_LINES: process.env.ALERT_MAX_STACK_LINES || 20,
    ALERT_MAX_VALUE_LENGTH: process.env.ALERT_MAX_VALUE_LENGTH || 1500,
    CRASH_ON_UNHANDLED_REJECTION: process.env.CRASH_ON_UNHANDLED_REJECTION || 'false',
    FATAL_ERROR_EXIT_DELAY_MS: process.env.FATAL_ERROR_EXIT_DELAY_MS || 3500,
    EMAIL_HOST: process.env.EMAIL_HOST || 'smtp.gmail.com',
    EMAIL_PORT: process.env.EMAIL_PORT || 587,
    EMAIL_SECURE: process.env.EMAIL_SECURE || 'false',
    VIEW_IP_SALT: process.env.VIEW_IP_SALT || 'dry',
    EMAIL_USER: process.env.EMAIL_USER,
    EMAIL_PASS: process.env.EMAIL_PASS,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    MAX_LOGIN_ATTEMPTS: process.env.MAX_LOGIN_ATTEMPTS || 5,
    LOCK_TIME: process.env.LOCK_TIME || 2,
    PURGE_ENABLED: process.env.PURGE_ENABLED || 'true',
    PURGE_AFTER_DAYS: process.env.PURGE_AFTER_DAYS || '14',
    PURGE_CRON: process.env.PURGE_CRON || '0 3 * * *',
    YT_COOKIE: process.env.YT_COOKIE || '',
    YT_USER_AGENT: process.env.YT_USER_AGENT || '',
    APP_VERSION: process.env.npm_package_version || '1.0.0',
    MEDIA_FILE_TTL_MINUTES: process.env.MEDIA_FILE_TTL_MINUTES || '5',
    ADMIN_BROADCAST_LIMIT: process.env.ADMIN_BROADCAST_LIMIT || '200',
    SCIM_TZ_OFFSET_MINUTES: process.env.SCIM_TZ_OFFSET_MINUTES || '60',
    SCIM_CONTACT_EMAIL: process.env.SCIM_CONTACT_EMAIL || 'scim@example.com',
    SCIM_WHATSAPP_PHONE: process.env.SCIM_WHATSAPP_PHONE || '',
    SCIM_RESERVATION_SLA_MINUTES: process.env.SCIM_RESERVATION_SLA_MINUTES || '30',
    SCIM_RESERVATION_REMINDER_MINUTES: process.env.SCIM_RESERVATION_REMINDER_MINUTES || '30',
    SCIM_REMINDER_ENABLED: process.env.SCIM_REMINDER_ENABLED || 'true',
    SCIM_REMINDER_CRON: process.env.SCIM_REMINDER_CRON || '*/1 * * * *',
    SCIM_REMINDER_BATCH_SIZE: process.env.SCIM_REMINDER_BATCH_SIZE || '50',
    SCIM_ENABLE_EMAIL_NOTIFICATIONS: process.env.SCIM_ENABLE_EMAIL_NOTIFICATIONS || 'true',
    SCIM_ENABLE_SMS_NOTIFICATIONS: process.env.SCIM_ENABLE_SMS_NOTIFICATIONS || 'false',
    SCIM_ENABLE_WHATSAPP_NOTIFICATIONS: process.env.SCIM_ENABLE_WHATSAPP_NOTIFICATIONS || 'false',
    SCIM_DEFAULT_COUNTRY_CODE: process.env.SCIM_DEFAULT_COUNTRY_CODE || '+242',
    SCIM_TWILIO_ACCOUNT_SID: process.env.SCIM_TWILIO_ACCOUNT_SID || '',
    SCIM_TWILIO_AUTH_TOKEN: process.env.SCIM_TWILIO_AUTH_TOKEN || '',
    SCIM_TWILIO_SMS_FROM: process.env.SCIM_TWILIO_SMS_FROM || '',
    SCIM_TWILIO_WHATSAPP_FROM: process.env.SCIM_TWILIO_WHATSAPP_FROM || '',
    FFMPEG_PATH: process.env.FFMPEG_PATH || '',
    YTDL_NO_UPDATE: process.env.YTDL_NO_UPDATE || '',
    MEDIA_DIR: process.env.MEDIA_DIR || 'downloads',
    MEDIA_VERBOSE: process.env.MEDIA_VERBOSE || 'false',
  },
  
  test: {
    MONGO_URI: process.env.MONGO_URI_TEST || 'mongodb://localhost:27017/dryapi_test',
    REDIS_URL: process.env.REDIS_URL_TEST || 'redis://localhost:6379/1',
    REDIS_ENABLED: process.env.REDIS_ENABLED_TEST || 'true',
    JWT_SECRET: process.env.JWT_SECRET_TEST || 'test_secret_key',
    JWT_SECRET_PREVIOUS: process.env.JWT_SECRET_PREVIOUS_TEST || '',
    JWT_EXPIRE: process.env.JWT_EXPIRE_TEST || '1h',
    PORT: process.env.PORT_TEST || 5001,
    LOG_REQUESTS: process.env.LOG_REQUESTS_TEST || 'false',
    ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS_TEST || 'http://localhost:3000',
    HEALTH_MONITOR_INTERVAL_MS: 0,
    MONITOR_REPEAT_ALERTS: 'false',
    MONITOR_REPEAT_ALERT_MS: 900000,
    CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME_TEST || 'test_cloud_name',
    CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY_TEST || 'test_api_key',
    CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET_TEST || 'test_api_secret',
    APP_NAME: 'DRY API Test',
    FRONTEND_URL: 'http://localhost:4200',
    EMAIL_FROM: 'test@example.com',
    SEND_WELCOME_EMAIL_ON_REGISTER: process.env.SEND_WELCOME_EMAIL_ON_REGISTER_TEST || process.env.SEND_WELCOME_EMAIL_ON_REGISTER || 'false',
    EMAIL_PROVIDER: process.env.EMAIL_PROVIDER_TEST || process.env.EMAIL_PROVIDER || 'mock',
    ALERT_WEBHOOK_URL: process.env.ALERT_WEBHOOK_URL_TEST || process.env.ALERT_WEBHOOK_URL || '',
    SLACK_WEBHOOK_URL: process.env.SLACK_WEBHOOK_URL_TEST || process.env.SLACK_WEBHOOK_URL || '',
    DISCORD_WEBHOOK_URL: process.env.DISCORD_WEBHOOK_URL_TEST || process.env.DISCORD_WEBHOOK_URL || '',
    ALERT_EMAIL_TO: process.env.ALERT_EMAIL_TO_TEST || process.env.ALERT_EMAIL_TO || '',
    ALERT_API_ERRORS: process.env.ALERT_API_ERRORS_TEST || process.env.ALERT_API_ERRORS || 'true',
    ALERT_API_CLIENT_ERRORS: process.env.ALERT_API_CLIENT_ERRORS_TEST || process.env.ALERT_API_CLIENT_ERRORS || 'false',
    ALERT_DEDUP_WINDOW_MS: process.env.ALERT_DEDUP_WINDOW_MS_TEST || process.env.ALERT_DEDUP_WINDOW_MS || 60000,
    ALERT_MAX_STACK_LINES: process.env.ALERT_MAX_STACK_LINES_TEST || process.env.ALERT_MAX_STACK_LINES || 20,
    ALERT_MAX_VALUE_LENGTH: process.env.ALERT_MAX_VALUE_LENGTH_TEST || process.env.ALERT_MAX_VALUE_LENGTH || 1500,
    CRASH_ON_UNHANDLED_REJECTION: process.env.CRASH_ON_UNHANDLED_REJECTION_TEST || process.env.CRASH_ON_UNHANDLED_REJECTION || 'false',
    FATAL_ERROR_EXIT_DELAY_MS: process.env.FATAL_ERROR_EXIT_DELAY_MS_TEST || process.env.FATAL_ERROR_EXIT_DELAY_MS || 3500,
    EMAIL_HOST: process.env.EMAIL_HOST_TEST || process.env.EMAIL_HOST || 'localhost',
    EMAIL_PORT: process.env.EMAIL_PORT_TEST || 1025,
    EMAIL_SECURE: process.env.EMAIL_SECURE_TEST || 'false',
    VIEW_IP_SALT: process.env.VIEW_IP_SALT_TEST || process.env.VIEW_IP_SALT || 'dry',
    EMAIL_USER: process.env.EMAIL_USER_TEST || 'test',
    EMAIL_PASS: process.env.EMAIL_PASS_TEST || 'test',
    RESEND_API_KEY: process.env.RESEND_API_KEY_TEST || 'test_key',
    MAX_LOGIN_ATTEMPTS: 5,
    LOCK_TIME: 2,
    PURGE_ENABLED: process.env.PURGE_ENABLED_TEST || 'false',
    PURGE_AFTER_DAYS: process.env.PURGE_AFTER_DAYS_TEST || '1',
    PURGE_CRON: process.env.PURGE_CRON_TEST || '0 0 * * *',
    YT_COOKIE: process.env.YT_COOKIE_TEST || '',
    YT_USER_AGENT: process.env.YT_USER_AGENT_TEST || '',
    APP_VERSION: process.env.npm_package_version || '1.0.0',
    MEDIA_FILE_TTL_MINUTES: process.env.MEDIA_FILE_TTL_MINUTES_TEST || '5',
    ADMIN_BROADCAST_LIMIT: process.env.ADMIN_BROADCAST_LIMIT_TEST || '200',
    SCIM_TZ_OFFSET_MINUTES: process.env.SCIM_TZ_OFFSET_MINUTES_TEST || '60',
    SCIM_CONTACT_EMAIL: process.env.SCIM_CONTACT_EMAIL_TEST || 'scim@example.com',
    SCIM_WHATSAPP_PHONE: process.env.SCIM_WHATSAPP_PHONE_TEST || '',
    SCIM_RESERVATION_SLA_MINUTES: process.env.SCIM_RESERVATION_SLA_MINUTES_TEST || '30',
    SCIM_RESERVATION_REMINDER_MINUTES: process.env.SCIM_RESERVATION_REMINDER_MINUTES_TEST || '10',
    SCIM_REMINDER_ENABLED: process.env.SCIM_REMINDER_ENABLED_TEST || 'false',
    SCIM_REMINDER_CRON: process.env.SCIM_REMINDER_CRON_TEST || '*/1 * * * *',
    SCIM_REMINDER_BATCH_SIZE: process.env.SCIM_REMINDER_BATCH_SIZE_TEST || '20',
    SCIM_ENABLE_EMAIL_NOTIFICATIONS: process.env.SCIM_ENABLE_EMAIL_NOTIFICATIONS_TEST || 'false',
    SCIM_ENABLE_SMS_NOTIFICATIONS: process.env.SCIM_ENABLE_SMS_NOTIFICATIONS_TEST || 'false',
    SCIM_ENABLE_WHATSAPP_NOTIFICATIONS: process.env.SCIM_ENABLE_WHATSAPP_NOTIFICATIONS_TEST || 'false',
    SCIM_DEFAULT_COUNTRY_CODE: process.env.SCIM_DEFAULT_COUNTRY_CODE_TEST || '+242',
    SCIM_TWILIO_ACCOUNT_SID: process.env.SCIM_TWILIO_ACCOUNT_SID_TEST || '',
    SCIM_TWILIO_AUTH_TOKEN: process.env.SCIM_TWILIO_AUTH_TOKEN_TEST || '',
    SCIM_TWILIO_SMS_FROM: process.env.SCIM_TWILIO_SMS_FROM_TEST || '',
    SCIM_TWILIO_WHATSAPP_FROM: process.env.SCIM_TWILIO_WHATSAPP_FROM_TEST || '',
    FFMPEG_PATH: process.env.FFMPEG_PATH_TEST || '',
    YTDL_NO_UPDATE: process.env.YTDL_NO_UPDATE_TEST || '',
    MEDIA_DIR: process.env.MEDIA_DIR_TEST || 'downloads',
    MEDIA_VERBOSE: process.env.MEDIA_VERBOSE_TEST || 'false',
  }
};

const env = process.env.NODE_ENV || 'development';

// Validation des variables requises
const requiredVars = ['MONGO_URI', 'JWT_SECRET'];
const currentConfig = config[env];

requiredVars.forEach(varName => {
  if (!currentConfig[varName]) {
    throw new Error(`Variable d'environnement requise manquante: ${varName}`);
  }
});

const parsePositiveInt = (value, fallback) => {
  const n = Number.parseInt(String(value ?? ''), 10);
  if (Number.isNaN(n) || n <= 0) return fallback;
  return n;
};

const parseBoolean = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
};

// Fusionner avec les variables d'environnement actuelles
const finalConfig = {
  ...currentConfig,
  NODE_ENV: env,
  
  // Configuration supplÃ©mentaire
  CORS: {
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'CSRF-Token']
  },
  
  RATE_LIMIT: {
    windowMs: parsePositiveInt(process.env.RATE_LIMIT_WINDOW_MS, 10 * 60 * 1000), // 10 minutes
    max: parsePositiveInt(process.env.RATE_LIMIT_MAX, env === 'production' ? 100 : 1000),
    authMultiplier: parsePositiveInt(process.env.RATE_LIMIT_AUTH_MULTIPLIER, env === 'production' ? 20 : 30),
    adminMultiplier: parsePositiveInt(process.env.RATE_LIMIT_ADMIN_MULTIPLIER, env === 'production' ? 100 : 150),
    skipAuthenticated: parseBoolean(process.env.RATE_LIMIT_SKIP_AUTHENTICATED, env !== 'production'),
    skipAdmin: parseBoolean(process.env.RATE_LIMIT_SKIP_ADMIN, false),
    message: { success: false, message: 'Trop de requêtes, veuillez réessayer plus tard.' }
  },
  
  UPLOAD: {
    maxFileSize: 5 * 1024 * 1024, // 5MB
    allowedImageTypes: ['image/jpeg', 'image/png', 'image/webp'],
    allowedVideoTypes: ['video/mp4', 'video/webm']
  },
  
  CACHE: {
    defaultDuration: env === 'production' ? 600 : 300, // 10min en prod, 5min en dev
    userCacheDuration: 1800, // 30 minutes
    staticCacheDuration: 3600 // 1 heure
  }
};

module.exports = finalConfig;

