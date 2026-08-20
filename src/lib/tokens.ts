import { arbitrum, base, polygon } from 'wagmi/chains'
import type { SupportedChainId } from './chains'

export type TokenSymbol =
  | 'ARGt' | 'BRAt' | 'MEXt' | 'CHLt' | 'COLt' | 'PERt' | 'BOLt'
  | 'USDC' | 'USDT' | 'EURC'

export type TokenMeta = {
  symbol: TokenSymbol
  name: string
  currency: string
  flag: string
  decimals: number
  /** Direcciones por chain. Un token no existe en todas. */
  addresses: Partial<Record<SupportedChainId, `0x${string}`>>
}

/**
 * OJO: hay addresses que se repiten entre tokens distintos en chains distintas.
 * 0x59863989... es ARGt en Arbitrum pero MEXt en Base, y BRAt en Polygon.
 * Siempre indexar por (chainId, symbol), nunca por address sola.
 *
 * OJO 2: desde que entraron USDC/USDT/EURC conviven tokens de 6 y de 18 decimales.
 * Todo lo que formatee o parsee tiene que leer TOKENS[symbol].decimals; asumir 18
 * hace que un saldo de 10 USDC se muestre como 0,00000000000001.
 */
export const TOKENS: Record<TokenSymbol, TokenMeta> = {
  ARGt: {
    symbol: 'ARGt',
    name: 'Argentine Peso token',
    currency: 'Peso argentino',
    flag: '🇦🇷',
    decimals: 18,
    addresses: {
      [arbitrum.id]: '0x59863989d080B22476DB95656d0C3CC18be92214',
      [base.id]: '0xf016413834E6D1A14F3D628B11D6Ef725a6bdbDD',
      [polygon.id]: '0x50464bE58912745447E24EB3bbDedcee10D3E056',
    },
  },
  BRAt: {
    symbol: 'BRAt',
    name: 'Brazilian Real token',
    currency: 'Real brasileño',
    flag: '🇧🇷',
    decimals: 18,
    addresses: {
      [arbitrum.id]: '0xC4ed6Aba5373D78E160F4df39e011F078Be54df8',
      [base.id]: '0xFEE29845569570F8e0119291dff77B7b93283aaB',
      [polygon.id]: '0x59863989d080B22476DB95656d0C3CC18be92214',
    },
  },
  MEXt: {
    symbol: 'MEXt',
    name: 'Mexican Peso token',
    currency: 'Peso mexicano',
    flag: '🇲🇽',
    decimals: 18,
    addresses: {
      [arbitrum.id]: '0xb96aA6babCcD738d6644ADd4912fE5eFbEBF5a25',
      [base.id]: '0x59863989d080B22476DB95656d0C3CC18be92214',
    },
  },
  CHLt: {
    symbol: 'CHLt',
    name: 'Chilean Peso token',
    currency: 'Peso chileno',
    flag: '🇨🇱',
    decimals: 18,
    addresses: {
      [arbitrum.id]: '0xe8dbC4680235cCAeFf48e4C0B0EaceeBb89E5e17',
      [base.id]: '0x95ef2370166b250e7CE3b8F236c7e7E9feD12c2e',
      [polygon.id]: '0xfa658f62CA6cacaa769035AdBcbeD9Bf75f9f72D',
    },
  },
  COLt: {
    symbol: 'COLt',
    name: 'Colombian Peso token',
    currency: 'Peso colombiano',
    flag: '🇨🇴',
    decimals: 18,
    addresses: {
      [arbitrum.id]: '0xa16d5DB80A45157E0e451750B81FF0CC0b61d558',
      [base.id]: '0xD70ad085684b2A9f4B5d54D7BDB2ecA37a273216',
    },
  },
  PERt: {
    symbol: 'PERt',
    name: 'Peruvian Sol token',
    currency: 'Sol peruano',
    flag: '🇵🇪',
    decimals: 18,
    addresses: {
      [arbitrum.id]: '0x899438713f62B04d6CD8e8709986F7256fB6E3d9',
      [base.id]: '0xD09ABA2969B822d66DC4Bc3bB58eE520Bcf9f0C3',
    },
  },
  BOLt: {
    symbol: 'BOLt',
    name: 'Bolivian Boliviano token',
    currency: 'Boliviano',
    flag: '🇧🇴',
    decimals: 18,
    addresses: {
      [arbitrum.id]: '0x1edF5E61B6a4Fe19FEf3A695328F61aAa07728eA',
      [base.id]: '0x1d2E8C1Fe82ab2AD8dc43eD98A2F507Dfb5b4995',
      [polygon.id]: '0x20ECA820D3cd00ed9C9f2861Cdf6429baCD8ed55',
    },
  },

  // Monedas fuertes. No las emite Twin: son las nativas de cada red, verificadas
  // con scripts/verify-tokens.mjs. Las tres tienen 6 decimales, no 18.
  //
  // El symbol() on-chain de USDT no dice "USDT": es "USD₮0" en Arbitrum y "USDT0"
  // en Polygon, por el rebrand omnichain de Tether. El nombre que se muestra sale
  // de aca, no del contrato.
  USDC: {
    symbol: 'USDC',
    name: 'USD Coin',
    currency: 'Dolar',
    flag: '🇺🇸',
    decimals: 6,
    addresses: {
      [arbitrum.id]: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
      [base.id]: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      [polygon.id]: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
    },
  },
  USDT: {
    symbol: 'USDT',
    name: 'Tether USD',
    currency: 'Dolar (Tether)',
    flag: '🇺🇸',
    decimals: 6,
    addresses: {
      [arbitrum.id]: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
      [base.id]: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2',
      [polygon.id]: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
    },
  },
  // EURC solo lo desplego Circle en Base, de las tres redes que soporta la app.
  EURC: {
    symbol: 'EURC',
    name: 'Euro Coin',
    currency: 'Euro',
    flag: '🇪🇺',
    decimals: 6,
    addresses: {
      [base.id]: '0x60a3E35Cc302bFA44Cb288Bc5a4F316Fdb1adb42',
    },
  },
}

/**
 * Orden en que se muestran en la home. ARGt primero (es el del milestone 1) y USDC
 * segundo: es el destino de "dolarizar", el producto estrella.
 */
export const TOKEN_ORDER: TokenSymbol[] = [
  'ARGt', 'USDC', 'USDT', 'EURC', 'BRAt', 'MEXt', 'CHLt', 'COLt', 'PERt', 'BOLt',
]

/** Monedas fuertes: el destino de dolarizar. */
export const HARD_TOKENS: TokenSymbol[] = ['USDC', 'USDT', 'EURC']

/** Las stablecoins que emite Twin, una por pais. */
export const TWIN_TOKENS: TokenSymbol[] = ['ARGt', 'BRAt', 'MEXt', 'CHLt', 'COLt', 'PERt', 'BOLt']

export function tokenAddress(symbol: TokenSymbol, chainId: SupportedChainId) {
  return TOKENS[symbol].addresses[chainId]
}

export function chainsForToken(symbol: TokenSymbol): SupportedChainId[] {
  return Object.keys(TOKENS[symbol].addresses).map(Number) as SupportedChainId[]
}

/** Todos los pares (symbol, chainId) que existen. Base para el multicall de balances. */
export function allTokenChainPairs(): { symbol: TokenSymbol; chainId: SupportedChainId }[] {
  return TOKEN_ORDER.flatMap((symbol) =>
    chainsForToken(symbol).map((chainId) => ({ symbol, chainId })),
  )
}
