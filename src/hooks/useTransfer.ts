'use client'

import { useCallback, useState } from 'react'
import { erc20Abi } from 'viem'
import { useAccount, useConfig, useSwitchChain, useWriteContract } from 'wagmi'
import { waitForTransactionReceipt } from 'wagmi/actions'
import { TOKENS, type TokenSymbol } from '@/lib/tokens'
import type { SupportedChainId } from '@/lib/chains'
import { humanError } from './useVault'

export type TransferStep = 'idle' | 'switching' | 'signing' | 'confirming' | 'done'

export function useTransfer() {
  const { address, chainId } = useAccount()
  const config = useConfig()
  const { writeContractAsync } = useWriteContract()
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
      const token = TOKENS[opts.symbol].addresses[opts.chainId]
      if (!address || !token) return
      setError(null)
      setTxHash(null)
      try {
        if (chainId !== opts.chainId) {
          setStep('switching')
          await switchChainAsync({ chainId: opts.chainId })
        }

        setStep('signing')
        const hash = await writeContractAsync({
          address: token,
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
    [address, chainId, config, switchChainAsync, writeContractAsync],
  )

  const reset = useCallback(() => {
    setStep('idle')
    setError(null)
    setTxHash(null)
  }, [])

  return { send, step, error, txHash, reset }
}
