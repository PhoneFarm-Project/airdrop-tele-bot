var mongoose = require('mongoose');

//user Schema
var UserSchema = mongoose.Schema({
  ethAddress: {
    type: String,
    required: true,
  },
  twitterUser: {
    type: String,
    required: false,
  },
  telegramUser: {
    type: String,
    required: true,
  },
  creationDate: {
    type: String,
    required: false,
  },
});

module.exports = mongoose.model('User', UserSchema);
