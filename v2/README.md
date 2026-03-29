# VoteHybrid v2 Offline Extension

This folder adds offline booth support to the existing stack.

Active booth flow:
- scan RFID card
- load profile/session
- select candidate
- enter PIN
- confirm transaction

Online and offline use the same user account, same wallet, and same on-chain vote state.

## Current behavior (2026-02-13)

- Fingerprint/legacy sensor flow is removed.
- Officer attestation is disabled in the active simplified flow.
- `/offline/session/attest` is kept only for backward compatibility.
- `/offline/session/start` can directly return `sessionToken` when gate checks pass.
- Offline vote checks on-chain status (`eligible`, `hasVoted`) before submitting.
- If user already voted online, offline vote is blocked (`Vote already recorded for this wallet`).
- PIN security is enforced server-side with weak-PIN rejection and lockout policy.

## Folder layout

- `v2/services/offline-api` - offline API
- `v2/device/arduino/offline_booth/offline_booth.ino` - RC522 sketch
- `v2/device/serial-bridge` - optional CLI bridge for diagnostics

## 1) Start core stack first

Run existing online stack and infra:
- `services/api`
- `apps/dapp`
- Docker Postgres + MinIO

You can use root scripts:

```powershell
./setup.ps1
./start.ps1
```

## 2) Configure and run v2 offline API

```bash
cd v2/services/offline-api
npm install
cp .env.example .env
```

Required env notes:
- `DATABASE_URL`: same DB as online API (default local host port is `55433`)
- `JWT_SECRET`: same secret as online API (for admin JWT compatibility)
- `OFFLINE_RFID_PEPPER`: strong random string
- `CONTRACT_ADDRESS`, `RPC_URL`, `FUNDER_PRIVATE_KEY`, `WALLET_ENCRYPTION_KEY`: same blockchain context as online API

Initialize Prisma:

```bash
npm run prisma:generate
npm run prisma:push
```

Run service:

```bash
npm run dev
```

Health:

- `http://localhost:4100/health`

## 3) DApp offline page configuration

In `apps/dapp/.env`, set:

```env
VITE_API_URL=http://localhost:4000
VITE_OFFLINE_API_URL=http://localhost:4100
```

Run DApp:

```bash
cd apps/dapp
npm run dev
```

Open:
- `http://localhost:5173/offline`

## 4) Arduino RFID sketch

Flash:
- `v2/device/arduino/offline_booth/offline_booth.ino`

Expected serial output examples:
- `RFID:04A1B2C3`
- parser also accepts common UID text formats in the web booth page

## 5) Optional serial bridge (diagnostics only)

The main booth flow now uses browser Web Serial directly.

Serial bridge is optional if you want CLI-based diagnostics/automation:

```bash
cd v2/device/serial-bridge
npm install
npm run dev -- --list
```

Run session check:

```bash
npm run dev -- --port COM6 --mode session
```

## 6) Offline API endpoints

- `POST /offline/profiles/register`
- `POST /offline/profiles/link-online`
- `POST /offline/pin/setup`
- `POST /offline/session/start`
- `POST /offline/session/attest` (compatibility endpoint)
- `POST /offline/vote`
- `GET /offline/admin/profiles` (admin)
- `GET /offline/admin/audit` (admin)
- `POST /offline/admin/officers` and `GET /offline/admin/officers` (legacy/admin compatibility)

## 7) Key rules

- KYC must be `APPROVED`.
- Wallet must exist and be decryptable.
- PIN must match (with lockout on repeated failures).
- On-chain `hasVoted` blocks duplicate voting.

## 8) Quick verification scenario (important)

Use one user with approved KYC + linked RFID + PIN:

1. Vote online from `/candidates`.
2. Go to `/offline` and scan same RFID.
3. Start session, select candidate, enter PIN.
4. Expected: offline vote is rejected with `Vote already recorded for this wallet`.

This confirms no dual vote between online and offline paths.
