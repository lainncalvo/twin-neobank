'use client'

import { TOKENS, chainsForToken, type TokenSymbol } from '@/lib/tokens'
import { CHAIN_META, explorerTx, type SupportedChainId } from '@/lib/chains'
import { formatAmount } from '@/lib/format'
import { Card, Label, Spinner, cn } from './ui'

export function AmountInput({
  value,
  onChange,
  symbol,
  max,
  onMax,
  hint,
}: {
  value: string
  onChange: (v: string) => void
  symbol: TokenSymbol
  max?: bigint
  onMax?: () => void
  hint?: string
}) {
  const meta = TOKENS[symbol]
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <Label>Monto</Label>
        {max !== undefined && (
          <button
            type="button"
            onClick={onMax}
            className="text-xs text-ink-400 transition-colors hover:text-mint-400"
          >
            Disponible{' '}
            <span className="font-mono tabular-nums">{formatAmount(max, meta.decimals)}</span>
          </button>
        )}
      </div>
      <div className="flex items-center gap-2 rounded-xl border border-ink-800 bg-ink-900 px-4 py-3 focus-within:border-ink-600">
        <span className="text-lg text-ink-400">$</span>
        <input
          inputMode="decimal"
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^\d.,]/g, ''))}
          placeholder="0,00"
          className="min-w-0 flex-1 bg-transparent font-mono text-2xl tabular-nums outline-none placeholder:text-ink-700"
        />
        <span className="shrink-0 text-sm font-medium text-ink-400">{meta.symbol}</span>
      </div>
      {hint && <p className="text-xs text-ink-400">{hint}</p>}
    </div>
  )
}

export function TokenPicker({
  value,
  onChange,
  options,
}: {
  value: TokenSymbol
  onChange: (s: TokenSymbol) => void
  options: TokenSymbol[]
}) {
  return (
    <div className="space-y-2">
      <Label>Moneda</Label>
      <div className="flex flex-wrap gap-2">
        {options.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onChange(s)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm transition-colors',
              value === s
                ? 'border-mint-400 bg-mint-400/10 text-mint-400'
                : 'border-ink-800 text-ink-300 hover:border-ink-600',
            )}
          >
            <span>{TOKENS[s].flag}</span>
            {s}
          </button>
        ))}
      </div>
    </div>
  )
}

export function ChainPicker({
  label,
  value,
  onChange,
  symbol,
  exclude,
  balances,
}: {
  label: string
  value: SupportedChainId
  onChange: (id: SupportedChainId) => void
  symbol: TokenSymbol
  exclude?: SupportedChainId
  balances?: Partial<Record<SupportedChainId, bigint>>
}) {
  const options = chainsForToken(symbol).filter((id) => id !== exclude)
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="grid gap-2">
        {options.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            className={cn(
              'flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors',
              value === id
                ? 'border-mint-400 bg-mint-400/5'
                : 'border-ink-800 hover:border-ink-600',
            )}
          >
            <span className="size-2 rounded-full" style={{ background: CHAIN_META[id].color }} />
            <span className="flex-1 text-sm font-medium">{CHAIN_META[id].name}</span>
            {balances?.[id] !== undefined && (
              <span className="font-mono text-xs tabular-nums text-ink-400">
                {formatAmount(balances[id]!, TOKENS[symbol].decimals)}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}

export function TxStatus({
  step,
  chainId,
  hash,
  extraLink,
}: {
  step: string | null
  chainId: SupportedChainId
  hash?: string | null
  extraLink?: { href: string; label: string }
}) {
  if (!step && !hash) return null
  return (
    <Card className="space-y-2 p-4">
      {step && (
        <p className="flex items-center gap-2 text-sm text-ink-300">
          <Spinner className="size-3.5 text-mint-400" />
          {step}
        </p>
      )}
      {hash && (
        <a
          href={explorerTx(chainId, hash)}
          target="_blank"
          rel="noreferrer"
          className="block truncate font-mono text-xs text-mint-400 underline-offset-2 hover:underline"
        >
          Ver en el explorador ↗
        </a>
      )}
      {extraLink && (
        <a
          href={extraLink.href}
          target="_blank"
          rel="noreferrer"
          className="block text-xs text-mint-400 underline-offset-2 hover:underline"
        >
          {extraLink.label} ↗
        </a>
      )}
    </Card>
  )
}

export function SuccessCard({
  title,
  detail,
  chainId,
  hash,
  onDone,
  extraLink,
}: {
  title: string
  detail?: string
  chainId: SupportedChainId
  hash?: string | null
  onDone: () => void
  extraLink?: { href: string; label: string }
}) {
  return (
    <Card className="space-y-4 border-mint-400/30 bg-mint-400/5 p-6 text-center">
      <span className="mx-auto grid size-12 place-items-center rounded-full bg-mint-400 text-ink-950">
        <svg viewBox="0 0 20 20" className="size-6" fill="currentColor" aria-hidden>
          <path d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0l-3.5-3.5a1 1 0 1 1 1.4-1.4l2.8 2.8 6.8-6.8a1 1 0 0 1 1.4 0Z" />
        </svg>
      </span>
      <div>
        <p className="text-base font-semibold">{title}</p>
        {detail && <p className="mt-1 text-sm text-ink-400">{detail}</p>}
      </div>
      <div className="space-y-1.5">
        {hash && (
          <a
            href={explorerTx(chainId, hash)}
            target="_blank"
            rel="noreferrer"
            className="block text-xs text-mint-400 underline-offset-2 hover:underline"
          >
            Ver en el explorador ↗
          </a>
        )}
        {extraLink && (
          <a
            href={extraLink.href}
            target="_blank"
            rel="noreferrer"
            className="block text-xs text-mint-400 underline-offset-2 hover:underline"
          >
            {extraLink.label} ↗
          </a>
        )}
      </div>
      <button
        onClick={onDone}
        className="w-full rounded-xl border border-ink-700 py-3 text-sm font-medium transition-colors hover:bg-ink-800"
      >
        Listo
      </button>
    </Card>
  )
}
