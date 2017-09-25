'use strict';

// Messenger API integration example
// We assume you have:
// * a Wit.ai bot setup (https://wit.ai/docs/quickstart)
// * a Messenger Platform setup (https://developers.facebook.com/docs/messenger-platform/quickstart)
// You need to `npm install` the following dependencies: body-parser, express, request.
//
// 1. npm install body-parser express request
// 2. Download and install ngrok from https://ngrok.com/download
// 3. ./ngrok http 8445
// 4. WIT_TOKEN=your_access_token FB_PAGE_ACCESS_TOKEN=your_page_token node index.js
// 5. Subscribe your page to the Webhooks using verify_token and `https://<your_ngrok_io>/webhook` as callback URL.
// 6. Talk to your bot on Messenger!

const bodyParser = require('body-parser'),
      crypto = require('crypto'),
      express = require('express'),
      fetch = require('node-fetch'),
      request = require('request'),
      { Wit, log } = require('node-wit');

const PORT = process.env.PORT || 8445;

const WIT_TOKEN = process.env.WIT_TOKEN;
const FB_PAGE_ACCESS_TOKEN = process.env.FB_PAGE_ACCESS_TOKEN;

if (!FB_PAGE_ACCESS_TOKEN) { throw new Error('missing FB_PAGE_ACCESS_TOKEN') }

let FB_VERIFY_TOKEN = null;

crypto.randomBytes(8, (err, buff) => {
  if (err) throw err;
  FB_VERIFY_TOKEN = buff.toString('hex');
  console.log(`/webhook will accept the Verify Token "${FB_VERIFY_TOKEN}"`);
});

// ----------------------------------------------------------------------------
// Messenger API specific code

// See the Send API reference
// https://developers.facebook.com/docs/messenger-platform/send-api-reference

const fbMessage = (id, text) => {
  const body = JSON.stringify({
    recipient: { id },
    message: { text },
  });

  const url = `https://graph.facebook.com/me/messages?access_token=${encodeURIComponent(FB_PAGE_ACCESS_TOKEN)}`;

  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  })
  .then(res => res.json())
  .then(json => {
    if (json.error && json.error.message) {
      throw new Error(json.error.message);
    }
    return json;
  });
};

// ----------------------------------------------------------------------------
// Wit.ai bot specific code

// This will contain all user sessions.
// Each session has an entry:
// sessionId -> {fbid: facebookUserId, context: sessionState}
const sessions = {};

const findOrCreateSession = fbid => {
  let sessionId;

  Object.keys(sessions).forEach(id => {
    if (sessions[id].fbid === fbid)
      sessionId = id;
  });

  if (!sessionId) {
    // No session found for user fbid, let's create a new one
    sessionId = new Date().toISOString();
    sessions[sessionId] = {
      fbid: fbid,
      context: {}
    };
  }

  return sessionId;
};

// Our bot actions
const actions = {
  send({ sessionId }, { text }) {
    // Our bot has something to say!
    // Let's retrieve the Facebook user whose session belongs to
    const recipientId = sessions[sessionId].fbid;
    if (recipientId) {
      // Yay, we found our recipient!
      // Let's forward our bot response to her.
      // We return a promise to let our bot know when we're done sending
      return fbMessage(recipientId, text)
      .then(_ => null)
      .catch(err => {
        console.error(
          'Oops! An error occurred while forwarding the response to',
          recipientId,
          ':',
          err.stack || err
        );
      });
    } else {
      console.error("Oops! Couldn't find user for session:", sessionId);
      // Giving the wheel back to our bot
      return Promise.resolve();
    }
  },
  // You should implement your custom actions here
  // See https://wit.ai/docs/quickstart
};

// Setting up our bot
const wit = new Wit({
  accessToken: WIT_TOKEN,
  actions,
  logger: new log.Logger(log.INFO)
});

const queryWit = (text, n = 1) => {
  return fetch(
    `https://api.wit.ai/message?v=20170307&n=${n}&q=${encodeURIComponent(text)}`,
    {
      headers: {
        Authorization: `Bearer ${WIT_TOKEN}`,
        'Content-Type': 'application/json',
      }
    }
  ).then(res => res.json());
};

// maps wit intents to responses
const responses = {
  get_location_in_airport: 'You can find our buses at the Airport parking lot, behind the Costa del Sol Hotel (Next to International fights arrival)',
  get_schedule: 'You can find our timetables at this link: https://www.airportexpresslima.com/timetables/ \n Please be aware, for International flights it is recommended to be at the airport 3 hours before the flight and 2 hours before for domestic flights.',
  get_info: 'You can find how our service works in this link: https://www.airportexpresslima.com/how-it-works/',
  get_payment_info: 'You can pay our guides in cash on board the bus. Also you can buy your tickets at our airport counter or online at this link:  https://www.airportexpresslima.com/tickets/',
  get_stops_info: 'We have 7 official stops in Miraflores. You can find more detailed information about our stops in this link: https://www.airportexpresslima.com/find-your-stop/',
  get_prices: 'You can find our prices at this link: https://www.airportexpresslima.com/tickets/',
  get_validity: 'Your ticket is valid for 6 months. You can use it on any bus, any day during those 6 months',
  get_roundtrip_info: 'Our system only allows to select the departure date/time, as usually the passengers do not show up the day they indicate for their return, for that reason, the ticket is open for any return day/time. For your return, you only need to show the voucher that will be given on board on the day of your departure. Your ticket is valid for 6 months.'
};

const handleMessage = message => {
  console.log(message);
  return queryWit(message).then(({entities}) => {
    console.log(entities);
    const intent = firstEntity(entities, 'intent');
    if (!intent) {
      console.log('🤖  Try something else. I got no intent :)');
      return;
    }

    if (intent.value in responses) {
      return responses[intent.value];
    }
    return console.log(`🤖  ${intent.value}`);
  });
}

const firstEntity = (entities, name)  => {
  return entities &&
    entities[name] &&
    Array.isArray(entities[name]) &&
    entities[name] &&
    entities[name][0];
}

// Starting our webserver and putting it all together
const app = express();

app.use(({method, url}, rsp, next) => {
  rsp.on('finish', () => {
    console.log(`${rsp.statusCode} ${method} ${url}`);
  });
  next();
});

app.use(bodyParser.json());

// Webhook setup
app.get('/webhook', (req, res) => {
  if (req.query['hub.mode'] === 'subscribe' &&
    req.query['hub.verify_token'] === FB_VERIFY_TOKEN) {
    res.send(req.query['hub.challenge']);
  } else {
    res.sendStatus(400);
  }
});

// Message handler
app.post('/webhook', (req, res) => {
  // Parse the Messenger payload
  // See the Webhook reference
  // https://developers.facebook.com/docs/messenger-platform/webhook-reference
  const data = req.body;

  if (data.object !== 'page') {
    return;
  }

  data.entry.forEach(entry => {
    entry.messaging.forEach(event => {
      if (event.message && !event.message.is_echo) {
        // Yay! We got a new message!
        // We retrieve the Facebook user ID of the sender
        const sender = event.sender.id;

        // We retrieve the user's current session, or create one if it doesn't exist
        // This is needed for our bot to figure out the conversation history
        const sessionId = findOrCreateSession(sender);

        // We retrieve the message content
        const {text, attachments} = event.message;

        if (attachments) {
          // We received an attachment
          // Let's reply with an automatic message
          fbMessage(sender, 'Sorry I can only process text messages for now.')
          .catch(console.error);
        } else if (text) {
          // We received a text message

          // Let's forward the message to the Wit.ai Bot Engine
          // This will run all actions until our bot has nothing left to do
          handleMessage(text)
          .then(console.log)
          .catch(console.err)

          // wit.runActions(
          //   sessionId, // the user's current session
          //   text, // the user's message
          //   sessions[sessionId].context // the user's current session state
          // ).then(context => {
          //   // Our bot did everything it has to do.
          //   // Now it's waiting for further messages to proceed.
          //   console.log('Waiting for next user messages');
          //
          //   // Based on the session state, you might want to reset the session.
          //   // This depends heavily on the business logic of your bot.
          //   // Example:
          //   // if (context['done']) {
          //   //   delete sessions[sessionId];
          //   // }
          //
          //   // Updating the user's current session state
          //   sessions[sessionId].context = context;
          // })
          // .catch(err => {
          //   console.error('Oops! Got an error from Wit: ', err.stack || err);
          // })
        }
      } else {
        console.log('received event', JSON.stringify(event));
      }
    });
  });

  res.sendStatus(200);
});

app.listen(PORT);

console.log('Listening on :' + PORT + '...');
