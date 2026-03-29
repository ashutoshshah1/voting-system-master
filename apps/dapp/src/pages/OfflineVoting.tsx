import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "../components/Button";
import { CandidateCard } from "../components/CandidateCard";
import { PageHeader } from "../components/PageHeader";
import { Panel } from "../components/Panel";
import { StatusBanner } from "../components/StatusBanner";
import { useAuth } from "../context/AuthContext";
import { useElection } from "../context/ElectionContext";
import {
  apiClient,
  type OfflineLinkOnlineResponse,
  type OfflineSessionStartResponse,
} from "../services/apiClient";
import {
  getOfflineGateMessage,
  getOfflineGateTitle,
  getUserFacingErrorMessage,
} from "../utils/errorMessages";
import {
  MAX_DOB,
  MIN_DOB,
  normalizeNidInput,
  validateDob,
  validateNid,
} from "../utils/validation";

type NoticeTone = "info" | "success" | "warning" | "error";

type Notice = {
  tone: NoticeTone;
  title: string;
  message: string;
};

const inputClassName =
  "w-full rounded-2xl border border-slate-200/80 bg-white/90 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-500 focus:border-neon-blue/60 focus:outline-none focus:ring-2 focus:ring-neon-blue/30";

const toRawErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Request failed";

type SerialPortLike = {
  open: (options: {
    baudRate: number;
    dataBits?: number;
    stopBits?: number;
    parity?: "none" | "even" | "odd";
    flowControl?: "none" | "hardware";
  }) => Promise<void>;
  close: () => Promise<void>;
  readable: ReadableStream<Uint8Array> | null;
  setSignals?: (signals: {
    dataTerminalReady?: boolean;
    requestToSend?: boolean;
    break?: boolean;
  }) => Promise<void>;
  getInfo?: () => {
    usbVendorId?: number;
    usbProductId?: number;
  };
};

type NavigatorWithSerial = Navigator & {
  serial?: {
    requestPort: () => Promise<SerialPortLike>;
    getPorts?: () => Promise<SerialPortLike[]>;
  };
};

const normalizeRfidUid = (value: string) =>
  value
    .trim()
    .toUpperCase()
    .replace(/[^0-9A-F]/g, "");

const SCANNER_BAUD_RATE = 115200;
const SCAN_IDLE_HINT_DELAY_MS = 20000;
const SCAN_RELAY_FILE_URL = "/rfid-scan.json";
const RELAY_HEARTBEAT_TTL_MS = 6000;
const RELAY_SCAN_TTL_MS = 15000;

const normalizeDecimalUidGroup = (value: string) => {
  const parts = value.match(/\d{1,3}/g);
  if (!parts || parts.length < 4) {
    return null;
  }
  const asHex = parts
    .map((part) => Number(part))
    .filter((part) => Number.isInteger(part) && part >= 0 && part <= 255)
    .map((part) => part.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
  return asHex.length >= 8 ? asHex : null;
};

const extractRfidUidFromLine = (rawLine: string) => {
  const line = rawLine.trim();
  if (!line) {
    return null;
  }

  const labeledMatch = line.match(
    /(?:rfid(?:\s*read)?|uid(?:\s*tag)?)\s*[:=]\s*([0-9a-fA-F:\-\s]+)/i
  );
  if (labeledMatch?.[1]) {
    const normalized = normalizeRfidUid(labeledMatch[1]);
    return normalized.length >= 4 ? normalized : null;
  }

  const bytePairs = line.match(/\b[0-9a-fA-F]{2}\b/g);
  if (bytePairs && bytePairs.length >= 4) {
    const normalized = normalizeRfidUid(bytePairs.join(""));
    return normalized.length >= 4 ? normalized : null;
  }

  const compactHex = line.match(/\b(?:0x)?[0-9a-fA-F]{8,}\b/);
  if (compactHex?.[0]) {
    const normalized = normalizeRfidUid(compactHex[0]);
    return normalized.length >= 4 ? normalized : null;
  }

  const decimalGroup = line.match(/\b\d{1,3}\b(?:[\s,:-]+\b\d{1,3}\b){3,}/);
  if (decimalGroup?.[0]) {
    return normalizeDecimalUidGroup(decimalGroup[0]);
  }

  return null;
};

const extractRfidUidFromText = (text: string) => {
  const normalizedText = text.trim();
  if (!normalizedText) {
    return null;
  }

  const labeledMatch = normalizedText.match(
    /(?:rfid(?:\s*read)?|uid(?:\s*tag)?)\s*[:=]\s*([0-9a-fA-F:\-\s]{4,})/i
  );
  if (labeledMatch?.[1]) {
    const normalized = normalizeRfidUid(labeledMatch[1]);
    return normalized.length >= 4 ? normalized : null;
  }

  const bytePairsGroup = normalizedText.match(
    /\b[0-9a-fA-F]{2}\b(?:[\s:-]+\b[0-9a-fA-F]{2}\b){3,}/
  );
  if (bytePairsGroup?.[0]) {
    const normalized = normalizeRfidUid(bytePairsGroup[0]);
    return normalized.length >= 4 ? normalized : null;
  }

  const compactHex = normalizedText.match(/\b(?:0x)?[0-9a-fA-F]{8,}\b/);
  if (compactHex?.[0]) {
    const normalized = normalizeRfidUid(compactHex[0]);
    return normalized.length >= 4 ? normalized : null;
  }

  const decimalGroup = normalizedText.match(/\b\d{1,3}\b(?:[\s,:-]+\b\d{1,3}\b){3,}/);
  if (decimalGroup?.[0]) {
    return normalizeDecimalUidGroup(decimalGroup[0]);
  }

  return null;
};

const toScannerErrorMessage = (error: unknown) => {
  const message = toRawErrorMessage(error);
  const normalized = message.toLowerCase();
  if (
    normalized.includes("access denied") ||
    normalized.includes("permission denied") ||
    normalized.includes("resource busy")
  ) {
    return "Serial port is busy. Close Arduino Serial Monitor/IDE and any serial bridge using the same COM port.";
  }
  if (normalized.includes("networkerror") || normalized.includes("failed to open")) {
    return "Failed to open serial port. Reconnect Arduino, select the correct COM port, then try again.";
  }
  return message;
};

const normalizePinInput = (value: string) => value.replace(/\D/g, "").slice(0, 6);

const joinNaturalList = (items: string[]) => {
  if (items.length === 0) {
    return "";
  }
  if (items.length === 1) {
    return items[0];
  }
  if (items.length === 2) {
    return `${items[0]} and ${items[1]}`;
  }
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
};

const buildProfileSetupMessage = (response: OfflineLinkOnlineResponse) => {
  const nextSteps: string[] = [];
  if (response.offlineProfile.pinSetupRequired) {
    nextSteps.push("set a 6-digit PIN");
  }
  if (response.requiresAdminApproval) {
    nextSteps.push("wait for admin KYC approval and wallet setup");
  }
  if (!nextSteps.length) {
    return `${response.user.fullName} is ready for RFID session and PIN confirmation.`;
  }
  return `${response.user.fullName} was linked successfully, but cannot vote yet. Please ${joinNaturalList(
    nextSteps
  )} before voting.`;
};

export function OfflineVoting() {
  const { user } = useAuth();
  const { candidates, isLoading: candidatesLoading, error: candidatesError } =
    useElection();

  const [userPath, setUserPath] = useState<"new" | "existing">("existing");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [activeAction, setActiveAction] = useState<
    "register" | "link" | "start" | "vote" | null
  >(null);
  const [scanMode, setScanMode] = useState<"idle" | "connecting" | "ready" | "error">(
    "idle"
  );
  const [scanError, setScanError] = useState<string | null>(null);
  const [lastScannedUid, setLastScannedUid] = useState<string | null>(null);
  const [scannerPortLabel, setScannerPortLabel] = useState<string | null>(null);
  const [lastScannerRawLine, setLastScannerRawLine] = useState<string | null>(null);
  const [scannerByteCount, setScannerByteCount] = useState(0);
  const [lastSessionLatencyMs, setLastSessionLatencyMs] = useState<number | null>(null);
  const [lastRelayScanAt, setLastRelayScanAt] = useState<string | null>(null);
  const [lastRelayHeartbeatAt, setLastRelayHeartbeatAt] = useState<string | null>(null);
  const [lastRelaySerialAt, setLastRelaySerialAt] = useState<string | null>(null);
  const [relayAvailable, setRelayAvailable] = useState(false);

  const [registerFullName, setRegisterFullName] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerNid, setRegisterNid] = useState("");
  const [registerDob, setRegisterDob] = useState("");
  const [registerRfidUid, setRegisterRfidUid] = useState("");
  const [registerPin, setRegisterPin] = useState("");

  const [existingNid, setExistingNid] = useState("");
  const [existingDob, setExistingDob] = useState("");
  const [rfidUid, setRfidUid] = useState("");
  const [profilePin, setProfilePin] = useState("");

  const [voterPin, setVoterPin] = useState("");
  const [selectedCandidateId, setSelectedCandidateId] = useState<number | null>(
    null
  );
  const [isVoteIntentConfirmed, setIsVoteIntentConfirmed] = useState(false);
  const [profileResult, setProfileResult] = useState<OfflineLinkOnlineResponse | null>(
    null
  );
  const [startResult, setStartResult] = useState<OfflineSessionStartResponse | null>(
    null
  );
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [voteTxHash, setVoteTxHash] = useState<string | null>(null);
  const serialPortRef = useRef<SerialPortLike | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const readBufferRef = useRef("");
  const destroyedRef = useRef(false);
  const scanHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastScanAtRef = useRef<number | null>(null);
  const lastAppliedUidRef = useRef<{ uid: string; at: number } | null>(null);
  const serialDataSeenRef = useRef(false);
  const autoReconnectAttemptedRef = useRef(false);
  const lastRelayEventKeyRef = useRef<string | null>(null);

  const selectedCandidate = useMemo(
    () => candidates.find((candidate) => candidate.id === selectedCandidateId) ?? null,
    [candidates, selectedCandidateId]
  );
  const hasSession = Boolean(sessionToken);
  const relayActive = relayAvailable;
  const scannerSourceLabel = relayActive
    ? "Local bridge"
    : scanMode === "ready"
      ? "Browser serial"
      : "Waiting";

  const clearScanHintTimer = useCallback(() => {
    if (scanHintTimerRef.current) {
      clearTimeout(scanHintTimerRef.current);
      scanHintTimerRef.current = null;
    }
  }, []);

  const handleStartSessionByUid = useCallback(async (uid: string, silent = false) => {
    const normalizedUid = normalizeRfidUid(uid);
    if (normalizedUid.length < 4) {
      setNotice({
        tone: "warning",
        title: "Card scan required",
        message: "Tap RFID card once so UID can be captured before starting session.",
      });
      return;
    }

    setRfidUid(normalizedUid);
    setRegisterRfidUid(normalizedUid);
    setActiveAction("start");
    setVoteTxHash(null);
    setSelectedCandidateId(null);
    setIsVoteIntentConfirmed(false);
    setSessionToken(null);
    setStartResult(null);
    const startedAt = Date.now();

    try {
      const response = await apiClient.offlineStartSession({
        rfidUid: normalizedUid,
      });
      setLastSessionLatencyMs(Date.now() - startedAt);
      setStartResult(response);

      const token = response.sessionToken ?? response.preSessionToken;
      setSessionToken(token);
      const isLoggedInDifferentUser = user && response.user.id !== user.id;

      if (!token) {
        setNotice({
          tone: "warning",
          title: getOfflineGateTitle(response.gate),
          message: response.message || getOfflineGateMessage(response.gate),
        });
      } else if (isLoggedInDifferentUser) {
        setNotice({
          tone: user.role === "ADMIN" ? "info" : "warning",
          title: "Booth session ready",
          message:
            user.role === "ADMIN"
              ? `${response.user.fullName} is ready to vote. Admin login stays active, but the booth session now follows the scanned RFID card.`
              : `${response.user.fullName} is ready to vote. The booth is signed in as ${user.fullName}, so the scanned RFID session will be used for this vote.`,
        });
      } else if (!silent) {
        setNotice({
          tone: "success",
          title: "Session ready",
          message: response.message,
        });
      } else {
        setNotice({
          tone: "success",
          title: "Profile loaded",
          message: `${response.user.fullName} profile loaded from RFID scan. Choose candidate and confirm PIN.`,
        });
      }
    } catch (error) {
      const message = getUserFacingErrorMessage(
        error,
        "offlineSession",
        "Could not start the RFID session."
      );
      setLastSessionLatencyMs(Date.now() - startedAt);
      if (/unrecognized rfid|not registered|not linked/i.test(message)) {
        setUserPath("new");
        setNotice({
          tone: "info",
          title: "Card not registered",
          message:
            "This card is not linked yet. Fill new voter details below to register this RFID card.",
        });
        return;
      }
      setNotice({
        tone: "error",
        title: "Session start failed",
        message,
      });
    } finally {
      setActiveAction(null);
    }
  }, [user]);

  const applyScannedUid = useCallback(
    (uid: string) => {
      const normalized = normalizeRfidUid(uid);
      if (!normalized) {
        return;
      }
      const now = Date.now();
      const lastApplied = lastAppliedUidRef.current;
      if (lastApplied && lastApplied.uid === normalized && now - lastApplied.at < 2500) {
        return;
      }
      lastAppliedUidRef.current = { uid: normalized, at: now };
      lastScanAtRef.current = Date.now();
      clearScanHintTimer();
      setScanError(null);
      setLastScannedUid(normalized);
      setRfidUid(normalized);
      setRegisterRfidUid(normalized);
      setNotice({
        tone: "info",
        title: "Card scanned",
        message: `RFID ${normalized} captured. Starting session automatically...`,
      });
      void handleStartSessionByUid(normalized, true);
    },
    [clearScanHintTimer, handleStartSessionByUid]
  );

  const closeScanner = useCallback(async () => {
    clearScanHintTimer();
    const reader = readerRef.current;
    if (reader) {
      try {
        await reader.cancel();
      } catch {
        // ignore
      }
      reader.releaseLock();
      readerRef.current = null;
    }

    const port = serialPortRef.current;
    if (port) {
      try {
        await port.close();
      } catch {
        // ignore
      }
      serialPortRef.current = null;
    }
  }, [clearScanHintTimer]);

  const handleDisconnectScanner = async () => {
    await closeScanner();
    serialDataSeenRef.current = false;
    setScanMode("idle");
    setScanError(null);
    setScannerPortLabel(null);
    setLastScannerRawLine(null);
    setScannerByteCount(0);
    setNotice({
      tone: "info",
      title: "Scanner disconnected",
      message: "Scanner port released. Reconnect when ready.",
    });
  };

  const handleConnectScanner = async (
    baudRate = SCANNER_BAUD_RATE,
    internalRetry = false
  ) => {
    const nav = navigator as NavigatorWithSerial;
    if (!nav.serial) {
      setScanMode("error");
      setScanError("Web Serial is not supported in this browser. Use Chrome/Edge.");
      return;
    }

    setScanMode("connecting");
    setScanError(null);
    setLastScannerRawLine(null);
    setScannerByteCount(0);
    serialDataSeenRef.current = false;
    if (!internalRetry) {
      autoReconnectAttemptedRef.current = false;
    }
    readBufferRef.current = "";

    try {
      await closeScanner();
      const grantedPorts =
        typeof nav.serial.getPorts === "function" ? await nav.serial.getPorts() : [];
      const port = grantedPorts[0] ?? (await nav.serial.requestPort());
      await port.open({
        baudRate,
        dataBits: 8,
        stopBits: 1,
        parity: "none",
        flowControl: "none",
      });
      serialPortRef.current = port;
      const portInfo = typeof port.getInfo === "function" ? port.getInfo() : null;
      const vid = portInfo?.usbVendorId?.toString(16).toUpperCase();
      const pid = portInfo?.usbProductId?.toString(16).toUpperCase();
      setScannerPortLabel(
        vid || pid
          ? `VID:${vid ?? "?"} PID:${pid ?? "?"} @ ${baudRate} baud`
          : `Connected @ ${baudRate} baud`
      );

      if (!port.readable) {
        throw new Error("Scanner readable stream is unavailable.");
      }

      const reader = port.readable.getReader();
      readerRef.current = reader;
      setScanMode("ready");
      setNotice({
        tone: "info",
        title: "Scanner connected",
        message: "Tap RFID card once. Profile will load automatically.",
      });
      const connectedAt = Date.now();
      clearScanHintTimer();
      scanHintTimerRef.current = setTimeout(() => {
        const hasScanAfterConnect =
          lastScanAtRef.current !== null && lastScanAtRef.current >= connectedAt;
        if (readerRef.current && !hasScanAfterConnect) {
          if (serialDataSeenRef.current) {
            setScanError(
              "Serial data is arriving, but no RFID UID was detected. Use RC522-compatible 13.56MHz card/tag, then verify RC522 wiring (SDA 10, RST 9, MOSI 11, MISO 12, SCK 13, 3.3V, GND)."
            );
            return;
          }
          if (baudRate === SCANNER_BAUD_RATE && !autoReconnectAttemptedRef.current) {
            autoReconnectAttemptedRef.current = true;
            setScanError("No serial bytes yet. Reconnecting scanner at 115200...");
            void handleConnectScanner(SCANNER_BAUD_RATE, true);
            return;
          }
          setScanError(
            `No RFID data detected after ${Math.floor(
              SCAN_IDLE_HINT_DELAY_MS / 1000
            )}s at ${baudRate} baud. Keep card on reader for 1s and close other serial apps.`
          );
        }
      }, SCAN_IDLE_HINT_DELAY_MS);

      const decoder = new TextDecoder();
      while (!destroyedRef.current) {
        const result = await reader.read();
        if (result.done) {
          if (!destroyedRef.current) {
            setScanMode("error");
            setScanError(
              "Scanner stream closed unexpectedly. Click Reconnect 115200 and tap card again."
            );
          }
          break;
        }
        const bytes = result.value?.length ?? 0;
        if (bytes > 0) {
          serialDataSeenRef.current = true;
        }
        setScannerByteCount((value) => value + bytes);
        const chunk = decoder.decode(result.value, { stream: true });
        const chunkTrimmed = chunk.trim();
        if (chunkTrimmed) {
          setLastScannerRawLine(chunkTrimmed.slice(0, 120));
          if (scanError?.includes("No RFID data detected") || scanError?.includes("No serial data detected")) {
            setScanError(null);
          }
          const uidFromChunk = extractRfidUidFromText(chunkTrimmed);
          if (uidFromChunk) {
            applyScannedUid(uidFromChunk);
          }
        }
        readBufferRef.current += chunk;

        const lines = readBufferRef.current.split(/\r?\n/);
        readBufferRef.current = lines.pop() ?? "";
        if (readBufferRef.current.length > 512) {
          readBufferRef.current = readBufferRef.current.slice(-256);
        }
        for (const rawLine of lines) {
          const trimmed = rawLine.trim();
          if (!trimmed) {
            continue;
          }
          setLastScannerRawLine(trimmed.slice(0, 120));
          const uid = extractRfidUidFromLine(trimmed);
          if (!uid) {
            continue;
          }
          applyScannedUid(uid);
        }
      }
      if (readerRef.current === reader) {
        try {
          reader.releaseLock();
        } catch {
          // ignore
        }
        readerRef.current = null;
      }
    } catch (error) {
      setScanMode("error");
      setScanError(toScannerErrorMessage(error));
    }
  };

  useEffect(() => {
    return () => {
      destroyedRef.current = true;
      void closeScanner();
    };
  }, [closeScanner]);

  useEffect(() => {
    let active = true;
    const tick = async () => {
      try {
        const response = await fetch(`${SCAN_RELAY_FILE_URL}?t=${Date.now()}`, {
          cache: "no-store",
        });
        if (!response.ok) {
          return;
        }
        const payload = (await response.json()) as {
          rfidUid?: string;
          scannedAt?: string;
          relayAliveAt?: string;
          lastSerialAt?: string;
          lastSerialLine?: string;
        };
        if (!active) {
          return;
        }
        const relayAliveAt = payload.relayAliveAt?.trim() ?? "";
        const relayAliveMs = Date.parse(relayAliveAt);
        const relayIsFresh =
          Number.isFinite(relayAliveMs) && Date.now() - relayAliveMs <= RELAY_HEARTBEAT_TTL_MS;
        setRelayAvailable(relayIsFresh);
        setLastRelayHeartbeatAt(relayAliveAt || null);

        if (!relayIsFresh) {
          setLastRelayScanAt(null);
          setLastRelaySerialAt(null);
          lastRelayEventKeyRef.current = null;
          return;
        }
        const relaySerialAt = payload.lastSerialAt?.trim() ?? "";
        setLastRelaySerialAt(relaySerialAt || null);
        const relaySerialLine = payload.lastSerialLine?.trim() ?? "";
        if (relaySerialLine) {
          setLastScannerRawLine(`relay:${relaySerialLine.slice(0, 120)}`);
        }

        const normalizedUid = normalizeRfidUid(payload.rfidUid ?? "");
        const scannedAt = payload.scannedAt?.trim() ?? "";
        if (!normalizedUid || normalizedUid.length < 4) {
          return;
        }

        setLastScannedUid(normalizedUid);
        setRfidUid((current) => (normalizeRfidUid(current).length >= 4 ? current : normalizedUid));
        setRegisterRfidUid((current) =>
          normalizeRfidUid(current).length >= 4 ? current : normalizedUid
        );
        if (scannedAt) {
          setLastRelayScanAt(scannedAt);
        }

        if (!scannedAt) {
          return;
        }
        const scannedAtMs = Date.parse(scannedAt);
        if (!Number.isFinite(scannedAtMs) || Date.now() - scannedAtMs > RELAY_SCAN_TTL_MS) {
          return;
        }
        const eventKey = `${normalizedUid}:${scannedAt}`;
        if (eventKey === lastRelayEventKeyRef.current) {
          return;
        }
        lastRelayEventKeyRef.current = eventKey;
        setLastRelayScanAt(scannedAt);
        setLastScannerRawLine(`relay:${normalizedUid}`);
        applyScannedUid(normalizedUid);
      } catch {
        if (!active) {
          return;
        }
        setRelayAvailable(false);
        setLastRelayHeartbeatAt(null);
        setLastRelayScanAt(null);
        setLastRelaySerialAt(null);
        lastRelayEventKeyRef.current = null;
      }
    };
    const intervalId = setInterval(() => {
      void tick();
    }, 800);
    void tick();
    return () => {
      active = false;
      clearInterval(intervalId);
    };
  }, [applyScannedUid]);

  const handleRegisterProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    const normalizedUid = normalizeRfidUid(registerRfidUid);
    const normalizedNid = normalizeNidInput(registerNid);
    const validationError = validateNid(normalizedNid) ?? validateDob(registerDob);
    if (normalizedUid.length < 4) {
      setNotice({
        tone: "warning",
        title: "Card scan required",
        message: "Tap RFID card once so UID is auto-filled before registration.",
      });
      return;
    }
    setRegisterNid(normalizedNid);
    if (validationError) {
      setNotice({
        tone: "warning",
        title: "Invalid voter details",
        message: validationError,
      });
      return;
    }

    setActiveAction("register");
    setVoteTxHash(null);
    setStartResult(null);
    setSessionToken(null);
    setSelectedCandidateId(null);
    setIsVoteIntentConfirmed(false);

    try {
      const response = await apiClient.offlineRegisterProfile({
        fullName: registerFullName.trim(),
        email: registerEmail.trim(),
        nid: normalizedNid,
        dob: registerDob,
        rfidUid: normalizedUid,
        pin: registerPin.trim() || undefined,
      });
      setProfileResult(response);
      setExistingNid(normalizedNid);
      setExistingDob(registerDob);
      setRfidUid(normalizedUid);
      setRegisterRfidUid(normalizedUid);
      setProfilePin(registerPin.trim());
      setNotice({
        tone: response.requiresAdminApproval ? "warning" : "success",
        title: response.requiresAdminApproval
          ? "Registered, waiting for approval"
          : "Registered and linked",
        message: buildProfileSetupMessage(response),
      });
    } catch (error) {
      setNotice({
        tone: "error",
        title: "Registration failed",
        message: getUserFacingErrorMessage(
          error,
          "offlineRegister",
          "Could not register this voter."
        ),
      });
    } finally {
      setActiveAction(null);
    }
  };

  const handleLinkProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    const normalizedUid = normalizeRfidUid(rfidUid);
    const normalizedNid = normalizeNidInput(existingNid);
    const validationError = validateNid(normalizedNid) ?? validateDob(existingDob);
    if (normalizedUid.length < 4) {
      setNotice({
        tone: "warning",
        title: "Card scan required",
        message: "Tap RFID card once so UID is auto-filled before linking profile.",
      });
      return;
    }
    setExistingNid(normalizedNid);
    if (validationError) {
      setNotice({
        tone: "warning",
        title: "Invalid voter details",
        message: validationError,
      });
      return;
    }

    setActiveAction("link");
    setVoteTxHash(null);
    setStartResult(null);
    setSessionToken(null);
    setSelectedCandidateId(null);
    setIsVoteIntentConfirmed(false);

    try {
      const response = await apiClient.offlineLinkOnline({
        nid: normalizedNid,
        dob: existingDob,
        rfidUid: normalizedUid,
        pin: profilePin.trim() || undefined,
      });
      setRfidUid(normalizedUid);
      setRegisterRfidUid(normalizedUid);
      setProfileResult(response);
      setNotice({
        tone: response.requiresAdminApproval ? "warning" : "success",
        title: response.requiresAdminApproval ? "RFID linked, setup pending" : "RFID linked",
        message: buildProfileSetupMessage(response),
      });
    } catch (error) {
      setNotice({
        tone: "error",
        title: "Link failed",
        message: getUserFacingErrorMessage(
          error,
          "offlineLink",
          "Could not link this card to an online voter."
        ),
      });
    } finally {
      setActiveAction(null);
    }
  };

  const handleStartSession = async (event: React.FormEvent) => {
    event.preventDefault();
    await handleStartSessionByUid(rfidUid);
  };

  const handleVote = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!sessionToken) {
      setNotice({
        tone: "warning",
        title: "Session missing",
        message: "Scan RFID card and start session first.",
      });
      return;
    }
    if (!selectedCandidateId) {
      setNotice({
        tone: "warning",
        title: "Candidate not selected",
        message: "Select a candidate before confirming vote.",
      });
      return;
    }
    if (!isVoteIntentConfirmed) {
      setNotice({
        tone: "warning",
        title: "Confirmation required",
        message: "Confirm your selected candidate before entering PIN.",
      });
      return;
    }
    if (!/^\d{6}$/.test(voterPin.trim())) {
      setNotice({
        tone: "warning",
        title: "Invalid PIN",
        message: "Enter your 6-digit voter PIN.",
      });
      return;
    }

    setActiveAction("vote");

    try {
      const response = await apiClient.offlineVote({
        sessionToken,
        pin: voterPin.trim(),
        candidateId: selectedCandidateId,
      });
      setVoteTxHash(response.txHash);
      setNotice({
        tone: "success",
        title: "Vote submitted",
        message: "Offline vote transaction has been confirmed.",
      });
    } catch (error) {
      setNotice({
        tone: "error",
        title: "Vote failed",
        message: getUserFacingErrorMessage(
          error,
          "offlineVote",
          "Could not submit the offline vote."
        ),
      });
    } finally {
      setActiveAction(null);
    }
  };

  return (
    <div className="space-y-8 animate-fadeUp">
      <PageHeader
        kicker="Offline Booth"
        title="Offline Voting Console"
        subtitle="Scan RFID, load profile, choose candidate, enter 6-digit PIN, and confirm transaction."
      />

      <Panel className="space-y-3">
        <div className="text-xs font-semibold uppercase tracking-[0.25em] text-text-muted">
          Workflow
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <div
            className={`rounded-2xl border px-4 py-3 text-sm ${
              lastScannedUid
                ? "border-neon-blue/40 bg-neon-blue/10 text-neon-blue"
                : "border-white/10 bg-black/20 text-text-muted"
            }`}
          >
            <div className="text-xs uppercase tracking-[0.2em]">Step 1</div>
            <div className="mt-1 font-semibold">Scan and verify</div>
          </div>
          <div
            className={`rounded-2xl border px-4 py-3 text-sm ${
              hasSession
                ? "border-neon-blue/40 bg-neon-blue/10 text-neon-blue"
                : "border-white/10 bg-black/20 text-text-muted"
            }`}
          >
            <div className="text-xs uppercase tracking-[0.2em]">Step 2</div>
            <div className="mt-1 font-semibold">Choose candidate</div>
          </div>
          <div
            className={`rounded-2xl border px-4 py-3 text-sm ${
              voteTxHash
                ? "border-neon-green/40 bg-neon-green/10 text-neon-green"
                : "border-white/10 bg-black/20 text-text-muted"
            }`}
          >
            <div className="text-xs uppercase tracking-[0.2em]">Step 3</div>
            <div className="mt-1 font-semibold">Confirm with PIN</div>
          </div>
        </div>
      </Panel>

      {notice ? (
        <StatusBanner tone={notice.tone} title={notice.title} message={notice.message} />
      ) : null}

      <section className="space-y-4">
        <div className="text-xs font-semibold uppercase tracking-[0.25em] text-text-muted">
          Step 1 · Identity & Session
        </div>
        <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          <Panel className="space-y-4">
            <div className="text-xs font-semibold uppercase tracking-[0.25em] text-text-muted">
              RFID scanner
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => void handleConnectScanner()}
                disabled={scanMode === "connecting" || relayActive}
              >
                {scanMode === "ready"
                  ? "Scanner connected"
                  : scanMode === "connecting"
                    ? "Connecting scanner..."
                    : "Connect scanner"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => void handleConnectScanner(SCANNER_BAUD_RATE)}
                disabled={scanMode === "connecting" || relayActive}
              >
                Reconnect 115200
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => void handleDisconnectScanner()}
                disabled={scanMode === "connecting"}
              >
                Disconnect
              </Button>
            </div>

            {relayActive ? (
              <div className="text-xs text-neon-green">
                Local relay scanner is active. Browser serial controls are disabled to avoid COM conflicts.
              </div>
            ) : null}

            <div className="grid gap-2 rounded-2xl border border-white/10 bg-black/20 p-3 text-xs text-text-muted">
              <div>
                Scanner source:{" "}
                <span className="font-semibold text-white">{scannerSourceLabel}</span>
              </div>
              <div>Port: {scannerPortLabel ?? "Not connected"}</div>
              <div>Serial bytes received: {scannerByteCount}</div>
              <div>Relay heartbeat: {lastRelayHeartbeatAt ?? "Waiting"}</div>
              <div>Relay serial at: {lastRelaySerialAt ?? "Waiting"}</div>
              <div>Relay scan at: {lastRelayScanAt ?? "Waiting"}</div>
              <div>Last scanner line: {lastScannerRawLine ?? "Waiting"}</div>
              <div>
                Last scanned UID:{" "}
                <span className="font-semibold text-white">{lastScannedUid ?? "Waiting"}</span>
              </div>
              {lastSessionLatencyMs !== null ? (
                <div>Last session-start check: {lastSessionLatencyMs} ms</div>
              ) : null}
            </div>

            {scanError ? (
              <StatusBanner tone="warning" title="Scanner issue" message={scanError} />
            ) : null}
          </Panel>

          <div className="space-y-6">
            <Panel className="space-y-4">
              <div className="text-xs font-semibold uppercase tracking-[0.25em] text-text-muted">
                Voter profile action
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 p-1">
                <button
                  className={`rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] transition ${
                    userPath === "new"
                      ? "bg-neon-purple/20 text-neon-purple"
                      : "text-text-muted hover:text-white"
                  }`}
                  onClick={() => setUserPath("new")}
                  type="button"
                >
                  New voter
                </button>
                <button
                  className={`rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] transition ${
                    userPath === "existing"
                      ? "bg-neon-blue/20 text-neon-blue"
                      : "text-text-muted hover:text-white"
                  }`}
                  onClick={() => setUserPath("existing")}
                  type="button"
                >
                  Existing online voter
                </button>
              </div>

              {userPath === "new" ? (
                <form className="space-y-3" onSubmit={handleRegisterProfile}>
                  <input
                    className={inputClassName}
                    value={registerRfidUid}
                    onChange={(event) => setRegisterRfidUid(event.target.value)}
                    placeholder="RFID UID"
                    required
                    readOnly
                  />
                  <input
                    className={inputClassName}
                    value={registerFullName}
                    onChange={(event) => setRegisterFullName(event.target.value)}
                    placeholder="Full name"
                    required
                  />
                  <input
                    className={inputClassName}
                    value={registerEmail}
                    onChange={(event) => setRegisterEmail(event.target.value)}
                    placeholder="Email"
                    type="email"
                    required
                  />
                  <input
                    className={inputClassName}
                    value={registerNid}
                    onChange={(event) =>
                      setRegisterNid(normalizeNidInput(event.target.value))
                    }
                    placeholder="10-digit NID"
                    inputMode="numeric"
                    maxLength={10}
                    minLength={10}
                    pattern="[0-9]{10}"
                    required
                  />
                  <input
                    className={inputClassName}
                    value={registerDob}
                    onChange={(event) => setRegisterDob(event.target.value)}
                    type="date"
                    min={MIN_DOB}
                    max={MAX_DOB}
                    autoComplete="bday"
                    required
                  />
                  <input
                    className={inputClassName}
                    value={registerPin}
                    onChange={(event) =>
                      setRegisterPin(normalizePinInput(event.target.value))
                    }
                    placeholder="Set 6-digit PIN"
                    inputMode="numeric"
                    maxLength={6}
                    pattern="[0-9]{6}"
                    required
                  />
                  <Button type="submit" isLoading={activeAction === "register"}>
                    Register voter
                  </Button>
                </form>
              ) : (
                <form className="space-y-3" onSubmit={handleLinkProfile}>
                  <input
                    className={inputClassName}
                    value={existingNid}
                    onChange={(event) =>
                      setExistingNid(normalizeNidInput(event.target.value))
                    }
                    placeholder="10-digit NID"
                    inputMode="numeric"
                    maxLength={10}
                    minLength={10}
                    pattern="[0-9]{10}"
                    required
                  />
                  <input
                    className={inputClassName}
                    value={existingDob}
                    onChange={(event) => setExistingDob(event.target.value)}
                    type="date"
                    min={MIN_DOB}
                    max={MAX_DOB}
                    autoComplete="bday"
                    required
                  />
                  <input
                    className={inputClassName}
                    value={rfidUid}
                    onChange={(event) => setRfidUid(event.target.value)}
                    placeholder="RFID UID"
                    required
                    readOnly
                  />
                  <input
                    className={inputClassName}
                    value={profilePin}
                    onChange={(event) =>
                      setProfilePin(normalizePinInput(event.target.value))
                    }
                    placeholder="Set/update 6-digit PIN"
                    inputMode="numeric"
                    maxLength={6}
                    pattern="[0-9]{6}"
                  />
                  <Button type="submit" isLoading={activeAction === "link"}>
                    Link profile
                  </Button>
                </form>
              )}
            </Panel>

            <Panel className="space-y-4">
              <div className="text-xs font-semibold uppercase tracking-[0.25em] text-text-muted">
                Start voting session
              </div>
              <form className="space-y-3" onSubmit={handleStartSession}>
                <input
                  className={inputClassName}
                  value={rfidUid}
                  onChange={(event) => setRfidUid(event.target.value)}
                  placeholder="RFID UID"
                  required
                  readOnly
                />
                <Button
                  type="submit"
                  isLoading={activeAction === "start"}
                  disabled={normalizeRfidUid(rfidUid).length < 4}
                >
                  Start session
                </Button>
              </form>

              {profileResult ? (
                <div className="rounded-2xl border border-white/10 bg-black/20 p-3 text-sm text-text-muted">
                  Voter:{" "}
                  <span className="font-semibold text-white">{profileResult.user.fullName}</span>
                  {" | "}
                  KYC:{" "}
                  <span className="font-semibold text-white">{profileResult.user.kycStatus}</span>
                </div>
              ) : null}

              {startResult ? (
                <div className="grid gap-2 sm:grid-cols-3 text-sm text-text-muted">
                  <div className="rounded-xl border border-white/10 px-3 py-2">
                    PIN: <span className="font-semibold text-white">{startResult.gate.pinReady ? "Ready" : "Missing"}</span>
                  </div>
                  <div className="rounded-xl border border-white/10 px-3 py-2">
                    KYC: <span className="font-semibold text-white">{startResult.gate.kycApproved ? "Approved" : "Pending"}</span>
                  </div>
                  <div className="rounded-xl border border-white/10 px-3 py-2">
                    <div>
                      Wallet: <span className="font-semibold text-white">{startResult.gate.walletReady ? "Ready" : "Missing"}</span>
                    </div>
                    <div className="mt-1 text-[11px] text-text-muted/90 break-all font-mono">
                      {startResult.user.walletAddress ?? "No wallet address assigned"}
                    </div>
                  </div>
                </div>
              ) : null}

              {startResult && !hasSession ? (
                <StatusBanner
                  tone="warning"
                  title={getOfflineGateTitle(startResult.gate)}
                  message={startResult.message || getOfflineGateMessage(startResult.gate)}
                />
              ) : null}
            </Panel>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="text-xs font-semibold uppercase tracking-[0.25em] text-text-muted">
          Step 2 + Step 3 · Voting
        </div>
        <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
          <Panel className="space-y-4">
            <div className="text-sm font-semibold text-white">Choose candidate</div>
            {!hasSession ? (
              <StatusBanner
                tone="info"
                title="Card login required"
                message="Candidate list unlocks after session start from RFID scan."
              />
            ) : candidatesError ? (
              <StatusBanner tone="error" title="Candidates failed" message={candidatesError} />
            ) : candidatesLoading ? (
              <div className="text-sm text-text-muted">Loading candidates...</div>
            ) : candidates.length === 0 ? (
              <div className="text-sm text-text-muted">No candidates available.</div>
            ) : (
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {candidates.map((candidate) => (
                  <div key={candidate.id} className="space-y-2">
                    <CandidateCard
                      candidate={candidate}
                      onSelect={(candidateId) => {
                        setSelectedCandidateId(candidateId);
                        setIsVoteIntentConfirmed(false);
                      }}
                      disabled={!hasSession}
                    />
                    {selectedCandidateId === candidate.id ? (
                      <div className="rounded-xl border border-neon-blue/40 bg-neon-blue/10 px-3 py-2 text-xs font-semibold text-neon-blue">
                        Selected
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel className="space-y-4">
            <div className="text-sm font-semibold text-white">Confirm with PIN</div>
            {!hasSession ? (
              <div className="text-sm text-text-muted">
                Start session in Step 1 first.
              </div>
            ) : !selectedCandidate ? (
              <div className="text-sm text-text-muted">
                Select one candidate to continue.
              </div>
            ) : (
              <div className="space-y-3 rounded-2xl border border-white/10 bg-black/20 p-3 text-sm text-text-muted">
                <div>Are you sure you want to vote for this candidate?</div>
                <div>
                  <span className="font-semibold text-white">
                    {selectedCandidate.id} - {selectedCandidate.name}
                  </span>
                </div>
                <Button
                  type="button"
                  variant={isVoteIntentConfirmed ? "primary" : "outline"}
                  onClick={() => setIsVoteIntentConfirmed(true)}
                  disabled={!hasSession}
                >
                  Yes, continue
                </Button>
              </div>
            )}

            {isVoteIntentConfirmed ? (
              <form className="space-y-3" onSubmit={handleVote}>
                <div className="text-sm text-text-muted">Enter your 6-digit PIN to continue.</div>
                <input
                  className={inputClassName}
                  value={voterPin}
                  onChange={(event) => setVoterPin(normalizePinInput(event.target.value))}
                  placeholder="Voter 6-digit PIN"
                  inputMode="numeric"
                  maxLength={6}
                  pattern="[0-9]{6}"
                  required
                />
                <Button
                  type="submit"
                  isLoading={activeAction === "vote"}
                  disabled={!hasSession || !selectedCandidate}
                >
                  Confirm vote
                </Button>
              </form>
            ) : null}

            <div className="rounded-2xl border border-white/10 bg-black/20 p-3 text-xs text-text-muted space-y-1">
              <div>
                Session: <span className="font-semibold text-white">{hasSession ? "Active" : "Not started"}</span>
              </div>
              <div>
                Voter:{" "}
                <span className="font-semibold text-white">
                  {startResult?.user.fullName ?? profileResult?.user.fullName ?? "Pending"}
                </span>
              </div>
              <div>
                Candidate:{" "}
                <span className="font-semibold text-white">
                  {selectedCandidate ? `${selectedCandidate.id} - ${selectedCandidate.name}` : "Not selected"}
                </span>
              </div>
            </div>

            {voteTxHash ? (
              <div className="rounded-2xl border border-neon-green/40 bg-neon-green/10 p-3 text-sm text-neon-green">
                Transaction hash: {voteTxHash}
              </div>
            ) : null}
          </Panel>
        </div>
      </section>
    </div>
  );
}
