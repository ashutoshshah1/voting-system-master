import "dotenv/config";
import { SerialPort } from "serialport";
import { ReadlineParser } from "@serialport/parser-readline";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

type Mode = "register" | "link" | "pin-setup" | "session" | "attest" | "vote" | "scan";

const supportedModes: Mode[] = [
  "register",
  "link",
  "pin-setup",
  "session",
  "attest",
  "vote",
  "scan",
];

const defaultScanOutFile = fileURLToPath(
  new URL("../../../../apps/dapp/public/rfid-scan.json", import.meta.url)
);

const parseArgs = () => {
  const args = new Map<string, string | boolean>();
  const tokens = process.argv.slice(2);

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (!token.startsWith("--")) {
      continue;
    }
    const body = token.slice(2);
    const eqIndex = body.indexOf("=");
    if (eqIndex >= 0) {
      const key = body.slice(0, eqIndex);
      const value = body.slice(eqIndex + 1);
      args.set(key, value);
      continue;
    }
    const next = tokens[i + 1];
    if (next && !next.startsWith("--")) {
      args.set(body, next);
      i += 1;
      continue;
    }
    args.set(body, true);
  }

  return args;
};

const args = parseArgs();

const getArg = (name: string, fallback?: string) => {
  const value = args.get(name);
  if (typeof value === "string") {
    return value;
  }
  return fallback;
};

const hasFlag = (name: string) => args.get(name) === true;

const requiredArg = (name: string, fallback?: string) => {
  const value = getArg(name, fallback);
  if (!value) {
    throw new Error(`Missing required argument: --${name}`);
  }
  return value;
};

const parseNumberArg = (name: string, fallback?: string) => {
  const value = getArg(name, fallback);
  if (!value) {
    throw new Error(`Missing numeric argument: --${name}`);
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid numeric argument for --${name}: ${value}`);
  }
  return parsed;
};

const parseJsonSafe = (text: string) => {
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return { raw: text };
  }
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const postJson = async (
  apiBase: string,
  path: string,
  payload: unknown,
  options: { timeoutMs: number; retries: number }
) => {
  const isRetryableStatus = (status: number) => status === 429 || status >= 500;

  for (let attempt = 0; attempt <= options.retries; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs);

    try {
      const response = await fetch(`${apiBase}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      const text = await response.text();
      const data = parseJsonSafe(text);
      if (!response.ok) {
        const message = (data as { message?: string })?.message || text || "Unknown error";
        if (attempt < options.retries && isRetryableStatus(response.status)) {
          await wait((attempt + 1) * 300);
          continue;
        }
        throw new Error(`Request failed (${response.status}) ${path}: ${message}`);
      }
      return data;
    } catch (error) {
      const isTimeout = error instanceof Error && error.name === "AbortError";
      const isNetworkError =
        error instanceof TypeError ||
        (error instanceof Error && /fetch/i.test(error.message));
      if (attempt < options.retries && (isTimeout || isNetworkError)) {
        await wait((attempt + 1) * 300);
        continue;
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw new Error(`Request failed after ${options.retries + 1} attempts: ${path}`);
};

const printUsage = () => {
  console.log("VoteHybrid v2 serial bridge");
  console.log(
    "Usage: npm run dev -- --port COM5 --mode <register|link|pin-setup|session|attest|vote|scan> [options]"
  );
  console.log("Options:");
  console.log("  --api http://localhost:4100    Offline API base URL");
  console.log("  --baud 115200                  Serial baud rate");
  console.log("  --timeoutMs 15000              API request timeout in milliseconds");
  console.log("  --retries 1                    Retries for transient API failures");
  console.log("  --once                         Exit after one successful dispatch");
  console.log("  --outFile path/to/rfid-scan.json  File output for --mode scan");
  console.log("  --list                         List serial ports and exit");
  console.log("Mode specific:");
  console.log("  register: --fullName --email --nid --dob [--pin]");
  console.log("  link: --nid --dob [--pin]");
  console.log("  pin-setup: --nid --dob --pin");
  console.log("  attest: --officerEmployeeId --officerPin [--boothCode]");
  console.log("  vote: --pin --candidateId --officerEmployeeId --officerPin [--boothCode]");
  console.log("  scan: --outFile (writes latest scanned UID JSON for frontend polling)");
};

const main = async () => {
  if (hasFlag("help")) {
    printUsage();
    return;
  }

  if (hasFlag("list")) {
    const ports = await SerialPort.list();
    if (ports.length === 0) {
      console.log("No serial ports detected.");
      return;
    }
    console.log("Detected serial ports:");
    for (const port of ports) {
      console.log(`- ${port.path}${port.manufacturer ? ` (${port.manufacturer})` : ""}`);
    }
    return;
  }

  const modeRaw = getArg("mode", "session");
  if (!modeRaw || !supportedModes.includes(modeRaw as Mode)) {
    throw new Error(`Invalid --mode. Supported modes: ${supportedModes.join(", ")}`);
  }
  const mode = modeRaw as Mode;
  const apiBase = getArg("api", process.env.OFFLINE_API_URL || "http://localhost:4100")!;
  const portPath = requiredArg("port", process.env.SERIAL_PORT);
  const baudRate = parseNumberArg("baud", process.env.SERIAL_BAUD || "115200");
  const timeoutMs = Math.max(
    1000,
    Math.floor(parseNumberArg("timeoutMs", process.env.OFFLINE_API_TIMEOUT_MS || "15000"))
  );
  const retries = Math.max(
    0,
    Math.floor(parseNumberArg("retries", process.env.OFFLINE_API_RETRIES || "1"))
  );
  const once = hasFlag("once");
  const outFile = getArg(
    "outFile",
    process.env.SCAN_OUT_FILE || (mode === "scan" ? defaultScanOutFile : undefined)
  );
  const resolvedOutFile = outFile ? resolve(outFile) : null;
  let latestScan = {
    rfidUid: "",
    scannedAt: "",
    relayAliveAt: new Date().toISOString(),
    lastSerialAt: "",
    lastSerialLine: "",
  };

  const writeScanFile = async (patch?: Partial<typeof latestScan>) => {
    if (!resolvedOutFile) {
      return;
    }
    latestScan = {
      ...latestScan,
      ...(patch ?? {}),
      relayAliveAt: new Date().toISOString(),
    };
    await mkdir(dirname(resolvedOutFile), { recursive: true });
    await writeFile(resolvedOutFile, JSON.stringify(latestScan, null, 2), "utf8");
  };

  if (mode === "register") {
    requiredArg("fullName");
    requiredArg("email");
    requiredArg("nid");
    requiredArg("dob");
  }
  if (mode === "link" || mode === "pin-setup") {
    requiredArg("nid");
    requiredArg("dob");
  }
  if (mode === "pin-setup" || mode === "vote") {
    requiredArg("pin");
  }
  if (mode === "attest" || mode === "vote") {
    requiredArg("officerEmployeeId");
    requiredArg("officerPin");
  }
  if (mode === "vote") {
    parseNumberArg("candidateId");
  }

  console.log(`[bridge] connecting to ${portPath} at ${baudRate} baud`);
  console.log(`[bridge] mode=${mode} api=${apiBase}`);
  console.log(`[bridge] timeoutMs=${timeoutMs} retries=${retries}`);
  if (mode === "scan" && resolvedOutFile) {
    console.log(`[bridge] output file=${resolvedOutFile}`);
    await writeScanFile();
  }

  let port: SerialPort | null = new SerialPort({ path: portPath, baudRate, autoOpen: true });
  const parser = port.pipe(new ReadlineParser({ delimiter: "\n" }));
  let relayHeartbeatInterval: NodeJS.Timeout | null =
    mode === "scan" && resolvedOutFile
      ? setInterval(() => {
          void writeScanFile();
        }, 1000)
      : null;
  let shuttingDown = false;

  const shutdown = (code: number) => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    if (relayHeartbeatInterval) {
      clearInterval(relayHeartbeatInterval);
      relayHeartbeatInterval = null;
    }

    const exitProcess = () => {
      setTimeout(() => process.exit(code), 50);
    };

    if (!port || !port.isOpen) {
      exitProcess();
      return;
    }

    port.close((error) => {
      if (error) {
        console.error(
          "[bridge] failed to close serial port cleanly:",
          error instanceof Error ? error.message : error
        );
      }
      port = null;
      exitProcess();
    });
  };

  let rfidUid: string | null = null;
  let dispatching = false;
  let lastDispatchKey = "";
  let lastDispatchAt = 0;

  const dispatchScan = async (scanRfidUid: string) => {
    const now = Date.now();
    const key = scanRfidUid;
    if (key === lastDispatchKey && now - lastDispatchAt < 3000) {
      return;
    }

    dispatching = true;
    try {
      let response: unknown;
      const post = (path: string, payload: unknown) =>
        postJson(apiBase, path, payload, { timeoutMs, retries });

      if (mode === "scan") {
        await writeScanFile({
          rfidUid: scanRfidUid,
          scannedAt: new Date().toISOString(),
        });
        response = latestScan;
      } else if (mode === "register") {
        response = await post("/offline/profiles/register", {
          fullName: requiredArg("fullName"),
          email: requiredArg("email"),
          nid: requiredArg("nid"),
          dob: requiredArg("dob"),
          pin: getArg("pin"),
          rfidUid: scanRfidUid,
        });
      } else if (mode === "link") {
        response = await post("/offline/profiles/link-online", {
          nid: requiredArg("nid"),
          dob: requiredArg("dob"),
          pin: getArg("pin"),
          rfidUid: scanRfidUid,
        });
      } else if (mode === "pin-setup") {
        response = await post("/offline/pin/setup", {
          nid: requiredArg("nid"),
          dob: requiredArg("dob"),
          pin: requiredArg("pin"),
          rfidUid: scanRfidUid,
        });
      } else if (mode === "session") {
        response = await post("/offline/session/start", {
          rfidUid: scanRfidUid,
        });
      } else if (mode === "attest") {
        const precheck = (await post("/offline/session/start", {
          rfidUid: scanRfidUid,
        })) as { preSessionToken?: string | null };
        if (!precheck.preSessionToken) {
          throw new Error("Session started but no officer precheck token was returned.");
        }
        response = await post("/offline/session/attest", {
          preSessionToken: precheck.preSessionToken,
          officerEmployeeId: requiredArg("officerEmployeeId"),
          officerPin: requiredArg("officerPin"),
          boothCode: getArg("boothCode"),
        });
      } else {
        const precheck = (await post("/offline/session/start", {
          rfidUid: scanRfidUid,
        })) as { preSessionToken?: string | null };
        if (!precheck.preSessionToken) {
          throw new Error("Session started but no officer precheck token was returned.");
        }
        const session = (await post("/offline/session/attest", {
          preSessionToken: precheck.preSessionToken,
          officerEmployeeId: requiredArg("officerEmployeeId"),
          officerPin: requiredArg("officerPin"),
          boothCode: getArg("boothCode"),
        })) as { sessionToken?: string | null };
        if (!session.sessionToken) {
          throw new Error("Officer attestation succeeded but no voting token was returned.");
        }
        response = await post("/offline/vote", {
          sessionToken: session.sessionToken,
          pin: requiredArg("pin"),
          candidateId: parseNumberArg("candidateId"),
        });
      }

      lastDispatchKey = key;
      lastDispatchAt = Date.now();

      console.log("[bridge] dispatch success:");
      console.log(JSON.stringify(response, null, 2));

      if (once) {
        console.log("[bridge] --once enabled. Exiting.");
        shutdown(0);
        return;
      }
    } catch (error) {
      console.error("[bridge] dispatch failed:", error instanceof Error ? error.message : error);
    } finally {
      dispatching = false;
      rfidUid = null;
    }
  };

  parser.on("data", (rawLine: string) => {
    if (shuttingDown) {
      return;
    }
    const line = rawLine.trim();
    if (!line) {
      return;
    }

    if (line.startsWith("RFID:")) {
      rfidUid = line.slice("RFID:".length).trim();
      console.log(`[bridge] RFID read: ${rfidUid}`);
      if (mode === "scan") {
        void writeScanFile({
          lastSerialAt: new Date().toISOString(),
          lastSerialLine: line.slice(0, 120),
        });
      }
    } else {
      console.log(`[bridge] ${line}`);
      if (mode === "scan") {
        void writeScanFile({
          lastSerialAt: new Date().toISOString(),
          lastSerialLine: line.slice(0, 120),
        });
      }
    }

    if (!dispatching && rfidUid) {
      void dispatchScan(rfidUid);
    }
  });

  parser.on("error", (error) => {
    console.error("[bridge] serial parser error:", error);
  });

  port.on("error", (error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[bridge] serial port error:", message);

    const normalized = message.toLowerCase();
    const isMissingPort =
      normalized.includes("file not found") ||
      normalized.includes("no such file") ||
      normalized.includes("cannot find");
    const isAccessDenied =
      normalized.includes("access denied") ||
      normalized.includes("resource busy") ||
      normalized.includes("permission denied");

    const printPortHints = async () => {
      try {
        const ports = await SerialPort.list();
        if (ports.length === 0) {
          console.error(
            "[bridge] no serial ports detected. Check USB cable, Arduino drivers (CH340/CP210x), and Device Manager COM port."
          );
          return;
        }
        console.error("[bridge] available ports:");
        for (const detected of ports) {
          console.error(
            `- ${detected.path}${detected.manufacturer ? ` (${detected.manufacturer})` : ""}`
          );
        }
      } catch (listError) {
        console.error(
          "[bridge] failed to list ports:",
          listError instanceof Error ? listError.message : listError
        );
      }
    };

    if (isMissingPort) {
      void printPortHints();
    }
    if (isAccessDenied) {
      console.error(
        "[bridge] serial port is busy. Close Arduino Serial Monitor/IDE, any other serial terminal, and other bridge instances."
      );
      void printPortHints();
    }

    // A serial port error means the bridge cannot dispatch scans reliably.
    // Exit with non-zero so callers (scripts/CI) can detect the failure.
    shutdown(1);
  });

  const close = () => {
    shutdown(0);
  };
  process.on("SIGINT", close);
  process.on("SIGTERM", close);
};

main().catch((error) => {
  console.error("[bridge] fatal error:", error instanceof Error ? error.message : error);
  process.exit(1);
});
