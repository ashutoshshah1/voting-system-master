# VoteHybrid Technology Stack

Last updated: 2026-03-11

This document is the current source of truth for the technologies used by VoteHybrid and the local development stack verified on this workstation.

## 1) Runtime Stack

| Layer | Technologies | Repo locations | Notes |
| --- | --- | --- | --- |
| Web frontend | React 19, Vite 7, TypeScript 5.9, React Router 7, Tailwind CSS 3.4, ethers 6 | `apps/dapp` | Main voter/admin UI, including the `/offline` booth page. |
| Online API | Node.js, Express 5, Prisma 6, Zod 4, JWT, Multer, AWS SDK S3, ethers 6 | `services/api` | Auth, KYC, admin operations, wallet assignment/funding, online voting. |
| Offline API | Node.js, Express 5, Prisma 6, Zod 4, JWT, bcryptjs, ethers 6 | `v2/services/offline-api` | RFID profile linking, PIN setup, booth session start, offline vote relay, audit trail. |
| Smart contract | Solidity 0.8.20, Foundry, Sepolia Ethereum | `contracts` | Election lifecycle, candidate storage, voter status, vote recording, result publication. |
| Database | PostgreSQL 16 | Docker Compose + Prisma schemas | Shared relational store for users, KYC metadata, candidate metadata, and offline tables. |
| Object storage | MinIO (S3-compatible) | Docker Compose + `services/api/src/lib/s3.ts` | Stores KYC documents and candidate images. |
| Offline hardware path | Arduino RC522, Web Serial API, optional Node serial bridge (`serialport`) | `v2/device/arduino`, `apps/dapp/src/pages/OfflineVoting.tsx`, `v2/device/serial-bridge` | Active booth flow uses browser Web Serial; the CLI bridge is optional diagnostics tooling. |

## 2) Local Service Map

| Service | Port / URL | Purpose |
| --- | --- | --- |
| DApp | `http://localhost:5173` | Frontend UI |
| Online API | `http://localhost:4000` | Auth, KYC, admin, online vote relay |
| Offline API | `http://localhost:4100` | RFID/PIN booth workflow |
| PostgreSQL (host) | `localhost:55433` | Local database access from the APIs |
| PostgreSQL (container) | `5432` | Internal container port |
| MinIO API | `http://localhost:9000` | S3-compatible object storage |
| MinIO Console | `http://localhost:9001` | Local object storage admin UI |

## 3) Tooling and Development Requirements

| Tool | Requirement / verified version | Notes |
| --- | --- | --- |
| Node.js | 18+ required, verified with `24.14.0` | Required for all TypeScript/JavaScript services. |
| npm | Verified with `11.9.0` | Package manager used by all Node services. |
| Docker Desktop | Required, verified with Docker `29.2.1` | Runs PostgreSQL and MinIO locally. |
| Docker Compose | Required, verified with `v5.0.2` | Local infra orchestration. |
| Foundry | Optional for app runtime, verified with `1.5.1-stable` | Needed for contract build/test workflows. |
| Browser | Chrome or Edge recommended | Required for Web Serial support on `/offline`. |
| Arduino tooling | Arduino IDE or compatible flasher | Needed only if flashing the RC522 sketch. |

## 4) Operational Notes

- Online and offline voting share the same PostgreSQL data model and the same on-chain voter state.
- The browser booth flow talks directly to the RFID reader through Web Serial; no separate kiosk backend is required for normal operation.
- The optional serial bridge is useful for diagnostics, scripted booth testing, or environments where browser serial access is inconvenient.
- Foundry is not required to run the web app and APIs, but it is required to compile or test `contracts/src/Election.sol`.
- Local Postgres uses host port `55433` on this machine because the previously documented `55432` port was unavailable.

## 5) Related Documents

- `architecture.md` - high-level component view
- `deep-system-workflow.md` - online/offline process flows
- `system-requirements-inventory.md` - requirements-to-implementation mapping
- `final.md` - report-style technical narrative
