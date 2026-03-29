import "dotenv/config";

const requireEnv = (key: string) => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing environment variable: ${key}`);
  }
  return value;
};

const requireRpcUrls = () => {
  const raw = process.env.RPC_URLS || process.env.RPC_URL;
  if (!raw) {
    throw new Error("Missing environment variable: RPC_URL (or RPC_URLS)");
  }
  return raw
    .split(",")
    .map((url) => url.trim())
    .filter(Boolean);
};

const parseCorsOrigins = (value?: string) => {
  if (!value) {
    return [
      "http://localhost:5173",
      "http://localhost:5174",
      "http://127.0.0.1:5173",
      "http://127.0.0.1:5174",
    ];
  }
  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
};

const parsePositiveInt = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
};

export const env = {
  port: Number(process.env.PORT || 4100),
  databaseUrl: requireEnv("DATABASE_URL"),
  jwtSecret: requireEnv("JWT_SECRET"),
  offlineJwtSecret: process.env.OFFLINE_JWT_SECRET || requireEnv("JWT_SECRET"),
  offlineRfidPepper: requireEnv("OFFLINE_RFID_PEPPER"),
  offlinePinSaltRounds: parsePositiveInt(process.env.OFFLINE_PIN_SALT_ROUNDS, 10),
  offlinePinAttemptsLimit: parsePositiveInt(process.env.OFFLINE_PIN_ATTEMPTS_LIMIT, 3),
  offlineLockMinutes: parsePositiveInt(process.env.OFFLINE_LOCK_MINUTES, 15),
  offlinePrecheckMinutes: parsePositiveInt(process.env.OFFLINE_PRECHECK_MINUTES, 5),
  offlineSessionMinutes: parsePositiveInt(process.env.OFFLINE_SESSION_MINUTES, 3),
  corsOrigins: parseCorsOrigins(process.env.CORS_ORIGIN),
  rpcUrls: requireRpcUrls(),
  rpcChainId: Number(process.env.RPC_CHAIN_ID || 11155111),
  rpcChainName: process.env.RPC_CHAIN_NAME || "sepolia",
  contractAddress: requireEnv("CONTRACT_ADDRESS"),
  funderPrivateKey: requireEnv("FUNDER_PRIVATE_KEY"),
  fundAmount: process.env.FUND_AMOUNT || "0.02",
  walletEncryptionKey: requireEnv("WALLET_ENCRYPTION_KEY"),
};
