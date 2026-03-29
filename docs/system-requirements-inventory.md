# VoteHybrid System Inventory and Requirements Mapping

Last updated: 2026-03-11

This document lists:
- the internal `lib` files used in the project,
- the third-party libraries used across services,
- the platform services and why each is used,
- implementation coverage against the system requirements in `doc.md`.

## 1) Service Inventory (What services are used and for what purpose)

| Service/Component | Type | Where Defined | Purpose | Ports/Endpoint |
| --- | --- | --- | --- | --- |
| `apps/dapp` | Frontend web app | `apps/dapp` | Voter/admin UI (register/login, KYC submit, voting, results, admin tools). | Vite dev server (typically `5173`) |
| `services/api` | Backend API | `services/api/src/index.ts` | Auth, KYC, admin operations, wallet assignment/funding, vote relay, candidate media/doc retrieval. | `http://localhost:4000` |
| `v2/services/offline-api` | Backend API | `v2/services/offline-api/src/index.ts` | Offline profile linking, RFID session start, PIN-verified booth voting, offline audit trail. | `http://localhost:4100` |
| `v2/device/serial-bridge` | Optional diagnostics CLI | `v2/device/serial-bridge/src/index.ts` | Optional serial reader bridge for booth diagnostics and automation outside direct browser Web Serial. | CLI / local serial port |
| `contracts/src/Election.sol` | Smart contract | `contracts/src/Election.sol` | On-chain election state, candidate list, vote recording, eligibility, result publish/reset lifecycle. | Sepolia contract address via env |
| PostgreSQL | Database service | `docker-compose.yml`, Prisma schema | Stores users, KYC metadata, and candidate asset metadata. | Container `5432`, host mapping `55433` |
| MinIO (S3-compatible) | Object storage service | `docker-compose.yml`, `services/api/src/lib/s3.ts` | Stores KYC documents and candidate images. | API `9000`, console `9001` |
| Sepolia RPC providers | Blockchain network service | `services/api/src/lib/env.ts`, `apps/dapp/src/config/chain.ts` | Read/write chain data with fallback RPC support. | `RPC_URL`/`RPC_URLS`, `VITE_RPC_URLS` |
| Etherscan (Sepolia) | Explorer service | `apps/dapp/src/config/chain.ts` | Transaction/result inspection links in UI workflows. | `https://sepolia.etherscan.io` |
| Docker Compose | Local orchestration | `docker-compose.yml` | Boots local infra dependencies (`postgres`, `minio`). | `docker compose up -d` |

## 2) Internal Lib File List

### Backend `lib` files (`services/api/src/lib`)

| File | Purpose | Main Dependencies/Services |
| --- | --- | --- |
| `services/api/src/lib/env.ts` | Loads and validates runtime env configuration (DB, JWT, MinIO, RPC, contract, funding). | `dotenv`, env vars |
| `services/api/src/lib/prisma.ts` | Shared Prisma client instance for DB access. | `@prisma/client`, PostgreSQL |
| `services/api/src/lib/auth.ts` | JWT signing and request guards (`requireAuth`, `requireAdmin`). | `jsonwebtoken`, Express |
| `services/api/src/lib/crypto.ts` | AES-256-GCM encryption/decryption for wallet private keys. | Node `crypto` |
| `services/api/src/lib/s3.ts` | MinIO/S3 client, bucket bootstrap, object upload/download. | `@aws-sdk/client-s3`, MinIO |
| `services/api/src/lib/blockchain.ts` | RPC provider setup, admin tx queue/nonce handling, wallet creation/funding, contract calls (register/vote/results/etc.). | `ethers`, Sepolia RPC, contract ABI |

### Other core service/helper modules (non-`lib` but part of runtime flow)

| File | Purpose |
| --- | --- |
| `services/api/src/index.ts` | API routes and orchestration for auth/KYC/admin/voting/candidates. |
| `apps/dapp/src/services/apiClient.ts` | Typed API wrapper for frontend requests. |
| `apps/dapp/src/services/rpcProvider.ts` | Frontend fallback RPC provider builder. |
| `apps/dapp/src/services/ContractService.ts` | Frontend contract read service + mock mode behavior. |
| `apps/dapp/src/config/chain.ts` | Frontend chain/RPC/contract config from env. |
| `apps/dapp/src/utils/cache.ts` | localStorage TTL cache helper. |
| `apps/dapp/src/utils/format.ts` | UI address/hash formatter helpers. |

## 3) Third-Party Library Inventory

### API service dependencies (`services/api/package.json`)

| Library | Role in project |
| --- | --- |
| `express` | HTTP API server and routing. |
| `cors` | Allowed-origin policy for browser access. |
| `multer` | Multipart upload handling (KYC docs/candidate images). |
| `zod` | Payload validation schemas. |
| `jsonwebtoken` | JWT auth token sign/verify. |
| `@prisma/client` | DB client for PostgreSQL entities. |
| `@aws-sdk/client-s3` | MinIO/S3 object operations. |
| `ethers` | Ethereum wallet/provider/contract interactions. |
| `dotenv` | `.env` loading. |
| `bcryptjs` | Declared, but currently not referenced in source code. |

API dev dependencies in use: `typescript`, `tsx`, `prisma`, Node/Express/JWT/Multer/CORS type packages.

### DApp dependencies (`apps/dapp/package.json`)

| Library | Role in project |
| --- | --- |
| `react` + `react-dom` | UI runtime. |
| `react-router-dom` | SPA routing (`/`, `/login`, `/admin`, `/docs`, etc.). |
| `ethers` | Frontend contract read calls and RPC integration. |

DApp dev dependencies in use: `vite`, `@vitejs/plugin-react`, `typescript`, `tailwindcss`, `postcss`, `autoprefixer`, `eslint` + plugins/types.

### Offline API dependencies (`v2/services/offline-api/package.json`)

| Library | Role in project |
| --- | --- |
| `express` | HTTP API server for offline booth workflows. |
| `cors` | Browser access policy for the booth page and admin tools. |
| `zod` | Payload validation for RFID, PIN, profile link, and vote requests. |
| `jsonwebtoken` | Booth/admin token handling. |
| `bcryptjs` | PIN hashing and comparison for offline voter authentication. |
| `@prisma/client` | DB client for shared online/offline data. |
| `ethers` | Contract interaction for voter-status checks and vote relay. |
| `dotenv` | `.env` loading. |

Offline API dev dependencies in use: `typescript`, `tsx`, `prisma`, Node/Express/JWT type packages.

### Serial bridge dependencies (`v2/device/serial-bridge/package.json`)

| Library | Role in project |
| --- | --- |
| `serialport` | Accesses the RFID-connected serial device from a local CLI. |
| `@serialport/parser-readline` | Parses UID lines emitted by the Arduino sketch. |
| `dotenv` | Optional local configuration loading. |

Serial bridge dev dependencies in use: `typescript`, `tsx`, Node type packages.

### Contract toolchain (`contracts/foundry.toml`)

| Tool | Role in project |
| --- | --- |
| Foundry | Contract build/test workflow. |
| Solidity `0.8.20` | Compiler target version for `Election.sol`. |

## 4) Verified Local Toolchain

Verified on this workstation on 2026-03-11:

| Tool | Version / status |
| --- | --- |
| Node.js | `24.14.0` |
| npm | `11.9.0` |
| Docker Engine | `29.2.1` |
| Docker Compose | `v5.0.2` |
| Foundry | `1.5.1-stable` |
| Frontend health check | `http://localhost:5173` returned `200` |
| Online API health check | `http://localhost:4000/health` returned `200` |
| Offline API health check | `http://localhost:4100/health` returned `200` |
| Contract tests | `forge test` passed (`7/7`) |

## 5) Requirements Coverage (from `doc.md`)

Status labels:
- `Implemented`
- `Partial`
- `Planned / Not implemented`

### Software requirements

| Requirement | Status | Evidence |
| --- | --- | --- |
| Blockchain + smart contracts (Solidity, Foundry) | Implemented | `contracts/src/Election.sol`, `contracts/test/Election.t.sol`, `contracts/foundry.toml` |
| Frontend DApp (React + TypeScript + Tailwind) | Implemented | `apps/dapp/package.json`, `apps/dapp/src/*` |
| Off-chain API for metadata/logs | Implemented (Node/Express) | `services/api/src/index.ts`, Prisma models |
| Security/audit logging layer | Partial | JWT + role checks + key encryption + on-chain events + offline audit events + API rate limiting + security headers are in place; no dedicated centralized audit-log service yet |
| Arduino layer | Implemented in v2 | `v2/device/arduino/offline_booth/offline_booth.ino` |
| Flask / FastAPI backend option | Not used | Backend implemented with Node/Express |

### Hardware requirements

| Requirement | Status | Evidence |
| --- | --- | --- |
| Raspberry Pi | Planned / Not implemented | No hardware integration module in repo |
| RFID sensor | Implemented in v2 flow | `v2/device/arduino/offline_booth/offline_booth.ino`, `v2/device/serial-bridge/src/index.ts` |
| Legacy scanner sensor | Not used in active v2 flow | Active v2 flow is RFID + PIN booth verification (`v2/README.md`, `v2/services/offline-api/src/index.ts`) |
| HDMI touch display | Planned / Not implemented | No kiosk UI/hardware runtime in repo |

### Functional requirements

| Requirement | Status | Evidence |
| --- | --- | --- |
| Offline authentication flow | Implemented as RFID + PIN (officer step disabled in simplified flow) | `apps/dapp/src/pages/OfflineVoting.tsx`, `v2/services/offline-api/src/index.ts`, `v2/README.md` |
| Link voter identity (NID) to one wallet | Implemented | `User.nid` unique, wallet assignment on KYC approval, `voterIdHash` usage |
| Candidate selection via DApp | Implemented | `apps/dapp/src/pages/Candidates.tsx`, `/vote` API, on-chain `vote()` |
| Candidate selection via touch display (offline) | Planned / Not implemented | No kiosk/touch runtime in repo |
| Encrypted communication between device and server | Partial | API + serial bridge exist; TLS depends on deployment setup |
| Admin registration/eligibility control | Implemented | `/admin/kyc/*`, `/admin/voters/eligibility`, contract admin functions |

### Non-functional requirements

| Requirement | Status | Evidence |
| --- | --- | --- |
| Real-time response for RFID scan | Implemented in v2 flow | Web Serial RFID scan in booth UI + offline session endpoints (`apps/dapp/src/pages/OfflineVoting.tsx`, `v2/services/offline-api/src/index.ts`) |
| Portability on Raspberry Pi + touch display | Planned / Not implemented | Hardware-specific deployment not implemented |
| Privacy: avoid exposing sensitive identity data | Implemented for active v2 flow | Identity/KYC off-chain, voter hash on-chain, encrypted wallet keys |

## 6) Notes and Gaps to Resolve

- `docker-compose.yml` maps Postgres to host `55433`; align `DATABASE_URL` with the chosen host port.
- Legacy scanner/officer-attestation references in older docs should be treated as historical; active v2 booth flow is RFID + PIN.
- Offline vote can still fail if election/candidate state on-chain is not ready (for example no candidate, closed election, or published results).
- `GET /admin/voters` now supports bounded result size (`limit` query parameter) and bounded on-chain lookup concurrency to reduce RPC saturation under larger voter lists.
- Browser-based offline voting still depends on Web Serial support, so Chrome or Edge is recommended for booth usage.
