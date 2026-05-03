package model

import "time"

type Role string

const (
	RoleAdmin  Role = "admin"
	RoleMember Role = "member"
)

type User struct {
	ID        string  `db:"id" json:"id"`
	Name      string  `db:"name" json:"name"`
	Email     *string `db:"email" json:"email,omitempty"`
	GoogleID  *string `db:"google_id" json:"-"`
	AvatarURL *string `db:"avatar_url" json:"avatarUrl,omitempty"`
	IsGhost   bool    `db:"is_ghost" json:"isGhost"`
	CreatedAt time.Time `db:"created_at" json:"createdAt"`
}

type Group struct {
	ID        string    `db:"id" json:"id"`
	Name      string    `db:"name" json:"name"`
	CreatedBy string    `db:"created_by" json:"createdBy"`
	CreatedAt time.Time `db:"created_at" json:"createdAt"`
}

type GroupMember struct {
	GroupID  string  `db:"group_id" json:"groupId"`
	UserID   string  `db:"user_id" json:"userId"`
	Nickname *string `db:"nickname" json:"nickname,omitempty"`
	Role     Role    `db:"role" json:"role"`
}

type Category struct {
	ID      string `db:"id" json:"id"`
	GroupID string `db:"group_id" json:"groupId"`
	Name    string `db:"name" json:"name"`
}

type Purchase struct {
	ID          string    `db:"id" json:"id"`
	GroupID     string    `db:"group_id" json:"groupId"`
	TripID      *string   `db:"trip_id" json:"tripId,omitempty"`
	Description string    `db:"description" json:"description"`
	AmountCents int64     `db:"amount_cents" json:"amountCents"`
	PaidByID    string    `db:"paid_by_user_id" json:"paidByUserId"`
	CategoryID  *string   `db:"category_id" json:"categoryId,omitempty"`
	ReceiptURL  *string   `db:"receipt_url" json:"receiptUrl,omitempty"`
	PurchasedAt string    `db:"purchased_at" json:"purchasedAt"`
	CreatedBy   string    `db:"created_by" json:"createdBy"`
	CreatedAt   time.Time `db:"created_at" json:"createdAt"`
}

type Trip struct {
	ID          string  `db:"id" json:"id"`
	GroupID     string  `db:"group_id" json:"groupId"`
	Name        string  `db:"name" json:"name"`
	Description *string `db:"description" json:"description,omitempty"`
	TripDate    string  `db:"trip_date" json:"tripDate"`
	CreatedBy   string  `db:"created_by" json:"createdBy"`
	CreatedAt   string  `db:"created_at" json:"createdAt"`
}

type Assignment struct {
	ID              string `db:"id" json:"id"`
	PurchaseID      string `db:"purchase_id" json:"purchaseId"`
	UserID          string `db:"user_id" json:"userId"`
	CustomShareCents *int64 `db:"custom_share_cents" json:"customShareCents,omitempty"`
}

type Settlement struct {
	ID         string `db:"id" json:"id"`
	GroupID    string `db:"group_id" json:"groupId"`
	FromUserID string `db:"from_user_id" json:"fromUserId"`
	ToUserID   string `db:"to_user_id" json:"toUserId"`
	AmountCents int64 `db:"amount_cents" json:"amountCents"`
	IsPaid     bool   `db:"is_paid" json:"isPaid"`
	CreatedAt  time.Time `db:"created_at" json:"createdAt"`
}

type APIKey struct {
	ID              string     `db:"id" json:"id"`
	GroupID         string     `db:"group_id" json:"groupId"`
	Label           string     `db:"label" json:"label"`
	TokenHash       string     `db:"token_hash" json:"-"`
	ActingAsUserID  string     `db:"acting_as_user_id" json:"actingAsUserId"`
	CreatedByUserID string     `db:"created_by_user_id" json:"createdByUserId"`
	LastUsedAt      *time.Time `db:"last_used_at" json:"lastUsedAt,omitempty"`
	RevokedAt       *time.Time `db:"revoked_at" json:"revokedAt,omitempty"`
	CreatedAt       time.Time  `db:"created_at" json:"createdAt"`
}
