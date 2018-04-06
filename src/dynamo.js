'use strict';
const AWS = require('aws-sdk');

/********************************************
	addIouForUsers
	Adds an IOU to the IOU table for borrower 
	and creditor.

	@deviceId: device users are associated with
	@borrower: user borrowing money
	@creditor: user loaning money
	@amount: amount owed
	@category: what the money is owed for
*********************************************/
module.exports.addIouForUsers = (deviceId, borrower, creditor, amount, category) => {

	//create iou for users
	var iou = {
        borrower: borrower,
        creditor: creditor,
        amount: amount,
        category: category,
        created: new Date(Date.now()).toLocaleString(),
        paid: false
    }

	//Create table item from borrower and creditor
	var borrowerItem = new Item(deviceId, borrower, iou);
	var creditorItem = new Item(deviceId, creditor, null, iou);

  	//create params and add to table
  	var params = {
  		RequestItems: new Object()
  	}
  	params.RequestItems[process.env.IOU_TABLE] = [
  		{
  			PutRequest: {
  				Item: borrowerItem
  			}
  		},
  		{
  			PutRequest: {
  				Item: creditorItem
  			}
  		}
  	]

  	var docClient = new AWS.DynamoDB.DocumentClient();
  	docClient.batchWrite(params, function(err, data) {
  		if(err) {
  			console.error('Failed to insert new IOUs. JSON:', JSON.stringify(err, null, 2));
  		}
  	});
}

/********************************************
	addRoomate
	Adds a new roomate for a specific ID to the 
	IOU table.

	@deviceId: device user is associated with
	@roomate: name of user being added
*********************************************/
module.exports.addRoommate = (deviceId, roommate) => {
	//Create item representing new user, table params for new row
	var newUserItem = new Item(deviceId, roommate);
	var params = {
		TableName: process.env.IOU_TABLE,
		Item: newUserItem
	}

	//Insert into DB
	var docClient = new AWS.DynamoDB.DocumentClient();
	docClient.put(params, function(err, data) {
		if(err) {
			console.error('Could not insert new user. JSON: ', JSON.stringify(err, null, 2));
		}
	});
}

/********************************************
	Item()
	creates an Item object representing a row
	in the IOU table.

	@deviceId: device user is associated with
	@user: user IOU is being created for
	@borrowed: optional - populate with borrowed IOUs
	@credited: optional - populate with credited IOUs
*********************************************/
function Item(deviceId, user, borrowed, credited) {
	this.device_id = deviceId;
	this.user_name = user;
	if(borrowed) {
		this.borrowed = borrowed;
	} else if(credited){
		this.credited = credited;
	}
}