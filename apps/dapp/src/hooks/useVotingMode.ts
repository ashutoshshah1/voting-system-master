import { useCallback, useEffect, useState } from "react";

export type VotingMode = "online" | "offline";

export const VOTING_MODE_STORAGE_KEY = "votehybrid_voting_mode";
export const VOTING_MODE_CHANGE_EVENT = "votehybrid:voting-mode";

const readVotingMode = (): VotingMode => {
  if (typeof window === "undefined") {
    return "online";
  }
  return window.localStorage.getItem(VOTING_MODE_STORAGE_KEY) === "offline"
    ? "offline"
    : "online";
};

export const useVotingMode = () => {
  const [votingMode, setVotingModeState] = useState<VotingMode>(() => readVotingMode());

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const sync = () => {
      setVotingModeState(readVotingMode());
    };

    const onStorage = (event: StorageEvent) => {
      if (event.key === VOTING_MODE_STORAGE_KEY) {
        sync();
      }
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener(VOTING_MODE_CHANGE_EVENT, sync);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(VOTING_MODE_CHANGE_EVENT, sync);
    };
  }, []);

  const setVotingMode = useCallback((nextMode: VotingMode) => {
    setVotingModeState(nextMode);
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(VOTING_MODE_STORAGE_KEY, nextMode);
    window.dispatchEvent(new Event(VOTING_MODE_CHANGE_EVENT));
  }, []);

  return { votingMode, setVotingMode };
};
