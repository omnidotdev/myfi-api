type WalletValidationResult = {
  valid: boolean;
  network: string;
  error?: string;
};

type WalletBalance = {
  address: string;
  network: string;
  balance: string;
  source: "manual" | "on-chain";
};

const ETH_ADDRESS_REGEX = /^0x[0-9a-fA-F]{40}$/;
const BTC_LEGACY_REGEX = /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/;
const BTC_BECH32_REGEX = /^bc1[a-zA-HJ-NP-Z0-9]{25,62}$/;
const SOL_ADDRESS_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

// EVM-compatible networks share the same address format
const EVM_NETWORKS = new Set([
  "ethereum",
  "polygon",
  "arbitrum",
  "base",
  "avalanche",
  "optimism",
]);

/**
 * Validate a wallet address for a given network.
 * @param address - Wallet address to validate
 * @param network - Blockchain network identifier
 * @returns Validation result with network and optional error
 */
const validateWalletAddress = (
  address: string,
  network: string,
): WalletValidationResult => {
  const normalizedNetwork = network.toLowerCase();

  if (EVM_NETWORKS.has(normalizedNetwork)) {
    if (!ETH_ADDRESS_REGEX.test(address)) {
      return {
        valid: false,
        network: normalizedNetwork,
        error: "Invalid EVM address: must be 0x followed by 40 hex characters",
      };
    }

    return { valid: true, network: normalizedNetwork };
  }

  if (normalizedNetwork === "bitcoin") {
    if (!BTC_LEGACY_REGEX.test(address) && !BTC_BECH32_REGEX.test(address)) {
      return {
        valid: false,
        network: normalizedNetwork,
        error: "Invalid Bitcoin address: must start with 1, 3, or bc1",
      };
    }

    return { valid: true, network: normalizedNetwork };
  }

  if (normalizedNetwork === "solana") {
    if (!SOL_ADDRESS_REGEX.test(address)) {
      return {
        valid: false,
        network: normalizedNetwork,
        error: "Invalid Solana address: must be 32-44 base58 characters",
      };
    }

    return { valid: true, network: normalizedNetwork };
  }

  return {
    valid: false,
    network: normalizedNetwork,
    error: `Unsupported network: ${normalizedNetwork}`,
  };
};

/**
 * Fetch balance for a wallet address.
 *
 * Placeholder implementation; production would use Alchemy/Moralis for
 * on-chain balance lookups. Currently returns the manually-tracked balance.
 * @param address - Wallet address
 * @param network - Blockchain network identifier
 * @param manualBalance - Manually entered balance to fall back on
 * @returns Wallet balance data
 */
const fetchWalletBalance = async (
  address: string,
  network: string,
  manualBalance?: string,
): Promise<WalletBalance> => {
  // TODO: integrate Alchemy/Moralis for on-chain balance fetching
  return {
    address,
    network,
    balance: manualBalance ?? "0",
    source: "manual",
  };
};

export { fetchWalletBalance, validateWalletAddress };

export type { WalletBalance, WalletValidationResult };
