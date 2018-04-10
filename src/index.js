'use strict';
const Alexa = require('alexa-sdk');
const dynamo = require('./dynamo.js');
const APP_ID = process.env.APP_ID;

const handlers = {
  'LaunchRequest': function() {
    this.emit(':tell', 'Welcome to the I O U skill');
  },
  'Unhandled': function() {
    console.error(this.event);
    this.emit(':ask', 'Unhandled intent requested');
  },
  'AddDebtIntent': function() {
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
        this.emit(':tell', 'Adding debt');
      })
      .catch((err) => {
        this.emit(':tell', 'Sorry, I was unable to complete that request');
      });
  },
  'AddRoommateIntent': function() {
    const deviceId = this.event.context.System.device.deviceId;
    const roommate =  this.event.request.intent.slots.Roommate.value;
    const alexa = this;

    dynamo.getUser(deviceId, roommate)
      .then((user) => {
        if(Object.keys(user).length > 0) {
          return Promise.reject(new Error('too many keys: ' + JSON.stringify(user)));
        } else {
          // if user cannot be found in table, add them
          return dynamo.addUser(deviceId, roommate);
        }
      })
      .then((data) => {
        alexa.emit(':tell', `I have added ${roommate} as a user on this device.`);
      })
      .catch((err) => {
        console.error(err);
        alexa.emit(':tell', `${roommate} is already a user on this device`);
      });
  }
};

module.exports.handler = (event, context, callback) => {
  const alexa = Alexa.handler(event, context, callback);
  alexa.appId = APP_ID;
  alexa.registerHandlers(handlers);
  alexa.execute();
};
