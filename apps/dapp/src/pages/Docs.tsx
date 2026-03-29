import { PageHeader } from "../components/PageHeader";
import { Panel } from "../components/Panel";
import { StatTile } from "../components/StatTile";

const pdfUrl = "/docs/votehybrid-project-proposal.pdf";

const contents = [
  { label: "Abstract", href: "#abstract" },
  { label: "System Block Diagram", href: "#system-diagram" },
  { label: "Objectives", href: "#objectives" },
  { label: "Features", href: "#features" },
  { label: "Feasibility", href: "#feasibility" },
  { label: "Requirements", href: "#requirements" },
  { label: "Methodology", href: "#methodology" },
  { label: "Expected Outcomes", href: "#outcomes" },
  { label: "Project PDF", href: "#proposal" },
];

const objectives = [
  "Develop a secure web-based digital election system that integrates blockchain technology for transparent, immutable, and reliable online voting.",
];

const featureCards = [
  {
    title: "End-to-End Verifiability",
    desc: "Voters can confirm that their vote was cast, recorded, and counted accurately while preserving privacy.",
  },
  {
    title: "Blockchain Integration",
    desc: "Transparent, tamper-resistant vote storage with decentralized trust.",
  },
  {
    title: "Vote Privacy",
    desc: "Cryptographic protection (including privacy-preserving techniques) keeps voter identity separate from the ballot.",
  },
  {
    title: "Modular Architecture",
    desc: "Hybrid design blends hardware-assisted offline voting with a decentralized web application.",
  },
  {
    title: "Auditability & Dispute Resolution",
    desc: "Receipts and public ledger access support verification and dispute handling.",
  },
];

const feasibility = [
  "Technology availability: Ethereum, Solidity, Web3 tooling, and Arduino are mature and accessible.",
  "System development: Smart contracts and DApp voting portals have been demonstrated in related work.",
  "Hardware simulation: Arduino can emulate secure ballot devices with tamper detection.",
  "Integration: Web3 libraries enable smooth frontend-to-blockchain interaction.",
];

const softwareRequirements = [
  "Blockchain & smart contracts",
  "Arduino layer",
  "Frontend interface",
  "Security & audit",
  "Node.js",
  "React.js",
  "Tailwind CSS",
  "Flask",
  "FastAPI",
];

const hardwareRequirements = [
  "Raspberry Pi",
  "RFID sensor",
  "HDMI touch display",
];

const functionalRequirements = [
  "User authentication via RFID, officer attestation, and PIN.",
  "Voter identification using a National ID card.",
  "Candidate selection through a touch display.",
  "Client-server communication over HTTP.",
  "Encrypted communication between client and server.",
  "Admin panel access for authorized stakeholders.",
];

const nonFunctionalRequirements = [
  "Performance: real-time response for RFID scanning and booth session verification.",
  "Portability: runs on Raspberry Pi with an HDMI touch display.",
];

const methodology = [
  "System block diagram with input, processing, voting, and output blocks.",
  "Blockchain usage and data hashing for vote integrity.",
  "Smart contract development and testing using Foundry.",
  "Sequence diagrams for voter registration and voting flows.",
  "ER diagram and on-chain/off-chain data model design.",
  "Arduino program state flow for offline device behavior.",
  "DApp program flow for wallet auth, candidate selection, and voting.",
  "Use case diagram covering voters, admins, and devices.",
];

const outcomes = [
  {
    title: "Tamper-Proof Voting System",
    desc: "Votes recorded on-chain become immutable, each tied to a transaction hash for verifiable audit trails.",
  },
  {
    title: "End-to-End Vote Integrity",
    desc: "Eligibility checks restrict voting to verified users, while public records support independent audits.",
  },
  {
    title: "Decentralized Vote Storage",
    desc: "Distributed nodes remove single points of failure and improve resilience against attacks or outages.",
  },
  {
    title: "Accurate Vote Counting",
    desc: "Blockchain-based tallying automates counting and reduces manual error or bias.",
  },
  {
    title: "Transparent Audit With Privacy",
    desc: "Observers can verify results without revealing individual voter identities.",
  },
  {
    title: "Overall System Impact",
    desc: "A secure, transparent, and scalable election platform combining DApp voting with Arduino-assisted offline access.",
  },
];

const systemFlowHighlights = [
  "Online (1->6): Register/Login -> KYC Submit -> Admin Approval -> Candidate Select -> Vote Relay -> Receipt/Results.",
  "Offline (1->6): RFID Scan -> Session Start -> Candidate+PIN -> Offline Verify -> Tx Submit -> Booth Receipt.",
  "Shared infrastructure: Online API, Offline API, PostgreSQL, and MinIO support both lanes.",
  "Final integrity gate: both lanes converge to one Election contract and must pass hasVoted=false.",
];

export function Docs() {
  return (
    <div className="space-y-20">
      <section className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
        <div className="space-y-6">
          <div className="inline-flex flex-wrap items-center gap-3 rounded-full border border-white/5 bg-white/5 backdrop-blur px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-neon-blue">
            Project Proposal
            <span className="text-white/20">|</span>
            January 2026
          </div>

          <PageHeader
            kicker="Documentation"
            title="VoteHybrid Project Proposal"
            subtitle="A hybrid online + offline election system using blockchain technology for integrity, privacy, and auditability."
          />

          <p className="text-text-muted text-lg leading-relaxed">
            This proposal outlines a blockchain-backed voting system that combines a web DApp with
            an Arduino-assisted offline device. Voters authenticate using RFID, officer verification,
            cast ballots on a touch interface, and store results on-chain for tamper-proof verification.
          </p>

          <div className="flex flex-wrap gap-3">
            <a
              href={pdfUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition bg-gradient-to-r from-neon-purple to-neon-blue text-white shadow-neon hover:shadow-neonBlue hover:translate-y-[-1px]"
            >
              Open PDF
            </a>
            <a
              href={pdfUrl}
              download
              className="inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition border border-neon-blue/40 text-neon-blue hover:bg-neon-blue/10 hover:border-neon-blue"
            >
              Download PDF
            </a>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <StatTile label="Pages" value="48" />
            <StatTile label="Mode" value="Online + Offline" />
            <StatTile label="Trust" value="Blockchain" />
          </div>
        </div>

        <Panel className="space-y-6">
          <div className="text-sm font-semibold uppercase tracking-[0.3em] text-text-muted">
            Contents
          </div>
          <ol className="space-y-3 text-sm text-text-muted">
            {contents.map((item) => (
              <li key={item.href}>
                <a href={item.href} className="hover:text-neon-blue transition-colors">
                  {item.label}
                </a>
              </li>
            ))}
          </ol>
          <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-xs text-text-muted/80">
            Prepared at Tribhuvan University, Institute of Engineering, Sagarmatha Engineering College.
          </div>
        </Panel>
      </section>

      <section id="system-diagram" className="scroll-mt-28 space-y-6">
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-[0.3em] text-text-muted">
            System Block Diagram
          </div>
          <h2 className="text-2xl font-display font-semibold text-white">
            End-to-end operational flow
          </h2>
        </div>
        <Panel className="space-y-4 p-4">
          <img
            src="/docs/votehybrid-system-block-diagram.png"
            alt="VoteHybrid detailed system block diagram for online and offline voting flow"
            className="w-full rounded-2xl border border-white/10 bg-black/30"
            loading="lazy"
          />
          <div className="grid gap-3 md:grid-cols-2">
            {systemFlowHighlights.map((item) => (
              <div
                key={item}
                className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-text-muted"
              >
                {item}
              </div>
            ))}
          </div>
        </Panel>
      </section>

      <section id="abstract" className="scroll-mt-28 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Panel className="space-y-4">
          <div className="text-xs font-semibold uppercase tracking-[0.3em] text-text-muted">
            Abstract
          </div>
          <p className="text-text-muted leading-relaxed">
            Traditional voting can be slow, costly, and prone to manipulation, while remote online voting
            raises security and trust concerns. The proposed solution is a hybrid voting system that uses
            blockchain for immutable storage and an RFID + officer-attested offline device for verification.
            Voters can cast ballots at nearby polling stations, and results remain auditable without exposing
            voter identities.
          </p>
        </Panel>
        <Panel className="space-y-4">
          <div className="text-xs font-semibold uppercase tracking-[0.3em] text-text-muted">
            Project Details
          </div>
          <ul className="space-y-2 text-sm text-text-muted">
            <li>Report type: Project Proposal Report</li>
            <li>Institution: Sagarmatha Engineering College</li>
            <li>University: Tribhuvan University, Institute of Engineering</li>
            <li>Location: Sanepa, Lalitpur, Nepal</li>
            <li>Authors: Ashutosh Chandra Shah, Kshitiz Raj Shrestha, Shruti Kumari Jha</li>
          </ul>
        </Panel>
      </section>

      <section id="objectives" className="scroll-mt-28 grid gap-6 lg:grid-cols-2">
        <Panel className="space-y-4">
          <div className="text-xs font-semibold uppercase tracking-[0.3em] text-text-muted">
            Objectives
          </div>
          <ul className="space-y-3 text-sm text-text-muted">
            {objectives.map((item) => (
              <li key={item} className="flex items-start gap-3">
                <span className="mt-1 h-2 w-2 rounded-full bg-neon-blue" />
                {item}
              </li>
            ))}
          </ul>
        </Panel>

        <Panel className="space-y-4">
          <div className="text-xs font-semibold uppercase tracking-[0.3em] text-text-muted">
            Core Architecture
          </div>
          <ul className="space-y-3 text-sm text-text-muted">
            <li className="flex items-start gap-3">
              <span className="mt-1 h-2 w-2 rounded-full bg-neon-purple" />
              Offline kiosk workflow using RFID cards, officer verification, PIN entry, and touch display.
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1 h-2 w-2 rounded-full bg-neon-purple" />
              Online DApp workflow with wallet authentication and on-chain vote submission.
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1 h-2 w-2 rounded-full bg-neon-purple" />
              Blockchain ledger for immutable vote storage and public result verification.
            </li>
          </ul>
        </Panel>
      </section>

      <section id="features" className="scroll-mt-28 space-y-8">
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-[0.3em] text-text-muted">
            Features
          </div>
          <h2 className="text-2xl font-display font-semibold text-white">
            What the proposal delivers
          </h2>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {featureCards.map((feature) => (
            <Panel key={feature.title} className="space-y-3">
              <h3 className="text-lg font-semibold text-white">{feature.title}</h3>
              <p className="text-sm text-text-muted leading-relaxed">{feature.desc}</p>
            </Panel>
          ))}
        </div>
      </section>

      <section id="feasibility" className="scroll-mt-28 grid gap-6 lg:grid-cols-2">
        <Panel className="space-y-4">
          <div className="text-xs font-semibold uppercase tracking-[0.3em] text-text-muted">
            Feasibility
          </div>
          <ul className="space-y-3 text-sm text-text-muted">
            {feasibility.map((item) => (
              <li key={item} className="flex items-start gap-3">
                <span className="mt-1 h-2 w-2 rounded-full bg-neon-green" />
                {item}
              </li>
            ))}
          </ul>
        </Panel>
        <Panel className="space-y-4">
          <div className="text-xs font-semibold uppercase tracking-[0.3em] text-text-muted">
            Key Risks Addressed
          </div>
          <ul className="space-y-3 text-sm text-text-muted">
            <li className="flex items-start gap-3">
              <span className="mt-1 h-2 w-2 rounded-full bg-neon-blue" />
              Double voting prevented by eligibility checks and officer-attested session verification.
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1 h-2 w-2 rounded-full bg-neon-blue" />
              Tampering reduced through immutable blockchain records.
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1 h-2 w-2 rounded-full bg-neon-blue" />
              Privacy preserved by separating voter identity from on-chain ballots.
            </li>
          </ul>
        </Panel>
      </section>

      <section id="requirements" className="scroll-mt-28 space-y-6">
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-[0.3em] text-text-muted">
            System Requirements
          </div>
          <h2 className="text-2xl font-display font-semibold text-white">
            What the system needs to run
          </h2>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <Panel className="space-y-3">
            <h3 className="text-base font-semibold text-white">Software</h3>
            <ul className="space-y-2 text-sm text-text-muted">
              {softwareRequirements.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </Panel>
          <Panel className="space-y-3">
            <h3 className="text-base font-semibold text-white">Hardware</h3>
            <ul className="space-y-2 text-sm text-text-muted">
              {hardwareRequirements.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </Panel>
          <Panel className="space-y-3">
            <h3 className="text-base font-semibold text-white">Functional</h3>
            <ul className="space-y-2 text-sm text-text-muted">
              {functionalRequirements.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </Panel>
          <Panel className="space-y-3">
            <h3 className="text-base font-semibold text-white">Non-Functional</h3>
            <ul className="space-y-2 text-sm text-text-muted">
              {nonFunctionalRequirements.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </Panel>
        </div>
      </section>

      <section id="methodology" className="scroll-mt-28 space-y-6">
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-[0.3em] text-text-muted">
            Methodology
          </div>
          <h2 className="text-2xl font-display font-semibold text-white">
            How the system is designed and validated
          </h2>
        </div>
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <Panel className="space-y-4">
            <ul className="space-y-3 text-sm text-text-muted">
              {methodology.map((item, index) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="mt-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-surfaceHighlight text-neon-blue text-xs font-semibold">
                    {index + 1}
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </Panel>
          <Panel className="space-y-4">
            <div className="text-xs font-semibold uppercase tracking-[0.3em] text-text-muted">
              Workflow Summary
            </div>
            <div className="space-y-4 text-sm text-text-muted">
              <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
                Offline flow: RFID card scan -&gt; officer attestation -&gt; PIN verification -&gt; touch display ballot -&gt; vote sent to blockchain.
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
                Online flow: Wallet authentication → candidate selection → on-chain transaction → receipt for verification.
              </div>
            </div>
          </Panel>
        </div>
      </section>

      <section id="outcomes" className="scroll-mt-28 space-y-6">
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-[0.3em] text-text-muted">
            Expected Outcomes
          </div>
          <h2 className="text-2xl font-display font-semibold text-white">
            What the project is expected to achieve
          </h2>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          {outcomes.map((item) => (
            <Panel key={item.title} className="space-y-3">
              <h3 className="text-base font-semibold text-white">{item.title}</h3>
              <p className="text-sm text-text-muted leading-relaxed">{item.desc}</p>
            </Panel>
          ))}
        </div>
      </section>

      <section id="proposal" className="scroll-mt-28 space-y-6">
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-[0.3em] text-text-muted">
            Project PDF
          </div>
          <h2 className="text-2xl font-display font-semibold text-white">
            Full proposal document
          </h2>
        </div>
        <Panel className="space-y-4 p-4">
          <iframe
            title="VoteHybrid Project Proposal PDF"
            src={pdfUrl}
            className="h-[600px] w-full rounded-2xl border border-white/10 bg-black/30"
          />
          <p className="text-xs text-text-muted">
            If the embedded viewer does not load, use the "Open PDF" button above to view the proposal in a new tab.
          </p>
        </Panel>
      </section>
    </div>
  );
}
