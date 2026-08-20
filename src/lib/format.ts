import { formatUnits, parseUnits } from 'viem'
import { BRIDGE_DUST_UNIT } from './chains'

/** Formato de plata al estilo local: 1.234,56 */
export function formatAmount(value: bigint, decimals = 18, maxFraction = 2) {
  const raw = formatUnits(value, decimals)
  const n = Number(raw)
  if (!Number.isFinite(n)) return raw
  // Montos chicos pero no cero: mostrar mas decimales antes que "0,00".
  const fraction = n > 0 && n < 0.01 ? 6 : maxFraction
  return new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: n === 0 ? 2 : 2,
    maximumFractionDigits: fraction,
  }).format(n)
}

export function parseAmount(input: string, decimals = 18): bigint | null {
  const clean = input.trim().replace(/\./g, '').replace(',', '.')
  if (!clean || !/^\d*\.?\d*$/.test(clean)) return null
  try {
    return parseUnits(clean, decimals)
  } catch {
    return null
  }
}

/**
 * El OFT adapter tiene sharedDecimals=6 sobre un token de 18: LayerZero trunca
 * el monto a multiplos de 1e12 y el resto se pierde. Redondeamos nosotros para
 * que el usuario vea exactamente lo que se manda.
 */
export function truncateToBridgeUnit(value: bigint): bigint {
  return (value / BRIDGE_DUST_UNIT) * BRIDGE_DUST_UNIT
}

export function shortAddress(address?: string) {
  if (!address) return ''
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

export function formatEth(value: bigint) {
  const n = Number(formatUnits(value, 18))
  if (n === 0) return '0'
  if (n < 0.000001) return '<0,000001'
  return new Intl.NumberFormat('es-AR', { maximumFractionDigits: 6 }).format(n)
}

export function isAddressLike(value: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(value.trim())
}
