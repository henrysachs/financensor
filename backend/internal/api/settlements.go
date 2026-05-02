package api

import (
	"net/http"
	"sort"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/henrysachs/financensor/backend/internal/auth"
	"github.com/henrysachs/financensor/backend/internal/model"
	"github.com/jmoiron/sqlx"
)

type settlementResponse struct {
	FromUserID  string `json:"fromUserId"`
	ToUserID    string `json:"toUserId"`
	AmountCents int64  `json:"amountCents"`
}

func calculateSettlements(db *sqlx.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		groupID := chi.URLParam(r, "groupID")
		userID := auth.GetUserID(r.Context())

		if !isMember(db, groupID, userID) {
			writeError(w, http.StatusForbidden, "not a member")
			return
		}

		// Get all purchases with assignments for this group
		type purchaseRow struct {
			PurchaseID   string `db:"purchase_id"`
			AmountCents  int64  `db:"amount_cents"`
			PaidByUserID string `db:"paid_by_user_id"`
		}

		var purchases []purchaseRow
		err := db.Select(&purchases, `
			SELECT id as purchase_id, amount_cents, paid_by_user_id
			FROM purchases WHERE group_id = ?
		`, groupID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to get purchases")
			return
		}

		// balance[userID] = net amount (positive = owed money, negative = owes money)
		balance := make(map[string]int64)

		for _, p := range purchases {
			var assignments []model.Assignment
			db.Select(&assignments, "SELECT id, purchase_id, user_id, custom_share_cents FROM assignments WHERE purchase_id = ?", p.PurchaseID)

			if len(assignments) == 0 {
				continue
			}

			// Calculate shares
			totalCustom := int64(0)
			customCount := 0
			for _, a := range assignments {
				if a.CustomShareCents != nil {
					totalCustom += *a.CustomShareCents
					customCount++
				}
			}

			// Payer gets credited
			balance[p.PaidByUserID] += p.AmountCents

			// Distribute costs
			if customCount == len(assignments) {
				// All custom shares
				for _, a := range assignments {
					balance[a.UserID] -= *a.CustomShareCents
				}
			} else {
				// Equal split for non-custom, remainder to first
				remaining := p.AmountCents - totalCustom
				equalCount := len(assignments) - customCount
				shareEach := remaining / int64(equalCount)
				remainder := remaining - shareEach*int64(equalCount)

				first := true
				for _, a := range assignments {
					if a.CustomShareCents != nil {
						balance[a.UserID] -= *a.CustomShareCents
					} else {
						share := shareEach
						if first {
							share += remainder
							first = false
						}
						balance[a.UserID] -= share
					}
				}
			}
		}

		// Min-cash-flow algorithm
		settlements := minCashFlow(balance)

		writeJSON(w, http.StatusOK, settlements)
	}
}

func markSettlementPaid(db *sqlx.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		groupID := chi.URLParam(r, "groupID")
		settlementID := chi.URLParam(r, "settlementID")
		userID := auth.GetUserID(r.Context())

		if !isMember(db, groupID, userID) {
			writeError(w, http.StatusForbidden, "not a member")
			return
		}

		// Check if settlement exists, if not create it from the request
		var exists bool
		err := db.Get(&exists, "SELECT EXISTS(SELECT 1 FROM settlements WHERE id = ? AND group_id = ?)", settlementID, groupID)
		if err != nil || !exists {
			// Create settlement record from request body
			writeError(w, http.StatusNotFound, "settlement not found")
			return
		}

		_, err = db.Exec("UPDATE settlements SET is_paid = 1 WHERE id = ? AND group_id = ?", settlementID, groupID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to mark as paid")
			return
		}

		writeJSON(w, http.StatusOK, map[string]string{"status": "paid"})
	}
}

// persistSettlements saves calculated settlements to DB and returns them with IDs
func persistSettlements(db *sqlx.DB, groupID string, settlements []settlementResponse) []model.Settlement {
	result := make([]model.Settlement, 0, len(settlements))
	for _, s := range settlements {
		id := uuid.New().String()
		db.Exec(`
			INSERT OR REPLACE INTO settlements (id, group_id, from_user_id, to_user_id, amount_cents, is_paid)
			VALUES (?, ?, ?, ?, ?, 0)
		`, id, groupID, s.FromUserID, s.ToUserID, s.AmountCents)
		result = append(result, model.Settlement{
			ID:          id,
			GroupID:     groupID,
			FromUserID:  s.FromUserID,
			ToUserID:    s.ToUserID,
			AmountCents: s.AmountCents,
			IsPaid:      false,
		})
	}
	return result
}

// minCashFlow calculates minimum number of transactions to settle all debts
func minCashFlow(balance map[string]int64) []settlementResponse {
	type entry struct {
		userID string
		amount int64
	}

	// Filter out zero balances
	var entries []entry
	for uid, amt := range balance {
		if amt != 0 {
			entries = append(entries, entry{uid, amt})
		}
	}

	// Sort: debtors (negative) first, creditors (positive) last
	sort.Slice(entries, func(i, j int) bool {
		return entries[i].amount < entries[j].amount
	})

	var result []settlementResponse
	left, right := 0, len(entries)-1

	for left < right {
		debtor := entries[left]
		creditor := entries[right]

		amount := min(-debtor.amount, creditor.amount)
		if amount > 0 {
			result = append(result, settlementResponse{
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

	return result
}
