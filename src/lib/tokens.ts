import { arbitrum, base, polygon } from 'wagmi/chains'
import type { SupportedChainId } from './chains'

export type TokenSymbol =
  | 'ARGt' | 'BRAt' | 'MEXt' | 'CHLt' | 'COLt' | 'PERt' | 'BOLt'
  | 'USDC' | 'USDT' | 'EURC'
  | 'ETH' | 'POL'
  | 'cbBTC' | 'VIRTUAL'

export type TokenMeta = {
  symbol: TokenSymbol
  name: string
  currency: string
  flag: string
  decimals: number
  /**
   * 'native' es la moneda con la que se paga el gas: no tiene contrato, no se
   * puede leer con balanceOf y no se envia con transfer. Todo lo que arme una
   * llamada a contrato tiene que filtrar por esto.
   */
  kind: 'erc20' | 'native'
  /** Direcciones por chain. Un token no existe en todas. Vacia en las nativas. */
  addresses: Partial<Record<SupportedChainId, `0x${string}`>>
  /** Solo las nativas: en que redes existen. Reemplaza a `addresses` para ellas. */
  chains?: SupportedChainId[]
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
    kind: 'erc20',
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
    kind: 'erc20',
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
    kind: 'erc20',
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
    kind: 'erc20',
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
    kind: 'erc20',
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
    kind: 'erc20',
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
    kind: 'erc20',
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
    kind: 'erc20',
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
    kind: 'erc20',
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
    kind: 'erc20',
    name: 'Euro Coin',
    currency: 'Euro',
    flag: '🇪🇺',
    decimals: 6,
    addresses: {
      [base.id]: '0x60a3E35Cc302bFA44Cb288Bc5a4F316Fdb1adb42',
    },
  },

  // Monedas nativas: con estas se paga el gas de todo lo demas.
  //
  // OJO: no son un token con N direcciones, son un activo por red. Arbitrum y Base
  // usan ETH; Polygon usa POL, que es OTRO activo y no se suma con el ETH.
  ETH: {
    symbol: 'ETH',
    kind: 'native',
    name: 'Ether',
    currency: 'Ether',
    flag: 'Ξ',
    decimals: 18,
    addresses: {},
    chains: [arbitrum.id, base.id],
  },
  POL: {
    symbol: 'POL',
    kind: 'native',
    name: 'Polygon',
    currency: 'Polygon',
    flag: '⬣',
    decimals: 18,
    addresses: {},
    chains: [polygon.id],
  },

  // Activos de inversion. Solo en Base, que es donde estan los pools de Uniswap V4
  // con los que se compran. Verificados con scripts/verify-swap.mjs.
  //
  // No hay entrada para WETH a proposito: el ETH se compra NATIVO (currency 0x0 en
  // V4), que da mejor precio y cae en el saldo de ETH que el usuario ya ve.
  cbBTC: {
    symbol: 'cbBTC',
    kind: 'erc20',
    name: 'Coinbase Wrapped BTC',
    currency: 'Bitcoin',
    flag: '₿',
    decimals: 8,
    addresses: {
      [base.id]: '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf',
    },
  },
  VIRTUAL: {
    symbol: 'VIRTUAL',
    kind: 'erc20',
    name: 'Virtuals Protocol',
    currency: 'Virtuals',
    flag: '◈',
    decimals: 18,
    addresses: {
      [base.id]: '0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b',
    },
  },
}

/**
 * Orden en que se muestran en la home. ARGt primero (es el del milestone 1) y USDC
 * segundo: es el destino de "dolarizar", el producto estrella.
 */
export const TOKEN_ORDER: TokenSymbol[] = [
  'ARGt', 'USDC', 'USDT', 'EURC', 'BRAt', 'MEXt', 'CHLt', 'COLt', 'PERt', 'BOLt',
  'cbBTC', 'VIRTUAL', 'ETH', 'POL',
]

/** Monedas fuertes: el destino de dolarizar. */
export const HARD_TOKENS: TokenSymbol[] = ['USDC', 'USDT', 'EURC']

/** Las stablecoins que emite Twin, una por pais. */
export const TWIN_TOKENS: TokenSymbol[] = ['ARGt', 'BRAt', 'MEXt', 'CHLt', 'COLt', 'PERt', 'BOLt']

/** Con estas se paga el gas. Se muestran siempre, incluso en cero: no poder verlas
 *  es justo el problema que esta seccion resuelve. */
export const NATIVE_TOKENS: TokenSymbol[] = ['ETH', 'POL']

/** Lo que se puede comprar con dolares. ETH no esta aca aunque se pueda comprar:
 *  ya se muestra en "Para pagar red" y repetir la fila confunde. */
export const INVEST_TOKENS: TokenSymbol[] = ['cbBTC', 'VIRTUAL']

export function tokenAddress(symbol: TokenSymbol, chainId: SupportedChainId) {
  return TOKENS[symbol].addresses[chainId]
}

export function chainsForToken(symbol: TokenSymbol): SupportedChainId[] {
  const meta = TOKENS[symbol]
  // Las nativas no tienen direcciones: si se leyera `addresses` devolveria [], y
  // ese array vacio se propaga hasta CHAIN_META[undefined] y rompe los pickers.
  if (meta.kind === 'native') return meta.chains ?? []
  return Object.keys(meta.addresses).map(Number) as SupportedChainId[]
}

/**
 * Todos los pares (symbol, chainId) que se pueden leer con balanceOf.
 *
 * El filtro por kind NO es opcional: las nativas no tienen contrato, y meterlas en
 * el multicall no tira un error visible sino que devuelve failure -> 0n, o sea que
 * el saldo se mostraria en cero para siempre sin que nada avise.
 */
export function allTokenChainPairs(): { symbol: TokenSymbol; chainId: SupportedChainId }[] {
  return TOKEN_ORDER.filter((symbol) => TOKENS[symbol].kind === 'erc20').flatMap((symbol) =>
    chainsForToken(symbol).map((chainId) => ({ symbol, chainId })),
  )
}
