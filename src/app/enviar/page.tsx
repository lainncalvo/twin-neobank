'use client'

import { useMemo, useState } from 'react'
import { useAccount } from 'wagmi'
import { AppShell } from '@/components/AppShell'
import { AmountInput, ChainPicker, SuccessCard, TokenPicker, TxStatus } from '@/components/inputs'
import { BackLink, Button, ErrorNote, Label } from '@/components/ui'
import { GasGuard } from '@/components/GasGuard'
import { useBalances } from '@/hooks/useBalances'
import { useTransfer, type TransferStep } from '@/hooks/useTransfer'
import { useGasReserve } from '@/hooks/useGasReserve'
import { chainsForToken, TOKENS, TOKEN_ORDER, type TokenSymbol } from '@/lib/tokens'
import { exactAmountInput, formatAmount, formatEth, isAddressLike, parseAmount } from '@/lib/format'
import type { SupportedChainId } from '@/lib/chains'
import { CHAIN_META } from '@/lib/chains'

const STEP_LABEL: Record<TransferStep, string | null> = {
  idle: null,
  switching: 'Cambiando de red...',
  signing: 'Firmá la transferencia',
  confirming: 'Confirmando en la red...',
  done: null,
}

export default function EnviarPage() {
  return (
    <AppShell>
      <Enviar />
    </AppShell>
  )
}

function Enviar() {
  const { address } = useAccount()
  const { balances } = useBalances(address)
  const { send, step, error, txHash, reset } = useTransfer()

  const [symbol, setSymbol] = useState<TokenSymbol>('ARGt')
  const [chainId, setChainId] = useState<SupportedChainId>(chainsForToken('ARGt')[0])
  const [to, setTo] = useState('')
  const [amount, setAmount] = useState('')

  const meta = TOKENS[symbol]
  const byChain = balances.get(symbol)?.byChain ?? {}
  const available = byChain[chainId] ?? 0n
  const parsed = useMemo(() => parseAmount(amount, meta.decimals), [amount, meta.decimals])

  // Con la moneda nativa no se puede mandar todo: el gas se paga con lo mismo.
  const { isNative, reserve, sendable } = useGasReserve({ symbol, chainId, balance: available })

  const pickToken = (s: TokenSymbol) => {
    setSymbol(s)
    // Si el token nuevo no vive en la chain elegida, caemos a la primera que tenga.
    if (!chainsForToken(s).includes(chainId)) setChainId(chainsForToken(s)[0])
  }

  const toIsValid = isAddressLike(to)
  const amountIsValid = parsed !== null && parsed > 0n && parsed <= sendable
  const canSend = toIsValid && amountIsValid && step === 'idle'

  const problem = (() => {
    if (to && !toIsValid) return 'Esa no parece una dirección válida.'
    // Este caso va antes que el de saldo: si no, el usuario ve el boton gris sin
    // entender por que, teniendo saldo a la vista.
    if (isNative && available > 0n && sendable === 0n) {
      return `Tu ${symbol} alcanza justo para la comisión de red. Necesitás un poco más para enviar.`
    }
    if (parsed !== null && parsed > sendable) {
      return isNative
        ? `Dejá al menos ${formatEth(reserve)} ${symbol} para la comisión de red.`
        : 'No te alcanza el saldo en esa red.'
    }
    return null
  })()

  if (step === 'done') {
    return (
      <div className="space-y-6">
        <BackLink />
        <SuccessCard
          title="Transferencia enviada"
          detail={`${formatAmount(parsed ?? 0n, meta.decimals)} ${symbol} en ${CHAIN_META[chainId].name}`}
          chainId={chainId}
          hash={txHash}
          onDone={() => {
            reset()
            setAmount('')
            setTo('')
          }}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <BackLink />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Enviar</h1>
        <p className="mt-1 text-sm text-ink-400">
          Mandá plata a cualquier dirección, en la red que elijas.
        </p>
      </div>

      <TokenPicker value={symbol} onChange={pickToken} options={TOKEN_ORDER} />

      <ChainPicker
        label="Red"
        value={chainId}
        onChange={setChainId}
        symbol={symbol}
        balances={byChain}
      />

      <div className="space-y-2">
        <Label>Para</Label>
        <input
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder="0x..."
          spellCheck={false}
          className="w-full rounded-xl border border-ink-800 bg-ink-900 px-4 py-3 font-mono text-sm outline-none placeholder:text-ink-700 focus:border-ink-600"
        />
      </div>

      <AmountInput
        value={amount}
        onChange={setAmount}
        symbol={symbol}
        max={sendable}
        onMax={() => setAmount(exactAmountInput(sendable, meta.decimals))}
        hint={
          isNative
            ? `Se reservan ${formatEth(reserve)} ${symbol} para pagar la comisión de red.`
            : undefined
        }
      />

      <GasGuard chainId={chainId} />

      <ErrorNote>{problem || error}</ErrorNote>

      <TxStatus step={STEP_LABEL[step]} chainId={chainId} hash={txHash} />

      <Button
        onClick={() => send({ symbol, chainId, to: to.trim() as `0x${string}`, amount: parsed! })}
        disabled={!canSend}
        loading={step !== 'idle'}
      >
        Enviar {parsed && parsed > 0n ? formatAmount(parsed, meta.decimals) : ''} {symbol}
      </Button>
    </div>
  )
}
