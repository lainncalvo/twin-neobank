import { arbitrum, base, polygon } from 'wagmi/chains'
import type { Chain } from 'viem'

export const SUPPORTED_CHAINS = [arbitrum, base, polygon] as const
export type SupportedChainId = (typeof SUPPORTED_CHAINS)[number]['id']

/**
 * LayerZero V2 Endpoint IDs. NO son chain IDs: el bridge de Twin es un
 * OFT Adapter de LayerZero y `SendParam.dstEid` espera esto.
 * Verificado on-chain contra `peers(uint32)` de cada adapter.
 */
export const LZ_EID: Record<SupportedChainId, number> = {
  [arbitrum.id]: 30110,
  [base.id]: 30184,
  [polygon.id]: 30109,
}

/** Adapters OFT de ARGt, uno por chain. `approvalRequired()` es true en los tres. */
export const BRIDGE_ADAPTER: Record<SupportedChainId, `0x${string}`> = {
  [arbitrum.id]: '0x4821FBf47B261F0D52Ba0F941CF67b8648f82691',
  [base.id]: '0xe80Af1d12426dB4394b147e04f179a38e7C5Dfe7',
  [polygon.id]: '0xD70ad085684b2A9f4B5d54D7BDB2ecA37a273216',
}

/**
 * El adapter usa sharedDecimals() = 6 mientras ARGt tiene 18. LayerZero trunca
 * el monto a esa granularidad, asi que todo lo que sobre de 1e12 se pierde.
 */
export const BRIDGE_DUST_UNIT = 10n ** 12n

/** Vault ARGt Prime (Morpho Vault V2, ERC-4626). Solo existe en Arbitrum. */
export const VAULT_CHAIN_ID = arbitrum.id
export const VAULT_ADDRESS = '0x9Dd3F844747AB78d616BF76DB92756E17A064aDD' as const

/**
 * Dolarizar: ARGt -> USDC en Uniswap V4. Solo en Base, que es la unica red donde
 * existe el pool. Verificado con scripts/verify-swap.mjs.
 */
export const SWAP_CHAIN_ID = base.id
export const V4_QUOTER = '0x0d5e0F971ED27FBfF6c2837bf31316121532048D' as const
/** Adonde van fisicamente los tokens en un swap V4: el singleton de Uniswap. */
export const V4_POOL_MANAGER = '0x498581fF718922c3f8e6A244956aF099B2652b2b' as const
export const UNIVERSAL_ROUTER = '0x6fF5693b99212Da76ad316178A184AB56D299b43' as const
export const PERMIT2 = '0x000000000022D473030F116dDEE9F6B43aC78BA3' as const

/**
 * PoolKey exacto del unico pool ARGt/USDC con liquidez (poolId 0xba3ea6f7...).
 * currency0 es SIEMPRE la address menor: USDC < ARGt, y por eso vender ARGt para
 * comprar USDC va con zeroForOne = false. No reordenar estos campos.
 *
 * Se chequearon las cinco stablecoins de Twin que viven en Base contra USDC en los
 * cuatro fee tiers: solo este par tiene liquidez.
 */
export const ARGT_USDC_POOL = {
  currency0: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  currency1: '0xf016413834E6D1A14F3D628B11D6Ef725a6bdbDD',
  fee: 3000,
  tickSpacing: 60,
  hooks: '0x0000000000000000000000000000000000000000',
} as const

/**
 * Tolerancia sobre la cotizacion. El pool tiene ~USD 700 de TVL y el impacto medido
 * a 100.000 ARGt ya es 0,21%, asi que 0,5% queda demasiado ajustado.
 */
export const SWAP_SLIPPAGE_BPS = 100n

export const CHAIN_META: Record<SupportedChainId, { name: string; color: string; explorer: string }> = {
  [arbitrum.id]: { name: 'Arbitrum', color: '#28A0F0', explorer: 'https://arbiscan.io' },
  [base.id]: { name: 'Base', color: '#0052FF', explorer: 'https://basescan.org' },
  [polygon.id]: { name: 'Polygon', color: '#8247E5', explorer: 'https://polygonscan.com' },
}

export function chainById(id: number): Chain | undefined {
  return SUPPORTED_CHAINS.find((c) => c.id === id)
}

export function isSupportedChain(id: number): id is SupportedChainId {
  return SUPPORTED_CHAINS.some((c) => c.id === id)
}

export function explorerTx(chainId: SupportedChainId, hash: string) {
  return `${CHAIN_META[chainId].explorer}/tx/${hash}`
}
