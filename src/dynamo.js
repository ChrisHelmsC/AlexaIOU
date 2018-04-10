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
	@category: what the money is owed forfu
	@callback: function that is executed when add succeeds
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