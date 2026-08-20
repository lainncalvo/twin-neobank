'use client'

import { TOKENS, type TokenSymbol } from '@/lib/tokens'
import { CHAIN_META, type SupportedChainId } from '@/lib/chains'
import { formatAmount } from '@/lib/format'
import { Card, Skeleton, cn } from './ui'

export function HeroBalance({
  symbol,
  total,
  byChain,
  loading,
}: {
  symbol: TokenSymbol
  total: bigint
  byChain: Partial<Record<SupportedChainId, bigint>>
  loading?: boolean
}) {
  const meta = TOKENS[symbol]
  const chains = Object.entries(byChain)
    .map(([id, value]) => ({ id: Number(id) as SupportedChainId, value: value ?? 0n }))
    .filter((c) => c.value > 0n)
    .sort((a, b) => (b.value > a.value ? 1 : -1))

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 text-sm text-ink-400">
        <span className="text-base">{meta.flag}</span>
        {meta.currency}
      </div>

      {loading ? (
        <Skeleton className="mt-3 h-10 w-48" />
      ) : (
        <p className="mt-2 font-mono text-4xl font-semibold tracking-tight tabular-nums">
          <span className="text-ink-400">$</span> {formatAmount(total, meta.decimals)}
        </p>
      )}

      {chains.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-2">
          {chains.map((c) => (
            <span
              key={c.id}
              className="inline-flex items-center gap-1.5 rounded-full border border-ink-800 px-2.5 py-1 text-[11px] text-ink-300"
            >
              <span
                className="size-1.5 rounded-full"
                style={{ background: CHAIN_META[c.id].color }}
              />
              {CHAIN_META[c.id].name}
              <span className="font-mono tabular-nums text-ink-400">
                {formatAmount(c.value, meta.decimals)}
              </span>
            </span>
          ))}
        </div>
      )}
    </Card>
  )
}

export function TokenRow({
  symbol,
  total,
  loading,
  onClick,
  subtitle,
}: {
  symbol: TokenSymbol
  total: bigint
  loading?: boolean
  onClick?: () => void
  /** Pisa el simbolo en la segunda linea. Las nativas muestran en que redes viven. */
  subtitle?: string
}) {
  const meta = TOKENS[symbol]
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        'flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors',
        onClick && 'hover:bg-ink-850',
      )}
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-ink-800 text-lg">
        {meta.flag}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{meta.currency}</span>
        <span className="block text-xs text-ink-400">{subtitle ?? meta.symbol}</span>
      </span>
      {loading ? (
        <Skeleton className="h-5 w-20" />
      ) : (
        <span className="font-mono text-sm tabular-nums">{formatAmount(total, meta.decimals)}</span>
      )}
    </button>
  )
}
