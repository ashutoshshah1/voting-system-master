import { ethers, isAddress } from "ethers";
import abi from "../contracts/abi.json" with { type: "json" };
import { env } from "./env.js";
import { decryptSecret, encryptSecret } from "./crypto.js";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const buildProvider = () => {
  const network = new ethers.Network(env.rpcChainName, env.rpcChainId);
  const providers = env.rpcUrls.map(
    (url) =>
      new ethers.JsonRpcProvider(url, network, {
        batchMaxCount: 1,
        staticNetwork: network,
      })
  );
  if (providers.length === 1) {
    return providers[0];
  }
  return new ethers.FallbackProvider(
    providers.map((provider, index) => ({
      provider,
      priority: index,
      stallTimeout: 1500,
    })),
    network,
    { quorum: 1 }
  );
};
const provider = buildProvider();
provider.on("error", (error) => {
  console.error("RPC provider error:", error);
});
const adminSigner = new ethers.NonceManager(
  new ethers.Wallet(env.funderPrivateKey, provider)
);
let adminQueue: Promise<unknown> = Promise.resolve();

const isNonceExpired = (error: unknown) => {
  if (!error || typeof error !== "object") {
    return false;
  }
  const code = (error as { code?: string }).code;
  if (code === "NONCE_EXPIRED") {
    return true;
  }
  const message = `${(error as { reason?: string; shortMessage?: string; message?: string })
    .reason ?? (error as { shortMessage?: string }).shortMessage ?? (error as { message?: string }).message ?? ""}`.toLowerCase();
  return message.includes("nonce too low") || message.includes("nonce has already been used");
};

const withAdminQueue = async <T>(runner: () => Promise<T>) => {
  const run = async () => {
    try {
      adminSigner.reset();
      return await runner();
    } catch (error) {
      if (!isNonceExpired(error)) {
        throw error;
      }
      adminSigner.reset();
      return await runner();
    }
  };
  const next = adminQueue.then(run, run);
  adminQueue = next.catch(() => undefined);
  return next;
};

const ensureContractAddress = () => {
  if (!isAddress(env.contractAddress) || env.contractAddress === ZERO_ADDRESS) {
    throw new Error("Invalid contract address");
  }
};

export const createWallet = () => {
  const wallet = ethers.Wallet.createRandom();
  return {
    address: wallet.address.toLowerCase(),
    encryptedKey: encryptSecret(wallet.privateKey),
  };
};

export const fundWallet = async (address: string) => {
  return withAdminQueue(async () => {
    const value = ethers.parseEther(env.fundAmount);
    const tx = await adminSigner.sendTransaction({ to: address, value });
    await tx.wait();
    return tx.hash;
  });
};

export const registerVoterOnChain = async (walletAddress: string, voterIdHash: string) => {
  return withAdminQueue(async () => {
    ensureContractAddress();
    const contract = new ethers.Contract(env.contractAddress, abi, adminSigner);
    const tx = await contract.registerVoter(walletAddress, voterIdHash);
    await tx.wait();
    return tx.hash as string;
  });
};

export const setEligibilityOnChain = async (walletAddress: string, eligible: boolean) => {
  return withAdminQueue(async () => {
    ensureContractAddress();
    const contract = new ethers.Contract(env.contractAddress, abi, adminSigner);
    const tx = await contract.setEligibility(walletAddress, eligible);
    await tx.wait();
    return tx.hash as string;
  });
};

export const addCandidateOnChain = async (name: string, party: string) => {
  return withAdminQueue(async () => {
    ensureContractAddress();
    const contract = new ethers.Contract(env.contractAddress, abi, adminSigner);
    const tx = await contract.addCandidate(name, party);
    const receipt = await tx.wait();
    let candidateId: number | null = null;
    if (receipt?.logs?.length) {
      for (const log of receipt.logs) {
        try {
          const parsed = contract.interface.parseLog(log);
          if (parsed?.name === "CandidateAdded") {
            const idValue = parsed.args?.candidateId ?? parsed.args?.[0];
            candidateId = Number(idValue);
            break;
          }
        } catch {
          // Ignore non-matching logs.
        }
      }
    }
    if (candidateId === null) {
      try {
        const candidates = await contract.getCandidates();
        const last = candidates[candidates.length - 1];
        if (last) {
          const idValue = (last as { id?: unknown }).id ?? (last as unknown[])[0];
          candidateId = Number(idValue);
        }
      } catch {
        // Ignore fallback failures.
      }
    }
    return { txHash: tx.hash as string, candidateId };
  });
};

export const setElectionActiveOnChain = async (active: boolean) => {
  return withAdminQueue(async () => {
    ensureContractAddress();
    const contract = new ethers.Contract(env.contractAddress, abi, adminSigner);
    const tx = await contract.setElectionActive(active);
    await tx.wait();
    return tx.hash as string;
  });
};

export const publishResultsOnChain = async () => {
  return withAdminQueue(async () => {
    ensureContractAddress();
    const contract = new ethers.Contract(env.contractAddress, abi, adminSigner);
    const tx = await contract.publishResults();
    await tx.wait();
    return tx.hash as string;
  });
};

export const resetElectionOnChain = async () => {
  return withAdminQueue(async () => {
    ensureContractAddress();
    const contract = new ethers.Contract(env.contractAddress, abi, adminSigner);
    const tx = await contract.resetElection();
    await tx.wait();
    return tx.hash as string;
  });
};

export const getElectionActiveOnChain = async () => {
  ensureContractAddress();
  const contract = new ethers.Contract(env.contractAddress, abi, provider);
  return (await contract.electionActive()) as boolean;
};

export const getResultsPublishedOnChain = async () => {
  ensureContractAddress();
  const contract = new ethers.Contract(env.contractAddress, abi, provider);
  return (await contract.resultsPublished()) as boolean;
};

export const getVoterStatusOnChain = async (walletAddress: string) => {
  ensureContractAddress();
  if (!isAddress(walletAddress)) {
    throw new Error("Invalid wallet address");
  }
  const contract = new ethers.Contract(env.contractAddress, abi, provider);
  const status = await contract.getVoterStatus(walletAddress);
  return {
    eligible: status.eligible ?? status[0],
    hasVoted: status.hasVoted ?? status[1],
    voterIdHash: status.voterIdHash ?? status[2],
  } as { eligible: boolean; hasVoted: boolean; voterIdHash: string };
};

export const getWalletBalanceOnChain = async (walletAddress: string) => {
  if (!isAddress(walletAddress)) {
    throw new Error("Invalid wallet address");
  }
  const balance = await provider.getBalance(walletAddress);
  return ethers.formatEther(balance);
};

export const submitVote = async (encryptedKey: string, candidateId: number) => {
  ensureContractAddress();
  const privateKey = decryptSecret(encryptedKey);
  const wallet = new ethers.Wallet(privateKey, provider);
  const contract = new ethers.Contract(env.contractAddress, abi, wallet);
  const tx = await contract.vote(candidateId);
  try {
    await tx.wait(1, 15_000);
  } catch (error: any) {
    const code = `${error?.code || ""}`.toLowerCase();
    const message = `${error?.message || ""}`.toLowerCase();
    const isTimeout =
      code.includes("timeout") ||
      message.includes("timeout") ||
      message.includes("timed out");
    if (!isTimeout) {
      throw error;
    }
  }
  return tx.hash as string;
};
