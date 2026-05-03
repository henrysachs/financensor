package api

import (
	"context"
	"net/http"
	"sort"

	"github.com/danielgtaylor/huma/v2"
	"github.com/henrysachs/financensor/backend/internal/auth"
	"github.com/henrysachs/financensor/backend/internal/model"
	"github.com/jmoiron/sqlx"
)

// --- Input/Output types ---

type SettlementResponse struct {
	FromUserID  string `json:"fromUserId"`
	ToUserID    string `json:"toUserId"`
	AmountCents int64  `json:"amountCents"`
}

type CalculateSettlementsOutput struct {
	Body []SettlementResponse
}

type MarkSettlementPaidInput struct {
	GroupID      string `path:"groupID" doc:"Group ID"`
	SettlementID string `path:"settlementID" doc:"Settlement ID"`
}

// --- Route registration ---

func registerSettlementRoutes(api huma.API, db *sqlx.DB) {
	huma.Register(api, huma.Operation{
		OperationID: "calculate-settlements",
		Method:      http.MethodGet,
		Path:        "/groups/{groupID}/settlements",
		Summary:     "Calculate settlements for a group",
		Tags:        []string{"Settlements"},
	}, func(ctx context.Context, input *GroupPathParams) (*CalculateSettlementsOutput, error) {
		userID := auth.GetUserID(ctx)

		if !isMember(db, input.GroupID, userID) {
			return nil, huma.Error403Forbidden("not a member")
		}

		type purchaseRow struct {
			PurchaseID   string `db:"purchase_id"`
			AmountCents  int64  `db:"amount_cents"`
			PaidByUserID string `db:"paid_by_user_id"`
		}

		var purchases []purchaseRow
		err := db.Select(&purchases, `
			SELECT id as purchase_id, amount_cents, paid_by_user_id
			FROM purchases WHERE group_id = ?
		`, input.GroupID)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to get purchases", err)
		}

		balance := make(map[string]int64)

		for _, p := range purchases {
			var assignments []model.Assignment
			db.Select(&assignments, "SELECT id, purchase_id, user_id, custom_share_cents FROM assignments WHERE purchase_id = ?", p.PurchaseID)

			if len(assignments) == 0 {
				continue
			}

			totalCustom := int64(0)
			customCount := 0
			for _, a := range assignments {
				if a.CustomShareCents != nil {
					totalCustom += *a.CustomShareCents
					customCount++
				}
			}

			balance[p.PaidByUserID] += p.AmountCents

			if customCount == len(assignments) {
				for _, a := range assignments {
					balance[a.UserID] -= *a.CustomShareCents
				}
			} else {
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

		settlements := minCashFlow(balance)
		return &CalculateSettlementsOutput{Body: settlements}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "mark-settlement-paid",
		Method:      http.MethodPost,
		Path:        "/groups/{groupID}/settlements/{settlementID}/paid",
		Summary:     "Mark a settlement as paid",
		Tags:        []string{"Settlements"},
	}, func(ctx context.Context, input *MarkSettlementPaidInput) (*StatusOutput, error) {
		userID := auth.GetUserID(ctx)

		if !isMember(db, input.GroupID, userID) {
			return nil, huma.Error403Forbidden("not a member")
		}

		var exists bool
		err := db.Get(&exists, "SELECT EXISTS(SELECT 1 FROM settlements WHERE id = ? AND group_id = ?)", input.SettlementID, input.GroupID)
		if err != nil || !exists {
			return nil, huma.Error404NotFound("settlement not found")
		}

		_, err = db.Exec("UPDATE settlements SET is_paid = 1 WHERE id = ? AND group_id = ?", input.SettlementID, input.GroupID)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to mark as paid", err)
		}

		resp := &StatusOutput{}
		resp.Body.Status = "paid"
		return resp, nil
	})
}

// minCashFlow calculates minimum number of transactions to settle all debts
func minCashFlow(balance map[string]int64) []SettlementResponse {
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

	var result []SettlementResponse
	left, right := 0, len(entries)-1

	for left < right {
		debtor := entries[left]
		creditor := entries[right]

		amount := min(-debtor.amount, creditor.amount)
		if amount > 0 {
			result = append(result, SettlementResponse{
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
		result = []SettlementResponse{}
	}

	return result
}
