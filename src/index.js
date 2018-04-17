'use strict';
const Alexa = require('alexa-sdk');
const dynamo = require('./dynamo.js');
const APP_ID = process.env.APP_ID;

const handlers = {
  'LaunchRequest': function () {
    this.emit(':tell', 'Welcome to the I O U skill');
  },
  'Unhandled': function () {
    console.error(this.event);
    this.emit(':ask', 'Unhandled intent requested');
  },
  'AddDebtIntent': function () {
    //Grab information from intent request
    const deviceId = this.event.context.System.device.deviceId;
    const slots = this.event.request.intent.slots;
    const creditor = slots.Creditor.value;
    const borrower = slots.Borrower.value;
    const amount = slots.Amount.value;
    const category = slots.Category.value;

    //add IOU for both users
    dynamo.addIouForUsers(deviceId, borrower, creditor, amount, category)
      .then((data) => {
        this.emit(':tell', 'Okay, I have added that I O U');
      })
      .catch((err) => {
        console.log(err);
        if (err.alexaMessage) {
          this.emit(':tell', err.alexaMessage);
        } else {
          this.emit(':tell', 'Sorry, I am unable to complete that request at this time.');
        }
      });
  },
  'AddRoommateIntent': function () {
    const deviceId = this.event.context.System.device.deviceId;
    const roommate = this.event.request.intent.slots.Roommate.value;
    const alexa = this;

    dynamo.getUser(deviceId, roommate)
      .then((user) => {
        if (Object.keys(user).length > 0) {
          const err = new Error('too many keys: ' + JSON.stringify(user));
          err.alexaMessage = `${roommate} is already a user on this device`;
          return Promise.reject(err);
        } else {
          // if user cannot be found in table, add them
          return dynamo.addUser(deviceId, roommate);
        }
      })
      .then((data) => {
        this.emit(':tell', `I have added ${roommate} as a user on this device.`);
      })
      .catch((err) => {
        console.error(err);
        if (err.alexaMessage) {
          this.emit(':tell', `${roommate} is already a user on this device`);
        } else {
          this.emit(':tell', 'Sorry, I am unable to complete that request at this time.')
        }
      });
  },
  'OweRoomateIntent': function () {
    const deviceId = this.event.context.System.device.deviceId;
    const slots = this.event.request.intent.slots;
    const creditor = slots.Creditor.value;
    const borrower = slots.Borrower.value;
    const category = slots.Category.value;
    const alexa = this;

    //Check if both users exist for the given device
    Promise.all(
      dynamo.getUser(deviceId, borrower),
      dynamo.getUser(deviceId, creditor)
    )
      .then((users) => {
        const borrowerItem = users[0].Item;
        const creditorItem = users[1].Item;
        if (!borrowerItem && !creditorItem) {
          alexa.emit(':tell', `${borrower} and ${creditor} do not exist on this device.`);
          return Promise.reject(new Error(`Borrower=${borrower} and Creditor=${creditor} do not exist on device.`));
        } else if (!borrowerItem) {
          alexa.emit(':tell', `${borrower} does not exist on this device.`);
          return Promise.reject(new Error(`Borrower=${borrower} did not exist on device.`));
        } else if (!creditorItem) {
          alexa.emit(':tell', `${creditor} does not exist on this device.`);
          return Promise.reject(new Error(`Creditor=${creditor} did not exist on device.`));
        }

        const creditorUserIouItem = borrowerItem.borrowed[creditor];
        if (creditorUserIouItem) {
          //Borrower owes creditor something
          console.log('Item between parties is found');
          if (category) {
            const amount = creditorUserIouItem[category].amount;
            alexa.emit(':tell', `${borrower} owes ${creditor} ${amount} dollars for ${category}.`);
          } else {
            //Total up everything borrower owes and emit string
            var emitString = `${borrower} owes ${creditor} `;
            var totalAmount = 0;

            if (Object.keys(creditorUserIouItem).length == 1) {
              var propertyName = Object.keys(creditorUserIouItem)[0];
              var amount = creditorUserIouItem[propertyName].amount;
              emitString += `${amount} dollars for ${propertyName} `;
            } else {
              for (var propertyName in creditorUserIouItem) {
                var amount = creditorUserIouItem[propertyName].amount;
                totalAmount += amount;
                emitString += `${amount} dollars for ${propertyName}, `;
              }
              emitString += `giving a grand total of ${totalAmount} dollars owed.`;
            }

            alexa.emit(`:tell`, emitString);
          }
        } else {
          //Borrower owes creditor nothing at all, ensure creditor exists
          const baseString = `${borrower} does not owe ${creditor} anything `;
          var categoryString = ``;
          if (category) {
            categoryString = `for ${category}`;
          }
          alexa.emit(':tell', baseString + categoryString);
        }
      })
      .catch((err) => {
        console.error(err);
      });
  }
};

module.exports.handler = (event, context, callback) => {
  const alexa = Alexa.handler(event, context, callback);
  alexa.appId = APP_ID;
  alexa.registerHandlers(handlers);
  alexa.execute();
};
