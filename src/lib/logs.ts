import { createPublicClient, http, type PublicClient } from 'viem'
import { arbitrum, base, polygon } from 'wagmi/chains'
import {
  BRIDGE_ADAPTER, SWAP_CHAIN_ID, UNIVERSAL_ROUTER, V4_POOL_MANAGER, VAULT_ADDRESS,
  VAULT_CHAIN_ID, type SupportedChainId,
} from './chains'
import { TOKENS, allTokenChainPairs, type TokenSymbol } from './tokens'

/**
 * Clientes SOLO para leer logs, aparte a proposito de wagmiConfig.
 *
 * Los RPC de la app no sirven para historial: mainnet.base.org contesta
 * "eth_getLogs is limited to a 10,000 range", que en Base son unas 5 horas de
 * historia. Cubrir un mes serian ~130 requests paginados por red. Los gateways de
 * Tenderly aceptan fromBlock 0 sin API key y responden en menos de un segundo.
 *
 * Si esto se cae, se cae el historial y nada mas: balances, envios, vault y bridge
 * siguen sobre los RPC que ya estan probados con plata real.
 */
const LOGS_RPC: Record<SupportedChainId, string[]> = {
  [arbitrum.id]: [
    process.env.NEXT_PUBLIC_LOGS_RPC_ARBITRUM || 'https://arbitrum.gateway.tenderly.co',
    'https://arb1.arbitrum.io/rpc',
  ],
  [base.id]: [
    process.env.NEXT_PUBLIC_LOGS_RPC_BASE || 'https://base.gateway.tenderly.co',
    'https://base-rpc.publicnode.com',
  ],
  [polygon.id]: [
    process.env.NEXT_PUBLIC_LOGS_RPC_POLYGON || 'https://polygon.gateway.tenderly.co',
    'https://polygon-bor-rpc.publicnode.com',
  ],
}

const CHAINS = { [arbitrum.id]: arbitrum, [base.id]: base, [polygon.id]: polygon } as const

/** Un cliente por (red, url). El batch junta los getBlock de los timestamps. */
export function logsClients(chainId: SupportedChainId): PublicClient[] {
  return LOGS_RPC[chainId].map(
    (url) =>
      createPublicClient({
        chain: CHAINS[chainId],
        transport: http(url, { batch: { wait: 16 } }),
      }) as PublicClient,
  )
}

/**
 * (chainId, address en minuscula) -> simbolo.
 *
 * NUNCA indexar por address sola: 0x59863989... es ARGt en Arbitrum, MEXt en Base
 * y BRAt en Polygon. Un log mal mapeado muestra el token equivocado con los
 * decimales equivocados.
 */
export const TOKEN_BY_ADDRESS: Record<number, Record<string, TokenSymbol>> = (() => {
  const index: Record<number, Record<string, TokenSymbol>> = {}
  for (const { symbol, chainId } of allTokenChainPairs()) {
    const address = TOKENS[symbol].addresses[chainId]
    if (!address) continue
    index[chainId] ??= {}
    index[chainId][address.toLowerCase()] = symbol
  }
  return index
})()

/** Todas las direcciones de token de una red, para pedirlas en un solo getLogs. */
export function tokensOnChain(chainId: SupportedChainId): `0x${string}`[] {
  return Object.keys(TOKEN_BY_ADDRESS[chainId] ?? {}) as `0x${string}`[]
}

const ZERO = '0x0000000000000000000000000000000000000000'

/** Contrapartes que sabemos nombrar. Es lo que convierte un hash en una frase. */
export const KNOWN: Record<number, Record<string, string>> = (() => {
  const known: Record<number, Record<string, string>> = {}
  const add = (chainId: number, address: string, label: string) => {
    known[chainId] ??= {}
    known[chainId][address.toLowerCase()] = label
  }
  for (const chainId of Object.keys(BRIDGE_ADAPTER).map(Number) as SupportedChainId[]) {
    add(chainId, BRIDGE_ADAPTER[chainId], 'Puente entre redes')
    add(chainId, ZERO, 'Emisión')
  }
  add(VAULT_CHAIN_ID, VAULT_ADDRESS, 'Ahorro ARGt Prime')
  add(SWAP_CHAIN_ID, V4_POOL_MANAGER, 'Cambio a dólares')
  add(SWAP_CHAIN_ID, UNIVERSAL_ROUTER, 'Cambio a dólares')
  return known
})()

export function knownName(chainId: SupportedChainId, address: string): string | undefined {
  return KNOWN[chainId]?.[address.toLowerCase()]
}
