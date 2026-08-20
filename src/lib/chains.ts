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
