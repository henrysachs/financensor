package api

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/henrysachs/financensor/backend/internal/auth"
	"github.com/jmoiron/sqlx"
)

const maxUploadSize = 10 << 20 // 10MB
const uploadsDir = "uploads"

func uploadReceipt(db *sqlx.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		groupID := chi.URLParam(r, "groupID")
		purchaseID := chi.URLParam(r, "purchaseID")
		userID := auth.GetUserID(r.Context())

		if !isMember(db, groupID, userID) {
			writeError(w, http.StatusForbidden, "not a member")
			return
		}

		// Verify purchase belongs to group
		var count int
		err := db.Get(&count, "SELECT COUNT(*) FROM purchases WHERE id = ? AND group_id = ?", purchaseID, groupID)
		if err != nil || count == 0 {
			writeError(w, http.StatusNotFound, "purchase not found")
			return
		}

		r.Body = http.MaxBytesReader(w, r.Body, maxUploadSize)
		if err := r.ParseMultipartForm(maxUploadSize); err != nil {
			writeError(w, http.StatusBadRequest, "file too large (max 10MB)")
			return
		}

		file, header, err := r.FormFile("receipt")
		if err != nil {
			writeError(w, http.StatusBadRequest, "missing receipt file")
			return
		}
		defer file.Close()

		// Validate content type
		buf := make([]byte, 512)
		n, _ := file.Read(buf)
		contentType := http.DetectContentType(buf[:n])
		if contentType != "image/jpeg" && contentType != "image/png" && contentType != "image/webp" && contentType != "application/pdf" {
			writeError(w, http.StatusBadRequest, "only JPEG, PNG, WebP, and PDF files are allowed")
			return
		}
		// Reset reader
		if seeker, ok := file.(io.ReadSeeker); ok {
			seeker.Seek(0, io.SeekStart)
		}

		// Create uploads directory
		groupDir := filepath.Join(uploadsDir, groupID)
		if err := os.MkdirAll(groupDir, 0o755); err != nil {
			writeError(w, http.StatusInternalServerError, "failed to create upload directory")
			return
		}

		// Generate unique filename
		ext := filepath.Ext(header.Filename)
		filename := fmt.Sprintf("%s%s", uuid.New().String(), ext)
		filePath := filepath.Join(groupDir, filename)

		dst, err := os.Create(filePath)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to save file")
			return
		}
		defer dst.Close()

		if _, err := io.Copy(dst, file); err != nil {
			writeError(w, http.StatusInternalServerError, "failed to write file")
			return
		}

		// Update purchase with receipt URL
		receiptURL := fmt.Sprintf("/uploads/%s/%s", groupID, filename)
		_, err = db.Exec("UPDATE purchases SET receipt_url = ? WHERE id = ?", receiptURL, purchaseID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to update purchase")
			return
		}

		writeJSON(w, http.StatusOK, map[string]string{"receiptUrl": receiptURL})
	}
}
