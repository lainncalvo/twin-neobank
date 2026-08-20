'use client'

import { useMemo, useState } from 'react'
import { AppShell } from '@/components/AppShell'
import { AmountInput, SuccessCard, TxStatus } from '@/components/inputs'
import { BackLink, Button, Card, ErrorNote, Skeleton, cn } from '@/components/ui'
import { GasGuard } from '@/components/GasGuard'
import { useVault, type VaultAction } from '@/hooks/useVault'
import { VAULT_ADDRESS, VAULT_CHAIN_ID, CHAIN_META } from '@/lib/chains'
import { exactAmountInput, formatAmount, parseAmount } from '@/lib/format'

const STEP_LABEL: Record<VaultAction, string | null> = {
  idle: null,
  switching: 'Cambiando a Arbitrum...',
  approving: 'Autorizando el vault (1 de 2)...',
  depositing: 'Depositando (2 de 2)...',
  redeeming: 'Retirando...',
  done: null,
}

export default function AhorroPage() {
  return (
    <AppShell>
      <Ahorro />
    </AppShell>
  )
}

function Ahorro() {
  const vault = useVault()
  const [mode, setMode] = useState<'deposit' | 'withdraw'>('deposit')
  const [amount, setAmount] = useState('')

  const parsed = useMemo(() => parseAmount(amount, 18), [amount])
  const busy = vault.action !== 'idle' && vault.action !== 'done'

  const max = mode === 'deposit' ? (vault.walletBalance ?? 0n) : (vault.deposited ?? 0n)
  const amountIsValid = parsed !== null && parsed > 0n && parsed <= max
  const problem = parsed !== null && parsed > max ? 'No te alcanza el saldo.' : null

  const submit = async () => {
    if (!parsed) return
    if (mode === 'deposit') {
      await vault.deposit(parsed)
    } else {
      // El vault trabaja en shares. Si el usuario pide todo, mandamos sus shares
      // exactas para no dejar polvo por redondeo del convertToAssets.
      const shares =
        vault.deposited && parsed >= vault.deposited
          ? (vault.shares ?? 0n)
          : sharesFor(parsed, vault.shares, vault.deposited)
      await vault.redeem(shares)
    }
  }

  if (vault.action === 'done') {
    return (
      <div className="space-y-6">
        <BackLink />
        <SuccessCard
          title={mode === 'deposit' ? 'Depósito hecho' : 'Retiro hecho'}
          detail={`${formatAmount(parsed ?? 0n)} ARGt · ${vault.vaultName}`}
          chainId={VAULT_CHAIN_ID}
          hash={vault.txHash}
          onDone={() => {
            vault.reset()
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
        <h1 className="text-2xl font-semibold tracking-tight">Ahorro</h1>
        <p className="mt-1 text-sm text-ink-400">
          Tus pesos trabajan en {vault.vaultName}, un vault de terceros sobre Morpho.
        </p>
      </div>

      <Card className="p-6">
        <p className="text-xs uppercase tracking-wide text-ink-400">Tenés ahorrado</p>
        {vault.deposited === undefined ? (
          <Skeleton className="mt-3 h-9 w-40" />
        ) : (
          <p className="mt-2 font-mono text-3xl font-semibold tabular-nums">
            <span className="text-ink-400">$</span> {formatAmount(vault.deposited)}
            <span className="ml-2 text-sm font-normal text-ink-400">ARGt</span>
          </p>
        )}
        <dl className="mt-5 space-y-2 border-t border-ink-800 pt-4 text-xs">
          <Row label="Vault" value={vault.vaultName} />
          <Row label="Red" value={CHAIN_META[VAULT_CHAIN_ID].name} />
          <Row
            label="Total en el vault"
            value={
              vault.totalAssets !== undefined ? `${formatAmount(vault.totalAssets, 18, 0)} ARGt` : '—'
            }
          />
          <Row
            label="Contrato"
            value={
              <a
                href={`${CHAIN_META[VAULT_CHAIN_ID].explorer}/address/${VAULT_ADDRESS}`}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-mint-400 underline-offset-2 hover:underline"
              >
                {VAULT_ADDRESS.slice(0, 8)}...{VAULT_ADDRESS.slice(-6)} ↗
              </a>
            }
          />
        </dl>
      </Card>

      <div className="grid grid-cols-2 gap-1 rounded-xl border border-ink-800 p-1">
        {(['deposit', 'withdraw'] as const).map((m) => (
          <button
            key={m}
            onClick={() => {
              setMode(m)
              setAmount('')
              vault.reset()
            }}
            className={cn(
              'rounded-lg py-2.5 text-sm font-medium transition-colors',
              mode === m ? 'bg-ink-800 text-ink-100' : 'text-ink-400 hover:text-ink-100',
            )}
          >
            {m === 'deposit' ? 'Depositar' : 'Retirar'}
          </button>
        ))}
      </div>

      <AmountInput
        value={amount}
        onChange={setAmount}
        symbol="ARGt"
        max={max}
        onMax={() => setAmount(exactAmountInput(max))}
        hint={
          mode === 'deposit'
            ? 'La primera vez pide dos firmas: una para autorizar el vault y otra para depositar.'
            : undefined
        }
      />

      <GasGuard chainId={VAULT_CHAIN_ID} />

      <ErrorNote>{problem || vault.error}</ErrorNote>

      <TxStatus step={STEP_LABEL[vault.action]} chainId={VAULT_CHAIN_ID} hash={vault.txHash} />

      <Button onClick={submit} disabled={!amountIsValid || busy} loading={busy}>
        {mode === 'deposit' ? 'Depositar' : 'Retirar'}
      </Button>
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-ink-400">{label}</dt>
      <dd className="truncate text-right text-ink-200">{value}</dd>
    </div>
  )
}

/** Regla de tres shares/assets, con guardas para no dividir por cero. */
function sharesFor(assets: bigint, shares?: bigint, deposited?: bigint) {
  if (!shares || !deposited || deposited === 0n) return 0n
  return (assets * shares) / deposited
}
