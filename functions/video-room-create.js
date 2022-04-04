const Twilio = require('twilio');

exports.handler = function (context, event, callback) {
  const WEB_URL = context.WEB_URL;
  const TWILIO_ACCOUNT_SID = context.ACCOUNT_SID;
  const TWILIO_API_KEY = context.API_KEY;
  const TWILIO_API_SECRET = context.API_SECRET;

  const client = new Twilio(TWILIO_API_KEY
    , TWILIO_API_SECRET, { accountSid: TWILIO_ACCOUNT_SID });

  const messageRequest = client.video.rooms
    .create({recordParticipantsOnConnect: true,
      statusCallback: `${WEB_URL}`,
      type: 'group',
      uniqueName: `${event.uniqueName}`})
    .then(map => {
      return { success: true, map : map };
    })
    .catch((err) => {
      return { success: false, doc: {}, error: err.message };
    });

  messageRequest
    .then((result) => {
      return callback(null, { result });
    })
    .catch((err) => {
      return callback(err, null);
    });
};