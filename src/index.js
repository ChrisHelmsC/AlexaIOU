'use strict';
const Alexa = require('alexa-sdk');
const dynamo = require('./dynamo.js');
const APP_ID = process.env.APP_ID;

const handlers = {
  'LaunchRequest': function() {
    this.emit(':tell', 'Welcome to the I O U skill');
  }, 'Unhandled': function() {
    this.emit(':ask', 'Unhandled intent requested');
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

    var deviceId = this.event.context.System.device.deviceId;
    var roommate =  this.event.request.intent.slots.Roommate.value;
    var alexa = this;

    /*Callback for get user function. If user cannot be found, newuser is added.
      If user is found, do not add new user and let user know they already exist.*/
    function getUserCallback(err, data) {
      if(err) {
        console.error('Unable to get roomate. JSON: ', JSON.stringify(err, null, 2));
        alexa.emit(':tell', 'Sorry, I was unable to complete that request');
      } else {
        //If data object is empty, we can safely add the new user, otherwise report error
        if(data) {
          if(Object.keys(data).length > 0) {
            alexa.emit(':tell', 'I could not add that user because they already exist on this device');
          } else {
            //If user cannot be found in table, add them
            function addUserCallback(err, data) {
              if(err) {
                console.error('Could not insert new user. JSON: ', JSON.stringify(err, null, 2));
                alexa.emit(':tell', 'Sorry, I was unable to complete that request');
              } else  {
                alexa.emit(':tell', `I have added ${roommate} as a user on this device.`);
                console.log(data);
              }
            }

            dynamo.addUser(deviceId, roommate, addUserCallback);
          }
        } else {
          alexa.emit(':tell', 'Sorry, I was unable to complete that request');
        }
      }
    }

    dynamo.getUser(deviceId, roommate, getUserCallback);
  }
};

module.exports.handler = (event, context, callback) => {
  const alexa = Alexa.handler(event, context, callback);
  alexa.appId = APP_ID;
  alexa.registerHandlers(handlers);
  alexa.execute();
};

function isEmpty() {

}