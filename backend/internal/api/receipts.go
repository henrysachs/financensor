package api

import (
	"context"
	"fmt"
	"io"
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"
	"github.com/henrysachs/financensor/backend/internal/repository"
)

const maxUploadSize = 10 << 20 // 10MB

// --- Input/Output types ---

type UploadReceiptInput struct {
	GroupID    string `path:"groupID" doc:"Group ID"`
	PurchaseID string `path:"purchaseID" doc:"Purchase ID"`
	RawBody    huma.MultipartFormFiles[struct {
		Receipt huma.FormFile `form:"receipt" contentType:"image/jpeg,image/png,image/webp,application/pdf" required:"true"`
	}]
}

type UploadReceiptOutput struct {
	Body struct {
		ReceiptURL string `json:"receiptUrl" doc:"URL of the uploaded receipt"`
	}
}

// --- Route registration ---

func registerReceiptRoutes(api huma.API, repo repository.Repository, storage repository.ReceiptStorage, member humaMW) {
	huma.Register(api, huma.Operation{
		OperationID:  "upload-receipt",
		Method:       http.MethodPost,
		Path:         "/groups/{groupID}/purchases/{purchaseID}/receipt",
		Summary:      "Upload a receipt",
		Tags:         []string{"Purchases"},
		MaxBodyBytes: maxUploadSize,
		Middlewares:  huma.Middlewares{member},
	}, func(ctx context.Context, input *UploadReceiptInput) (*UploadReceiptOutput, error) {
		exists, err := repo.Receipts().PurchaseExists(ctx, input.GroupID, input.PurchaseID)
		if err != nil || !exists {
			return nil, huma.Error404NotFound("purchase not found")
		}

		file := input.RawBody.Data().Receipt

		// Validate content type
		buf := make([]byte, 512)
		n, _ := file.Read(buf)
		contentType := http.DetectContentType(buf[:n])
		if contentType != "image/jpeg" && contentType != "image/png" && contentType != "image/webp" && contentType != "application/pdf" {
			return nil, huma.Error400BadRequest("only JPEG, PNG, WebP, and PDF files are allowed")
		}
		file.Seek(0, io.SeekStart)

		ext := ""
		switch contentType {
		case "image/jpeg":
			ext = ".jpg"
		case "image/png":
			ext = ".png"
		case "image/webp":
			ext = ".webp"
		case "application/pdf":
			ext = ".pdf"
		}
		filename := fmt.Sprintf("%s%s", uuid.New().String(), ext)

		receiptURL, err := storage.Save(ctx, input.GroupID, filename, file)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to save file", err)
		}

		err = repo.Receipts().SetReceiptURL(ctx, input.PurchaseID, receiptURL)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to update purchase", err)
		}

		resp := &UploadReceiptOutput{}
		resp.Body.ReceiptURL = receiptURL
		return resp, nil
	})
}
