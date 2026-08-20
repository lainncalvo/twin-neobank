'use client'

import { useEstimateFeesPerGas } from 'wagmi'
import { NATIVE_GAS_RESERVE, NATIVE_TRANSFER_GAS, type SupportedChainId } from '@/lib/chains'
import { TOKENS, type TokenSymbol } from '@/lib/tokens'

/** Margen sobre la estimacion en vivo: cubre picos de precio entre cotizar y firmar. */
const LIVE_MULTIPLIER = 3n

/**
 * Cuanto se puede enviar de verdad cuando la moneda es la nativa.
 *
 * El gas se paga con la misma moneda que se envia, asi que ofrecer el 100% del
 * saldo arma una transaccion que falla siempre. Hay que reservar.
 *
 * No es un detalle uniforme: en Base la reserva es polvo y en Polygon son 0,02 POL,
 * que sobre un saldo chico es una parte real.
 *
 * La reserva es el mayor entre un piso fijo por red y la estimacion en vivo. Con
 * los precios de hoy gana el piso en las tres redes, y eso es deseable: el numero
 * queda quieto mientras el usuario lo mira y no depende de que el RPC conteste.
 *
 * Para un ERC-20 no aplica: el gas se paga con otra moneda, asi que se puede mandar
 * el saldo entero.
 */
export function useGasReserve({
  symbol,
  chainId,
  balance,
}: {
  symbol: TokenSymbol
  chainId: SupportedChainId
  balance: bigint
}) {
  const isNative = TOKENS[symbol].kind === 'native'

  // Una sola consulta por red: la clave no depende del monto ni del destino, asi
  // que no se dispara con cada tecla.
  const fees = useEstimateFeesPerGas({
    chainId,
    query: { enabled: isNative, refetchInterval: 30_000 },
  })

  if (!isNative) return { isNative, reserve: 0n, sendable: balance }

  const maxFee = fees.data?.maxFeePerGas
  const live = maxFee !== undefined ? NATIVE_TRANSFER_GAS * maxFee * LIVE_MULTIPLIER : 0n
  const floor = NATIVE_GAS_RESERVE[chainId]
  const reserve = live > floor ? live : floor

  const sendable = balance > reserve ? balance - reserve : 0n
  return { isNative, reserve, sendable }
}
