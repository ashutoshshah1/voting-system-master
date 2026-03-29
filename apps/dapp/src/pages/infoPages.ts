import type { InfoPageContent } from "./InfoPage";

export const infoPages: InfoPageContent[] = [
  {
    path: "/features",
    title: "Features",
    kicker: "Product",
    subtitle: "Key capabilities of the VoteHybrid platform.",
    intro:
      "VoteHybrid blends online voting with offline verification to deliver transparent results without compromising voter privacy.",
    highlights: [
      { label: "Verification", value: "RFID + Officer + PIN" },
      { label: "Ledger", value: "On-chain Votes" },
      { label: "Audit", value: "Public Results" },
    ],
    sections: [
      {
        title: "End-to-End Verifiability",
        body: [
          "Voters can confirm their ballot is recorded and counted correctly.",
          "Receipts and on-chain events provide transparent verification.",
          "Eligibility checks prevent double voting.",
        ],
      },
      {
        title: "Privacy by Design",
        body: [
          "Identity data stays off-chain while votes are stored immutably.",
          "Wallets are linked to hashed identifiers, not raw PII.",
          "No sensitive identity documents are stored on the public ledger.",
        ],
      },
      {
        title: "Hybrid Architecture",
        body: [
          "Offline kiosks handle RFID + officer verification + PIN.",
          "Online DApp supports wallet-based voting and receipts.",
          "Both modes converge on the same blockchain ledger.",
        ],
      },
      {
        title: "Admin Controls",
        body: [
          "Manage candidates, eligibility, and election status.",
          "Publish results and reset election cycles.",
          "Monitor voter state and KYC approval workflow.",
        ],
      },
    ],
  },
  {
    path: "/security",
    title: "Security",
    kicker: "Product",
    subtitle: "Security controls across the entire voting lifecycle.",
    intro:
      "Security combines verified identity, encrypted wallets, and immutable on-chain records to protect ballots from tampering or abuse.",
    sections: [
      {
        title: "Identity & Access",
        body: [
          "KYC verification confirms real-world identity before voting.",
          "Eligibility is controlled by authorized admins only.",
          "Voters are bound to a single wallet per election cycle.",
        ],
      },
      {
        title: "Wallet & Key Protection",
        body: [
          "Private keys are encrypted at rest using server-managed keys.",
          "Relayer funding isolates admin funds from voter wallets.",
          "Clients never handle private keys directly.",
        ],
      },
      {
        title: "On-Chain Integrity",
        body: [
          "Votes are stored immutably on the blockchain.",
          "Smart contracts enforce one-vote-per-wallet rules.",
          "Public receipts enable independent audits.",
        ],
      },
      {
        title: "Data Handling",
        body: [
          "Documents are stored in MinIO with access controls.",
          "Sensitive data remains off-chain to reduce exposure.",
          "All client-server communication is encrypted in transit.",
        ],
      },
    ],
  },
  {
    path: "/roadmap",
    title: "Roadmap",
    kicker: "Product",
    subtitle: "Planned milestones for the VoteHybrid platform.",
    intro:
      "The roadmap focuses on expanding offline device workflows, strengthening compliance, and preparing for real-world pilots.",
    sections: [
      {
        title: "Phase 1: MVP Delivery",
        body: [
          "Web DApp for registration, voting, and results.",
          "Admin tools for candidate and election management.",
          "Blockchain-backed vote storage on Sepolia.",
        ],
      },
      {
        title: "Phase 2: Offline Device Flow",
        body: [
          "Arduino-based kiosk integration.",
          "RFID + officer attestation + PIN at polling booths.",
          "Secure sync from device to blockchain backend.",
        ],
      },
      {
        title: "Phase 3: Compliance & Audit",
        body: [
          "Formalize privacy, retention, and audit policies.",
          "Independent security reviews and threat modeling.",
          "Expanded monitoring and incident response tooling.",
        ],
      },
      {
        title: "Phase 4: Pilot Programs",
        body: [
          "Partnered pilot elections with real voters.",
          "Operational playbooks for admins and observers.",
          "Feedback-driven iteration for scalability.",
        ],
      },
    ],
  },
  {
    path: "/changelog",
    title: "Changelog",
    kicker: "Product",
    subtitle: "Release notes and iteration history.",
    intro:
      "This log summarizes major changes to VoteHybrid as the product evolves.",
    sections: [
      {
        title: "v1.0 (February 2026)",
        body: [
          "Launched hybrid DApp with KYC-based onboarding.",
          "Admin tooling for candidates, elections, and results.",
          "Docs hub with project proposal and architecture overview.",
        ],
      },
      {
        title: "Next Up",
        body: [
          "Offline kiosk integration refinements.",
          "Enhanced voter audit dashboards.",
          "Expanded compliance documentation.",
        ],
      },
    ],
  },
  {
    path: "/about",
    title: "About",
    kicker: "Company",
    subtitle: "Why VoteHybrid exists.",
    intro:
      "VoteHybrid began as a university project exploring how blockchain can strengthen electoral trust while preserving voter privacy.",
    sections: [
      {
        title: "Mission",
        body: [
          "Deliver transparent, verifiable elections without exposing voter identities.",
          "Blend offline verification with online convenience.",
          "Build systems that scale for real-world deployments.",
        ],
      },
      {
        title: "Research Roots",
        body: [
          "Developed at Sagarmatha Engineering College, Tribhuvan University.",
          "Focuses on hybrid online + offline voting workflows.",
          "Anchored in academic study of e-voting security.",
        ],
      },
      {
        title: "Principles",
        body: [
          "Security and integrity come before convenience.",
          "Transparency is fundamental to public trust.",
          "Privacy protections are non-negotiable.",
        ],
      },
    ],
  },
  {
    path: "/careers",
    title: "Careers",
    kicker: "Company",
    subtitle: "Help shape trustworthy elections.",
    intro:
      "We are building a hybrid voting platform that balances transparency and privacy. Interested in contributing?",
    sections: [
      {
        title: "Open Roles",
        body: [
          "We are not hiring full-time roles yet.",
          "Research and collaboration opportunities are welcome.",
          "Reach out if you want to contribute to the project.",
        ],
      },
      {
        title: "What We Value",
        body: [
          "Security-first engineering and careful threat modeling.",
          "Clear documentation and transparent decision-making.",
          "Respect for voter privacy and ethical design.",
        ],
      },
    ],
  },
  {
    path: "/blog",
    title: "Blog",
    kicker: "Company",
    subtitle: "Updates from the VoteHybrid team.",
    intro:
      "We share technical notes, research findings, and project updates as development continues.",
    sections: [
      {
        title: "Latest Posts",
        body: [
          "No posts published yet.",
          "Check back for research and release updates.",
        ],
      },
      {
        title: "Topics We Cover",
        body: [
          "Blockchain voting integrity and auditability.",
          "Offline device workflows and officer-attested verification.",
          "Operational insights from pilot deployments.",
        ],
      },
    ],
  },
  {
    path: "/contact",
    title: "Contact",
    kicker: "Company",
    subtitle: "Get in touch with the VoteHybrid team.",
    intro:
      "Have questions about the project or want to collaborate? We are happy to talk.",
    sections: [
      {
        title: "General Inquiries",
        body: [
          "Email: contact@votehybrid.app",
          "Response time: 1-2 business days.",
        ],
      },
      {
        title: "Security Reports",
        body: [
          "Email: security@votehybrid.app",
          "Please include steps to reproduce and impact details.",
        ],
      },
      {
        title: "Project Collaboration",
        body: [
          "We welcome academic and civic partnerships.",
          "Share your goals and deployment scope in your message.",
        ],
      },
    ],
  },
  {
    path: "/help",
    title: "Help Center",
    kicker: "Resources",
    subtitle: "Guides and troubleshooting for voters and admins.",
    intro:
      "Find quick answers to common questions about registration, KYC, and casting a vote.",
    sections: [
      {
        title: "Getting Started",
        body: [
          "Register with your National ID and date of birth.",
          "Submit KYC documents for admin approval.",
          "Wait for wallet assignment before voting.",
        ],
      },
      {
        title: "Voting Flow",
        body: [
          "Select your candidate from the ballot.",
          "Confirm the transaction and wait for on-chain receipt.",
          "Results appear once the election is closed and published.",
        ],
      },
      {
        title: "Troubleshooting",
        body: [
          "If KYC is pending, contact your election admin.",
          "If voting fails, check wallet funding and RPC status.",
          "Refresh the page after transaction confirmation.",
        ],
      },
    ],
  },
  {
    path: "/status",
    title: "Status",
    kicker: "Resources",
    subtitle: "Current availability of VoteHybrid services.",
    intro:
      "Status in local development depends on the services you run on this machine.",
    sections: [
      {
        title: "Overall",
        body: [
          "Local environment: depends on your running services.",
          "Check Docker and API logs for real-time status.",
        ],
      },
      {
        title: "Core Services",
        body: [
          "DApp: Vite dev server on port 5173.",
          "API: Node service on port 4000.",
          "Postgres + MinIO: Docker Compose services.",
        ],
      },
    ],
  },
  {
    path: "/legal/privacy",
    title: "Privacy Policy",
    kicker: "Legal",
    subtitle: "Summary of how VoteHybrid handles data.",
    intro:
      "VoteHybrid prioritizes voter privacy by separating identity data from on-chain votes.",
    sections: [
      {
        title: "Data We Collect",
        body: [
          "Registration details (name, email, NID, DOB).",
          "KYC documents uploaded for verification.",
          "On-chain transaction metadata for vote receipts.",
        ],
      },
      {
        title: "How We Use Data",
        body: [
          "Verify eligibility and prevent duplicate voting.",
          "Generate audit trails without revealing voter identity.",
          "Support admin review and election management.",
        ],
      },
      {
        title: "Security & Retention",
        body: [
          "Sensitive documents are stored off-chain in MinIO.",
          "Private keys are encrypted at rest.",
          "Data retention follows election policy requirements.",
        ],
      },
    ],
  },
  {
    path: "/legal/terms",
    title: "Terms of Service",
    kicker: "Legal",
    subtitle: "Summary of acceptable use and responsibilities.",
    intro:
      "By using VoteHybrid, voters and admins agree to follow eligibility rules and respect election integrity.",
    sections: [
      {
        title: "Use of the Platform",
        body: [
          "Only eligible voters may cast ballots.",
          "Admins must manage elections responsibly.",
          "Misuse or tampering attempts are prohibited.",
        ],
      },
      {
        title: "Availability",
        body: [
          "Service availability depends on network and infrastructure.",
          "Local deployments are responsible for uptime and monitoring.",
        ],
      },
      {
        title: "Changes",
        body: [
          "Terms may evolve as the project matures.",
          "Material changes should be communicated to stakeholders.",
        ],
      },
    ],
  },
];
