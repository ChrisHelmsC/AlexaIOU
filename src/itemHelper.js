module.exports.getUnpayedDebtsForCreditor =  (creditorName) => {
	if(!creditorName) {
		return null;
	} else {
		return Object.entries(creditorName).filter(category => !category.paid);
	}
}

module.exports.getCreditorsAndUnpayedDebts = (borrowedList) => {
	if (!borrowedList) {
		return null;
	} else {
		return Object.entries(borrowedList)
			.map(module.exports.getUnpayedDebtsForCreditor)
			.filter(unpaid => Object.keys(unpaid).length > 0);
	}
}

module.exports.getTotalUnpayedFromDebts = (debts) => {
	return debts ? debts.reduce((a,c) => a + c, 0) : 0;
}

module.exports.payOffDebt = (debt) => {
	if (debt && !debt.paid) {
		debt.paid = true;
		return debt.amount;
	} else {
		return 0;
	}
}

module.exports.payOffDebts = (debts) => {
	if (debts) {
		return debts.filter(debt => !debt.paid)
			.reduce((total, debt) => {
				debt.paid = true;
				return total + debt.amount;
			}, 0);
	} else {
		return 0;
	}
}

module.exports.payOffAllCreditors = (borrower, userRowList) => {
	if(userRowList) {
		console.log('Yes user row list');
		userRowList.forEach((userRow) => {
			const loanedBorrower = userRow.credited[borrower];
			console.log('loaned borrower' + JSON.stringify(loanedBorrower));
			module.exports.payOffDebts(loanedBorrower);
			console.log('are debts payed' + JSON.stringify(loanedBorrower));
		});
	}
}