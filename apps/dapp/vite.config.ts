import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

const appDir = fileURLToPath(new URL(".", import.meta.url));
const emptyScanPayload = JSON.stringify(
  {
    rfidUid: "",
    scannedAt: "",
    relayAliveAt: "",
    lastSerialAt: "",
    lastSerialLine: "",
  },
  null,
  2
);

const scanRelayCandidatePaths = [
  resolve(appDir, "public/rfid-scan.json"),
  resolve(appDir, "../../tmp-integration-scan.json"),
  resolve(appDir, "../../tmp-live-scan.json"),
  resolve(appDir, "../../tmp-postfix-scan.json"),
  resolve(appDir, "../../tmp-rfid-scan.json"),
  resolve(appDir, "../../tmp-rfid-scan-com3.json"),
  resolve(appDir, "../../tmp-rfid-scan-env.json"),
  resolve(appDir, "../../v2/apps/dapp/public/rfid-scan.json"),
];

const readLatestScanPayload = () => {
  let latestMtimeMs = -1;
  let latestPayload = emptyScanPayload;

  for (const candidatePath of scanRelayCandidatePaths) {
    try {
      const stat = statSync(candidatePath);
      if (!stat.isFile() || stat.mtimeMs < latestMtimeMs) {
        continue;
      }
      const payload = readFileSync(candidatePath, "utf8");
      JSON.parse(payload);
      latestMtimeMs = stat.mtimeMs;
      latestPayload = payload;
    } catch {
      // Ignore missing or invalid scan files and continue checking fallbacks.
    }
  }

  return latestPayload;
};

const rfidScanRelayPlugin = (): Plugin => {
  const serveScanPayload = (
    requestUrl: string | undefined,
    res: { setHeader: (name: string, value: string) => void; end: (body: string) => void }
  ) => {
    if ((requestUrl ?? "").split("?")[0] !== "/rfid-scan.json") {
      return false;
    }
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.end(readLatestScanPayload());
    return true;
  };

  return {
    name: "rfid-scan-relay",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!serveScanPayload(req.url, res)) {
          next();
        }
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!serveScanPayload(req.url, res)) {
          next();
        }
      });
    },
  };
};

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), rfidScanRelayPlugin()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalizedId = id.replace(/\\/g, "/");
          if (!normalizedId.includes("/node_modules/")) {
            return undefined;
          }
          if (normalizedId.includes("/ethers/")) {
            return "ethers";
          }
          if (
            normalizedId.includes("/react-router") ||
            normalizedId.includes("/@remix-run/")
          ) {
            return "router";
          }
          return "vendor";
        },
      },
    },
  },
  server: {
    host: true,
    port: 5173,
    strictPort: true,
  },
});
