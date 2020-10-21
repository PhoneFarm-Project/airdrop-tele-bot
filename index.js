const Telegraf = require('telegraf'); // Module to use Telegraf API.
const config = require('./config'); // Configuration file that holds telegraf_token API key.
const session = require('telegraf/session');
const Extra = require('telegraf/extra');
const Markup = require('telegraf/markup');
const rateLimit = require('telegraf-ratelimit');
var mongoose = require('mongoose');
const User = require('./user');
var ethereum_address = require('ethereum-address'); //used for verifying eth address

const SHARE_TWEET = 'https://twitter.com/PhonefarmF/status/1316991901879267330';
const GROUP_ID = '231399891';

mongoose.connect(config.database, {
  socketTimeoutMS: 45000,
  keepAlive: true,
  poolSize: 10,
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
const db = mongoose.connection;

// CONNECTION EVENTS
// When successfully connected
mongoose.connection.on('connected', function () {
  console.log('Mongoose default connection open to ');
});

// If the connection throws an error
mongoose.connection.on('error', function (err) {
  console.log('Mongoose default connection error: ' + err);
});

// When the connection is disconnected
mongoose.connection.on('disconnected', function () {
  console.log('Mongoose default connection disconnected');
});

// If the Node process ends, close the Mongoose connection
process.on('SIGINT', function () {
  mongoose.connection.close(function () {
    console.log('Mongoose default connection disconnected through app termination');
    process.exit(0);
  });
});

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

//check connection

db.once('open', function () {
  console.log('connected to mongodb');
});
db.on('error', function (err) {
  console.log(err);
});

var refByNameAsync = function (ctx) {
  //finds and returns the name of the referrer
  return new Promise(function (resolve, reject) {
    try {
      var RefBy = ctx.session.refBy;
      var findQuery = {
        refNumber: RefBy,
      };
      User.findOne(findQuery, function (err, result) {
        if (err) throw err;
        if (result == null) {
          //if user doesn't exist
          ctx.session.refByName = '/';
          resolve('found none');
          return false;
        } else {
          //if user exists, return it's data
          ctx.session.refByName = result.telegramUser;
          resolve('works');
          console.log('Found TG USER REFER BY:', ctx.session.refByName);
        }
      });
    } catch (e) {
      reject(e);
      console.log(e);
    }
  });
};
var checkDataAsync = function (ctx) {
  //checks the input user data
  return new Promise(function (resolve, reject) {
    try {
      if (ethereum_address.isAddress(ctx.session.eth.toString())) {
        resolve(true);
        return true;
      } else {
        resolve(false);
        return false;
      }
    } catch (e) {
      reject('error');
      console.log(e);
    }
  });
};
var findExistingAsync = function (ctx) {
  return new Promise((resolve, reject) => {
    try {
      console.log('Finding user in refer database...');
      var userID = ctx.from.id.toString();
      User.findOne(
        {
          refNumber: userID,
        },
        (err, result) => {
          if (err) throw err;
          if (result == null) {
            console.log('user has no refer');
            resolve("user doesn't exist");
            return;
          }
          //returns data if user exists in
          console.log('user found!');
          var refNumber = ctx.session.refNumber;
          console.log('REF number in finding exist:', refNumber);
          User.countDocuments(
            {
              refBy: refNumber,
            },
            function (err, count) {
              ctx.session.count = count;
              console.log('count is:', count);
            }
          );
          console.log('result ===========', result);
          ctx.session.eth = result.ethAddress;
          ctx.session.twitter = result.twitterUser;
          ctx.session.refBy = result.refBy;
          ctx.session.refNumber = result.refNumber;
          ctx.session.username = result.telegramUser;
          ctx.session.retweet = result.retweet;
          ctx.session.joinTele = result.joinTele;
          ctx.session.followed = result.followed;
          ctx.session.found = '1';
          resolve('User found, returning');
        }
      );
    } catch (e) {
      reject('error');
      console.log(e);
    }
  });
};

var saveDataAsync = function (ctx) {
  //saves data to Mongodb
  return new Promise(function (resolve, reject) {
    try {
      console.log('SAVING DATA');
      var CreationDate = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, ''); //cleans up creation date
      var EthAddress = ctx.session.eth.toString();
      var TwitterUser = ctx.session.twitter.toString();
      var TelegramUser = ctx.session.username.toString();
      var RefNumber = ctx.session.refNumber.toString();
      var RefBy = '0';
      var Retweet = ctx.session.retweet;
      var JoinTele = ctx.session.joinTele;
      var Followed = ctx.session.followed;
      if (ctx.session.refBy != null) {
        RefBy = ctx.session.refBy;
      } else {
        RefBy = '0';
      }
      var findQuery = {
        refNumber: RefNumber,
      };
      User.findOne(findQuery, function (err, result) {
        console.log('FIND ONE');
        let me = new User({
          ethAddress: EthAddress,
          twitterUser: TwitterUser,
          telegramUser: TelegramUser,
          refNumber: RefNumber,
          refBy: RefBy,
          creationDate: CreationDate,
          retweet: Retweet,
          joinTele: JoinTele,
          followed: Followed,
        });

        if (err) {
          reject('error');
        }
        console.log('finding result', result);
        if (result == null) {
          //if it doesn't find an existing user, saves the current data
          me.save(function (err) {
            if (err) {
              reject('error saving');
              console.log('Error while saving:', err);
              return;
            } else {
              resolve('Saved data');
              console.log('1 document inserted');
            }
          });
        } else {
          //if it finds an existing user, it updates the data
          User.findOneAndUpdate(
            {
              refNumber: RefNumber,
            },
            {
              $set: {
                ethAddress: EthAddress,
                twitterUser: TwitterUser,
                telegramUser: TelegramUser,
                refNumber: RefNumber,
                refBy: RefBy,
                creationDate: CreationDate,
                retweet: Retweet,
                joinTele: JoinTele,
                followed: Followed,
              },
            },
            {
              new: true,
            },
            (err, doc) => {
              if (err) {
                reject('error updating');
                console.log('error updating:', err);
              } else {
                resolve('Saved existing data');
                ctx.session.step = 6;
                console.log(doc);
              }
            }
          );
        }
      });
    } catch (e) {
      reject('error');
      console.log(e);
    }
  });
};

//keyboard
const keyboard = Markup.inlineKeyboard(
  [
    // Markup.callbackButton('ETH🔑', 'eth'),
    // Markup.callbackButton('🐦Twitter', 'twitter'),
    // Markup.callbackButton('♻️Refresh', 'refresh'),
    // Markup.callbackButton('Check ✅', 'check'),
    // Markup.callbackButton('Confirm 🏁', 'confirm'),
    Markup.callbackButton('Get your PhoneFarm Airdrop! 🌱', 'startAirdrop'),
  ],
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
  console.log('status checking', ctx.session);
  let finalResult;

  finalResult = '👤 Username: ';
  finalResult += ctx.from.username;
  finalResult += '\n';
  finalResult += '🔑ETH Address: ';
  finalResult += ctx.session.eth || '';
  finalResult += '\n';
  finalResult += '🐦Twitter username: ';
  finalResult += ctx.session.twitter || '';
  finalResult += '\n';
  finalResult += '\n';

  finalResult += '1.📌 Filled ETH address';
  if (ctx.session.eth) {
    finalResult += ' ✅';
  } else {
    finalResult += ' ❌';
  }
  finalResult += '\n';
  finalResult += '2.📌 Filled in Twitter address';
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

// function makeTaskMessage(ctx) {
//   var finalResult;
//   finalResult = '👤 Username: ';
//   finalResult += ctx.from.username;
//   finalResult += '\n';
//   finalResult += '🔑ETH Address: ';
//   finalResult += ctx.session.eth;
//   finalResult += '\n';
//   finalResult += '🐦Twitter username: ';
//   finalResult += ctx.session.twitter;
//   finalResult += '\n';
//   return finalResult;
// }

async function initUserState(ctx) {
  if (ctx.session.found != '1') {
    ctx.session.eth = '';
    ctx.session.twitter = '';
    ctx.session.followed = '0';
    ctx.session.retweet = '0';
    ctx.session.joinTele = '0';
  } else {
    //values already set
  }
}

function goNextStep(ctx) {
  if (ctx.session.eth === '') ctx.session.step = 1;
  else if (ctx.session.twitter === '') ctx.session.step = 2;
  else if (ctx.session.followed === '0') ctx.session.step = 3;
  else if (ctx.session.retweet === '0') ctx.session.step = 4;
  else if (ctx.session.joinTele === '0') ctx.session.step = 5;
}

async function stepCheck(ctx) {
  switch (ctx.session.step) {
    case 1:
      console.log('step 1: check valid eth address');
      if (ethereum_address.isAddress(ctx.message.text.toString())) {
        ctx.session.eth = ctx.message.text;
        console.log(ctx.session.eth, ctx.message.text);
        goNextStep(ctx);
        ctx.reply('2.📌  Please input your Twitter username:');
      } else {
        ctx.reply('1.📌  Please input a valid ethereum address:');
      }
      break;
    case 2:
      console.log('step 2: check Twitter username');
      ctx.session.twitter = ctx.message.text;
      await ctx.reply('3.📌  Please follow us on Twitter: https://twitter.com/PhonefarmF');
      var keyboard = Markup.inlineKeyboard([Markup.callbackButton('Check ✅', 'check')], {
        columns: 1,
      });
      ctx.telegram.sendMessage(
        ctx.from.id,
        'When it done, please check status by hit the ✅ button bellow!',
        Extra.HTML().markup(keyboard)
      );
      break;
    case 3:
      console.log('step 3: check follow on Twitter');
      break;
    case 4:
      console.log('step 4: check retweet');
      break;
    case 5:
      console.log('step 5: check join channel');
      break;
    default:
      break;
  }
}

//bot init
const bot = new Telegraf(config.telegraf_token); // Let's instantiate a bot using our token.
bot.use(session());
// bot.use(Telegraf.log());

bot.start(async ctx => {
  //bot start
  //parameter parsing
  // ctx.session.refByName = '/';
  // ctx.session.count = 0;
  // findExistingAsync(ctx).then(function (uid) {
  // var len = ctx.message.text.length;
  if (ctx.from.username == null) {
    //user must have a valid username set.
    ctx.telegram.sendMessage(
      ctx.from.id,
      'Please set a username first then contact the bot again!'
    );
  } else {
    // ctx.session.username = ctx.from.username;
    // var ref = ctx.message.text.slice(7, len);
    // ctx.session.refBy = ref;
    // console.log('ref:', ref);
    // if (ref.length != 0) {
    //   var refMsg = 'Referred by: ' + ctx.session.refBy;

    //   ctx.session.refNumber = ctx.from.id.toString();
    //   ctx.telegram.sendMessage(ctx.from.id, refMsg);
    //   console.log('refer', ctx.session.refBy);
    // } else {
    //   ctx.session.refNumber = ctx.from.id.toString();
    //   console.log('session ref number:', ctx.session.refNumber);
    // }
    //save referer
    // ctx.session.telegram = ctx.message.chat.username;
    // ctx.session.language = ctx.message.from.language_code;

    initUserState(ctx);
    var msg = firstMessage(ctx);
    // var msg = makeTaskMessage(ctx);

    ctx.telegram.sendMessage(ctx.from.id, msg, Extra.markup(keyboard));
  }
  // });
});

bot.on('message', async ctx => {
  //bot listens to any message
  if (ctx.from.username == null) {
    var noUserMsg = 'Please set a username first then contact the bot again!!!!!';
    ctx.telegram.sendMessage(ctx.from.id, ctx.from);
    ctx.telegram.sendMessage(ctx.from.id, noUserMsg);
  } else {
    stepCheck(ctx);
    //   console.log('session found in message:', ctx.session.found);
    //   ctx.session.refNumber = ctx.from.id.toString();
    //   if (ctx.session.found != '1') {
    //     findExistingAsync(ctx).then(function (uid) {
    //       //wait for promise to complete.
    //     });
    //   }
    //   console.log('ref by name', ctx.session.refByName);
    //   if (ctx.session.refByName == null) {
    //     //checks if ref by name exists, speeds up concurrent calls.
    //     refByNameAsync(ctx).then(function (uid) {
    //       stepCheck(ctx).then(function (a) {
    //         // var msg = makeTaskMessage(ctx);
    //         // ctx.telegram.sendMessage(ctx.from.id, msg, Extra.HTML().markup(keyboard));
    //       });
    //     });
    //   } else {
    //     stepCheck(ctx).then(function (a) {
    //       // var msg = makeTaskMessage(ctx);
    //       // ctx.telegram.sendMessage(ctx.from.id, msg, Extra.HTML().markup(keyboard));
    //     });
    //   }
  }
});

// bot.telegram.getMe().then(botInfo => {
//   bot.options.username = botInfo.username;
//   console.log('Server has initialized bot nickname. Nick: ' + botInfo.username);
// });

bot.action('startAirdrop', ctx => {
  ctx.reply('1.📌  Please input your receiver ETH address.');
  goNextStep(ctx);
});

// bot.action('twitter', ctx => {
//   //button click twitter
//   ctx.reply('Input Twitter username, please.');
//   goNextStep(ctx);
// });

// bot.action('refresh', ctx => {
//   //button click refresh data
//   var msg = makeTaskMessage(ctx);
//   refByNameAsync(ctx).then(function (uid) {
//     findExistingAsync(ctx).then(function (uid) {
//       ctx.telegram.sendMessage(ctx.from.id, msg, Extra.HTML().markup(keyboard));
//       ctx.reply('Data has been refreshed!');
//     });
//   });
// });

bot.action('check', async ctx => {
  try {
    let user = await ctx.getChatMember(ctx.from.id, GROUP_ID);
    if (user && !user.is_bot) {
      ctx.session.joinTele = '1';
    }
  } catch (e) {
    console.log('not join telegram yet.');
  }

  var status = getStatusMessage(ctx);
  var keyboard = Markup.inlineKeyboard([Markup.callbackButton('Check ✅', 'check')], {
    columns: 1,
  });
  ctx.telegram.sendMessage(ctx.from.id, status, Extra.HTML().markup(keyboard));
});

bot.action('confirm', ctx => {
  //button click confirm
  checkDataAsync(ctx).then(function (uid) {
    var check = uid;
    console.log('CHECK', check);
    refByNameAsync(ctx).then(function (uid) {
      if (check == true) {
        saveDataAsync(ctx).then(function (uid) {
          var msg;
          msg = 'Completed.';
          msg += '\n';
          msg += 'Please use this referral link';
          msg += '\n';
          msg += 'https://t.me/phonefarmBot?start=';
          msg += ctx.session.refNumber;
          ctx.reply(msg);
        });
      } else {
        ctx.reply('Please input all data');
      }
    });
  });
});
bot.use(rateLimit(buttonsLimit));
bot.startPolling(); //MUST HAVE

//0x293a4037296D188a24F167f36924afF05FDF9eee
