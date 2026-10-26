const env = process.env;

export const config = {
  port: Number(env.PORT || 3000),
  publicUrl: (env.PUBLIC_URL || `http://localhost:${env.PORT || 3000}`).replace(/\/$/, ''),
  businessName: env.BUSINESS_NAME || 'Cabo Fish & Beach',
  // In local test mode the simulator uses a fake owner number so escalations can be tried out.
  ownerPhone: env.OWNER_PHONE || (env.WHATSAPP_TOKEN ? '' : '5210000000000'),
  ownerLang: env.OWNER_LANG === 'en' ? 'en' : 'es',
  botPhone: env.BOT_PHONE || '',
  adminPassword: env.ADMIN_PASSWORD || 'change-me',
  dbPath: env.DB_PATH || './data/cabo.db',
  timezone: 'America/Mazatlan', // Los Cabos, UTC-7 all year

  depositPercent: Number(env.DEPOSIT_PERCENT || 20),
  holdMinutes: Number(env.HOLD_MINUTES || 30),
  captainReplyMinutes: Number(env.CAPTAIN_REPLY_MINUTES || 15),
  rentalDeliveryFee: Number(env.RENTAL_DELIVERY_FEE || 25),
  // In-villa massages: therapists available per time slot, price per person (USD), and the part of that price
  // the client pays the therapist in cash (USD per person). The rest is charged online and is your margin.
  massageTherapists: Number(env.MASSAGE_THERAPISTS || 1),
  massagePrice60: Number(env.MASSAGE_PRICE_60 || 120),
  massagePrice90: Number(env.MASSAGE_PRICE_90 || 170),
  massageCash60: Number(env.MASSAGE_CASH_60 || 67),
  massageCash90: Number(env.MASSAGE_CASH_90 || 95),

  whatsapp: {
    token: env.WHATSAPP_TOKEN || '',
    phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID || '',
    verifyToken: env.WHATSAPP_VERIFY_TOKEN || '',
    appSecret: env.WHATSAPP_APP_SECRET || '',
    notifyTemplate: env.WHATSAPP_NOTIFY_TEMPLATE || '',
    // The same template approved in both languages
    notifyTemplateLang: { en: env.WHATSAPP_NOTIFY_TEMPLATE_LANG_EN || 'en', es: env.WHATSAPP_NOTIFY_TEMPLATE_LANG_ES || 'es_MX' },
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
