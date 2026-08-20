'use client'

import { useMemo, useState } from 'react'
import { useAccount } from 'wagmi'
import { AppShell } from '@/components/AppShell'
import { AmountInput, SuccessCard, TxStatus } from '@/components/inputs'
import { BackLink, Button, Card, ErrorNote, Label, cn } from '@/components/ui'
import { GasGuard } from '@/components/GasGuard'
import { useBalances } from '@/hooks/useBalances'
import { useSwap, type SwapStep } from '@/hooks/useSwap'
import { useGasReserve } from '@/hooks/useGasReserve'
import { INVEST_ROUTES, reverseRoute, SWAP_ROUTES, type SwapRouteId } from '@/lib/swap'
import { TOKENS } from '@/lib/tokens'
import { exactAmountInput, formatAmount, formatEth, parseAmount } from '@/lib/format'

type Mode = 'buy' | 'sell'

const STEP_LABEL: Record<SwapStep, string | null> = {
  idle: null,
  switching: 'Cambiando a Base...',
  'approving-token': 'Autorizando...',
  'approving-router': 'Autorizando el router...',
  swapping: 'Operando...',
  confirming: 'Confirmando en Base...',
  done: null,
}

export default function InvertirPage() {
  return (
    <AppShell>
      <Invertir />
    </AppShell>
  )
}

function Invertir() {
  const { address } = useAccount()
  const { balances, refetch } = useBalances(address)
  const [routeId, setRouteId] = useState<SwapRouteId>(INVEST_ROUTES[0])
  const [mode, setMode] = useState<Mode>('buy')
  const [amount, setAmount] = useState('')

  const buyRoute = SWAP_ROUTES[routeId]
  // Vender es el mismo pool con zeroForOne invertido. No hace falta otro encoding.
  const route = mode === 'buy' ? buyRoute : reverseRoute(buyRoute)

  const asset = buyRoute.to
  const decimalsIn = TOKENS[route.from].decimals
  const parsed = useMemo(() => parseAmount(amount, decimalsIn) ?? 0n, [amount, decimalsIn])
  const swap = useSwap({ amount: parsed, route })
  const busy = swap.step !== 'idle' && swap.step !== 'done'

  const byChain = balances.get(route.from)?.byChain ?? {}
  const balance = byChain[route.chainId] ?? 0n

  // Vender ETH tiene el mismo problema que enviarlo: el gas se paga con lo mismo,
  // asi que el saldo entero no es vendible.
  const { isNative, reserve, sendable } = useGasReserve({
    symbol: route.from,
    chainId: route.chainId,
    balance,
  })
  const available = sendable

  const problem = (() => {
    if (amount && parsed <= 0n) return 'Poné un monto válido.'
    if (isNative && balance > 0n && available === 0n) {
      return `Tu ${route.from} alcanza justo para la comisión de red.`
    }
    if (parsed > available) {
      return isNative
        ? `Dejá algo de ${route.from} para la comisión de red.`
        : `No te alcanza el saldo de ${route.from} en Base.`
    }
    return null
  })()

  const canSwap =
    parsed > 0n && parsed <= available && swap.amountOut !== undefined && !swap.quoteError && !busy

  const pick = (id: SwapRouteId) => {
    setRouteId(id)
    setAmount('')
    swap.reset()
  }

  const switchMode = (m: Mode) => {
    setMode(m)
    setAmount('')
    swap.reset()
  }

  if (swap.step === 'done') {
    return (
      <div className="space-y-6">
        <BackLink />
        <SuccessCard
          title={mode === 'buy' ? `Compraste ${asset}` : `Vendiste ${asset}`}
          detail={
            `${formatAmount(parsed, decimalsIn)} ${route.from} → ` +
            `${formatAmount(swap.amountOut ?? 0n, swap.decimalsOut)} ${route.to}`
          }
          chainId={route.chainId}
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
        <h1 className="text-2xl font-semibold tracking-tight">Invertir</h1>
        <p className="mt-1 text-sm text-ink-400">Comprá y vendé con tus dólares.</p>
      </div>

      <div>
        <Label>Activo</Label>
        <div className="mt-2 flex flex-wrap gap-2">
          {INVEST_ROUTES.map((id) => {
            const meta = TOKENS[SWAP_ROUTES[id].to]
            return (
              <button
                key={id}
                type="button"
                onClick={() => pick(id)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm transition-colors',
                  routeId === id
                    ? 'border-mint-400 bg-mint-400/10 text-mint-400'
                    : 'border-ink-800 text-ink-300 hover:border-ink-600',
                )}
              >
                <span>{meta.flag}</span>
                {meta.currency}
              </button>
            )
          })}
        </div>
      </div>

      {/* Comprar y vender son el mismo pool: sin la vuelta, la compra seria una
          trampa de la que no se puede salir. */}
      <div className="grid grid-cols-2 gap-1 rounded-xl border border-ink-800 p-1">
        {(['buy', 'sell'] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => switchMode(m)}
            className={cn(
              'rounded-lg py-2 text-sm font-medium transition-colors',
              mode === m ? 'bg-ink-800 text-ink-100' : 'text-ink-400 hover:text-ink-200',
            )}
          >
            {m === 'buy' ? 'Comprar' : 'Vender'}
          </button>
        ))}
      </div>

      <AmountInput
        value={amount}
        onChange={setAmount}
        symbol={route.from}
        max={available}
        onMax={() => setAmount(exactAmountInput(available, decimalsIn))}
        hint={
          isNative
            ? `Se reservan ${formatEth(reserve)} ${route.from} para la comisión de red.`
            : undefined
        }
      />

      {parsed > 0n && (
        <Card className="space-y-2 p-4 text-xs">
          <Line
            label="Recibís"
            value={
              swap.amountOut !== undefined
                ? `${formatAmount(swap.amountOut, swap.decimalsOut)} ${route.to}`
                : swap.isQuoting
                  ? 'Cotizando...'
                  : '—'
            }
            strong
          />
          <Line
            label="Precio"
            value={
              swap.amountOut !== undefined && swap.amountOut > 0n
                ? `1 ${route.to} = ${formatAmount(
                    (parsed * 10n ** BigInt(swap.decimalsOut)) / swap.amountOut,
                    decimalsIn,
                  )} ${route.from}`
                : '—'
            }
          />
          <Line
            label="Mínimo garantizado"
            value={
              swap.amountOutMin !== undefined
                ? `${formatAmount(swap.amountOutMin, swap.decimalsOut)} ${route.to}`
                : '—'
            }
          />
          <p className="pt-1 text-[11px] leading-relaxed text-ink-600">
            Se opera en el pool de Uniswap V4 en Base. {buyRoute.note}
          </p>
        </Card>
      )}

      {swap.approvalsNeeded > 0 && parsed > 0n && (
        <div>
          <Label>Primera vez con {route.from}</Label>
          <p className="mt-1 text-xs leading-relaxed text-ink-500">
            Vas a firmar {swap.approvalsNeeded + 1} veces: {swap.approvalsNeeded} para autorizar y
            una para operar. Los permisos quedan guardados por moneda, así que la próxima vez que
            uses {route.from} es una sola firma.
          </p>
        </div>
      )}

      <GasGuard chainId={route.chainId} />

      <ErrorNote>{problem || swap.quoteError || swap.error}</ErrorNote>

      <TxStatus step={STEP_LABEL[swap.step]} chainId={route.chainId} hash={swap.txHash} />

      <Button onClick={swap.swap} disabled={!canSwap} loading={busy}>
        {mode === 'buy' ? `Comprar ${asset}` : `Vender ${asset}`}
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
