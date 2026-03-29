import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAuth } from "./AuthContext";
import { apiClient } from "../services/apiClient";
import { readCache, writeCache } from "../utils/cache";
import { getUserFacingErrorMessage } from "../utils/errorMessages";
import type { Candidate, Result, VoterStatus } from "../types/election";

const CACHE_TTL_MS = 30000;
const SUMMARY_CACHE_KEY = "votehybrid:election:summary:v1";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

type BlockchainModules = {
  chainConfig: typeof import("../config/chain").chainConfig;
  ContractService: typeof import("../services/ContractService").ContractService;
  createRpcProvider: typeof import("../services/rpcProvider").createRpcProvider;
  ethers: typeof import("ethers").ethers;
};

type ContractServiceInstance = InstanceType<
  typeof import("../services/ContractService").ContractService
>;

type RpcProviderLike = {
  getCode: (address: string) => Promise<string>;
};

let blockchainModulesPromise: Promise<BlockchainModules> | null = null;

const loadBlockchainModules = () => {
  if (!blockchainModulesPromise) {
    blockchainModulesPromise = Promise.all([
      import("../config/chain"),
      import("../services/ContractService"),
      import("../services/rpcProvider"),
      import("ethers"),
    ]).then(([chainModule, contractServiceModule, rpcProviderModule, ethersModule]) => ({
      chainConfig: chainModule.chainConfig,
      ContractService: contractServiceModule.ContractService,
      createRpcProvider: rpcProviderModule.createRpcProvider,
      ethers: ethersModule.ethers,
    }));
  }

  return blockchainModulesPromise;
};

type ElectionContextValue = {
  candidates: Candidate[];
  results: Result[];
  voterStatus: VoterStatus | null;
  electionActive: boolean | null;
  resultsPublished: boolean | null;
  isLoading: boolean;
  isVoting: boolean;
  error: string | null;
  txHash: string | null;
  isMockMode: boolean;
  refresh: (options?: { silent?: boolean }) => Promise<void>;
  vote: (candidateId: number) => Promise<string | null>;
};

const ElectionContext = createContext<ElectionContextValue | null>(null);

export function ElectionProvider({ children }: { children: React.ReactNode }) {
  const { user, token } = useAuth();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [voterStatus, setVoterStatus] = useState<VoterStatus | null>(null);
  const [electionActive, setElectionActive] = useState<boolean | null>(null);
  const [resultsPublished, setResultsPublished] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isVoting, setIsVoting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [isMockMode, setIsMockMode] = useState(false);
  const refreshInFlight = useRef<Promise<void> | null>(null);
  const hasHydratedCache = useRef(false);
  const lastWalletRef = useRef<string | null>(null);

  const voterCacheKey = (wallet: string) =>
    `votehybrid:election:voter:${wallet.toLowerCase()}:v1`;

  const isContractDeployed = useCallback(async (
    provider: RpcProviderLike,
    address: string
  ) => {
    const { ethers } = await loadBlockchainModules();
    if (!ethers.isAddress(address) || address === ZERO_ADDRESS) {
      return false;
    }
    try {
      const code = await provider.getCode(address);
      return code !== "0x";
    } catch {
      return false;
    }
  }, []);

  const resolveService = useCallback(async () => {
    const { chainConfig, ContractService, createRpcProvider } =
      await loadBlockchainModules();
    const provider = createRpcProvider();
    let forceMock = chainConfig.useMock;
    if (!forceMock) {
      const hasContract = await isContractDeployed(
        provider,
        chainConfig.contractAddress
      );
      forceMock = !hasContract;
    }
    return {
      provider,
      service: new ContractService(provider, { forceMock }),
      ContractService,
    };
  }, [isContractDeployed]);

  const loadFromService = useCallback(async (service: ContractServiceInstance) => {
    const [nextCandidates, nextActive, nextPublished] = await Promise.all([
      service.getCandidates(),
      service.getElectionStatus(),
      service.getResultsPublished(),
    ]);
    const nextResults = nextPublished ? await service.getResults() : [];
    const nextVoterStatus = user?.walletAddress
      ? await service.getVoterStatus(user.walletAddress)
      : null;

    setCandidates(nextCandidates);
    setResults(nextResults);
    setElectionActive(nextActive);
    setResultsPublished(nextPublished);
    setVoterStatus(nextVoterStatus);

    writeCache(SUMMARY_CACHE_KEY, {
      candidates: nextCandidates,
      results: nextResults,
      electionActive: nextActive,
      resultsPublished: nextPublished,
      isMockMode: service.isMockMode(),
    });
    if (user?.walletAddress && nextVoterStatus) {
      writeCache(voterCacheKey(user.walletAddress), nextVoterStatus);
    }
  }, [user?.walletAddress]);

  const hydrateFromCache = useCallback(() => {
    const wallet = user?.walletAddress?.toLowerCase() ?? null;
    const walletChanged = lastWalletRef.current !== wallet;
    if (hasHydratedCache.current && !walletChanged) {
      return false;
    }
    hasHydratedCache.current = true;
    lastWalletRef.current = wallet;
    let hydrated = false;
    const summary = readCache<{
      candidates: Candidate[];
      results: Result[];
      electionActive: boolean | null;
      resultsPublished: boolean | null;
      isMockMode: boolean;
    }>(SUMMARY_CACHE_KEY, CACHE_TTL_MS);
    if (summary) {
      setCandidates(summary.candidates);
      setResults(summary.results);
      setElectionActive(summary.electionActive);
      setResultsPublished(summary.resultsPublished);
      setIsMockMode(summary.isMockMode);
      hydrated = true;
    }

    if (user?.walletAddress) {
      const voter = readCache<VoterStatus>(
        voterCacheKey(user.walletAddress),
        CACHE_TTL_MS
      );
      if (voter) {
        setVoterStatus(voter);
        hydrated = true;
      }
    } else {
      setVoterStatus(null);
    }
    return hydrated;
  }, [user?.walletAddress]);

  const refresh = useCallback(
    async (options?: { silent?: boolean }) => {
      const silent = options?.silent ?? false;
      if (refreshInFlight.current) {
        await refreshInFlight.current;
        if (silent) {
          return;
        }
      }
      if (!silent) {
        setIsLoading(true);
      }
      setError(null);
      const pending = (async () => {
        const { provider, service, ContractService } = await resolveService();
        setIsMockMode(service.isMockMode());
        try {
          await loadFromService(service);
        } catch (err) {
          if (!service.isMockMode()) {
            const fallback = new ContractService(provider, { forceMock: true });
            setIsMockMode(true);
            try {
              await loadFromService(fallback);
            } catch (fallbackErr) {
              setError(
                getUserFacingErrorMessage(
                  fallbackErr,
                  "generic",
                  "Failed to load election."
                )
              );
            }
          } else {
            setError(
              getUserFacingErrorMessage(
                err,
                "generic",
                "Failed to load election."
              )
            );
          }
        } finally {
          if (!silent) {
            setIsLoading(false);
          }
        }
      })();
      refreshInFlight.current = pending;
      try {
        await pending;
      } finally {
        refreshInFlight.current = null;
      }
    },
    [loadFromService, resolveService]
  );

  const vote = useCallback(async (candidateId: number) => {
    setIsVoting(true);
    setError(null);
    try {
      const { service } = await resolveService();
      setIsMockMode(service.isMockMode());
      if (service.isMockMode()) {
        const tx = await service.vote(candidateId);
        setTxHash(tx.hash);
        await tx.wait();
        setVoterStatus((prev) =>
          prev ? { ...prev, hasVoted: true } : { eligible: true, hasVoted: true }
        );
        setResults((prev) =>
          prev.map((result) =>
            result.candidateId === candidateId
              ? { ...result, votes: result.votes + 1 }
              : result
          )
        );
        return tx.hash;
      }
      if (!token) {
        throw new Error("Login required.");
      }
      const response = await apiClient.vote(token, candidateId);
      setTxHash(response.txHash);
      await refresh();
      return response.txHash;
    } catch (err) {
      setError(getUserFacingErrorMessage(err, "vote", "Vote failed."));
      return null;
    } finally {
      setIsVoting(false);
    }
  }, [token, resolveService, refresh]);

  useEffect(() => {
    const hydrated = hydrateFromCache();
    void refresh({ silent: hydrated });
  }, [hydrateFromCache, refresh]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void refresh({ silent: true });
    }, 15000);
    return () => window.clearInterval(intervalId);
  }, [refresh]);

  const value = useMemo(
    () => ({
      candidates,
      results,
      voterStatus,
      electionActive,
      resultsPublished,
      isLoading,
      isVoting,
      error,
      txHash,
      isMockMode,
      refresh,
      vote,
    }),
    [
      candidates,
      results,
      voterStatus,
      electionActive,
      resultsPublished,
      isLoading,
      isVoting,
      error,
      txHash,
      isMockMode,
      refresh,
      vote,
    ]
  );

  return (
    <ElectionContext.Provider value={value}>
      {children}
    </ElectionContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useElection() {
  const context = useContext(ElectionContext);
  if (!context) {
    throw new Error("useElection must be used within ElectionProvider");
  }
  return context;
}
