'use client'

import Link from 'next/link'
import { useAccount } from 'wagmi'
import { AppShell } from '@/components/AppShell'
import { HeroBalance, TokenRow } from '@/components/BalanceCard'
import { Card } from '@/components/ui'
import { useBalances, type TokenBalance } from '@/hooks/useBalances'
import { useHistory } from '@/hooks/useHistory'
import { useVaultPosition } from '@/hooks/useVault'
import { MovementRow } from '@/components/MovementRow'
import { formatAmount } from '@/lib/format'
import {
  chainsForToken, HARD_TOKENS, INVEST_TOKENS, NATIVE_TOKENS, TWIN_TOKENS, type TokenSymbol,
} from '@/lib/tokens'
import { CHAIN_META } from '@/lib/chains'

const ACTIONS = [
  { href: '/enviar', label: 'Enviar', icon: 'M17 3 3 9.2l5.3 2.1L10.4 17 17 3Z' },
  { href: '/recibir', label: 'Recibir', icon: 'M10 3v9.2l3.2-3.2 1.4 1.4-5.6 5.6-5.6-5.6 1.4-1.4L8 12.2V3h2Z' },
  { href: '/ahorro', label: 'Ahorrar', icon: 'M3 6.5A2.5 2.5 0 0 1 5.5 4h9A2.5 2.5 0 0 1 17 6.5v7a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 3 13.5v-7Zm10.5 5.5a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5Z' },
  { href: '/mover', label: 'Mover', icon: 'M6.5 3 2 7.5l4.5 4.5V9h7V6h-7V3Zm7 6v3h-7v3h7v3L18 13.5 13.5 9Z' },
  // Van en la grilla y no en la barra de abajo: la barra se queda en 4 destinos.
  { href: '/invertir', label: 'Invertir', icon: 'M3 15.5 8 10l3.2 3.2L17 6.6V11h2V3h-8v2h4.4l-4.4 5-3.2-3.2L1.6 14l1.4 1.5Z' },
  { href: '/cambiar', label: 'Dolarizar', icon: 'M10.8 2.5v1.6c1.7.2 2.9 1.1 3 2.6h-1.9c-.1-.7-.6-1.2-1.6-1.3v3l.8.2c1.9.4 2.9 1.3 2.9 2.9 0 1.7-1.2 2.7-3.2 2.9v1.6H9.2v-1.6c-1.9-.2-3.1-1.2-3.2-2.8h1.9c.1.8.7 1.3 1.7 1.4v-3.1l-.7-.2C7 9.7 6 8.9 6 7.3c0-1.6 1.2-2.6 3.2-2.8V2.5h1.6ZM9.2 5.4c-.8.1-1.3.5-1.3 1.2 0 .6.4 1 1.3 1.2V5.4Zm1.6 8.1c.9-.1 1.4-.6 1.4-1.2 0-.6-.4-1-1.4-1.3v2.5Z' },
]

export default function HomePage() {
  return (
    <AppShell>
      <Home />
    </AppShell>
  )
}

function Home() {
  const { address } = useAccount()
  const { balances, all, isLoading } = useBalances(address)
  const argt = balances.get('ARGt')!
  const vault = useVaultPosition(address)
  const { movements } = useHistory(address)
  const recent = movements.slice(0, 3)
  const bySymbol = (s: TokenSymbol) => all.find((b) => b.symbol === s)
  const hard = HARD_TOKENS.map(bySymbol).filter(Boolean) as TokenBalance[]
  const region = TWIN_TOKENS.filter((s) => s !== 'ARGt')
    .map(bySymbol)
    .filter(Boolean) as TokenBalance[]
  const native = NATIVE_TOKENS.map(bySymbol).filter(Boolean) as TokenBalance[]
  const invest = INVEST_TOKENS.map(bySymbol).filter(Boolean) as TokenBalance[]

  return (
    <div className="space-y-6">
      <HeroBalance
        symbol="ARGt"
        total={argt.total}
        byChain={argt.byChain}
        loading={isLoading}
      />

      <div className="grid grid-cols-3 gap-2">
        {ACTIONS.map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className="flex flex-col items-center gap-2 rounded-xl border border-ink-800 bg-ink-900/60 px-1 py-3 text-[10px] font-medium text-ink-300 transition-colors hover:border-ink-600 hover:text-ink-100"
          >
            <svg viewBox="0 0 20 20" className="size-5" fill="currentColor" aria-hidden>
              <path d={a.icon} />
            </svg>
            {a.label}
          </Link>
        ))}
      </div>

      {vault.assets !== undefined && vault.assets > 0n && (
        <Link href="/ahorro" className="block">
          <Card className="flex items-center gap-3 p-4 transition-colors hover:border-ink-600">
            <span className="grid size-10 place-items-center rounded-full bg-mint-400/10 text-mint-400">
              <svg viewBox="0 0 20 20" className="size-5" fill="currentColor" aria-hidden>
                <path d="M3 15.5 8 10l3 3 6-7v9.5H3Z" />
              </svg>
            </span>
            <span className="flex-1">
              <span className="block text-sm font-medium">En ahorro</span>
              <span className="block text-xs text-ink-400">ARGt Prime · Arbitrum</span>
            </span>
            <span className="font-mono text-sm tabular-nums text-mint-400">
              {formatAmount(vault.assets, 18)}
            </span>
          </Card>
        </Link>
      )}

      {/* Los dolares van primero y se muestran aunque esten en cero: es el destino
          de /cambiar, y en la demo se los ve llenarse. */}
      <section>
        <h2 className="px-3 pb-1 text-xs font-medium uppercase tracking-wide text-ink-400">
          Dólares y euros
        </h2>
        <Card className="divide-y divide-ink-800/70 p-1">
          {hard.map((b) => (
            <TokenRow key={b.symbol} symbol={b.symbol} total={b.total} loading={isLoading} />
          ))}
        </Card>
      </section>

      <section>
        <h2 className="px-3 pb-1 text-xs font-medium uppercase tracking-wide text-ink-400">
          Monedas de la región
        </h2>
        <Card className="divide-y divide-ink-800/70 p-1">
          {region.map((b) => (
            <TokenRow key={b.symbol} symbol={b.symbol} total={b.total} loading={isLoading} />
          ))}
        </Card>
      </section>

      <section>
        <h2 className="px-3 pb-1 text-xs font-medium uppercase tracking-wide text-ink-400">
          Inversiones
        </h2>
        <Card className="divide-y divide-ink-800/70 p-1">
          {invest.map((b) => (
            <TokenRow key={b.symbol} symbol={b.symbol} total={b.total} loading={isLoading} />
          ))}
        </Card>
        <p className="px-3 pt-1 text-[11px] text-ink-600">
          Se compran con dólares desde Invertir. El ETH aparece en “Para pagar red”.
        </p>
      </section>

      {/* Con estas se paga el gas. Van siempre, aunque esten en cero: no poder ver
          cuanto gas hay es exactamente el problema que esta seccion resuelve. */}
      <section>
        <h2 className="px-3 pb-1 text-xs font-medium uppercase tracking-wide text-ink-400">
          Para pagar red
        </h2>
        <Card className="divide-y divide-ink-800/70 p-1">
          {native.map((b) => (
            <TokenRow
              key={b.symbol}
              symbol={b.symbol}
              total={b.total}
              loading={isLoading}
              subtitle={chainsForToken(b.symbol)
                .map((id) => CHAIN_META[id].name)
                .join(' · ')}
            />
          ))}
        </Card>
      </section>

      {recent.length > 0 && (
        <section>
          <div className="flex items-baseline justify-between px-3 pb-1">
            <h2 className="text-xs font-medium uppercase tracking-wide text-ink-400">
              Movimientos
            </h2>
            <Link href="/movimientos" className="text-[11px] text-mint-400 hover:underline">
              Ver todos
            </Link>
          </div>
          <Card className="divide-y divide-ink-800/70 p-1">
            {recent.map((m) => (
              <MovementRow key={m.id} movement={m} />
            ))}
          </Card>
        </section>
      )}

      <p className="px-2 pb-4 text-[11px] leading-relaxed text-ink-600">
        Twin Stablecoins son instrumentos de pago digital respaldados por reservas. No son valores
        negociables ni productos de inversión.
      </p>
    </div>
  )
}
