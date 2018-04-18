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
    Promise.all([
      dynamo.getUser(deviceId, borrower),
      dynamo.getUser(deviceId, creditor)
    ])
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
                if(propertyName == Object.keys(creditorUserIouItem)[Object.keys(creditorUserIouItem).length-1]) {
                  emitString += ` and `;
                }
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
  },
  'OweEveryoneIntent': function () {
    const deviceId = this.event.context.System.device.deviceId;
    const slots = this.event.request.intent.slots;
    const borrower = slots.Borrower.value;
    const alexa = this;

    //ensure borrower is a user on this device
    dynamo.getUser(deviceId, borrower).then((user) => {
      const userItem = user.Item;
      if(!userItem) {
        alexa.emit(':tell', `${borrower} does not exist on this device.`);
        return Promise.reject(new Error(`Borrower=${borrower} did not exist on device.`));
      }
       
      //User exists, check for IOUs
      const numCreditors = Object.keys(userItem.borrowed).length;
      if(numCreditors == 0) {
        //user owes nothing
        alexa.emit(':tell', `${borrower} has IOUs at this time.`);
        return Promise.resolve(`${borrower} owes no money at this time.`);
      } else {

        var alexaTellString = `${borrower} owes `;
        var totalOwed = 0;
        for(var creditorName in userItem.borrowed) {
          //prepend 'and' to last part of tell string if last creditor
          if(creditorName == Object.keys(userItem.borrowed)[Object.keys(userItem.borrowed).length-1]) {
            alexaTellString += ` and `;
          }
          var result = getCreditorString(userItem.borrowed, creditorName);
          if(result) {
            alexaTellString += `${creditorName} ${result.total} dollars, `;
            totalOwed += result.total;
          }
        }  

        //If total is zero, user owes nothing
        if(totalOwed <= 0) {
          alexa.emit(':tell', `${borrower} has no IOUs at this time.`);
          return Promise.resolve(`${borrower} owes no money at this time.`);
        }
        
        //Otherwise, add total to string and emit response
        const totalTellString = `coming to a total of ${totalOwed} dollars.`;
        alexa.emit(':tell', alexaTellString + totalTellString);
        return Promise.resolve(totalTellString);
      }
    }).catch((err) => {
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

/*********************************************
  getCreditorString
  returns tuple consisting of a string used 
  for Alexa to tell the user about what they 
  owe a certain creditor, and the total they owe
  that creditor.

  @borrowed : borrower's borrowed attribute
    EX: user.Item.borrowed
  @creditorName : creditor for string to be created for
    EX: 'Chris'
**********************************************/
function getCreditorString(borrowed, creditorName) {
  if(!borrowed || !creditorName || !borrowed[creditorName]) {
    return null;
  }

  var alexaTellString = `${creditorName} `;
  var itemsOwed = borrowed[creditorName];
  var total = 0;
  for(var categoryName in itemsOwed) {
    if(!itemsOwed[categoryName].paid) {
      var amount = itemsOwed[categoryName].amount;
      total += amount;
      alexaTellString += `${amount} for ${categoryName}, `;
    }
  }

  //If no total, user has paid all debts to creditor
  if(total == 0) {
    return null;
  }

  const result = {
    total: total,
    tellString: alexaTellString
  }

  console.log(JSON.stringify(result));

  return result;
}






