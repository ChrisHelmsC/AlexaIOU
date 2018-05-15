'use strict';
const Alexa = require('alexa-sdk');
const dynamo = require('./dynamo.js');
const helper = require('./itemHelper.js');
const APP_ID = process.env.APP_ID;

const handlers = {
  'LaunchRequest': function () {
    this.emit(':ask', 'Welcome to the I O U skill. This skill can be used for keeping track of your debts and IOUs.');
  },
  'Unhandled': function () {
    console.error(this.event);
    this.emit(':tell', 'Unhandled intent requested');
  },
  'AMAZON.HelpIntent': function () {
    this.emit(':ask', 'You can begin by adding users to this device by telling IOU to add a user. A debt can be added by telling IOU to add a debt between two users for a certain amount of money, and what the debt is for. An example would be "Alexa, tell IOU that Chris owes Alex five dollars for coffee. Once debts are stored, IOU can repeat the debt back to the users, list off the total amount a user owes, or allow users to mark debts as payed off. What would you like to do?');
  }, 
  'SplitPayment': function () {
    const deviceId = this.event.context.System.device.deviceId;
    const slots = this.event.request.intent.slots;
    const creditor = slots.Creditor.value.toLowerCase();
    const amount = slots.Amount.value;
    const category = slots.Category.value;
    dynamo.getUsersForDevice(deviceId)
      .then(users => {
        const borrowers = users.filter(u => u.Item.name != creditor);
        console.log(borrowers);
        const sdf = borrowers.map(borrower => dynamo.addIouForUsers(deviceId, borrower, creditor, amount, category));
        return Promise.all(sdf);
      })
      .then(debts => {
        this.emit(':tell', `Okay, I have added that everyone owes ${creditor} ${amount} dollars for ${category}`);
      })
      .catch(err => {
        console.log(err);
        if (err.alexaMessage) {
          this.emit(':tell', err.alexaMessage);
        } else {
          this.emit(':tell', 'Sorry, I am unable to complete that request at this time.');
        }
      });
  },
  'AddDebtIntent': function () {
    //Grab information from intent request
    const deviceId = this.event.context.System.device.deviceId;
    const slots = this.event.request.intent.slots;
    const creditor = slots.Creditor.value.toLowerCase();
    const borrower = slots.Borrower.value.toLowerCase();
    const amount = slots.Amount.value;
    const category = slots.Category.value;

    //add IOU for both users
    dynamo.addIouForUsers(deviceId, borrower, creditor, amount, category)
      .then((data) => {
        this.emit(':tell', `Okay, I have added that ${borrower} owes ${creditor} ${amount} dollars for ${category}`);
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
    const roommate = this.event.request.intent.slots.Roommate.value.toLowerCase();
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
    const creditor = slots.Creditor.value ? slots.Creditor.value.toLowerCase() : slots.Creditor.value;
    const borrower = slots.Borrower.value ? slots.Borrower.value.toLowerCase() : slots.Borrower.value;
    const category = slots.Category.value;
    const alexa = this;
    console.log(`category value ${category}`)

    //Check if both users exist for the given device
    Promise.all([
      dynamo.getUser(deviceId, borrower),
      dynamo.getUser(deviceId, creditor)
    ])
      .then((users) => {
        const borrowerItem = users[0].Item;
        const creditorItem = users[1].Item;
        /*if (!borrowerItem && !creditorItem) {
          alexa.emit(':tell', `${borrower} and ${creditor} do not exist on this device.`);
          return Promise.reject(new Error(`Borrower=${borrower} and Creditor=${creditor} do not exist on device.`));
        } else if (!borrowerItem) {
          alexa.emit(':tell', `${borrower} does not exist on this device.`);
          return Promise.reject(new Error(`Borrower=${borrower} did not exist on device.`));
        } else if (!creditorItem) {
          alexa.emit(':tell', `${creditor} does not exist on this device.`);
          return Promise.reject(new Error(`Creditor=${creditor} did not exist on device.`));
        }*/

        const creditorUserIouItem = borrowerItem.borrowed[creditor];
        if (creditorUserIouItem) {
          //Borrower owes creditor something
          console.log('Item between parties is found');
          console.log(`Category is ${category} just before check`)
          if (category) {
            console.log('category: ' + JSON.stringify(category));
            if (creditorUserIouItem[category] && !creditorUserIouItem[category].paid) {
              console.log('category is not paid off');
              const amount = creditorUserIouItem[category].amount;
              alexa.emit(':tell', `${borrower} owes ${creditor} ${amount} dollars for ${category}.`);
              Promise.resolve(`${borrower} owes ${creditor} ${amount} dollars for ${category}.`);
            } else {
              alexa.emit(':tell', `${borrower} does not owe ${creditor} anything for ${category}.`);
              Promise.resolve(`${borrower} does not owe ${creditor} anything for ${category}.`);
            }
          } else {
            //Total up everything borrower owes and emit string
            var emitString = `${borrower} owes ${creditor} `;
            var totalAmount = 0;

            //Special wording for only owing one item
            if (Object.keys(creditorUserIouItem).length == 1) {
              console.log('Only one item');
              var propertyName = Object.keys(creditorUserIouItem)[0];
              if (!creditorUserIouItem[propertyName].paid) {
                totalAmount = creditorUserIouItem[propertyName].amount;
                emitString += `${totalAmount} dollars for ${propertyName} `;
              }
            } else {
              console.log('multiple items');
              const unpayedDebts = helper.getUnpayedDebtsForCreditor(creditorUserIouItem);
              for (var category in unpayedDebts) {
                if (category == Object.keys(unpayedDebts)[Object.keys(unpayedDebts).length - 1]
                  && Object.keys(unpayedDebts).length > 1) {
                  emitString += ` and `;
                }
                var amount = unpayedDebts[category].amount;
                console.log(`amount is ${amount}`);
                totalAmount += amount;
                emitString += `${amount} dollars for ${category}, `;
              }
              emitString += `giving a grand total of ${totalAmount} dollars owed.`;
            }

            console.log(`total amount: ${totalAmount}`)
            if (totalAmount > 0) {
              alexa.emit(`:tell`, emitString);
              return Promise.resolve(emitString)
            }
          }
        }

        //Borrower owes creditor nothing at all
        const baseString = `${borrower} does not owe ${creditor} anything `;
        var categoryString = ``;
        if (category) {
          categoryString = `for ${category}`;
        }
        alexa.emit(':tell', baseString + categoryString);
        return Promise.resolve(baseString + categoryString);
      })
      .catch((err) => {
        this.emit(':tell', 'Sorry, I am unable to complete that request at this time.');
        console.error(err);
      });
  },
  'OweEveryoneIntent': function () {
    const deviceId = this.event.context.System.device.deviceId;
    const slots = this.event.request.intent.slots;
    const borrower = slots.Borrower.value.toLowerCase();
    const alexa = this;

    //ensure borrower is a user on this device
    dynamo.getUser(deviceId, borrower).then((user) => {
      const userItem = user.Item;
      if (!userItem) {
        alexa.emit(':tell', `${borrower} does not exist on this device.`);
        return Promise.reject(new Error(`Borrower=${borrower} did not exist on device.`));
      }

      //User exists, check for IOUs
      const unpayedCreditorsAndDebts = helper.getCreditorsAndUnpayedDebts(userItem.borrowed);
      const numCreditors = Object.keys(unpayedCreditorsAndDebts).length;
      console.log(unpayedCreditorsAndDebts);
      console.log(numCreditors);
      if (numCreditors == 0) {
        //user owes nothing
        alexa.emit(':tell', `${borrower} has no IOUs at this time.`);
        return Promise.resolve(`${borrower} owes no money at this time.`);
      } else {
        var alexaTellString = `${borrower} owes `;
        var totalOwed = 0;
        for (var creditorName in unpayedCreditorsAndDebts) {
          //prepend 'and' to last part of tell string if last creditor
          if (creditorName == Object.keys(unpayedCreditorsAndDebts)[Object.keys(unpayedCreditorsAndDebts).length - 1]
            && numCreditors != 1) {
            alexaTellString += ` and `;
          }
          var result = getCreditorString(unpayedCreditorsAndDebts, creditorName);
          if (result) {
            alexaTellString += `${creditorName} ${result.total} dollars, `;
            totalOwed += result.total;
          }
        }

        //If total is zero, user owes nothing
        if (totalOwed <= 0) {
          alexa.emit(':tell', `${borrower} has no IOUs at this time.`);
          return Promise.resolve(`${borrower} owes no money at this time.`);
        }

        //Otherwise, add total to string and emit response
        const totalTellString = `coming to a total of ${totalOwed} dollars.`;
        alexa.emit(':tell', alexaTellString + totalTellString);
        return Promise.resolve(totalTellString);
      }
    }).catch((err) => {
      alexa.emit(`:tell`, `Sorry, I am unable to complete that request at this time.`);
      console.error(err);
    });
  },
  'PayOffDebtIntent': function () {
    const deviceId = this.event.context.System.device.deviceId;
    const slots = this.event.request.intent.slots;
    const creditor = slots.Creditor.value.toLowerCase();
    const borrower = slots.Borrower.value.toLowerCase();
    const category = slots.Category.value;
    const alexa = this;

    //Check if getting specific creditor
    if (creditor) {
      Promise.all([
        dynamo.getUser(deviceId, borrower),
        dynamo.getUser(deviceId, creditor)
      ]).then((users) => {
        const borrowerItem = users[0].Item;
        const creditorItem = users[1].Item;

        //Ensure both users are real people on this device
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

        const borrowed = borrowerItem.borrowed[creditor];
        const credited = creditorItem.credited[borrower];
        if (!borrowed || !credited) {
          alexa.emit(`:tell`, `${borrower} does not owe ${creditor} aything.`);
          return Promise.resolve(`${borrower} does not owe ${creditor} aything.`);
        }

        console.log('getting unpayed debts');
        const unpayedDebts = helper.getUnpayedDebtsForCreditor(borrowed);
        const unpayedLoans = helper.getUnpayedDebtsForCreditor(credited);

        //check if specific thing is being payed off 
        console.log('Checking category');
        if (category) {
          if (!unpayedDebts[category] || !unpayedLoans[category]) {
            alexa.emit(`:tell`, `${borrower} does not owe ${creditor} anything for ${category}.`);
            return Promise.resolve(`${borrower} does not owe ${creditor} anything for ${category}.`);
          }

          const specificUnpaidDebt = unpayedDebts[category];
          const specificUnpaidLoan = unpayedLoans[category];
          specificUnpaidDebt.paid = true;
          specificUnpaidLoan.paid = true;

          //Add users to lsit to be updated in table
          const userList = [borrowerItem, creditorItem];
          dynamo.putListOfUsers(deviceId, userList).then((response) => {
            alexa.emit(`:tell`, `${borrower} paid off ${creditor} ${specificUnpaidDebt.amount} dollars for ${category}.`);
            return Promise.resolve(`${borrower} paid off ${creditor} ${specificUnpaidDebt.amount} dollars for ${category}.`);
          });
        } else {
          //Borrower is paying off all debts to an individual
          console.log('no category specified');
          var total = 0;
          var alexaTellString = `Paid ${creditor} `;
          console.log('paying debts');
          for (var debt in unpayedDebts) {
            if (debt == Object.keys(unpayedDebts)[Object.keys(unpayedDebts).length - 1] && Object.keys(unpayedDebts).length != 1) {
              alexaTellString += ` and `;
            }
            var amount = helper.payOffDebt(unpayedDebts[debt]);
            helper.payOffDebt(unpayedLoans[debt]);
            total += amount;
            alexaTellString += `${amount} dollars for ${debt},`;
          }

          //Add final amount to tell string
          console.log('creating final tell string');
          alexaTellString += `Coming to a total of ${total} dollars.`;

          if (total <= 0) {
            console.log('no total');
            alexa.emit(`:tell`, `${borrower} does not owe ${creditor} anything.`);
            return Promise.resolve(`${borrower} does not owe ${creditor} anything.`);
          }

          console.log('putting users');
          const userList = [borrowerItem, creditorItem];
          dynamo.putListOfUsers(deviceId, userList).then((response) => {
            console.log('users put');
            alexa.emit(`:tell`, alexaTellString);
            return Promise.resolve(alexaTellString);
          });
        }
      })
    } else {
      //No specific creditor, paying off all debts
      dynamo.getUser(deviceId, borrower).then((user) => {
        if (!user.Item) {
          alexa.emit(':tell', `${borrower} does not exist on this device.`);
          return Promise.reject(new Error(`Borrower=${borrower} did not exist on device.`));
        }

        //Iterate over users, total amount payed and pay off pending IOUs
        const userBorrowed = user.Item.borrowed;
        var grandTotal = 0;
        var alexaTellString = `Paid off `;
        const userList = [];
        for (var creditorName in userBorrowed) {
          if (creditorName == Object.keys(userBorrowed)[Object.keys(userBorrowed).length - 1] && Object.keys(userBorrowed).length != 1) {
            alexaTellString += ` and `;
          }
          var unpayedDebts = helper.getUnpayedDebtsForCreditor(userBorrowed[creditorName]);
          var userTotal = helper.payOffDebts(unpayedDebts);
          userList.push(creditorName);

          //If debts were paid to user, add to total and to alexa string
          if (userTotal > 0) {
            grandTotal += userTotal;
            alexaTellString += `${userTotal} dollars to ${creditorName}, `;
          }
        }

        //Get all users who borrower is paying back
        console.log('Getting users');
        dynamo.getListOfUsers(deviceId, userList).then((batchUserResponse) => {
          if (batchUserResponse.Responses) {
            console.log('getList:' + JSON.stringify(batchUserResponse));
            var userRowList = batchUserResponse.Responses[process.env.IOU_TABLE];
            helper.payOffAllCreditors(borrower, userRowList);
            console.log('Users paid:' + JSON.stringify(userRowList));

            //Add borrower to list of users to get updated
            userRowList.push(user.Item);

            //Update DB
            dynamo.putListOfUsers(deviceId, userRowList).then((putResponse) => {
              if (putResponse) {
                //Finish string if users were paid off, otherwise let user know they owed nothing
                if (grandTotal > 0) {
                  alexaTellString += ` coming to a total of ${grandTotal} dollars.`;
                  alexa.emit(':tell', alexaTellString);
                  return Promise.resolve(alexaTellString);
                } else {
                  alexa.emit(':tell', `${borrower} currently does not owe anyone money.`);
                  return Promise.resolve(`${borrower} currently does not owe anyone money.`);
                }
              }
            }).catch((err) => {
              this.emit(':tell', 'Sorry, I am unable to complete that request at this time.');
              console.error(err);
            });
          }
        });
      })
        .catch((err) => {
          this.emit(':tell', 'Sorry, I am unable to complete that request at this time.');
          console.error(err);
        })
    }
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
  if (!borrowed || !creditorName || !borrowed[creditorName]) {
    return null;
  }

  var alexaTellString = `${creditorName} `;
  var itemsOwed = borrowed[creditorName];
  var total = 0;
  for (var categoryName in itemsOwed) {
    if (!itemsOwed[categoryName].paid) {
      var amount = itemsOwed[categoryName].amount;
      total += amount;
      alexaTellString += `${amount} for ${categoryName}, `;
    }
  }

  //If no total, user has paid all debts to creditor
  if (total == 0) {
    return null;
  }

  const result = {
    total: total,
    tellString: alexaTellString
  }

  console.log(JSON.stringify(result));

  return result;
}






