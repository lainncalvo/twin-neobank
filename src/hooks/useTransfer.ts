'use client'

import { useCallback, useState } from 'react'
import { erc20Abi } from 'viem'
import { useAccount, useConfig, useSendTransaction, useSwitchChain, useWriteContract } from 'wagmi'
import { waitForTransactionReceipt } from 'wagmi/actions'
import { TOKENS, type TokenSymbol } from '@/lib/tokens'
import type { SupportedChainId } from '@/lib/chains'
import { humanError } from './useVault'

export type TransferStep = 'idle' | 'switching' | 'signing' | 'confirming' | 'done'

/**
 * Envia un token o la moneda nativa.
 *
 * Un ERC-20 se manda con transfer(); la moneda nativa no tiene contrato y va como
 * valor de la transaccion. Todo lo demas (switch de red, espera del recibo,
 * estados) es identico en los dos casos.
 */
export function useTransfer() {
  const { address, chainId } = useAccount()
  const config = useConfig()
  const { writeContractAsync } = useWriteContract()
  const { sendTransactionAsync } = useSendTransaction()
  const { switchChainAsync } = useSwitchChain()
  const [step, setStep] = useState<TransferStep>('idle')
  const [error, setError] = useState<string | null>(null)
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null)

  const send = useCallback(
    async (opts: {
      symbol: TokenSymbol
      chainId: SupportedChainId
      to: `0x${string}`
      amount: bigint
    }) => {
      if (!address) return
      const meta = TOKENS[opts.symbol]
      const isNative = meta.kind === 'native'
      const token = meta.addresses[opts.chainId]
      // Antes esto era un `return` mudo y el boton quedaba muerto sin decir nada,
      // que para el usuario es peor que un error.
      if (!isNative && !token) {
        setError(`${opts.symbol} no existe en esa red.`)
        return
      }
      setError(null)
      setTxHash(null)
      try {
        if (chainId !== opts.chainId) {
          setStep('switching')
          await switchChainAsync({ chainId: opts.chainId })
        }

        setStep('signing')
        const hash = isNative
          ? await sendTransactionAsync({
              to: opts.to,
              value: opts.amount,
              chainId: opts.chainId,
            })
          : await writeContractAsync({
              address: token!,
              abi: erc20Abi,
              functionName: 'transfer',
              args: [opts.to, opts.amount],
              chainId: opts.chainId,
            })
        setTxHash(hash)

        setStep('confirming')
        // chainId explicito: despues del switch, el client "actual" puede seguir
        // apuntando a la red vieja por un tick.
        await waitForTransactionReceipt(config, { hash, chainId: opts.chainId })
        setStep('done')
      } catch (e) {
        setError(humanError(e))
        setStep('idle')
      }
    },
    [address, chainId, config, switchChainAsync, writeContractAsync, sendTransactionAsync],
  )

  const reset = useCallback(() => {
    setStep('idle')
    setError(null)
    setTxHash(null)
  }, [])

  return { send, step, error, txHash, reset }
}
