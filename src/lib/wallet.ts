import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  maxUint256,
  parseAbi,
  type Address,
  type EIP1193Provider,
  type PublicClient,
} from "viem";
import { bsc } from "viem/chains";

export const USDT_ADDRESS = "0x55d398326f99059fF775485246999027B3197955" as Address;
export const READ_WALLET = "0x0000000000000000000000000000000000000000" as Address;
export const BSC_EXPLORER = "https://bscscan.com";

export const erc20Abi = parseAbi([
  "function balanceOf(address owner) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
]);

type InjectedProvider = {
  request: (args: { method: string; params?: unknown }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
};

export function injected(): InjectedProvider | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { ethereum?: InjectedProvider }).ethereum ?? null;
}

const BSC_RPC = import.meta.env.VITE_BSC_RPC || "https://bsc-dataseed.binance.org";

let cachedClient: PublicClient | null = null;

export function publicClient(): PublicClient {
  cachedClient ??= createPublicClient({
    chain: bsc,
    transport: http(BSC_RPC),
  });
  return cachedClient;
}

function walletFor(address: Address) {
  const eth = injected();
  if (!eth) throw new Error("Open Veyl inside Nimiq Pay to use its wallet.");
  return createWalletClient({
    account: address,
    chain: bsc,
    transport: custom(eth as unknown as EIP1193Provider),
  });
}

export async function findAccount(): Promise<Address | null> {
  const eth = injected();
  if (!eth) return null;
  try {
    const accounts = (await eth.request({ method: "eth_accounts" })) as Address[];
    return accounts?.[0] ?? null;
  } catch {
    return null;
  }
}

export async function connectAccount(): Promise<Address | null> {
  const eth = injected();
  if (!eth) return null;
  const accounts = (await eth.request({ method: "eth_requestAccounts" })) as Address[];
  return accounts?.[0] ?? null;
}

export async function ensureBsc(): Promise<void> {
  const eth = injected();
  if (!eth) throw new Error("Open Veyl inside Nimiq Pay to use its wallet.");
  const chainId = String(await eth.request({ method: "eth_chainId" }));
  if (chainId.toLowerCase() === "0x38") return;
  try {
    await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x38" }] });
  } catch (error) {
    if ((error as { code?: number }).code !== 4902) throw error;
    await eth.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: "0x38",
          chainName: "BNB Smart Chain",
          nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
          rpcUrls: [BSC_RPC],
          blockExplorerUrls: [BSC_EXPLORER],
        },
      ],
    });
  }
  const after = String(await eth.request({ method: "eth_chainId" })).toLowerCase();
  if (after !== "0x38") throw new Error("Switch the wallet to BNB Chain and retry.");
}

export function readBalance(token: Address, owner: Address): Promise<bigint> {
  return publicClient().readContract({
    address: token,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [owner],
  }) as Promise<bigint>;
}

export function readAllowance(token: Address, owner: Address, spender: Address): Promise<bigint> {
  return publicClient().readContract({
    address: token,
    abi: erc20Abi,
    functionName: "allowance",
    args: [owner, spender],
  }) as Promise<bigint>;
}

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

export function approveMax(token: Address, owner: Address, spender: Address): Promise<`0x${string}`> {
  if (!ADDRESS_RE.test(spender) || /^0x0{40}$/.test(spender)) {
    throw new Error("The quote returned an invalid approval target.");
  }
  return walletFor(owner).writeContract({
    address: token,
    abi: erc20Abi,
    functionName: "approve",
    args: [spender, maxUint256],
    account: owner,
    chain: bsc,
  });
}

export function sendSwapTx(
  owner: Address,
  to: Address,
  data: `0x${string}`,
  value: bigint,
): Promise<`0x${string}`> {
  if (!ADDRESS_RE.test(to) || /^0x0{40}$/.test(to)) {
    throw new Error("The quote returned an invalid transaction destination.");
  }
  if (!/^0x[0-9a-fA-F]+$/.test(data) || data === "0x") {
    throw new Error("The quote returned invalid transaction data.");
  }
  return walletFor(owner).sendTransaction({ account: owner, chain: bsc, to, data, value });
}

export function waitReceipt(hash: `0x${string}`) {
  return publicClient().waitForTransactionReceipt({ hash });
}

export function friendlyError(error: unknown): string {
  const message =
    error instanceof Error
      ? ((error as { shortMessage?: string }).shortMessage ?? error.message)
      : String(error);
  if (/reject|denied|4001/i.test(message)) return "Request rejected in the wallet.";
  if (/insufficient funds/i.test(message)) return "Not enough BNB to cover the network fee.";
  if (/chain/i.test(message) && /mismatch/i.test(message)) return "Switch the wallet to BNB Chain and retry.";
  return message.length > 160 ? `${message.slice(0, 157)}…` : message;
}
