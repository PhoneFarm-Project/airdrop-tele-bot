require('dotenv').config();
const Twitter = require('twitter-lite');
const Telegraf = require('telegraf'); // Module to use Telegraf API.
const session = require('telegraf/session');
const Extra = require('telegraf/extra');
const Markup = require('telegraf/markup');
const rateLimit = require('telegraf-ratelimit');
var ethereum_address = require('ethereum-address'); //used for verifying eth address

const SHARE_TWEET = process.env.SHARE_TWEET;
const GROUP_ID = process.env.GROUP_ID;

const twitterClient = new Twitter({
  consumer_key: process.env.CONSUMER_KEY,
  consumer_secret: process.env.CONSUMER_SECRET,
  access_token_key: process.env.ACCESS_TOKEN,
  access_token_secret: process.env.ACCESS_TOKEN_SECRET,
});

async function accountExist(screen_name) {
  try {
    await twitterClient.get('users/show', {
      screen_name,
    });
    return true;
  } catch (e) {
    return false;
  }
}

const buttonsLimit = {
  //sets a limit for user clicks
  window: 1000,
  limit: 1,
  onLimitExceeded: (ctx, next) => {
    if ('callback_query' in ctx.update)
      ctx
        .answerCbQuery('You`ve pressed buttons too often, wait.', true)
        .catch(err => sendError(err, ctx));
  },
  keyGenerator: ctx => {
    return ctx.callbackQuery ? true : false;
  },
};

const keyboard = Markup.inlineKeyboard(
  [Markup.callbackButton('Get your PhoneFarm Airdrop! 🌱', 'startAirdrop')],
  {
    columns: 2,
  }
);

function firstMessage(ctx) {
  var msg;
  msg = `🔥 Hi ${ctx.from.first_name} ${ctx.from.last_name}, welcome to PhoneFarm Airdrop bot! 🔥`;
  msg += '\n';
  msg += 'Please follow the instructions to get 10 PHONE Token 📱';
  msg += '\n';
  msg += '\n';
  msg += '1.📌 Submit your receiver ETH address.';
  msg += '\n';
  msg += '2.📌 Submit your Twitter username.';
  msg += '\n';
  msg += '3.📌 Follow us on Twitter: https://twitter.com/PhonefarmF';
  msg += '\n';
  msg += `4.📌 Retweet our campaign tweet: ${SHARE_TWEET}`;
  msg += '\n';
  msg += '5.📌 Join our channel: https://t.me/phonefarm_official';
  msg += '\n';
  msg += '\n';

  return msg;
}

function getStatusMessage(ctx) {
  // console.log('status checking', ctx.session);
  let finalResult;

  finalResult = '👤 Username: ';
  finalResult += ctx.from.username;
  finalResult += '\n';
  finalResult += '🔑 ETH Address: ';
  finalResult += ctx.session.eth || '';
  finalResult += '\n';
  finalResult += '🐦 Twitter username: ';
  finalResult += ctx.session.twitter || '';
  finalResult += '\n';
  finalResult += '\n';

  finalResult += '1.📌 Fill ETH address';
  if (ctx.session.eth) {
    finalResult += ' ✅';
  } else {
    finalResult += ' ❌';
  }
  finalResult += '\n';
  finalResult += '2.📌 Fill Twitter address';
  if (ctx.session.twitter) {
    finalResult += ' ✅';
  } else {
    finalResult += ' ❌';
  }
  finalResult += '\n';
  finalResult += '3.📌 Follow us on Twitter: https://twitter.com/PhonefarmF';
  if (ctx.session.followed === '1') {
    finalResult += ' ✅';
  } else {
    finalResult += ' ❌';
  }
  finalResult += '\n';
  finalResult += `4.📌 Retweet our campaign tweet: ${SHARE_TWEET}`;
  if (ctx.session.retweet === '1') {
    finalResult += ' ✅';
  } else {
    finalResult += ' ❌';
  }
  finalResult += '\n';
  finalResult += '5.📌 Join our channel: https://t.me/phonefarm_official';
  if (ctx.session.joinTele === '1') {
    finalResult += ' ✅';
  } else {
    finalResult += ' ❌';
  }
  finalResult += '\n';
  return finalResult;
}

async function initUserState(ctx) {
  ctx.session.eth = '';
  ctx.session.twitter = '';
  ctx.session.followed = '0';
  ctx.session.retweet = '0';
  ctx.session.joinTele = '0';
}

function goNextStep(ctx) {
  if (ctx.session.eth === '') ctx.session.step = 1;
  else if (ctx.session.twitter === '') ctx.session.step = 2;
  else if (ctx.session.followed === '0') ctx.session.step = 3;
  else if (ctx.session.retweet === '0') ctx.session.step = 4;
  else ctx.session.step = 5;
}

async function stepCheck(ctx) {
  switch (ctx.session.step) {
    case 1:
      console.log('step 1: check valid eth address');
      if (ethereum_address.isAddress(ctx.message.text.toString())) {
        ctx.session.eth = ctx.message.text;
        goNextStep(ctx);
        ctx.reply('2.📌  Please input your Twitter username:');
      } else {
        ctx.reply('1.📌  Please input a valid ethereum address:');
      }
      break;
    case 2:
      console.log('step 2: check Twitter username');
      let acc = ctx.message.text;
      let accExist = await accountExist(acc);
      if (!accExist) {
        ctx.reply('2.📌  Please input a valid Twitter username:');
      } else {
        goNextStep(ctx);
        ctx.session.twitter = ctx.message.text;
        await ctx.reply('3.📌  Please follow us on Twitter: https://twitter.com/PhonefarmF');
        var keyboard = Markup.inlineKeyboard([Markup.callbackButton('DONE ✅', 'check')], {
          columns: 1,
        });
        ctx.telegram.sendMessage(
          ctx.from.id,
          'When it done, please hit the DONE button bellow!',
          Extra.HTML().markup(keyboard)
        );
      }
      break;
    case 3:
      console.log('step 3: check follow on Twitter');
      await ctx.reply(`4.📌  Please retweet our campaign tweet: ${SHARE_TWEET}`);
      var keyboard = Markup.inlineKeyboard([Markup.callbackButton('DONE ✅', 'check')], {
        columns: 1,
      });
      ctx.telegram.sendMessage(
        ctx.from.id,
        'When it done, please hit the DONE button bellow!',
        Extra.HTML().markup(keyboard)
      );
      break;
    case 4:
      console.log('step 4: check retweet');
      try {
        let user = await ctx.telegram.getChatMember(GROUP_ID, ctx.from.id);
        if (user && !user.is_bot) {
          ctx.session.joinTele = '1';
          ctx.session.step = 5;
        }
        var status = getStatusMessage(ctx);
        var keyboard = Markup.inlineKeyboard([Markup.callbackButton('SUBMIT ✅', 'submit')], {
          columns: 1,
        });
        ctx.telegram.sendMessage(ctx.from.id, status, Extra.HTML().markup(keyboard));
      } catch (e) {
        console.log('not join telegram yet.');
        await ctx.reply(`5.📌 Please join our channel: https://t.me/phonefarm_official'`);
        var keyboard = Markup.inlineKeyboard([Markup.callbackButton('DONE ✅', 'check')], {
          columns: 1,
        });
        ctx.telegram.sendMessage(
          ctx.from.id,
          'When it done, please hit the DONE button bellow!',
          Extra.HTML().markup(keyboard)
        );
      }
      break;
    default:
      console.log('other message');
      break;
  }
}

const bot = new Telegraf(process.env.TELEGRAM_TOKEN); // Let's instantiate a bot using our token.
bot.use(session());
// bot.use(Telegraf.log());

bot.start(async ctx => {
  if (ctx.from.username == null) {
    ctx.telegram.sendMessage(
      ctx.from.id,
      'Please set a username first then contact the bot again!'
    );
  } else {
    initUserState(ctx);
    var msg = firstMessage(ctx);
    ctx.telegram.sendMessage(ctx.from.id, msg, Extra.markup(keyboard));
  }
});

bot.on('message', async ctx => {
  if (ctx.from.username == null) {
    var noUserMsg = 'Please set a username first then contact the bot again!!!!!';
    ctx.telegram.sendMessage(ctx.from.id, ctx.from);
    ctx.telegram.sendMessage(ctx.from.id, noUserMsg);
  } else {
    stepCheck(ctx);
  }
});

bot.action('startAirdrop', ctx => {
  ctx.reply('1.📌  Please input your receiver ETH address.');
  goNextStep(ctx);
});

bot.action('check', async ctx => {
  console.log('checking on step ', ctx.session.step);
  if (ctx.session.step === 2) {
    ctx.session.followed = '1';
    ctx.session.step = 3;
  } else if (ctx.session.step === 3) {
    ctx.session.retweet = '1';
    ctx.session.step = 4;
  }
  stepCheck(ctx);
});

bot.action('submit', ctx => {
  console.log('submit data ', ctx.session);
});

bot.use(rateLimit(buttonsLimit));
bot.startPolling(); //MUST HAVE
