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

	// Get referenced users from iou table
	return Promise.all([
		module.exports.getUser(deviceId, borrower),
		module.exports.getUser(deviceId, creditor)
	])
	.then((data) => {
		const borrowerItem = data[0].Item;
		const creditorItem = data[1].Item;
		if (!borrowerItem) {
			var borrowerError = new Error('Unable to get requested borrower.');
			borrowerError.alexaMessage = `${borrower} is not currently a user for this device.`;
			return Promise.reject(borrowerError);
		}
		if(!creditorItem) {
			var creditorError = new Error('Unable to get requested creditor.');
			creditorError.alexaMessage = `${creditor} is not currently a user for this device.`;
			return Promise.reject(creditorError);
		}

		// format amount as USD, create iou
		const formattedAmount = Number(parseFloat(amount).toFixed(2));
		const iou = {
			amount: formattedAmount,
			created: new Date(Date.now()).toLocaleString(),
			paid: false
		}

		// Add item to borrower and creditors rows
		if(creditor in borrowerItem.borrowed) {
			if(category in borrowerItem.borrowed[creditor]) {
				// User already owes/credits for this category,
				// add new amount owed/borrowed
				 borrowerItem.borrowed[creditor][category].amount += formattedAmount;
				 creditorItem.credited[borrower][category].amount += formattedAmount;
			} else {
				// Users do not currently have an iou for this category
				borrowerItem.borrowed[creditor][category] = iou;
				creditorItem.credited[borrower][category] = iou;
			}
		} else {
			// Users do not yet have any ious between them
			borrowerItem.borrowed[creditor] = new Object();
			borrowerItem.borrowed[creditor][category] = iou;
			creditorItem.credited[borrower] = new Object();
			creditorItem.credited[borrower][category] = iou;
		}

		// create params and add to table
		  const params = {
			  RequestItems: {}
		  };
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
		  ];

		  const docClient = new AWS.DynamoDB.DocumentClient();
		  return docClient.batchWrite(params).promise();
	});
};

/********************************************
	addUser
	Adds a new roomate for a specific ID to the 
	IOU table.

	@deviceId: device user is associated with
	@roomate: name of user being added
	@callback: function executed once user is added
*********************************************/
module.exports.addUser = (deviceId, user) => {
	//Create item representing new user, table params for new row
	const newUserItem = new Item(deviceId, user);
	const params = {
		TableName: process.env.IOU_TABLE,
		Item: newUserItem
	};

	//Insert into DB
	const docClient = new AWS.DynamoDB.DocumentClient();
	return docClient.put(params).promise();
};

/********************************************
	getUser
	Gets a user and all associated ious from
	the iou table

	@deviceId: device associated with user
	@user: user's name on table
	@callback: function for using data retrieved from table
*********************************************/
module.exports.getUser = (deviceId, user) => {
	//create item for selecting user
	const paramsKey = {
		device_id: deviceId,
		user_name: user
	};
	const params = {
		TableName: process.env.IOU_TABLE,
		Key: paramsKey
	};

	//grab user from DB
	const documentClient = new AWS.DynamoDB.DocumentClient();
	return documentClient.get(params).promise();
};

module.exports.putListOfUsers = (deviceId, userArray) => {
	if(!deviceId || !userArray) {
		return null;
	}

	const params = {
		RequestItems: {}
	};
	var putItemsHere = params.RequestItems[process.env.IOU_TABLE] = [];

	userArray.forEach(function(userItem) {
		putItemsHere.push({
			PutRequest: {
				Item: userItem
			}
		});
	})

	const docClient = new AWS.DynamoDB.DocumentClient();
	return docClient.batchWrite(params).promise();
}

module.exports.getListOfUsers = (deviceId, userArray) => {
	if(!deviceId || !userArray) {
		return null;
	}

	const params = {
		RequestItems: {}
	};
	params.RequestItems[process.env.IOU_TABLE] = {};
	var keys = params.RequestItems[process.env.IOU_TABLE]['Keys'] = [];

	userArray.forEach(function(user) {
		keys.push({
			device_id: deviceId,
			user_name: user
		});
	});

	console.log(JSON.stringify(keys));

	const documentClient = new AWS.DynamoDB.DocumentClient();
	return documentClient.batchGet(params).promise(); 
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
function Item(deviceId, user) {
	this.device_id = deviceId;
	this.user_name = user;
	this.borrowed = {};
	this.credited = {};
}