'use client'

import { useMemo, useState } from 'react'
import { useAccount } from 'wagmi'
import { AppShell } from '@/components/AppShell'
import { AmountInput, ChainPicker, SuccessCard, TxStatus } from '@/components/inputs'
import { BackLink, Button, Card, ErrorNote } from '@/components/ui'
import { useBalances } from '@/hooks/useBalances'
import { layerZeroScanUrl, useBridge, type BridgeStep } from '@/hooks/useBridge'
import { CHAIN_META, chainById, type SupportedChainId } from '@/lib/chains'
import { chainsForToken } from '@/lib/tokens'
import { formatAmount, formatEth, parseAmount } from '@/lib/format'

const ROUTE_CHAINS = chainsForToken('ARGt')

const STEP_LABEL: Record<BridgeStep, string | null> = {
  idle: null,
  switching: 'Cambiando de red...',
  approving: 'Autorizando el puente (1 de 2)...',
  sending: 'Enviando (2 de 2)...',
  confirming: 'Confirmando en la red de origen...',
  done: null,
}

export default function MoverPage() {
  return (
    <AppShell>
      <Mover />
    </AppShell>
  )
}

function Mover() {
  const { address } = useAccount()
  const { balances } = useBalances(address)
  const [src, setSrc] = useState<SupportedChainId>(ROUTE_CHAINS[0])
  const [dst, setDst] = useState<SupportedChainId>(ROUTE_CHAINS[1])
  const [amount, setAmount] = useState('')

  const byChain = balances.get('ARGt')?.byChain ?? {}
  const available = byChain[src] ?? 0n
  const parsed = useMemo(() => parseAmount(amount, 18) ?? 0n, [amount])

  const bridge = useBridge({ srcChainId: src, dstChainId: dst, amount: parsed })
  const busy = bridge.step !== 'idle' && bridge.step !== 'done'

  const pickSrc = (id: SupportedChainId) => {
    setSrc(id)
    if (id === dst) setDst(ROUTE_CHAINS.find((c) => c !== id)!)
  }

  const amountIsValid = parsed > 0n && parsed <= available
  const problem = (() => {
    if (parsed > available) return 'No te alcanza el saldo en esa red.'
    if (parsed > 0n && bridge.sendAmount === 0n)
      return 'El monto es demasiado chico para el puente (mínimo 0,000001 ARGt).'
    return null
  })()

  const canSend = amountIsValid && bridge.nativeFee !== undefined && !busy && !bridge.quoteError

  if (bridge.step === 'done') {
    return (
      <div className="space-y-6">
        <BackLink />
        <SuccessCard
          title="Envío en camino"
          detail={`${formatAmount(bridge.sendAmount)} ARGt de ${CHAIN_META[src].name} a ${CHAIN_META[dst].name}. Suele tardar entre 1 y 3 minutos.`}
          chainId={src}
          hash={bridge.txHash}
          extraLink={
            bridge.txHash
              ? { href: layerZeroScanUrl(bridge.txHash), label: 'Seguir en LayerZero Scan' }
              : undefined
          }
          onDone={() => {
            bridge.reset()
            setAmount('')
          }}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <BackLink />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Mover</h1>
        <p className="mt-1 text-sm text-ink-400">
          Pasá tus pesos de una red a otra sin vender nada.
        </p>
      </div>

      <ChainPicker label="Desde" value={src} onChange={pickSrc} symbol="ARGt" balances={byChain} />
      <ChainPicker label="Hasta" value={dst} onChange={setDst} symbol="ARGt" exclude={src} />

      <AmountInput
        value={amount}
        onChange={setAmount}
        symbol="ARGt"
        max={available}
        onMax={() => setAmount(formatAmount(available, 18, 6))}
      />

      {parsed > 0n && (
        <Card className="space-y-2 p-4 text-xs">
          <Line
            label="Llega a destino"
            value={
              bridge.amountReceived !== undefined
                ? `${formatAmount(bridge.amountReceived)} ARGt`
                : bridge.isQuoting
                  ? 'Cotizando...'
                  : '—'
            }
            strong
          />
          <Line
            label={`Comisión de red (${chainById(src)?.nativeCurrency.symbol ?? 'ETH'})`}
            value={bridge.nativeFee !== undefined ? formatEth(bridge.nativeFee) : '—'}
          />
          {bridge.dust > 0n && (
            <Line
              label="Se redondea"
              value={`−${formatAmount(bridge.dust, 18, 18)} ARGt`}
              muted
            />
          )}
          <p className="pt-1 text-[11px] leading-relaxed text-ink-600">
            El puente trabaja con 6 decimales, así que el monto se redondea para abajo. Tarda entre
            1 y 3 minutos en acreditarse.
          </p>
        </Card>
      )}

      <ErrorNote>{problem || bridge.quoteError || bridge.error}</ErrorNote>

      <TxStatus
        step={STEP_LABEL[bridge.step]}
        chainId={src}
        hash={bridge.txHash}
        extraLink={
          bridge.txHash
            ? { href: layerZeroScanUrl(bridge.txHash), label: 'Seguir en LayerZero Scan' }
            : undefined
        }
      />

      <Button onClick={bridge.bridge} disabled={!canSend} loading={busy}>
        Mover a {CHAIN_META[dst].name}
      </Button>
    </div>
  )
}

function Line({
  label,
  value,
  strong,
  muted,
}: {
  label: string
  value: string
  strong?: boolean
  muted?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-ink-400">{label}</span>
      <span
        className={
          strong
            ? 'font-mono tabular-nums text-sm font-semibold text-mint-400'
            : muted
              ? 'font-mono tabular-nums text-ink-600'
              : 'font-mono tabular-nums text-ink-200'
        }
      >
        {value}
      </span>
    </div>
  )
}
