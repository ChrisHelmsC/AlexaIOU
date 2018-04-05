'use strict';
const Alexa = require('alexa-sdk');
const AWS = require('aws-sdk');

const APP_ID = process.env.APP_ID;

var docClient = new AWS.DynamoDB.DocumentClient();

const handlers = {
  'LaunchRequest': function() {
    this.emit(':tell', 'Welcome to the I O U skill');
  },
  'AddDebtIntent': function() {
    this.emit(':tell', 'Adding debt');

    //grab iou variables from event, create item for databse
    let deviceId = this.event.context.System.device.deviceId;
    let slots = this.event.request.intent.slots;
    var params = {
      TableName: process.env.IOU_TABLE,
      Item: {
        device_id: deviceId,
        borrower: slots.Borrower.value,
        iou: {
          creditor: slots.Creditor.value,
          amount: slots.Amount.value,
          category: slots.Category.value,
          created: new Date(Date.now()).toLocaleString()
        }
      }
    }

    //insert info into database
    docClient.put(params, function(err, data) {
      if(err) {
        console.error("Unable to add IOU. Error JSON:", JSON.stringify(err, null, 2));
      } else {
        console.log("Creation of new IOU row succeeded.");
      }
    })
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