type ChainConfig = {
  chainId: number;
  name: string;
  rpcUrl: string;
  rpcUrls: string[];
  contractAddress: string;
  explorerBaseUrl: string;
  useMock: boolean;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
};

const rawRpcUrls: string =
  import.meta.env.VITE_RPC_URLS ||
  import.meta.env.VITE_RPC_URL ||
  "https://rpc.sepolia.org";
const rpcUrls: string[] = rawRpcUrls
  .split(",")
  .map((url: string) => url.trim())
  .filter((url: string) => Boolean(url));

export const chainConfig: ChainConfig = {
  chainId: Number(import.meta.env.VITE_CHAIN_ID || 11155111),
  name: import.meta.env.VITE_CHAIN_NAME || "Sepolia",
  rpcUrl: rpcUrls[0] || "https://rpc.sepolia.org",
  rpcUrls,
  contractAddress: import.meta.env.VITE_CONTRACT_ADDRESS || "",
  explorerBaseUrl: import.meta.env.VITE_EXPLORER_URL || "https://sepolia.etherscan.io",
  useMock: import.meta.env.VITE_USE_MOCK === "true",
  nativeCurrency: {
    name: "Ether",
    symbol: "ETH",
    decimals: 18,
  },
};
