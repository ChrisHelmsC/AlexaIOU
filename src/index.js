'use strict';
const Alexa = require('alexa-sdk');

const APP_ID = process.env.APP_ID;

const handlers = {
  'LaunchRequest': function() {
    this.emit(':tell', 'Welcome to the I O U skill');
  },
  'AddDebtIntent': function() {
    this.emit(':tell', 'Adding debt');
  },
  'AddRoommateIntent': function() {
    this.emit(':tell', 'Adding roommate');
  }
};

module.exports.handler = (event, context, callback) => {
  const alexa = Alexa.handler(event, context, callback);
  alexa.appId = APP_ID;
  alexa.registerHandlers(handlers);
  alexa.execute();
};