'use client'

import type { Movement } from '@/hooks/useHistory'
import { CHAIN_META, explorerTx } from '@/lib/chains'
import { formatAmount, shortAddress } from '@/lib/format'
import { TOKENS } from '@/lib/tokens'

const ICON = {
  in: 'M10 3v9.2l3.2-3.2 1.4 1.4-5.6 5.6-5.6-5.6 1.4-1.4L8 12.2V3h2Z',
  out: 'M17 3 3 9.2l5.3 2.1L10.4 17 17 3Z',
  swap: 'M6.5 3 2 7.5l4.5 4.5V9h7V6h-7V3Zm7 6v3h-7v3h7v3L18 13.5 13.5 9Z',
} as const

const amount = (symbol: keyof typeof TOKENS, value: bigint) =>
  `${formatAmount(value, TOKENS[symbol].decimals)} ${symbol}`

export function MovementRow({ movement: m }: { movement: Movement }) {
  const meta = CHAIN_META[m.chainId]
  return (
    <a
      href={explorerTx(m.chainId, m.txHash)}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-ink-800/40"
    >
      <span
        className={
          'flex size-10 shrink-0 items-center justify-center rounded-full ' +
          (m.kind === 'in'
            ? 'bg-mint-400/10 text-mint-400'
            : m.kind === 'swap'
              ? 'bg-mint-400/10 text-mint-400'
              : 'bg-ink-800 text-ink-300')
        }
      >
        <svg viewBox="0 0 20 20" className="size-4" fill="currentColor" aria-hidden>
          <path d={ICON[m.kind]} />
        </svg>
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-ink-100">{m.label}</span>
        <span className="flex items-center gap-1.5 text-[11px] text-ink-500">
          <span className="size-1.5 rounded-full" style={{ background: meta.color }} />
          {meta.name}
          <span className="text-ink-600">·</span>
          <span className="font-mono">{shortAddress(m.counterparty)}</span>
        </span>
      </span>

      <span className="shrink-0 text-right font-mono text-xs tabular-nums">
        {m.out && (
          <span className="block text-ink-300">−{amount(m.out.symbol, m.out.value)}</span>
        )}
        {m.in && (
          <span className="block text-mint-400">+{amount(m.in.symbol, m.in.value)}</span>
        )}
      </span>
    </a>
  )
}
