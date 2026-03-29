# Deep System Workflow

Last updated: 2026-03-11

This document describes the active VoteHybrid workflow for both online and offline voting.

## 0) Technology Map

| Layer | Technologies in use | Notes |
| --- | --- | --- |
| Browser UI | React 19, Vite 7, TypeScript 5.9, React Router 7, Tailwind CSS 3.4 | Main user/admin interface and booth page |
| Online service | Node.js, Express 5, Prisma 6, Zod 4, JWT, Multer, AWS SDK S3, ethers 6 | Registration, login, KYC, admin workflows, online voting |
| Offline service | Node.js, Express 5, Prisma 6, Zod 4, JWT, bcryptjs, ethers 6 | RFID linking, PIN handling, offline voting, audit trail |
| Contract layer | Solidity 0.8.20, Foundry, Sepolia | Election state, vote status, candidate/result storage |
| Data layer | PostgreSQL 16, MinIO | Shared DB plus S3-compatible object storage |
| Device layer | Arduino RC522, Web Serial API, optional Node serial bridge (`serialport`) | Browser flow is primary; CLI bridge is optional |

Local runtime ports:
- Frontend: `5173`
- Online API: `4000`
- Offline API: `4100`
- Postgres host: `55433`
- MinIO API / console: `9000` / `9001`

## 1) Deep Architecture Diagram

```mermaid
flowchart LR
  subgraph ClientLayer["Client Layer"]
    VoterOnline["Online Voter (Web Browser)"]
    VoterOffline["Offline Voter (Booth Browser)"]
    Admin["Admin"]
  end

  subgraph DeviceLayer["Offline Device Layer"]
    RFID["RFID Reader (Arduino RC522)"]
    Bridge["Serial Bridge CLI (Node + serialport, optional)"]
  end

  subgraph ServiceLayer["Service Layer"]
    API["Online API (services/api :4000, Express + Prisma)"]
    OfflineAPI["Offline API (v2/services/offline-api :4100, Express + Prisma)"]
  end

  subgraph DataLayer["Data Layer"]
    DB["PostgreSQL 16"]
    ObjectStore["MinIO/S3"]
  end

  subgraph ChainLayer["Blockchain Layer"]
    Chain["Election Smart Contract (Solidity / Sepolia)"]
  end

  VoterOnline -->|Register/Login/KYC/Vote| API
  Admin -->|KYC/Candidate/Election controls| API

  VoterOffline -->|/offline page + Web Serial scan| OfflineAPI
  RFID -->|Serial UID| VoterOffline

  RFID --> Bridge
  Bridge -->|Optional API calls| OfflineAPI

  API --> DB
  API --> ObjectStore
  API --> Chain

  OfflineAPI --> DB
  OfflineAPI --> Chain

  API -. shared user/kyc/wallet/voter data .-> OfflineAPI
```

## 2) Online Voting Sequence

```mermaid
sequenceDiagram
  autonumber
  participant U as Online Voter
  participant D as DApp
  participant A as Online API
  participant P as PostgreSQL
  participant C as Smart Contract

  U->>D: Register/Login
  D->>A: /auth/register or /auth/login
  A->>P: Read/write user
  A-->>D: JWT + profile

  U->>D: Submit KYC
  D->>A: POST /kyc/submit
  A->>P: KYC pending

  Admin->>A: Approve KYC
  A->>P: Set KYC APPROVED + wallet + voterIdHash
  A->>C: registerVoter + setEligibility

  U->>D: Vote
  D->>A: POST /vote
  A->>C: vote(candidateId)
  C-->>A: txHash
  A-->>D: Vote receipt
```

## 3) Offline Voting Sequence (Active Web Flow)

```mermaid
sequenceDiagram
  autonumber
  participant V as Offline Voter
  participant B as Booth Browser (/offline)
  participant R as RFID Reader
  participant OA as Offline API
  participant P as PostgreSQL
  participant C as Smart Contract

  V->>R: Tap RFID card
  R-->>B: UID line over serial

  B->>OA: POST /offline/session/start (rfidUid)
  OA->>P: Resolve offline profile + KYC + wallet + PIN gate
  OA-->>B: sessionToken (if ready) + user info

  alt Not ready
    B-->>V: Keep forms visible for register/link/PIN setup
  else Ready
    B-->>V: Candidate list unlocked
    V->>B: Select candidate + confirm intent
    V->>B: Enter 6-digit PIN
    B->>OA: POST /offline/vote (sessionToken, pin, candidateId)
    OA->>C: Verify election + voter status
    OA->>C: Auto-sync voter register/eligibility if needed
    OA->>C: vote(candidateId)
    C-->>OA: txHash
    OA-->>B: Vote receipt
  end
```

## 4) Offline Gate Conditions

`/offline/session/start` checks:
- `pinReady`
- `kycApproved`
- `walletReady`

If any gate is false, session token is not usable for voting and UI keeps setup path visible.

## 5) Duplicate Vote Prevention (Online vs Offline)

- Online API blocks when on-chain `hasVoted = true`.
- Offline API also checks on-chain `hasVoted` before submit.
- Smart contract enforces final `Already voted` protection.

Result: if user votes online first, offline vote for same wallet is rejected.

## 6) Legacy Compatibility Notes

- `POST /offline/session/attest` is kept for backward compatibility.
- Officer step is disabled in active simplified flow.
- Serial bridge remains optional for diagnostics/automation; booth UI uses Web Serial directly.
- See `technology-stack.md` for the concise versioned technology summary.
