import { base } from 'wagmi/chains'
import { PERMIT2, UNIVERSAL_ROUTER, V4_QUOTER, type SupportedChainId } from './chains'
import { TOKENS, type TokenSymbol } from './tokens'

export const NATIVE_CURRENCY = '0x0000000000000000000000000000000000000000' as const

export type PoolKey = {
  currency0: `0x${string}`
  currency1: `0x${string}`
  fee: number
  tickSpacing: number
  hooks: `0x${string}`
}

export type SwapRoute = {
  id: string
  chainId: SupportedChainId
  from: TokenSymbol
  to: TokenSymbol
  poolKey: PoolKey
  /** Derivado, nunca escrito a mano. Ver el comentario de `buildRoute`. */
  zeroForOne: boolean
  slippageBps: bigint
  /** Texto honesto sobre la profundidad de ESTE pool. Se muestra en la pantalla. */
  note: string
}

/** En V4 la moneda nativa se referencia como address cero, no como WETH. */
function swapAddress(symbol: TokenSymbol, chainId: SupportedChainId): `0x${string}` {
  const meta = TOKENS[symbol]
  if (meta.kind === 'native') return NATIVE_CURRENCY
  const address = meta.addresses[chainId]
  if (!address) throw new Error(`${symbol} no existe en la red ${chainId}`)
  return address
}

/**
 * Arma la ruta ordenando las currencies, que es lo que exige V4: currency0 es
 * SIEMPRE la address menor.
 *
 * `zeroForOne` se DERIVA de esa comparacion y nunca se escribe a mano, porque el
 * orden no es uniforme entre pares: USDC es la menor frente a ARGt y cbBTC, pero
 * la mayor frente a VIRTUAL, y la nativa (0x0) es la menor frente a todo.
 * Hardcodearlo hace que parte de las rutas opere al reves, y el revert que se
 * obtiene no lo dice.
 */
function buildRoute(
  opts: {
    from: TokenSymbol
    to: TokenSymbol
    fee: number
    tickSpacing: number
    slippageBps: bigint
    note: string
  },
  chainId: SupportedChainId = base.id,
): SwapRoute {
  const fromAddress = swapAddress(opts.from, chainId)
  const toAddress = swapAddress(opts.to, chainId)
  const fromIsFirst = fromAddress.toLowerCase() < toAddress.toLowerCase()
  return {
    id: `${opts.from}-${opts.to}`,
    chainId,
    from: opts.from,
    to: opts.to,
    zeroForOne: fromIsFirst,
    poolKey: {
      currency0: fromIsFirst ? fromAddress : toAddress,
      currency1: fromIsFirst ? toAddress : fromAddress,
      fee: opts.fee,
      tickSpacing: opts.tickSpacing,
      hooks: NATIVE_CURRENCY,
    },
    slippageBps: opts.slippageBps,
    note: opts.note,
  }
}

/**
 * Las rutas verificadas con scripts/verify-swap.mjs. Cada una tiene su propia
 * tolerancia: un pool de USD 700 no aguanta lo mismo que uno donde USD 10.000
 * mueven 0,06%.
 */
export const SWAP_ROUTES = {
  // Dolarizar. Impacto medido a 100.000 ARGt: 0,21%. Techo del pool ~372.000 ARGt.
  'ARGt-USDC': buildRoute({
    from: 'ARGt', to: 'USDC', fee: 3000, tickSpacing: 60, slippageBps: 100n,
    note: 'Es un mercado chico (unos USD 700 de liquidez), así que los montos grandes pagan más: hasta 10.000 ARGt el costo ronda el 0,4%.',
  }),
  // Impacto medido a 10.000 USDC: 0,02%. Es el pool mas profundo de los cuatro.
  'USDC-cbBTC': buildRoute({
    from: 'USDC', to: 'cbBTC', fee: 500, tickSpacing: 10, slippageBps: 50n,
    note: 'Mercado profundo: US$10.000 mueven el precio menos del 0,05%.',
  }),
  // ETH NATIVO, no WETH: mejor precio (0,06% contra 1,34% de impacto a 10.000 USDC)
  // y el ETH cae en el saldo que el usuario ya tiene, sin token envuelto.
  'USDC-ETH': buildRoute({
    from: 'USDC', to: 'ETH', fee: 3000, tickSpacing: 60, slippageBps: 100n,
    note: 'Mercado profundo: US$10.000 mueven el precio menos del 0,1%.',
  }),
  // Impacto medido a 10.000 USDC: 3,54%. El mas fino de los tres, por eso mas tolerancia.
  'USDC-VIRTUAL': buildRoute({
    from: 'USDC', to: 'VIRTUAL', fee: 3000, tickSpacing: 60, slippageBps: 200n,
    note: 'Mercado mediano: US$10.000 mueven el precio alrededor del 3,5%.',
  }),
} as const satisfies Record<string, SwapRoute>

export type SwapRouteId = keyof typeof SWAP_ROUTES

/** Da vuelta una ruta para vender en lugar de comprar. Es el mismo pool. */
export function reverseRoute(route: SwapRoute): SwapRoute {
  return {
    ...route,
    id: `${route.to}-${route.from}`,
    from: route.to,
    to: route.from,
    zeroForOne: !route.zeroForOne,
  }
}

/** Los activos que se pueden comprar con dolares. */
export const INVEST_ROUTES: SwapRouteId[] = ['USDC-cbBTC', 'USDC-ETH', 'USDC-VIRTUAL']

export const SWAP_VENUE = { quoter: V4_QUOTER, router: UNIVERSAL_ROUTER, permit2: PERMIT2 }
