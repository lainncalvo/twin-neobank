'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useAccount } from 'wagmi'
import { AppShell } from '@/components/AppShell'
import { AmountInput, SuccessCard, TxStatus } from '@/components/inputs'
import { BackLink, Button, Card, ErrorNote, Label } from '@/components/ui'
import { GasGuard } from '@/components/GasGuard'
import { useBalances } from '@/hooks/useBalances'
import { useSwap, type SwapStep } from '@/hooks/useSwap'
import { SWAP_CHAIN_ID } from '@/lib/chains'
import { SWAP_ROUTES } from '@/lib/swap'
import { TOKENS } from '@/lib/tokens'
import { exactAmountInput, formatAmount, parseAmount } from '@/lib/format'

const STEP_LABEL: Record<SwapStep, string | null> = {
  idle: null,
  switching: 'Cambiando a Base...',
  'approving-token': 'Autorizando ARGt...',
  'approving-router': 'Autorizando el router...',
  swapping: 'Cambiando...',
  confirming: 'Confirmando en Base...',
  done: null,
}

export default function CambiarPage() {
  return (
    <AppShell>
      <Cambiar />
    </AppShell>
  )
}

function Cambiar() {
  const { address } = useAccount()
  const { balances, refetch } = useBalances(address)
  const [amount, setAmount] = useState('')

  const byChain = balances.get('ARGt')?.byChain ?? {}
  const enBase = byChain[SWAP_CHAIN_ID] ?? 0n
  const enOtrasRedes = (balances.get('ARGt')?.total ?? 0n) - enBase

  const route = SWAP_ROUTES['ARGt-USDC']
  const decimalsIn = TOKENS[route.from].decimals
  const parsed = useMemo(() => parseAmount(amount, decimalsIn) ?? 0n, [amount, decimalsIn])
  const swap = useSwap({ amount: parsed, route })
  const busy = swap.step !== 'idle' && swap.step !== 'done'

  const problem = (() => {
    if (amount && parsed <= 0n) return 'Poné un monto válido.'
    if (parsed > enBase) return 'No te alcanza el saldo en Base.'
    return null
  })()

  const canSwap =
    parsed > 0n && parsed <= enBase && swap.amountOut !== undefined && !swap.quoteError && !busy

  if (swap.step === 'done') {
    return (
      <div className="space-y-6">
        <BackLink />
        <SuccessCard
          title="Ya tenés dólares"
          detail={`${formatAmount(parsed, decimalsIn)} ARGt → ${formatAmount(swap.amountOut ?? 0n, swap.decimalsOut)} USDC`}
          chainId={SWAP_CHAIN_ID}
          hash={swap.txHash}
          onDone={() => {
            swap.reset()
            setAmount('')
            refetch()
          }}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <BackLink />

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dolarizar</h1>
        <p className="mt-1 text-sm text-ink-400">Pasá tus pesos a dólares al instante.</p>
      </div>

      {/* Ruta fija, no un selector: hay un solo par con liquidez y un solo sentido
          que el mercado banca. Mostrarlo asi es mas honesto que un picker que
          falla en casi todas las combinaciones. */}
      <Card className="flex items-center justify-center gap-3 p-4">
        <span className="text-sm font-medium">{TOKENS.ARGt.flag} ARGt</span>
        <svg viewBox="0 0 20 20" className="size-4 text-ink-500" fill="currentColor" aria-hidden>
          <path d="M9 4v3h-7v2h7v3l5-4-5-4Z" />
        </svg>
        <span className="text-sm font-medium">{TOKENS.USDC.flag} USDC</span>
        <span className="rounded-full border border-ink-700 px-2 py-0.5 text-[11px] text-ink-400">
          Base
        </span>
      </Card>

      {/* Sin esto el usuario ve el boton gris y no entiende por que: tiene pesos,
          pero en otra red. */}
      {enBase === 0n && enOtrasRedes > 0n && (
        <Card className="border-amber-500/30 bg-amber-500/5 p-4 text-sm">
          <p className="text-ink-300">
            Tenés {formatAmount(enOtrasRedes)} ARGt en otras redes. Para dolarizarlos primero
            movelos a Base.
          </p>
          <Link href="/mover" className="mt-2 inline-block text-mint-400 hover:underline">
            Mover a Base →
          </Link>
        </Card>
      )}

      <AmountInput
        value={amount}
        onChange={setAmount}
        symbol="ARGt"
        max={enBase}
        onMax={() => setAmount(exactAmountInput(enBase, decimalsIn))}
      />

      {parsed > 0n && (
        <Card className="space-y-2 p-4 text-xs">
          <Line
            label="Recibís"
            value={
              swap.amountOut !== undefined
                ? `${formatAmount(swap.amountOut, swap.decimalsOut)} USDC`
                : swap.isQuoting
                  ? 'Cotizando...'
                  : '—'
            }
            strong
          />
          <Line
            label="Cotización"
            value={
              swap.amountOut !== undefined && swap.amountOut > 0n
                ? `1 USDC = ${formatAmount(
                    (parsed * 10n ** BigInt(swap.decimalsOut)) / swap.amountOut,
                    decimalsIn,
                  )} ARGt`
                : '—'
            }
          />
          <Line
            label="Mínimo garantizado"
            value={
              swap.amountOutMin !== undefined
                ? `${formatAmount(swap.amountOutMin, swap.decimalsOut)} USDC`
                : '—'
            }
          />
          <p className="pt-1 text-[11px] leading-relaxed text-ink-600">
            El cambio se hace en el pool de Uniswap V4 que usa Twin. {route.note} Por ahora solo en
            este sentido: el de vuelta todavía no tiene profundidad.
          </p>
        </Card>
      )}

      {swap.approvalsNeeded > 0 && parsed > 0n && (
        <div>
          <Label>Primera vez</Label>
          <p className="mt-1 text-xs leading-relaxed text-ink-500">
            Vas a firmar {swap.approvalsNeeded + 1} veces: {swap.approvalsNeeded} para autorizar y
            una para cambiar. Los permisos quedan guardados, así que la próxima es una sola firma.
          </p>
        </div>
      )}

      <GasGuard chainId={SWAP_CHAIN_ID} />

      <ErrorNote>{problem || swap.quoteError || swap.error}</ErrorNote>

      <TxStatus step={STEP_LABEL[swap.step]} chainId={SWAP_CHAIN_ID} hash={swap.txHash} />

      <Button onClick={swap.swap} disabled={!canSwap} loading={busy}>
        Cambiar a dólares
      </Button>
    </div>
  )
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-ink-400">{label}</span>
      <span
        className={
          strong
            ? 'font-mono tabular-nums text-sm font-semibold text-mint-400'
            : 'font-mono tabular-nums text-ink-200'
        }
      >
        {value}
      </span>
    </div>
  )
}
