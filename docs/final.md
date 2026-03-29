# VoteHybrid: A Hybrid On-Chain/Off-Chain E-Voting System

## Abstract
This paper presents VoteHybrid, a hybrid e-voting platform combining a web application, an off-chain verification pipeline, and an Ethereum smart contract for vote integrity. The system integrates KYC-based voter onboarding, relayed voting transactions, and an admin-controlled election lifecycle. We describe the design choices, feasibility analysis, implementation details, and testing outcomes. The architecture balances transparency and auditability with privacy requirements and operational practicality.

## Index Terms
Index Terms- blockchain, e-voting, smart contract, KYC, Ethereum, web application

## I. Introduction
Electronic voting systems must reconcile transparency, integrity, privacy, and operational usability. Purely centralized systems are efficient but less transparent, while fully on-chain systems can be transparent but may conflict with privacy requirements and operational constraints. VoteHybrid adopts a hybrid approach: identity verification and sensitive data are handled off-chain, while the voting process and election state are stored on-chain for auditability.

This paper documents the system design, technology selection, feasibility evaluation, and validation process. It also provides function-level explanations and step-by-step operation details for academic review.

## II. System Goals and Scope
### A. Goals
- Provide transparent, verifiable vote recording through smart contracts.
- Protect voter privacy and sensitive documents with off-chain storage.
- Enable administrators to manage election states and candidates.
- Ensure reliability under public RPC instability.

### B. Scope
In scope:
- User registration and login with NID and DOB.
- KYC submission and admin approval.
- Wallet assignment and funding.
- Voting, election open/close, results publication, and reset.

Out of scope:
- Mainnet deployment for production elections.
- Hardware security modules for key custody.
- Cross-chain governance.

## III. Feasibility Study
### A. Technical Feasibility
The system is technically feasible using established tooling: smart contracts in Solidity [1], contract access through Ethers.js [2], a Node.js/Express API, and storage via PostgreSQL and MinIO [3], [4].

Key technical risks and mitigations:
- RPC instability mitigated with fallback providers.
- Nonce conflicts mitigated with serialized admin transactions.

### B. Operational Feasibility
Local operations are supported using Docker Compose for Postgres and MinIO. Admin tools provide workflow management for candidate updates and election state changes. The operational workflow is compatible with small to medium-scale deployments for demonstrations and pilots.

### C. Economic Feasibility
Development and testing on Sepolia avoids mainnet costs. Wallet funding is environment-configurable through `FUND_AMOUNT`, allowing low-cost testnet operation while retaining flexibility for different workflows.

### D. Legal and Compliance Feasibility
The KYC pipeline implies legal obligations around data privacy and retention. The platform is feasible in jurisdictions that permit centralized identity verification combined with on-chain vote recording, but compliance frameworks must be defined for production use.

## IV. Alternatives Considered (Non-Feasible Options)
- Full on-chain identity storage rejected due to privacy concerns and cost overhead.
- Centralized-only voting rejected due to lack of transparency and auditability.
- Mainnet-only operation rejected in development due to cost and operational risk.

## V. Architecture and Technology Stack
### System Block Diagram

The figure below summarizes the complete online and offline system workflow, including actors, APIs, shared storage, and the common blockchain integrity layer.

![VoteHybrid Detailed System Block Diagram](./votehybrid-system-block-diagram.png)

Figure 1. VoteHybrid end-to-end system block diagram (online + offline flow with shared on-chain vote integrity).

### Technology Matrix

| Layer | Active technologies |
| --- | --- |
| Web frontend | React 19, Vite 7, TypeScript 5.9, React Router 7, Tailwind CSS 3.4, Ethers.js 6 |
| Online API | Node.js, Express 5, Prisma 6, Zod 4, JWT, Multer, AWS SDK S3 |
| Offline API | Node.js, Express 5, Prisma 6, Zod 4, JWT, bcryptjs |
| Contract layer | Solidity 0.8.20, Foundry, Sepolia Ethereum |
| Data and storage | PostgreSQL 16, MinIO (S3-compatible) |
| Offline device path | Arduino RC522, browser Web Serial, optional Node serial bridge |

### A. Frontend
- React with Vite for rapid development and optimized builds.
- TypeScript for static typing and maintainability.
- React Router handles the SPA route structure.
- Tailwind CSS is used for the current styling system.

### B. Backend
- Node.js and Express for both the online API and the v2 offline booth API.
- Prisma ORM for database abstraction.
- JWT-based authentication.
- Multer for document upload handling.
- Zod validates request payloads.
- AWS SDK S3 integration is used for MinIO object storage access.
- bcryptjs is used in the offline flow for PIN hashing and verification.

### C. Blockchain Layer
- Solidity smart contract deployed on Sepolia.
- Ethers.js for contract interaction.
- Foundry is used for contract build and test workflows.
- NonceManager to avoid transaction collisions.
- FallbackProvider to handle RPC instability.

### D. Storage Layer
- PostgreSQL for user, KYC metadata, and candidate records.
- MinIO for KYC document storage.

### E. Local Environment
- Docker Compose for local Postgres and MinIO provisioning.
- Chrome or Edge for the active `/offline` browser booth flow using Web Serial.
- Arduino RC522 hardware and sketch for RFID reads.
- Optional Node serial bridge for diagnostics and scripted booth checks.

## VI. Technology Selection Rationale
This section explains why each technology was chosen based on system requirements.

### A. React + Vite
- Fast local development and hot-module reload for UI iteration.
- Predictable bundling and asset handling for deployment.

### B. TypeScript
- Reduces runtime errors by enforcing types across API and UI layers.
- Enables safer refactors of complex voting and eligibility logic.

### C. Node.js + Express
- Lightweight API framework suitable for custom workflows (KYC, relayed voting).
- Mature ecosystem for auth, uploads, and blockchain tooling.

### D. Prisma + PostgreSQL
- Prisma provides type-safe database access and migration workflows.
- PostgreSQL offers reliable relational storage for audit requirements.

### E. MinIO
- S3-compatible storage for KYC documents.
- Supports local and production-like workflows without vendor lock-in.

### F. Solidity + Ethers.js
- Solidity is the standard for Ethereum smart contracts.
- Ethers.js provides stable wallet operations and contract calls.

### G. Docker Compose
- Reproducible local development environment for storage and database services.

### H. Web Serial + RC522
- The active offline booth flow uses browser-native serial access instead of a separate kiosk backend.
- This keeps the RFID path simple for demonstrations while preserving an optional CLI bridge for diagnostics.

### I. Foundry
- Foundry provides a focused Solidity build/test workflow for the election contract.
- It complements the application stack by verifying election lifecycle behavior independently from the web services.

## VII. Development Steps (Build Process)
1) Repository structure
- Create a monorepo layout with contracts, backend, and frontend directories.
- Add TypeScript configurations and environment templates.

2) Smart contract implementation
- Implement Election.sol with voter registration, eligibility, voting, and results.
- Add electionId to enable clean resets between elections.
- Emit events for key actions (VoterRegistered, EligibilityUpdated, CandidateAdded, VoteCast).
- Compile and export ABI for API and dapp use.

3) Backend API construction
- Build authentication (register/login) and JWT session handling.
- Implement KYC submission with file upload to MinIO.
- Add admin endpoints for KYC approval, candidate creation, and election management.
- Implement wallet creation, encryption, funding, and on-chain voter registration.
- Add RPC fallback and nonce serialization for reliability.

4) Frontend development
- Create voter pages for registration, KYC, wallet status, voting, and results.
- Build admin panel for candidate and election management.
- Add processing dialogs for long-running transactions.

5) Data layer and migrations
- Define Prisma schema for users, KYC submissions, and candidate metadata.
- Run migrations to align database state with schema changes.

6) Integration and stabilization
- Connect frontend to API and contract reads.
- Ensure voting is disabled when results are published.
- Add wallet balance display through API to avoid browser RPC issues.

7) Offline booth extension
- Add the v2 offline API for RFID-linked booth sessions and PIN-based vote confirmation.
- Add Web Serial booth UI support and keep the CLI serial bridge optional for diagnostics.

8) Testing
- Execute smart contract tests (Foundry).
- Run manual end-to-end workflow tests for registration, KYC, voting, and reset.

## VIII. Smart Contract Model
### A. Data Structures
- VoterStatus: eligible, hasVoted, voterIdHash.
- Candidate: id, name, party.
- Result: candidateId, votes.

### B. State Variables
- owner: contract administrator address.
- electionActive: whether voting is open.
- resultsPublished: whether results are public.
- electionId: current election cycle identifier.
- voters: mapping of electionId -> wallet -> VoterStatus.
- voterIdToWallet: mapping of electionId -> voterIdHash -> wallet.
- candidates: mapping of electionId -> Candidate array.
- votes: mapping of electionId -> candidateId -> count.

### C. Election Lifecycle
- Each election cycle is isolated by electionId.
- resetElection increments electionId, which effectively clears candidates and voter status for a new cycle.

### D. Events
- VoterRegistered: emitted when a voter is registered on-chain.
- EligibilityUpdated: emitted when eligibility is changed.
- CandidateAdded: emitted when a new candidate is added.
- VoteCast: emitted after a vote is recorded.
- ElectionStatusChanged and ResultsPublished: emitted for state transitions.
- ElectionReset: emitted when a new election cycle begins.

### E. Function Summary
- Administration: registerVoter, setEligibility, addCandidate, setElectionActive, publishResults, resetElection.
- Public: vote, getCandidates, getResults, getVoterStatus.

## IX. Function-Level Description
This section provides detailed functional explanations for contract functions, API endpoints, and key frontend workflows.

### A. Smart Contract Functions (Election.sol)
1) constructor()
- Purpose: Initializes owner and default election state.
- Inputs: none.
- Validations: none.
- Actions: sets owner = msg.sender, electionActive = true, resultsPublished = false, electionId = 1.

2) registerVoter(address wallet, bytes32 voterIdHash)
- Purpose: Registers a wallet for the current election.
- Inputs: wallet, voterIdHash.
- Validations: wallet not zero; wallet not already registered for current election; voterIdHash not already used in current election.
- Actions: writes VoterStatus with eligible = true, hasVoted = false; updates voterIdToWallet.
- Output: none; emits VoterRegistered.

3) setEligibility(address wallet, bool eligible)
- Purpose: Updates eligibility for a registered voter.
- Inputs: wallet, eligible.
- Validations: wallet is registered for current election.
- Actions: updates voters[electionId][wallet].eligible.
- Output: none; emits EligibilityUpdated.

4) addCandidate(string name, string party)
- Purpose: Adds a candidate to the current election.
- Inputs: name, party.
- Validations: caller is owner.
- Actions: appends candidate with id = candidates[electionId].length + 1.
- Output: none; emits CandidateAdded.

5) setElectionActive(bool active)
- Purpose: Opens or closes the election.
- Inputs: active.
- Validations: caller is owner.
- Actions: sets electionActive to active.
- Output: none; emits ElectionStatusChanged.

6) publishResults()
- Purpose: Publishes results after election closure.
- Inputs: none.
- Validations: electionActive is false; resultsPublished is false.
- Actions: sets resultsPublished = true.
- Output: none; emits ResultsPublished.

7) getCandidates()
- Purpose: Returns candidate list for current election.
- Inputs: none.
- Validations: none.
- Actions: returns candidates[electionId].
- Output: Candidate array.

8) getResults()
- Purpose: Returns results for current election.
- Inputs: none.
- Validations: resultsPublished is true OR caller is owner.
- Actions: constructs result list from candidates and votes mapping.
- Output: Result array.

9) getVoterStatus(address wallet)
- Purpose: Returns voter status for a wallet.
- Inputs: wallet.
- Validations: none.
- Actions: returns voters[electionId][wallet].
- Output: VoterStatus.

10) vote(uint256 candidateId)
- Purpose: Records a vote on-chain.
- Inputs: candidateId.
- Validations: electionActive true; resultsPublished false; voter registered; voter eligible; voter has not voted; candidateId valid.
- Actions: marks hasVoted true and increments votes count.
- Output: none; emits VoteCast.

11) resetElection()
- Purpose: Starts a new election cycle.
- Inputs: none.
- Validations: caller is owner.
- Actions: increments electionId; sets electionActive true; sets resultsPublished false.
- Output: none; emits ElectionReset.

### B. API Functions (Express Endpoints)
1) POST /auth/register
- Purpose: Creates a user and returns a JWT.
- Input: fullName, email, nid, dob.
- Validation: field length and format checks.
- Actions: insert user in database; sign JWT.
- Output: token and user profile.

2) POST /auth/login
- Purpose: Authenticates user by nid and dob.
- Input: nid, dob.
- Validation: field format checks.
- Actions: fetch user and sign JWT.
- Output: token and user profile.

3) GET /me
- Purpose: Returns current user profile.
- Input: Authorization header.
- Actions: fetch user by token subject.
- Output: user profile.

4) POST /kyc/submit
- Purpose: Accepts KYC document for verification.
- Input: documentType and file (multipart).
- Validation: file required, size limit enforced.
- Actions: upload file to MinIO, upsert KYC submission, set status to PENDING.
- Output: submission id and status.

5) POST /admin/kyc/:id/approve
- Purpose: Approves KYC and assigns wallet.
- Input: submission id, optional reviewNote.
- Actions: set KYC status to APPROVED; create wallet if missing; encrypt private key with AES-256-GCM; fund wallet from funder; register voter on-chain using voterIdHash derived from sha256(userId).
- Output: submission id, status, voterIdHash.

6) POST /admin/kyc/:id/reject
- Purpose: Rejects KYC submission.
- Input: submission id, optional reviewNote.
- Actions: set KYC status to REJECTED and update user.
- Output: submission id and status.

7) POST /admin/candidates
- Purpose: Adds candidate and stores metadata.
- Input: name, party (multipart).
- Actions: call addCandidate on-chain; parse CandidateAdded event to derive candidateId; upsert CandidateAsset with name/party; optional image upload.
- Output: txHash and candidateId.

8) POST /admin/election/status
- Purpose: Opens or closes election.
- Input: active boolean.
- Actions: call setElectionActive on-chain.
- Output: txHash and active state.

9) POST /admin/results/publish
- Purpose: Publishes results.
- Input: none.
- Actions: call publishResults on-chain.
- Output: txHash.

10) POST /admin/election/reset
- Purpose: Resets election state.
- Input: none.
- Actions: call resetElection on-chain.
- Output: txHash.

11) POST /admin/voters/eligibility
- Purpose: Sets voter eligibility; auto-registers if needed.
- Input: walletAddress, eligible.
- Actions: validate wallet address; check on-chain status; if not registered, register using user.voterIdHash; then update eligibility.
- Output: txHash and optional registerTxHash.

12) POST /vote
- Purpose: Submits a vote on behalf of a user wallet.
- Input: candidateId.
- Actions: decrypt wallet private key; submit on-chain vote; if insufficient funds, fund wallet and retry.
- Output: txHash.

13) GET /admin/voters
- Purpose: Returns users with on-chain status.
- Input: none.
- Actions: fetch users and call getVoterStatus for each wallet.
- Output: list of users with eligibility and voting status.

14) GET /wallet/balance
- Purpose: Returns wallet address and on-chain balance.
- Input: Authorization header.
- Actions: query chain balance for current user wallet.
- Output: walletAddress and balance.

15) GET /candidates and GET /candidates/:id/image
- Purpose: Returns candidate metadata and optional image.
- Actions: fetch CandidateAsset list; resolve image file if present.
- Output: metadata list or image response.

### C. Frontend Functions (Key Workflows)
1) AuthContext
- Purpose: Maintains user session state.
- Actions: register/login, store token, refresh profile, handle logout.

2) ElectionContext
- Purpose: Loads candidates, results, voter status, and election state.
- Actions: reads contract data; falls back to mock data if contract unavailable; uses API for vote.

3) AdminPanel
- Purpose: Provides admin tools for candidates, eligibility, and election lifecycle.
- Actions: triggers API calls, shows transaction processing dialog, refreshes data on success.

4) Connect Page
- Purpose: Displays wallet status (full address, voter hash, balance, KYC status).
- Actions: calls API balance endpoint and renders data with full values.

5) Voting Pages
- Purpose: Allow user to select candidate and submit vote.
- Actions: disable voting when results are published; show processing modal during transaction.

## X. System Operation Details
### A. Authentication and Session
1) User registers with email, nid, and dob.
2) API validates input and stores user record.
3) JWT is issued and stored in browser local storage.
4) On page load, frontend calls /me to refresh session state.

### B. KYC Submission
1) User uploads a document via multipart form.
2) API stores file in MinIO and records metadata in KycSubmission.
3) User status remains PENDING until admin review.

### C. KYC Review and Wallet Assignment
1) Admin approves submission.
2) API creates wallet if missing and encrypts private key using AES-256-GCM.
3) API funds the wallet from the funder account.
4) API registers voter on-chain with voterIdHash.

### D. Voter Registration and Eligibility
1) Registration binds wallet to voterIdHash on-chain.
2) Eligibility can be toggled by admin.
3) If not registered for current election, the API auto-registers before eligibility update.

### E. Voting Transaction Flow
1) User selects candidate and confirms vote.
2) API decrypts stored private key and submits transaction.
3) If balance is insufficient, API funds wallet and retries once.
4) UI shows processing modal and updates state after completion.

### F. Election Status and Results
1) Admin opens or closes election via on-chain transaction.
2) Results can be published only after closure.
3) Results become visible to all users after publication.

### G. Election Reset
1) Admin triggers resetElection.
2) electionId increments and previous candidates/votes become inaccessible.
3) New candidates and voters are registered under the new electionId.

### H. Wallet Status and Balance Display
1) Connect page calls /wallet/balance.
2) API fetches balance from chain and returns it.
3) UI renders full wallet address and full voter hash for transparency.

### I. Admin Monitoring
1) Admin fetches voter list.
2) API merges database profiles with on-chain status.
3) Admin UI shows eligibility and voting state per user.

## XI. Data Model
### A. User
- id, email, fullName, nid, dob
- role (USER/ADMIN)
- kycStatus (PENDING/APPROVED/REJECTED)
- walletAddress, walletEncryptedKey
- voterIdHash
- createdAt, updatedAt

### B. KycSubmission
- id, userId, documentType, documentUrl
- status, reviewedBy, reviewNote
- createdAt, updatedAt

### C. CandidateAsset
- id, candidateId, name, party
- imageKey (optional)
- createdAt, updatedAt

### D. On-Chain State vs Off-Chain State
- On-chain: eligibility, voting status, candidates, results.
- Off-chain: identity data, KYC documents, wallet encryption payloads.

## XII. Reliability and Error Handling
### A. RPC Fallback
- Multiple RPC URLs are configured to reduce failures.
- FallbackProvider selects healthy nodes for read operations.

### B. Nonce Management
- Admin transactions are serialized with NonceManager.
- Prevents nonce reuse errors during back-to-back admin actions.

### C. Vote Retry Logic
- If a vote fails due to insufficient funds, the system funds the wallet and retries.
- This minimizes user-facing failures without manual intervention.

### D. Timeouts and UI State
- Voting and admin actions show processing dialogs.
- Slow transaction notices appear if confirmations take longer than expected.

### E. Error Messaging
- API responses include error reasons where possible.
- UI surfaces errors in banners for user visibility.

## XIII. Security Considerations
### A. Authentication and Authorization
- JWT-based authentication for API access.
- Role checks for admin-only endpoints.

### B. Wallet Key Protection
- Private keys are encrypted with AES-256-GCM.
- Encryption key is stored in server environment variables.

### C. KYC Data Protection
- Documents stored in MinIO with controlled access.
- Document URLs are not exposed directly to public users.

### D. Input Validation
- Zod schema validation for API payloads.
- File size limits enforced for uploads.

### E. Network and CORS
- CORS is restricted to configured origins.

## XIV. Testing and Validation
### A. Smart Contract Tests
- Candidate addition, voting flow, election reset, and results publishing.

### B. System-Level Tests
- Registration, KYC approval, wallet assignment, voting, results, reset.

### C. UI Validation
- Wallet status display with full address and voter hash.
- Voting disabled after results publication.
- Processing dialogs for transaction feedback.

### D. Build and Runtime Verification
- The current repository state builds successfully for `services/api`, `apps/dapp`, and `v2/services/offline-api`.
- Local health checks return success for `http://localhost:4000/health`, `http://localhost:4100/health`, and `http://localhost:5173`.
- `forge test` passes for the election contract suite.

## XV. Results and Discussion
The hybrid model enabled transparency for vote state changes while protecting user identity off-chain. RPC instability in test networks was the primary operational issue; fallback providers resolved most failures. Admin transaction serialization reduced errors caused by nonce conflicts. The system provides a usable baseline for academic demonstration and pilot projects.

## XVI. Limitations and Future Work
Limitations:
- Relies on a centralized admin for KYC and wallet funding.
- Uses a testnet environment, not mainnet.
- Does not implement advanced anonymity protocols.

Future work:
- Explore decentralized identity verification.
- Add cryptographic privacy layers for vote secrecy.
- Formalize compliance policies for production deployment.

## XVII. Conclusion
VoteHybrid demonstrates a practical, hybrid on-chain/off-chain voting system balancing transparency, privacy, and operational feasibility. The architecture and implementation are appropriate for research and demonstration use. With additional compliance and security layers, it can be extended toward production-grade deployments.

## References
[1] Ethereum Foundation, "Solidity documentation." [Online]. Available: https://docs.soliditylang.org

[2] Ethers.js, "Ethers.js documentation." [Online]. Available: https://docs.ethers.org

[3] Prisma, "Prisma documentation." [Online]. Available: https://www.prisma.io/docs

[4] MinIO, "MinIO documentation." [Online]. Available: https://min.io/docs
