module.exports.getUnpayedDebtsForCreditor =  (creditorName) => {
	if(!creditorName) {
		return null;
	}

	var unpayedDebts = {};
	for(var category in creditorName) {
		if(!creditorName[category].paid) {
			unpayedDebts[category] = creditorName[category];
		}
	}

	return unpayedDebts;
}

module.exports.getCreditorsAndUnpayedDebts = (borrowedList) => {
	if(!borrowedList) {
		return null;
	}

	const creditorsAndUnpayedDebts = {};
	for(var creditor in borrowedList) {
		var unpayedDebts = module.exports.getUnpayedDebtsForCreditor(borrowedList[creditor]);
		if(Object.keys(unpayedDebts).length > 0) {
			creditorsAndUnpayedDebts[creditor] = module.exports.getUnpayedDebtsForCreditor(borrowedList[creditor]);
		}
	}

	return creditorsAndUnpayedDebts;
}

module.exports.getTotalUnpayedFromDebts =  (debts) => {
	var total = 0;
	if(debts) {
		for(var iou in debts) {
			total += debts[iou].amount;
		}
	}
	return total;
}

module.exports.payOffDebt =  (debt) => {
	if(debt) {
		if(!debt.paid) {
			debt.paid = true;
			return debt.amount;
		}
	}
	return 0;
}

module.exports.payOffDebts = (debts) => {
	var total = 0;
	if(debts) {
		for(var debt in debts) {
			if(!debts[debt].paid) {
				debts[debt].paid = true;
				total += debts[debt].amount;
			}
		}
	}
	return total;
}

module.exports.payOffAllCreditors = (borrower, userRowList) => {
	if(userRowList) {
		console.log('Yes user row list');
		userRowList.forEach(function(userRow) {
			const loanedBorrower = userRow.credited[borrower];
			console.log('loaned borrower' + JSON.stringify(loanedBorrower));
			module.exports.payOffDebts(loanedBorrower);
			console.log('are debts payed' + JSON.stringify(loanedBorrower));
		});
	}
}