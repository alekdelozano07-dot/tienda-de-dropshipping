const env = process.env;

export const config = {
  port: Number(env.PORT || 3000),
  publicUrl: (env.PUBLIC_URL || `http://localhost:${env.PORT || 3000}`).replace(/\/$/, ''),
  businessName: env.BUSINESS_NAME || 'Cabo Fish & Beach',
  ownerPhone: env.OWNER_PHONE || '',
  botPhone: env.BOT_PHONE || '',
  adminPassword: env.ADMIN_PASSWORD || 'change-me',
  dbPath: env.DB_PATH || './data/cabo.db',
  timezone: 'America/Mazatlan', // Los Cabos, UTC-7 all year

  depositPercent: Number(env.DEPOSIT_PERCENT || 20),
  holdMinutes: Number(env.HOLD_MINUTES || 30),
  captainReplyMinutes: Number(env.CAPTAIN_REPLY_MINUTES || 15),
  rentalDeliveryFee: Number(env.RENTAL_DELIVERY_FEE || 25),

  whatsapp: {
    token: env.WHATSAPP_TOKEN || '',
    phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID || '',
    verifyToken: env.WHATSAPP_VERIFY_TOKEN || '',
    appSecret: env.WHATSAPP_APP_SECRET || '',
    notifyTemplate: env.WHATSAPP_NOTIFY_TEMPLATE || '',
    notifyTemplateLang: env.WHATSAPP_NOTIFY_TEMPLATE_LANG || 'en',
  },
  stripe: {
    secretKey: env.STRIPE_SECRET_KEY || '',
    webhookSecret: env.STRIPE_WEBHOOK_SECRET || '',
  },
};

// Without credentials the bot runs in local test mode: messages go to the
// in-memory outbox / console and payments use a fake checkout page.
export const devMode = {
  whatsapp: !config.whatsapp.token || !config.whatsapp.phoneNumberId,
  stripe: !config.stripe.secretKey,
};
