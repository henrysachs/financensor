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
	GroupID string `db:"group_id" json:"groupId"`
	UserID  string `db:"user_id" json:"userId"`
	Role    Role   `db:"role" json:"role"`
}

type Category struct {
	ID      string `db:"id" json:"id"`
	GroupID string `db:"group_id" json:"groupId"`
	Name    string `db:"name" json:"name"`
}

type Purchase struct {
	ID          string    `db:"id" json:"id"`
	GroupID     string    `db:"group_id" json:"groupId"`
	Description string    `db:"description" json:"description"`
	AmountCents int64     `db:"amount_cents" json:"amountCents"`
	PaidByID    string    `db:"paid_by_user_id" json:"paidByUserId"`
	CategoryID  *string   `db:"category_id" json:"categoryId,omitempty"`
	ReceiptURL  *string   `db:"receipt_url" json:"receiptUrl,omitempty"`
	CreatedBy   string    `db:"created_by" json:"createdBy"`
	CreatedAt   time.Time `db:"created_at" json:"createdAt"`
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
