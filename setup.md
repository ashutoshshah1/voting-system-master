# One-Time Setup and Startup (Online + Offline RFID)

This is the single setup path for the current VoteHybrid system:
- online voting (`services/api` + `apps/dapp`)
- offline RFID voting (`v2/services/offline-api` + `/offline` page)

## Quick setup (recommended)

Windows (PowerShell):
```powershell
./setup.ps1
```

macOS/Linux (bash):
```bash
./setup.sh
```

What setup scripts do:
- create missing `.env` files from `.env.example`
- start Docker services (Postgres + MinIO)
- install dependencies for all required apps
- run Prisma setup for `services/api` and `v2/services/offline-api`

## Prerequisites

- Node.js 18+
- Docker + Docker Compose
- Chrome or Edge for Web Serial RFID on `/offline`
- Sepolia RPC + contract address + funder key (unless mock mode for frontend-only)

## Services and ports

- DApp: `http://localhost:5173`
- Online API: `http://localhost:4000`
- Offline API: `http://localhost:4100`
- Postgres (host): `localhost:55433`
- MinIO API: `localhost:9000`
- MinIO Console: `localhost:9001`

## Manual setup (if not using scripts)

1. Start infra:
```bash
docker compose up -d
```

2. Configure `services/api`:
```bash
cd services/api
npm install
cp .env.example .env
```

Important values in `services/api/.env`:
```env
PORT=4000
DATABASE_URL=postgresql://postgres:postgres@localhost:55433/votesphere
JWT_SECRET=change-me
CORS_ORIGIN=http://localhost:5173,http://localhost:5174,http://127.0.0.1:5173,http://127.0.0.1:5174
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

3. Configure `v2/services/offline-api`:
```bash
cd ../../v2/services/offline-api
npm install
cp .env.example .env
```

Important values in `v2/services/offline-api/.env`:
```env
PORT=4100
DATABASE_URL=postgresql://postgres:postgres@localhost:55433/votesphere
JWT_SECRET=change-me
OFFLINE_JWT_SECRET=change-me-offline
OFFLINE_RFID_PEPPER=change-me-rfid-pepper
OFFLINE_PIN_SALT_ROUNDS=10
OFFLINE_PIN_ATTEMPTS_LIMIT=3
OFFLINE_LOCK_MINUTES=15
OFFLINE_PRECHECK_MINUTES=5
OFFLINE_SESSION_MINUTES=3
CORS_ORIGIN=http://localhost:5173,http://localhost:5174,http://127.0.0.1:5173,http://127.0.0.1:5174
RPC_URL=https://rpc.sepolia.org
RPC_CHAIN_ID=11155111
RPC_CHAIN_NAME=sepolia
CONTRACT_ADDRESS=0xYourContractAddressHere
FUNDER_PRIVATE_KEY=0xYourFunderPrivateKeyHere
FUND_AMOUNT=0.0002
WALLET_ENCRYPTION_KEY=change-me-strong
```

4. Configure `apps/dapp`:
```bash
cd ../../../apps/dapp
npm install
cp .env.example .env
```

Important values in `apps/dapp/.env`:
```env
VITE_CHAIN_ID=11155111
VITE_CHAIN_NAME=Sepolia
VITE_RPC_URL=https://sepolia.drpc.org
VITE_RPC_URLS=https://ethereum-sepolia-rpc.publicnode.com,https://rpc.sepolia.org,https://sepolia.drpc.org
VITE_CONTRACT_ADDRESS=0xYourContractAddressHere
VITE_EXPLORER_URL=https://sepolia.etherscan.io
VITE_USE_MOCK=false
VITE_API_URL=http://localhost:4000
VITE_OFFLINE_API_URL=http://localhost:4100
```

5. Prisma setup:
```bash
cd ../../../services/api
npx prisma migrate deploy
npx prisma generate

cd ../../v2/services/offline-api
npm run prisma:generate
npm run prisma:push
```

## Startup (every time)

Windows single-command startup:
```powershell
./start.ps1
```

Manual startup (3 terminals):
```bash
# Terminal 1
cd services/api && npm run dev

# Terminal 2
cd v2/services/offline-api && npm run dev

# Terminal 3
cd apps/dapp && npm run dev
```

## Quick web sanity check

1. Open `http://localhost:5173`.
2. Register/login user online.
3. Open `/offline` page.
4. Click `Connect scanner` and choose Arduino COM port.
5. Tap RFID card once.
6. Confirm UID auto-fills and session starts (or form auto-fills for registration/link).

## Quick test data check: online vote then offline should fail

Use one approved user with linked RFID and PIN.

1. User votes from online candidates page.
2. Go to `/offline`, scan same user RFID, start session, choose candidate.
3. Enter PIN and submit.
4. Expected result: vote is blocked with `Vote already recorded for this wallet`.

Why this is enforced:
- Online API checks `hasVoted` before voting.
- Offline API syncs/checks on-chain voter status and blocks if `hasVoted=true`.

## Common issues

- `Invalid payload` on offline start: UID was empty; scan card first.
- Scanner connected but no read: close Arduino Serial Monitor/IDE and reconnect scanner.
- API unreachable: check `VITE_API_URL` / `VITE_OFFLINE_API_URL` and service ports.
- DB connection errors: ensure `DATABASE_URL` uses host port `55433`.

## Admin SQL helper

```sql
UPDATE "User" SET "role" = 'ADMIN' WHERE email = 'admin@example.com';
```
