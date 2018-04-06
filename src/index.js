'use strict';
const Alexa = require('alexa-sdk');
const dynamo = require('./dynamo.js');
const APP_ID = process.env.APP_ID;

const handlers = {
  'LaunchRequest': function() {
    this.emit(':tell', 'Welcome to the I O U skill');
  },
  'AddDebtIntent': function() {
    this.emit(':tell', 'Adding debt');

    //Grab information from intent request
    var deviceId = this.event.context.System.device.deviceId;
    var slots = this.event.request.intent.slots;
    var creditor = slots.Creditor.value;
    var borrower = slots.Borrower.value;
    var amount = slots.Amount.value;
    var category = slots.Category.value;

    //add IOU for both users
    dynamo.addIouForUsers(deviceId, borrower, creditor, amount, category);
  },
  'AddRoommateIntent': function() {
    this.emit(':tell', 'Adding roommate');

    var deviceId = this.event.context.System.device.deviceId;
    var roommate =  this.event.request.intent.slots.Roommate.value;
    dynamo.addRoommate(deviceId, roommate);
  }
};

module.exports.handler = (event, context, callback) => {
  const alexa = Alexa.handler(event, context, callback);
  alexa.appId = APP_ID;
  alexa.registerHandlers(handlers);
  alexa.execute();
};