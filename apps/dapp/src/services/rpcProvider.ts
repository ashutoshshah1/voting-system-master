import { ethers } from "ethers";
import { chainConfig } from "../config/chain";

export const createRpcProvider = () => {
  const network = new ethers.Network(chainConfig.name, chainConfig.chainId);
  const providers = chainConfig.rpcUrls.map(
    (url: string) =>
      new ethers.JsonRpcProvider(url, network, {
        batchMaxCount: 1,
        staticNetwork: network,
      })
  );
  if (providers.length === 1) {
    return providers[0];
  }
  return new ethers.FallbackProvider(
    providers.map((provider: ethers.JsonRpcProvider, index: number) => ({
      provider,
      priority: index,
      stallTimeout: 1500,
    })),
    network,
    { quorum: 1 }
  );
};
