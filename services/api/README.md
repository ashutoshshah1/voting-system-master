# VoteHybrid API (Auth + KYC)

This service handles user registration/login (NID + DOB), KYC submissions, and admin review.
KYC documents are stored in object storage (MinIO), while metadata is stored in
PostgreSQL.

## Tech Stack
- Node.js + Express
- PostgreSQL (Prisma ORM)
- MinIO (S3-compatible storage)

## Setup
```bash
cd services/api
npm install
```

## Environment Variables
Create `services/api/.env` based on `.env.example`:
```
PORT=4000
DATABASE_URL=postgresql://postgres:postgres@localhost:55433/votesphere
JWT_SECRET=change-me
CORS_ORIGIN=http://localhost:5173
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=kyc-docs
MINIO_USE_SSL=false
RPC_URL=https://rpc.sepolia.org
CONTRACT_ADDRESS=0xYourContractAddressHere
FUNDER_PRIVATE_KEY=0xYourFunderPrivateKeyHere
FUND_AMOUNT=0.02
WALLET_ENCRYPTION_KEY=change-me-strong
```
Keep `FUNDER_PRIVATE_KEY` and `WALLET_ENCRYPTION_KEY` private.
`WALLET_ENCRYPTION_KEY` is used to encrypt stored wallet private keys.
`FUNDER_PRIVATE_KEY` must be the contract owner wallet for registration.

## Start Postgres + MinIO
From repo root:
```bash
docker compose up -d
```

## Prisma Migrate
```bash
npx prisma migrate deploy
npx prisma generate
```

## Run the API
```bash
npm run dev
```

## Wallets + Funding
On KYC approval, the API generates a wallet for the user and funds it with
`FUND_AMOUNT` from the `FUNDER_PRIVATE_KEY` account. Wallets are permanent
and cannot be changed once assigned.

## Admin User
Create an admin user by updating the `role` field in the database:
```sql
UPDATE "User" SET "role" = 'ADMIN' WHERE email = 'admin@example.com';
```

## API Endpoints (MVP)
- `POST /auth/register`
- `POST /auth/login`
- `GET /me`
- `POST /kyc/submit`
- `POST /vote`
- `GET /admin/kyc/pending`
- `POST /admin/kyc/:id/approve`
- `POST /admin/kyc/:id/reject`
- `POST /admin/candidates`
- `POST /admin/election/status`
- `POST /admin/results/publish`
- `POST /admin/voters/eligibility`

`/vote` signs and submits the transaction using the user's assigned wallet.
Admin endpoints require a user with role `ADMIN`.
Results are published via `/admin/results/publish`.

### Auth payloads
- Register: `fullName`, `email`, `nid`, `dob` (YYYY-MM-DD)
- Login: `nid`, `dob` (YYYY-MM-DD)
