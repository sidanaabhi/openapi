FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY . .
RUN go mod tidy && go mod download && go build -o controlplane ./cmd/controlplane

FROM alpine:3.19
RUN apk add --no-cache wget
WORKDIR /app
COPY --from=builder /app/controlplane .
EXPOSE 18000 18001 8081
HEALTHCHECK --interval=15s --timeout=5s --retries=5 CMD wget -qO- http://localhost:8081/healthz || exit 1
CMD ["./controlplane"]
