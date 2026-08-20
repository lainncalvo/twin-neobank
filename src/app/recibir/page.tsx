'use client'

import { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { useAccount, useBalance } from 'wagmi'
import { AppShell } from '@/components/AppShell'
import { BackLink, Button, Card } from '@/components/ui'
import { CHAIN_META, SUPPORTED_CHAINS, VAULT_CHAIN_ID } from '@/lib/chains'
import { formatEth } from '@/lib/format'

export default function RecibirPage() {
  return (
    <AppShell>
      <Recibir />
    </AppShell>
  )
}

function Recibir() {
  const { address } = useAccount()
  const [copied, setCopied] = useState(false)
  const gas = useBalance({ address, chainId: VAULT_CHAIN_ID })

  const copy = async () => {
    if (!address) return
    await navigator.clipboard.writeText(address)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const needsGas = gas.data !== undefined && gas.data.value === 0n

  return (
    <div className="space-y-6">
      <BackLink />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Recibir</h1>
        <p className="mt-1 text-sm text-ink-400">
          Esta es tu cuenta. Sirve para recibir cualquier moneda de Twin en{' '}
          {SUPPORTED_CHAINS.map((c) => CHAIN_META[c.id].name).join(', ')}.
        </p>
      </div>

      <Card className="flex flex-col items-center gap-5 p-6">
        {address ? (
          <div className="rounded-2xl bg-white p-4">
            <QRCodeSVG value={address} size={180} level="M" />
          </div>
        ) : (
          <div className="size-[212px] animate-pulse rounded-2xl bg-ink-800" />
        )}

        <p className="w-full break-all text-center font-mono text-xs leading-relaxed text-ink-300">
          {address}
        </p>

        <Button variant="ghost" onClick={copy} disabled={!address}>
          {copied ? '¡Copiada!' : 'Copiar dirección'}
        </Button>
      </Card>

      {needsGas && (
        <Card className="border-amber-500/25 bg-amber-500/5 p-4">
          <p className="text-sm font-medium text-amber-200">Te falta ETH para las comisiones</p>
          <p className="mt-1 text-xs leading-relaxed text-ink-400">
            Tu cuenta no tiene ETH en Arbitrum. Mandá una fracción chica (0,0005 ETH alcanza para
            varias operaciones) a la dirección de arriba para poder enviar, ahorrar y mover plata.
          </p>
        </Card>
      )}

      {gas.data !== undefined && gas.data.value > 0n && (
        <p className="px-2 text-center text-xs text-ink-600">
          Comisiones disponibles: {formatEth(gas.data.value)} ETH en Arbitrum
        </p>
      )}
    </div>
  )
}
