// Package settle implements the minimum cash flow algorithm for settling group debts.
package settle

import "sort"

// Transfer represents a single payment from one user to another.
type Transfer struct {
	FromUserID  string
	ToUserID    string
	AmountCents int64
}

// MinCashFlow calculates the minimum number of transactions to settle all debts.
// The balance map keys are user IDs; positive values mean the user is owed money,
// negative values mean the user owes money.
func MinCashFlow(balance map[string]int64) []Transfer {
	type entry struct {
		userID string
		amount int64
	}

	var entries []entry
	for uid, amt := range balance {
		if amt != 0 {
			entries = append(entries, entry{uid, amt})
		}
	}

	sort.Slice(entries, func(i, j int) bool {
		return entries[i].amount < entries[j].amount
	})

	var result []Transfer
	left, right := 0, len(entries)-1

	for left < right {
		debtor := entries[left]
		creditor := entries[right]

		amount := min(-debtor.amount, creditor.amount)
		if amount > 0 {
			result = append(result, Transfer{
				FromUserID:  debtor.userID,
				ToUserID:    creditor.userID,
				AmountCents: amount,
			})
		}

		entries[left].amount += amount
		entries[right].amount -= amount

		if entries[left].amount == 0 {
			left++
		}
		if entries[right].amount == 0 {
			right--
		}
	}

	if result == nil {
		result = []Transfer{}
	}

	return result
}
