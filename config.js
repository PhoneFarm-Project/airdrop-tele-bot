require('dotenv').config();
module.exports = {
  telegraf_token: process.env.TELEGRAM_TOKEN,
  database: process.env.DB,
};
