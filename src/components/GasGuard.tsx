'use client'

import Link from 'next/link'
import { useAccount, useBalance } from 'wagmi'
import { CHAIN_META, chainById, type SupportedChainId } from '@/lib/chains'
import { Card } from './ui'

/**
 * La wallet embebida nace sin nada de gas, asi que la primera operacion de
 * cualquiera falla con un revert que no le dice nada al usuario. Mejor avisar
 * antes y mandarlo a fondearse.
 */
export function GasGuard({ chainId }: { chainId: SupportedChainId }) {
  const { address } = useAccount()
  const { data } = useBalance({ address, chainId })

  if (!data || data.value > 0n) return null

  const native = chainById(chainId)?.nativeCurrency.symbol ?? 'ETH'

  return (
    <Card className="border-amber-500/25 bg-amber-500/5 p-4">
      <p className="text-sm font-medium text-amber-200">
        Te falta {native} en {CHAIN_META[chainId].name}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-ink-400">
        Las operaciones en {CHAIN_META[chainId].name} se pagan en {native} y tu cuenta no tiene.
        Mandate una fracción chica a tu dirección para poder firmar.
      </p>
      <Link
        href="/recibir"
        className="mt-3 inline-block text-xs font-medium text-amber-200 underline-offset-2 hover:underline"
      >
        Ver mi dirección →
      </Link>
    </Card>
  )
}
