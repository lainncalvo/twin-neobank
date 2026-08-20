'use client'

import Link from 'next/link'
import { useAccount } from 'wagmi'
import { AppShell } from '@/components/AppShell'
import { HeroBalance, TokenRow } from '@/components/BalanceCard'
import { Card } from '@/components/ui'
import { useBalances, type TokenBalance } from '@/hooks/useBalances'
import { useVaultPosition } from '@/hooks/useVault'
import { formatAmount } from '@/lib/format'
import { HARD_TOKENS, TWIN_TOKENS, type TokenSymbol } from '@/lib/tokens'

const ACTIONS = [
  { href: '/enviar', label: 'Enviar', icon: 'M17 3 3 9.2l5.3 2.1L10.4 17 17 3Z' },
  { href: '/recibir', label: 'Recibir', icon: 'M10 3v9.2l3.2-3.2 1.4 1.4-5.6 5.6-5.6-5.6 1.4-1.4L8 12.2V3h2Z' },
  { href: '/ahorro', label: 'Ahorrar', icon: 'M3 6.5A2.5 2.5 0 0 1 5.5 4h9A2.5 2.5 0 0 1 17 6.5v7a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 3 13.5v-7Zm10.5 5.5a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5Z' },
  { href: '/mover', label: 'Mover', icon: 'M6.5 3 2 7.5l4.5 4.5V9h7V6h-7V3Zm7 6v3h-7v3h7v3L18 13.5 13.5 9Z' },
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
  const bySymbol = (s: TokenSymbol) => all.find((b) => b.symbol === s)
  const hard = HARD_TOKENS.map(bySymbol).filter(Boolean) as TokenBalance[]
  const region = TWIN_TOKENS.filter((s) => s !== 'ARGt')
    .map(bySymbol)
    .filter(Boolean) as TokenBalance[]

  return (
    <div className="space-y-6">
      <HeroBalance
        symbol="ARGt"
        total={argt.total}
        byChain={argt.byChain}
        loading={isLoading}
      />

      <div className="grid grid-cols-4 gap-2">
        {ACTIONS.map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className="flex flex-col items-center gap-2 rounded-xl border border-ink-800 bg-ink-900/60 py-3 text-[11px] font-medium text-ink-300 transition-colors hover:border-ink-600 hover:text-ink-100"
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

      <p className="px-2 pb-4 text-[11px] leading-relaxed text-ink-600">
        Twin Stablecoins son instrumentos de pago digital respaldados por reservas. No son valores
        negociables ni productos de inversión.
      </p>
    </div>
  )
}
