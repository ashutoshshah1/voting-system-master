export const formatAddress = (address?: string | null) => {
  if (!address) return "N/A";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

export const formatVoterId = (hash?: string) => {
  if (!hash) return "Unverified";
  return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
};
