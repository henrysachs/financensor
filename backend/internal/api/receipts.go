package api

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"
	"github.com/henrysachs/financensor/backend/internal/auth"
	"github.com/jmoiron/sqlx"
)

const maxUploadSize = 10 << 20 // 10MB
const uploadsDir = "uploads"

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

func registerReceiptRoutes(api huma.API, db *sqlx.DB) {
	huma.Register(api, huma.Operation{
		OperationID:   "upload-receipt",
		Method:        http.MethodPost,
		Path:          "/groups/{groupID}/purchases/{purchaseID}/receipt",
		Summary:       "Upload a receipt",
		Tags:          []string{"Purchases"},
		MaxBodyBytes:  maxUploadSize,
	}, func(ctx context.Context, input *UploadReceiptInput) (*UploadReceiptOutput, error) {
		userID := auth.GetUserID(ctx)

		if !isMember(db, input.GroupID, userID) {
			return nil, huma.Error403Forbidden("not a member")
		}

		var count int
		err := db.Get(&count, "SELECT COUNT(*) FROM purchases WHERE id = ? AND group_id = ?", input.PurchaseID, input.GroupID)
		if err != nil || count == 0 {
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
		// Reset reader
		file.Seek(0, io.SeekStart)

		groupDir := filepath.Join(uploadsDir, input.GroupID)
		if err := os.MkdirAll(groupDir, 0o755); err != nil {
			return nil, huma.Error500InternalServerError("failed to create upload directory", err)
		}

		ext := filepath.Ext(file.Filename)
		filename := fmt.Sprintf("%s%s", uuid.New().String(), ext)
		filePath := filepath.Join(groupDir, filename)

		dst, err := os.Create(filePath)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to save file", err)
		}
		defer dst.Close()

		if _, err := io.Copy(dst, file); err != nil {
			return nil, huma.Error500InternalServerError("failed to write file", err)
		}

		receiptURL := fmt.Sprintf("/uploads/%s/%s", input.GroupID, filename)
		_, err = db.Exec("UPDATE purchases SET receipt_url = ? WHERE id = ?", receiptURL, input.PurchaseID)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to update purchase", err)
		}

		resp := &UploadReceiptOutput{}
		resp.Body.ReceiptURL = receiptURL
		return resp, nil
	})
}
