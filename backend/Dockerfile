FROM golang:1.26-alpine AS builder

WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 go build -ldflags="-s -w" -o /financensor ./cmd/server

FROM cgr.dev/chainguard/static:latest

COPY --from=builder /financensor /financensor

EXPOSE 8080

ENTRYPOINT ["/financensor"]
