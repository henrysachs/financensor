package repository

import "errors"

// Sentinel errors returned by repository methods.
var (
	ErrNotFound = errors.New("not found")
	ErrExpired  = errors.New("expired")
	ErrConflict = errors.New("conflict")
)
