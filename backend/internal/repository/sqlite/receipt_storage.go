package sqlite

import (
	"context"
	"fmt"
	"io"
	"os"
	"path/filepath"
)

// Save persists a receipt file to the local filesystem and returns the URL path.
func (s *LocalReceiptStorage) Save(_ context.Context, groupID, filename string, content io.Reader) (string, error) {
	groupDir := filepath.Join(s.UploadsDir, groupID)
	if err := os.MkdirAll(groupDir, 0o755); err != nil {
		return "", fmt.Errorf("create upload dir: %w", err)
	}

	filePath := filepath.Join(groupDir, filename)
	dst, err := os.Create(filePath)
	if err != nil {
		return "", fmt.Errorf("create file: %w", err)
	}
	defer dst.Close()

	if _, err := io.Copy(dst, content); err != nil {
		return "", fmt.Errorf("write file: %w", err)
	}

	return fmt.Sprintf("/uploads/%s/%s", groupID, filename), nil
}
