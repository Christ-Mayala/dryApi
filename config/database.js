const env = process.env.NODE_ENV || 'development';

const parsePositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (Number.isNaN(parsed) || parsed <= 0) return fallback;
  return parsed;
};

const parseBoolean = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
};

const readSetting = (name, options = {}) => {
  const { fallback = '', testFallback = fallback } = options;
  const envKey = env === 'development' ? `${name}_DEV` : env === 'test' ? `${name}_TEST` : name;

  if (process.env[envKey] !== undefined) return process.env[envKey];
  if (env !== 'production' && process.env[name] !== undefined) return process.env[name];
  if (env === 'test') return testFallback;
  return fallback;
};

const buildBaseConfig = () => ({
  NODE_ENV: env,
  APP_NAME: readSetting('APP_NAME', { fallback: 'DRY API', testFallback: 'DRY API Test' }),
  APP_VERSION: process.env.npm_package_version || '1.0.0',
  PORT: parsePositiveInt(
    readSetting('PORT', { fallback: '5000', testFallback: '5001' }),
    env === 'test' ? 5001 : 5000
  ),
  FRONTEND_URL: readSetting('FRONTEND_URL', { fallback: 'http://localhost:4200' }),
  SERVER_URL: readSetting('SERVER_URL', {
    fallback: 'http://localhost:5000',
    testFallback: 'http://localhost:5001',
  }),
  MONGO_URI: readSetting('MONGO_URI', { testFallback: 'mongodb://127.0.0.1:27017/dryapi_test' }),
  MONGO_DB_PREFIX: readSetting('MONGO_DB_PREFIX'),
  REDIS_URL: readSetting('REDIS_URL', {
    fallback: 'redis://localhost:6379',
    testFallback: 'redis://localhost:6379/1',
  }),
  REDIS_ENABLED: readSetting('REDIS_ENABLED', { fallback: 'false', testFallback: 'false' }),
  JWT_SECRET: readSetting('JWT_SECRET', {
    testFallback: 'test_secret_key_that_is_long_enough_for_ci',
  }),
  JWT_SECRET_PREVIOUS: readSetting('JWT_SECRET_PREVIOUS'),
  JWT_EXPIRE: readSetting('JWT_EXPIRE', { fallback: '7d', testFallback: '1h' }),
  SESSION_SECRET: readSetting('SESSION_SECRET', {
    testFallback: 'test_session_secret_that_is_long_enough_for_ci',
  }),
  LOG_REQUESTS: readSetting('LOG_REQUESTS', {
    fallback: env === 'development' ? 'true' : 'false',
    testFallback: 'false',
  }),
  ALLOWED_ORIGINS: readSetting('ALLOWED_ORIGINS', {
    fallback: 'http://localhost:3000,http://localhost:4200,http://localhost:5000',
  }),
  CORS_ORIGINS: readSetting('CORS_ORIGINS', {
    fallback: 'http://localhost:3000,http://localhost:4200,http://localhost:5000',
  }),
  MAX_LOGIN_ATTEMPTS: readSetting('MAX_LOGIN_ATTEMPTS', { fallback: '5' }),
  LOCK_TIME: readSetting('LOCK_TIME', { fallback: '2' }),
  RATE_LIMIT_WINDOW_MS: readSetting('RATE_LIMIT_WINDOW_MS', { fallback: '600000' }),
  RATE_LIMIT_MAX: readSetting('RATE_LIMIT_MAX', {
    fallback: env === 'production' ? '100' : '1000',
  }),
  RATE_LIMIT_AUTH_MULTIPLIER: readSetting('RATE_LIMIT_AUTH_MULTIPLIER', {
    fallback: env === 'production' ? '20' : '30',
  }),
  RATE_LIMIT_ADMIN_MULTIPLIER: readSetting('RATE_LIMIT_ADMIN_MULTIPLIER', {
    fallback: env === 'production' ? '100' : '150',
  }),
  RATE_LIMIT_SKIP_AUTHENTICATED: readSetting('RATE_LIMIT_SKIP_AUTHENTICATED', {
    fallback: env !== 'production' ? 'true' : 'false',
  }),
  RATE_LIMIT_SKIP_ADMIN: readSetting('RATE_LIMIT_SKIP_ADMIN', { fallback: 'false' }),
  EMAIL_PROVIDER: readSetting('EMAIL_PROVIDER', { fallback: env === 'test' ? 'mock' : 'auto' }),
  EMAIL_HOST: readSetting('EMAIL_HOST', {
    fallback: env === 'test' ? 'localhost' : 'smtp.gmail.com',
  }),
  EMAIL_PORT: readSetting('EMAIL_PORT', { fallback: env === 'test' ? '1025' : '587' }),
  EMAIL_SECURE: readSetting('EMAIL_SECURE', { fallback: 'false' }),
  EMAIL_USER: readSetting('EMAIL_USER', { testFallback: 'test-user' }),
  EMAIL_PASS: readSetting('EMAIL_PASS', { testFallback: 'test-pass' }),
  EMAIL_FROM: readSetting('EMAIL_FROM', {
    fallback: process.env.FROM_EMAIL || 'noreply@example.com',
    testFallback: 'test@example.com',
  }),
  SEND_WELCOME_EMAIL_ON_REGISTER: readSetting('SEND_WELCOME_EMAIL_ON_REGISTER', {
    fallback: env === 'test' ? 'false' : 'true',
  }),
  RESEND_API_KEY: readSetting('RESEND_API_KEY', { testFallback: 'test_resend_key' }),
  CLOUDINARY_CLOUD_NAME: readSetting('CLOUDINARY_CLOUD_NAME', { testFallback: 'test-cloud' }),
  CLOUDINARY_API_KEY: readSetting('CLOUDINARY_API_KEY', { testFallback: 'test-key' }),
  CLOUDINARY_API_SECRET: readSetting('CLOUDINARY_API_SECRET', { testFallback: 'test-secret' }),
  GOOGLE_CLIENT_ID: readSetting('GOOGLE_CLIENT_ID'),
  GOOGLE_CLIENT_SECRET: readSetting('GOOGLE_CLIENT_SECRET'),
  FACEBOOK_APP_ID: readSetting('FACEBOOK_APP_ID'),
  FACEBOOK_APP_SECRET: readSetting('FACEBOOK_APP_SECRET'),
  ALERT_WEBHOOK_URL: readSetting('ALERT_WEBHOOK_URL'),
  SLACK_WEBHOOK_URL: readSetting('SLACK_WEBHOOK_URL'),
  DISCORD_WEBHOOK_URL: readSetting('DISCORD_WEBHOOK_URL'),
  ALERT_EMAIL_TO: readSetting('ALERT_EMAIL_TO'),
  ALERT_API_ERRORS: readSetting('ALERT_API_ERRORS', { fallback: 'true' }),
  ALERT_API_CLIENT_ERRORS: readSetting('ALERT_API_CLIENT_ERRORS', { fallback: 'false' }),
  ALERT_DEDUP_WINDOW_MS: readSetting('ALERT_DEDUP_WINDOW_MS', { fallback: '60000' }),
  ALERT_MAX_STACK_LINES: readSetting('ALERT_MAX_STACK_LINES', { fallback: '20' }),
  ALERT_MAX_VALUE_LENGTH: readSetting('ALERT_MAX_VALUE_LENGTH', { fallback: '1500' }),
  CRASH_ON_UNHANDLED_REJECTION: readSetting('CRASH_ON_UNHANDLED_REJECTION', { fallback: 'false' }),
  FATAL_ERROR_EXIT_DELAY_MS: readSetting('FATAL_ERROR_EXIT_DELAY_MS', { fallback: '3500' }),
  HEALTH_MONITOR_INTERVAL_MS: readSetting('HEALTH_MONITOR_INTERVAL_MS', { fallback: '0' }),
  MONITOR_REPEAT_ALERTS: readSetting('MONITOR_REPEAT_ALERTS', { fallback: 'false' }),
  MONITOR_REPEAT_ALERT_MS: readSetting('MONITOR_REPEAT_ALERT_MS', { fallback: '900000' }),
  MONITOR_DAILY_SUMMARY: readSetting('MONITOR_DAILY_SUMMARY', { fallback: 'false' }),
  MONITOR_DAILY_SUMMARY_MS: readSetting('MONITOR_DAILY_SUMMARY_MS', { fallback: '86400000' }),
  MONITOR_LOGS_EVERY_DAYS: readSetting('MONITOR_LOGS_EVERY_DAYS', { fallback: '3' }),
  MONITOR_LOGS_EVERY_MS: readSetting('MONITOR_LOGS_EVERY_MS', { fallback: '259200000' }),
  MONITOR_SUMMARY_ON_START: readSetting('MONITOR_SUMMARY_ON_START', { fallback: 'true' }),
  PURGE_ENABLED: readSetting('PURGE_ENABLED', { fallback: env === 'test' ? 'false' : 'true' }),
  PURGE_AFTER_DAYS: readSetting('PURGE_AFTER_DAYS', { fallback: env === 'test' ? '1' : '14' }),
  PURGE_CRON: readSetting('PURGE_CRON', { fallback: '0 3 * * *' }),
  SEED_ADMIN_EMAIL: readSetting('SEED_ADMIN_EMAIL', { fallback: 'admin@dry.local' }),
  SEED_ADMIN_NAME: readSetting('SEED_ADMIN_NAME', { fallback: 'Admin' }),
  SEED_ADMIN_PASSWORD: readSetting('SEED_ADMIN_PASSWORD', { fallback: 'ChangeMe123!' }),
  SCIM_CONTACT_EMAIL: readSetting('SCIM_CONTACT_EMAIL', { fallback: 'scim@example.com' }),
  SCIM_TIMEZONE: readSetting('SCIM_TIMEZONE', { fallback: 'Africa/Brazzaville' }),
  SCIM_TZ_OFFSET_MINUTES: readSetting('SCIM_TZ_OFFSET_MINUTES', { fallback: '60' }),
  SCIM_WHATSAPP_PHONE: readSetting('SCIM_WHATSAPP_PHONE'),
  SCIM_ADMIN_WHATSAPP_PHONE: readSetting('SCIM_ADMIN_WHATSAPP_PHONE'),
  SCIM_RESERVATION_SLA_MINUTES: readSetting('SCIM_RESERVATION_SLA_MINUTES', { fallback: '30' }),
  SCIM_RESERVATION_REMINDER_MINUTES: readSetting('SCIM_RESERVATION_REMINDER_MINUTES', {
    fallback: env === 'test' ? '10' : '30',
  }),
  SCIM_REMINDER_ENABLED: readSetting('SCIM_REMINDER_ENABLED', {
    fallback: env === 'test' ? 'false' : 'true',
  }),
  SCIM_REMINDER_CRON: readSetting('SCIM_REMINDER_CRON', { fallback: '*/1 * * * *' }),
  SCIM_REMINDER_BATCH_SIZE: readSetting('SCIM_REMINDER_BATCH_SIZE', {
    fallback: env === 'test' ? '20' : '50',
  }),
  SCIM_ENABLE_EMAIL_NOTIFICATIONS: readSetting('SCIM_ENABLE_EMAIL_NOTIFICATIONS', {
    fallback: env === 'production' ? 'true' : 'false',
  }),
  SCIM_ENABLE_SMS_NOTIFICATIONS: readSetting('SCIM_ENABLE_SMS_NOTIFICATIONS', {
    fallback: 'false',
  }),
  SCIM_ENABLE_WHATSAPP_NOTIFICATIONS: readSetting('SCIM_ENABLE_WHATSAPP_NOTIFICATIONS', {
    fallback: 'false',
  }),
  SCIM_ENABLE_ADMIN_WHATSAPP_NOTIFICATIONS: readSetting(
    'SCIM_ENABLE_ADMIN_WHATSAPP_NOTIFICATIONS',
    { fallback: env === 'test' ? 'true' : 'false' }
  ),
  SCIM_DEFAULT_COUNTRY_CODE: readSetting('SCIM_DEFAULT_COUNTRY_CODE', { fallback: '+242' }),
  SCIM_TWILIO_ACCOUNT_SID: readSetting('SCIM_TWILIO_ACCOUNT_SID'),
  SCIM_TWILIO_AUTH_TOKEN: readSetting('SCIM_TWILIO_AUTH_TOKEN'),
  SCIM_TWILIO_SMS_FROM: readSetting('SCIM_TWILIO_SMS_FROM'),
  SCIM_TWILIO_WHATSAPP_FROM: readSetting('SCIM_TWILIO_WHATSAPP_FROM'),
  VIEW_IP_SALT: readSetting('VIEW_IP_SALT', { fallback: 'change-this-ip-salt' }),
  YT_COOKIE: readSetting('YT_COOKIE'),
  YT_USER_AGENT: readSetting('YT_USER_AGENT'),
  FFMPEG_PATH: readSetting('FFMPEG_PATH'),
  YTDL_NO_UPDATE: readSetting('YTDL_NO_UPDATE'),
  MEDIA_DIR: readSetting('MEDIA_DIR', { fallback: 'downloads' }),
  MEDIA_VERBOSE: readSetting('MEDIA_VERBOSE', { fallback: 'false' }),
});

const baseConfig = buildBaseConfig();

const validations = [
  {
    key: 'MONGO_URI',
    when: () => env !== 'test',
    validate: (value) => Boolean(value),
    message: 'MONGO_URI est requis.',
  },
  {
    key: 'JWT_SECRET',
    validate: (value) => Boolean(value) && String(value).length >= 32,
    message: 'JWT_SECRET doit contenir au moins 32 caracteres.',
  },
  {
    key: 'SESSION_SECRET',
    validate: (value) => Boolean(value) && String(value).length >= 32,
    message: 'SESSION_SECRET doit contenir au moins 32 caracteres.',
  },
  {
    key: 'PORT',
    validate: (value) => Number.isInteger(value) && value > 0,
    message: 'PORT doit etre un entier positif.',
  },
  {
    key: 'RATE_LIMIT_WINDOW_MS',
    validate: (value) => parsePositiveInt(value, 0) > 0,
    message: 'RATE_LIMIT_WINDOW_MS doit etre un entier positif.',
  },
  {
    key: 'HEALTH_MONITOR_INTERVAL_MS',
    validate: (value) => Number(value) >= 0,
    message: 'HEALTH_MONITOR_INTERVAL_MS doit etre superieur ou egal a 0.',
  },
];

const validateRuntimeConfig = (runtimeConfig) => {
  const errors = validations
    .filter((rule) => (typeof rule.when === 'function' ? rule.when(runtimeConfig) : true))
    .filter((rule) => !rule.validate(runtimeConfig[rule.key], runtimeConfig))
    .map((rule) => `- ${rule.message}`);

  if (errors.length) {
    throw new Error(`Configuration invalide pour NODE_ENV=${env}\n${errors.join('\n')}`);
  }
};

const finalConfig = {
  ...baseConfig,
  CORS: {
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'CSRF-Token'],
  },
  RATE_LIMIT: {
    windowMs: parsePositiveInt(baseConfig.RATE_LIMIT_WINDOW_MS, 10 * 60 * 1000),
    max: parsePositiveInt(baseConfig.RATE_LIMIT_MAX, env === 'production' ? 100 : 1000),
    authMultiplier: parsePositiveInt(
      baseConfig.RATE_LIMIT_AUTH_MULTIPLIER,
      env === 'production' ? 20 : 30
    ),
    adminMultiplier: parsePositiveInt(
      baseConfig.RATE_LIMIT_ADMIN_MULTIPLIER,
      env === 'production' ? 100 : 150
    ),
    skipAuthenticated: parseBoolean(baseConfig.RATE_LIMIT_SKIP_AUTHENTICATED, env !== 'production'),
    skipAdmin: parseBoolean(baseConfig.RATE_LIMIT_SKIP_ADMIN, false),
    message: { success: false, message: 'Trop de requetes, veuillez reessayer plus tard.' },
  },
  UPLOAD: {
    maxFileSize: 5 * 1024 * 1024,
    allowedImageTypes: ['image/jpeg', 'image/png', 'image/webp'],
    allowedVideoTypes: ['video/mp4', 'video/webm'],
  },
  CACHE: {
    defaultDuration: env === 'production' ? 600 : 300,
    userCacheDuration: 1800,
    staticCacheDuration: 3600,
  },
};

validateRuntimeConfig(finalConfig);

module.exports = finalConfig;
