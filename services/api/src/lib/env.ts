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

export const env = {
  port: Number(process.env.PORT || 4000),
  databaseUrl: requireEnv("DATABASE_URL"),
  jwtSecret: requireEnv("JWT_SECRET"),
  corsOrigins: parseCorsOrigins(process.env.CORS_ORIGIN),
  minioEndpoint: requireEnv("MINIO_ENDPOINT"),
  minioPort: Number(process.env.MINIO_PORT || 9000),
  minioAccessKey: requireEnv("MINIO_ACCESS_KEY"),
  minioSecretKey: requireEnv("MINIO_SECRET_KEY"),
  minioBucket: requireEnv("MINIO_BUCKET"),
  minioUseSsl: process.env.MINIO_USE_SSL === "true",
  rpcUrls: requireRpcUrls(),
  rpcChainId: Number(process.env.RPC_CHAIN_ID || 11155111),
  rpcChainName: process.env.RPC_CHAIN_NAME || "sepolia",
  contractAddress: requireEnv("CONTRACT_ADDRESS"),
  funderPrivateKey: requireEnv("FUNDER_PRIVATE_KEY"),
  fundAmount: process.env.FUND_AMOUNT || "0.02",
  walletEncryptionKey: requireEnv("WALLET_ENCRYPTION_KEY"),
};
