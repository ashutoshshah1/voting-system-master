# VoteHybrid DApp

Frontend for both:
- online voting flow (`/login`, `/kyc`, `/candidates`)
- offline booth flow (`/offline`) with RFID scan + PIN confirmation

## Tech stack

- React + Vite + TypeScript
- Tailwind CSS
- Ethers.js

## Main features

- Register + login (NID + DOB)
- KYC upload and admin approval flow
- Wallet assignment and vote relay
- Candidate selection and vote confirmation
- Offline booth page with:
  - Web Serial RFID connection (Chrome/Edge)
  - auto UID capture and form auto-fill
  - card session start before candidate list unlock
  - PIN confirmation before transaction

## Setup

```bash
cd apps/dapp
npm install
```

Create `.env` from `.env.example` and confirm:

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

## Run

```bash
npm run dev
```

## Build check

```bash
npm run build
```

## Backend dependencies

- Online API: `services/api` (`VITE_API_URL`)
- Offline API: `v2/services/offline-api` (`VITE_OFFLINE_API_URL`)

## Manual smoke checklist

1. Login/register and confirm online pages load.
2. Open `/offline`.
3. Connect scanner and scan RFID.
4. Confirm UID auto-fills and session starts.
5. Confirm candidate list appears only after card session.
6. Confirm PIN is required for offline vote submit.
7. Confirm already-voted users are blocked by API response.
