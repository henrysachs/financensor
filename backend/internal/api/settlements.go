package api

import (
	"context"
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"github.com/henrysachs/financensor/backend/internal/repository"
	"github.com/henrysachs/financensor/backend/internal/settle"
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

func registerSettlementRoutes(api huma.API, repo repository.Repository, member humaMW) {
	huma.Register(api, huma.Operation{
		OperationID:  "calculate-settlements",
		Method:       http.MethodGet,
		Path:         "/groups/{groupID}/settlements",
		Summary:      "Calculate settlements for a group",
		Tags:         []string{"Settlements"},
		Middlewares:  huma.Middlewares{member},
	}, func(ctx context.Context, input *GroupPathParams) (*CalculateSettlementsOutput, error) {
		purchases, err := repo.Purchases().List(ctx, input.GroupID)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to get purchases", err)
		}

		balance := make(map[string]int64)

		for _, pw := range purchases {
			if len(pw.Assignments) == 0 {
				continue
			}

			totalCustom := int64(0)
			customCount := 0
			for _, a := range pw.Assignments {
				if a.CustomShareCents != nil {
					totalCustom += *a.CustomShareCents
					customCount++
				}
			}

			balance[pw.Purchase.PaidByID] += pw.Purchase.AmountCents

			if customCount == len(pw.Assignments) {
				for _, a := range pw.Assignments {
					balance[a.UserID] -= *a.CustomShareCents
				}
			} else {
				remaining := pw.Purchase.AmountCents - totalCustom
				equalCount := len(pw.Assignments) - customCount
				shareEach := remaining / int64(equalCount)
				remainder := remaining - shareEach*int64(equalCount)

				first := true
				for _, a := range pw.Assignments {
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

		transfers := settle.MinCashFlow(balance)
		settlements := make([]SettlementResponse, len(transfers))
		for i, t := range transfers {
			settlements[i] = SettlementResponse{
				FromUserID:  t.FromUserID,
				ToUserID:    t.ToUserID,
				AmountCents: t.AmountCents,
			}
		}

		return &CalculateSettlementsOutput{Body: settlements}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID:  "mark-settlement-paid",
		Method:       http.MethodPost,
		Path:         "/groups/{groupID}/settlements/{settlementID}/paid",
		Summary:      "Mark a settlement as paid",
		Tags:         []string{"Settlements"},
		Middlewares:  huma.Middlewares{member},
	}, func(ctx context.Context, input *MarkSettlementPaidInput) (*StatusOutput, error) {
		err := repo.Settlements().MarkPaid(ctx, input.GroupID, input.SettlementID)
		if err == repository.ErrNotFound {
			return nil, huma.Error404NotFound("settlement not found")
		}
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to mark as paid", err)
		}
		resp := &StatusOutput{}
		resp.Body.Status = "paid"
		return resp, nil
	})
}
