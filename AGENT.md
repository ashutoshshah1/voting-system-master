# VoteHybrid Project Agent Guide

Last scanned: 2026-02-15
Workspace root: `c:\Users\haker\Desktop\project\VoteHybrid-client\VoteHybrid-client\main`

This file is a practical, code-driven map of the current repository state, runtime behavior, and verification status.

## 1) Repository purpose

VoteHybrid is a hybrid election system:
- Online voting path: web DApp + online API.
- Offline booth path: RFID scan + PIN confirmation via offline API.
- Shared integrity layer: same on-chain `Election` contract and same user/wallet identity model.

Core trust model:
- Identity and KYC stay off-chain (Postgres + MinIO).
- Voting state and tally integrity stay on-chain (Ethereum contract).
- Duplicate voting is prevented by on-chain `hasVoted` checks in both online and offline flows.

## 2) Monorepo layout

| Path | Purpose |
| --- | --- |
| `apps/dapp` | React + Vite frontend (online and offline UI routes) |
| `services/api` | Online API (auth, KYC, admin actions, vote relay, candidates) |
| `contracts` | Solidity contract + Foundry tests |
| `v2/services/offline-api` | Offline API (RFID profile link, session, PIN, vote, audit) |
| `v2/device/serial-bridge` | Optional serial-to-offline-api bridge CLI |
| `v2/device/arduino/offline_booth` | RC522 Arduino sketch |
| `docs`, `doc.md`, `setup.md` | Architecture and project documentation |
| `setup.ps1`, `setup.sh`, `start.ps1` | Setup and startup automation |
| `docker-compose.yml` | Local Postgres + MinIO infra |

## 3) Stack and versions (from source)

- Frontend: React 19, React Router 7, Vite 7, TypeScript 5, Tailwind 3.
- APIs: Node + Express 5 + TypeScript + Prisma 6 + Zod + JWT + Ethers 6.
- Storage: PostgreSQL 16 (Docker), MinIO latest (Docker), S3-compatible API.
- Blockchain: Solidity `0.8.20`, Ethers JSON-RPC + FallbackProvider + NonceManager.
- Contracts toolchain: Foundry (`forge` expected locally).
- Device path: Arduino RC522 + optional Node serial bridge (`serialport`).

## 4) Runtime architecture

- DApp (`:5173`) calls:
  - Online API (`:4000`) for auth/KYC/admin/vote and candidate media.
  - Offline API (`:4100`) for RFID profile/session/PIN/offline vote.
- Both APIs call same blockchain contract (`CONTRACT_ADDRESS`).
- Online API also calls MinIO for KYC docs and candidate images.
- Both APIs use Postgres via Prisma.

## 5) Smart contract details (`contracts/src/Election.sol`)

Main state:
- `owner`, `electionActive`, `resultsPublished`, `electionId`.
- Per-election maps for voters, voter-id binding, candidates, votes.

Key rules:
- `registerVoter` enforces unique wallet and unique voter hash in current election.
- `vote` enforces:
  - election open
  - results not published
  - voter registered
  - voter eligible
  - voter not already voted
  - valid candidate id
- `resetElection` increments `electionId` and resets active/published flags for new cycle.

Foundry tests present in `contracts/test/Election.t.sol`:
- Register and single vote.
- Double-vote revert.
- Result visibility rules.
- Publish-only-after-close.
- Reset behavior.

## 6) ABI status

ABI files are synchronized across modules:
- `services/api/src/contracts/abi.json`
- `apps/dapp/src/contracts/abi.json`
- `v2/services/offline-api/src/contracts/abi.json`

Note: current ABI contains callable functions, but no event entries. API candidate creation has event-parse logic plus a fallback `getCandidates()` lookup; fallback is what will resolve candidate id with this ABI.

## 7) Database models

### Online API Prisma (`services/api/prisma/schema.prisma`)
- `User`: identity, role, KYC status, wallet, encrypted key, voter hash.
- `KycSubmission`: one-per-user document metadata and review status.
- `CandidateAsset`: candidate metadata and optional image key.

### Offline API Prisma (`v2/services/offline-api/prisma/schema.prisma`)
Extends online schema with:
- `OfflineProfile`: RFID hash, PIN hash, lockout counters, last seen.
- `BoothOfficer`: legacy/admin compatibility officer entity.
- `OfflineSessionAttestation`: legacy attestation record.
- `OfflineAuditEvent`: audit stream for profile/session/vote events.

## 8) Online API behavior (`services/api/src/index.ts`)

Middleware and controls:
- CORS allowlist from `CORS_ORIGIN`.
- Security headers middleware (`X-Frame-Options`, `nosniff`, etc.).
- JSON body limit 200kb.
- In-memory rate limiters per route class.
- Multer memory storage with 5MB file limit.

Auth:
- JWT 7-day token (`signToken`).
- `requireAuth` and `requireAdmin` guards.

Core endpoints:
- `GET /health`
- `POST /auth/register`
- `POST /auth/login`
- `GET /me`
- `POST /kyc/submit` (multipart file + documentType)
- `GET /wallet/balance`
- `GET /candidates`
- `GET /candidates/:id/image`
- `POST /vote` (relayed by server-side wallet key decryption)

Admin endpoints:
- `GET /admin/kyc/pending`
- `GET /admin/kyc/:id/document`
- `POST /admin/kyc/:id/approve`
- `POST /admin/kyc/:id/reject`
- `POST /admin/candidates`
- `POST /admin/election/status`
- `POST /admin/results/publish`
- `POST /admin/election/reset`
- `POST /admin/voters/eligibility`
- `GET /admin/voters?limit=...`

On-chain reliability logic:
- Admin tx queue + NonceManager reset/retry for nonce-expired cases.
- Fallback provider using `RPC_URLS`/`RPC_URL`.
- Vote flow retries once after wallet funding on insufficient funds.

Startup dependency:
- API startup calls `ensureBucket()`, so MinIO must be reachable before API can boot.

## 9) Offline API behavior (`v2/services/offline-api/src/index.ts`)

Security and policy:
- Same CORS/security header pattern and in-memory rate limiters.
- RFID hash = `sha256(OFFLINE_RFID_PEPPER:UID_NORMALIZED)`.
- PIN policy:
  - 6-8 digits allowed by schema.
  - common weak pins rejected.
  - lockout after configured failed attempts.

Session gates:
- `pinReady`
- `kycApproved`
- `walletReady`
- session token issued only when all gates pass.

Offline endpoints:
- `GET /health`
- `POST /offline/profiles/register`
- `POST /offline/profiles/link-online`
- `POST /offline/pin/setup`
- `POST /offline/session/start`
- `POST /offline/session/attest` (kept for compatibility; officer step bypassed in active flow)
- `POST /offline/vote`

Offline admin endpoints:
- `POST /offline/admin/officers`
- `GET /offline/admin/officers`
- `GET /offline/admin/profiles`
- `GET /offline/admin/audit`

Offline vote flow:
- Verify session token scope.
- Verify profile + lockout + PIN.
- Verify KYC approved and wallet ready.
- Check election active + not published.
- Auto-sync voter on-chain (register if missing, set eligible true if needed).
- Reject if on-chain `hasVoted`.
- Submit vote; retry once after funding on insufficient funds.
- Write audit events for success/failure paths.

## 10) Frontend architecture (`apps/dapp`)

App shell:
- Routing in `src/app/App.tsx`.
- Providers: `AuthProvider` + `ElectionProvider`.
- Visual shell in `src/app/AppShell.tsx`.

Main routes:
- `/`, `/login`, `/register`, `/kyc`, `/connect`
- `/candidates`, `/confirm`, `/receipt`, `/results`
- `/offline`
- `/admin`, `/admin/kyc`
- `/docs`
- Dynamic content pages from `src/pages/infoPages.ts` (features/security/roadmap/legal/help/etc.)

State contexts:
- `AuthContext`: token storage (`votesphere_token`), register/login/me refresh, KYC submit.
- `ElectionContext`: chain reads, cache hydration, mock fallback mode, periodic refresh, vote action.

Services:
- `apiClient.ts`: typed online/offline HTTP methods.
- `ContractService.ts`: read-only contract integration and mock mode.
- `rpcProvider.ts`: fallback provider creation from multiple RPC URLs.

Offline UI (`src/pages/OfflineVoting.tsx`):
- Web Serial scanner integration (Chrome/Edge).
- UID parsing supports labeled hex, byte pairs, compact hex, decimal groups.
- Optional relay polling from `/rfid-scan.json` for bridge-based mode.
- Auto-start session after valid UID scan.
- New voter registration path and existing voter link path.
- Candidate unlock only after valid session token.
- Explicit vote intent confirm + PIN submit.

## 11) Device layer

### Arduino sketch (`v2/device/arduino/offline_booth/offline_booth.ino`)
- RC522 wiring:
  - `MISO 12`, `MOSI 11`, `SCK 13`, `SDA/SS 10`, `RST 9`, `3.3V`, `GND`
- Emits:
  - `BOOT:RC522 ready`
  - periodic `STATUS:READY`
  - `RFID:<UIDHEX>`
- Includes anti-repeat and periodic reader reinit.

### Serial bridge (`v2/device/serial-bridge/src/index.ts`)
- Modes: `register|link|pin-setup|session|attest|vote|scan`.
- Reads serial lines, extracts UID, posts JSON to offline API.
- `scan` mode writes heartbeat + last UID JSON for DApp polling.
- Includes retry/timeout behavior and COM-port diagnostics.

## 12) Environment variables

### DApp (`apps/dapp/.env`)
- `VITE_CHAIN_ID`, `VITE_CHAIN_NAME`
- `VITE_RPC_URL`, `VITE_RPC_URLS`
- `VITE_CONTRACT_ADDRESS`, `VITE_EXPLORER_URL`
- `VITE_USE_MOCK`
- `VITE_API_URL`, `VITE_OFFLINE_API_URL`

### Online API (`services/api/.env`)
- `PORT`, `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN`
- `MINIO_ENDPOINT`, `MINIO_PORT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_BUCKET`, `MINIO_USE_SSL`
- `RPC_URL`, `RPC_URLS`, `RPC_CHAIN_ID`, `RPC_CHAIN_NAME`
- `CONTRACT_ADDRESS`, `FUNDER_PRIVATE_KEY`, `FUND_AMOUNT`
- `WALLET_ENCRYPTION_KEY`

### Offline API (`v2/services/offline-api/.env`)
- `PORT`, `DATABASE_URL`, `JWT_SECRET`, `OFFLINE_JWT_SECRET`
- `OFFLINE_RFID_PEPPER`
- `OFFLINE_PIN_SALT_ROUNDS`, `OFFLINE_PIN_ATTEMPTS_LIMIT`, `OFFLINE_LOCK_MINUTES`
- `OFFLINE_PRECHECK_MINUTES`, `OFFLINE_SESSION_MINUTES`
- `CORS_ORIGIN`
- `RPC_URL`, `RPC_URLS`, `RPC_CHAIN_ID`, `RPC_CHAIN_NAME`
- `CONTRACT_ADDRESS`, `FUNDER_PRIVATE_KEY`, `FUND_AMOUNT`
- `WALLET_ENCRYPTION_KEY`

### Serial bridge (`v2/device/serial-bridge/.env`)
- `OFFLINE_API_URL`
- `SERIAL_PORT`, `SERIAL_BAUD`
- `OFFLINE_API_TIMEOUT_MS`, `OFFLINE_API_RETRIES`

## 13) Scripts and startup

Root automation:
- `setup.ps1` / `setup.sh`
  - checks Node 18+ and Docker
  - creates missing `.env` from `.env.example`
  - starts Docker infra
  - installs deps
  - runs Prisma setup
- `start.ps1`
  - starts Docker infra
  - starts API, DApp, optional offline API and optional serial bridge

Per-project scripts:
- `apps/dapp`: `dev`, `build`, `lint`, `preview`
- `services/api`: `dev`, `build`, `start`, `lint`, prisma commands
- `v2/services/offline-api`: `dev`, `build`, `start`, prisma commands
- `v2/device/serial-bridge`: `dev`, `build`

## 14) Verification results from this scan

### Build/lint checks

| Command | Result |
| --- | --- |
| `apps/dapp npm run build` | PASS (bundle size warning only) |
| `apps/dapp npm run lint` | PASS with 2 warnings in `OfflineVoting.tsx` (`react-hooks/exhaustive-deps`) |
| `services/api npm run build` | PASS |
| `services/api npm run lint` | PASS |
| `v2/services/offline-api npm run build` | PASS |
| `v2/device/serial-bridge npm run build` | PASS |
| `contracts forge test` | BLOCKED (`forge` not installed in environment) |

### Runtime checks

| Check | Result |
| --- | --- |
| `docker compose up -d` | FAIL (Docker engine not running: missing `dockerDesktopLinuxEngine` pipe) |
| `services/api npm run dev` | FAIL in current environment (MinIO connection refused on `localhost:9000`) |
| `v2/services/offline-api npm run dev` | PASS (service starts and exposes `/health`) |
| `apps/dapp npm run dev` | PASS (Vite serves on `:5173`) |

Implication:
- Full end-to-end online flow is blocked until Docker services (especially MinIO) are running.
- Offline API and frontend can boot, but full voting still depends on DB/chain state readiness.

## 15) Known mismatches and implementation notes

1. `services/api/README.md` still shows `DATABASE_URL` example on `5432`; active compose host mapping is `55432`.
2. Some docs mention legacy officer-attestation as active requirement; code currently bypasses officer step and keeps attestation endpoint for compatibility.
3. ABI files do not include event entries, so candidate id extraction falls back to post-tx candidate list lookup.
4. DApp build warns about a large JS chunk (`~605 kB`) and may benefit from code-splitting.
5. DApp lint warnings in `OfflineVoting.tsx` indicate missing hook deps (`closeScanner`, `applyScannedUid`).
6. `docs` page content reflects proposal language and includes requirements not fully implemented in current runtime (for example Raspberry Pi/touch deployment specifics).

## 16) What to do to get "all green"

1. Start Docker Desktop and ensure engine is running.
2. Run `docker compose up -d` at repo root.
3. Install Foundry (`forge`) to run contract tests.
4. Re-run:
   - `cd contracts && forge test`
   - `cd services/api && npm run dev` and verify `http://localhost:4000/health`
   - `cd v2/services/offline-api && npm run dev` and verify `http://localhost:4100/health`
   - `cd apps/dapp && npm run dev` and verify `http://localhost:5173`
5. Optional full API integration run (if chain/env funded and reachable):
   - `cd services/api && node .codex-e2e.mjs`

## 17) Fast reference file map

### Most critical backend files
- `services/api/src/index.ts`
- `services/api/src/lib/blockchain.ts`
- `services/api/src/lib/s3.ts`
- `services/api/src/lib/security.ts`
- `services/api/prisma/schema.prisma`
- `v2/services/offline-api/src/index.ts`
- `v2/services/offline-api/src/lib/auth.ts`
- `v2/services/offline-api/src/lib/blockchain.ts`
- `v2/services/offline-api/prisma/schema.prisma`

### Most critical frontend files
- `apps/dapp/src/app/App.tsx`
- `apps/dapp/src/context/AuthContext.tsx`
- `apps/dapp/src/context/ElectionContext.tsx`
- `apps/dapp/src/services/apiClient.ts`
- `apps/dapp/src/pages/OfflineVoting.tsx`
- `apps/dapp/src/pages/AdminPanel.tsx`
- `apps/dapp/src/pages/Candidates.tsx`

### Contracts and device
- `contracts/src/Election.sol`
- `contracts/test/Election.t.sol`
- `v2/device/arduino/offline_booth/offline_booth.ino`
- `v2/device/serial-bridge/src/index.ts`

