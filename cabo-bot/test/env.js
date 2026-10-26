// Imported first by the tests so config.js sees these values.
process.env.NODE_ENV = 'test';
process.env.OWNER_PHONE = '5210000000000';
process.env.WHATSAPP_TOKEN = '';
process.env.STRIPE_SECRET_KEY = '';
process.env.ANTHROPIC_API_KEY = ''; // tests plug in a fake interpreter instead
