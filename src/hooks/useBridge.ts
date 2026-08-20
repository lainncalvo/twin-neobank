'use client'

import { useCallback, useMemo, useState } from 'react'
import { erc20Abi, pad } from 'viem'
import { useAccount, useConfig, useReadContracts, useSwitchChain, useWriteContract } from 'wagmi'
import { waitForTransactionReceipt } from 'wagmi/actions'
import { oftAdapterAbi, type SendParam } from '@/lib/abi/oftAdapter'
import { BRIDGE_ADAPTER, LZ_EID, type SupportedChainId } from '@/lib/chains'
import { TOKENS } from '@/lib/tokens'
import { truncateToBridgeUnit } from '@/lib/format'
import { humanError } from './useVault'

export type BridgeStep = 'idle' | 'switching' | 'approving' | 'sending' | 'confirming' | 'done'

/**
 * El bridge de Twin es un OFT Adapter de LayerZero V2.
 *
 * Tres cosas que no son obvias y hay que respetar:
 *  1. dstEid es el endpoint ID de LayerZero, NO el chain ID.
 *  2. approvalRequired() = true: hay que approve el ERC-20 al adapter antes de send.
 *  3. sharedDecimals = 6 sobre un token de 18: el monto se trunca a multiplos de
 *     1e12. Truncamos nosotros para que el usuario firme exactamente lo que llega.
 */
export function useBridge({
  srcChainId,
  dstChainId,
  amount,
}: {
  srcChainId: SupportedChainId
  dstChainId: SupportedChainId
  amount: bigint
}) {
  const { address, chainId } = useAccount()
  const config = useConfig()
  const { writeContractAsync } = useWriteContract()
  const { switchChainAsync } = useSwitchChain()

  const [step, setStep] = useState<BridgeStep>('idle')
  const [error, setError] = useState<string | null>(null)
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null)

  const adapter = BRIDGE_ADAPTER[srcChainId]
  const token = TOKENS.ARGt.addresses[srcChainId]!
  const sendAmount = useMemo(() => truncateToBridgeUnit(amount), [amount])

  const sendParam: SendParam | null = useMemo(() => {
    if (!address || sendAmount <= 0n) return null
    return {
      dstEid: LZ_EID[dstChainId],
      to: pad(address, { size: 32 }),
      amountLD: sendAmount,
      minAmountLD: sendAmount,
      // El adapter ya tiene enforcedOptions seteadas (type-3, lzReceive 300k gas),
      // asi que no hace falta construir options a mano.
      extraOptions: '0x',
      composeMsg: '0x',
      oftCmd: '0x',
    }
  }, [address, dstChainId, sendAmount])

  const quotes = useReadContracts({
    contracts: sendParam
      ? [
          {
            address: adapter,
            abi: oftAdapterAbi,
            functionName: 'quoteOFT',
            args: [sendParam],
            chainId: srcChainId,
          },
          {
            address: adapter,
            abi: oftAdapterAbi,
            functionName: 'quoteSend',
            args: [sendParam, false],
            chainId: srcChainId,
          },
          {
            address: token,
            abi: erc20Abi,
            functionName: 'allowance',
            args: [address!, adapter],
            chainId: srcChainId,
          },
        ]
      : [],
    query: { enabled: Boolean(sendParam), refetchInterval: 30_000 },
  })

  const oftResult = quotes.data?.[0]
  const feeResult = quotes.data?.[1]
  const allowanceResult = quotes.data?.[2]

  const amountReceived =
    oftResult?.status === 'success'
      ? (oftResult.result as readonly [unknown, unknown, { amountReceivedLD: bigint }])[2]
          .amountReceivedLD
      : undefined

  const nativeFee =
    feeResult?.status === 'success'
      ? (feeResult.result as { nativeFee: bigint }).nativeFee
      : undefined

  const allowance =
    allowanceResult?.status === 'success' ? (allowanceResult.result as bigint) : undefined

  const quoteError =
    oftResult?.status === 'failure' || feeResult?.status === 'failure'
      ? 'No pudimos cotizar el envío. Puede que esa ruta no esté disponible ahora.'
      : null

  const bridge = useCallback(async () => {
    if (!address || !sendParam || nativeFee === undefined) return
    setError(null)
    setTxHash(null)
    try {
      if (chainId !== srcChainId) {
        setStep('switching')
        await switchChainAsync({ chainId: srcChainId })
      }

      if ((allowance ?? 0n) < sendParam.amountLD) {
        setStep('approving')
        const approveHash = await writeContractAsync({
          address: token,
          abi: erc20Abi,
          functionName: 'approve',
          args: [adapter, sendParam.amountLD],
          chainId: srcChainId,
        })
        await waitForTransactionReceipt(config, { hash: approveHash, chainId: srcChainId })
      }

      setStep('sending')
      const hash = await writeContractAsync({
        address: adapter,
        abi: oftAdapterAbi,
        functionName: 'send',
        args: [sendParam, { nativeFee, lzTokenFee: 0n }, address],
        value: nativeFee,
        chainId: srcChainId,
      })
      setTxHash(hash)

      setStep('confirming')
      await waitForTransactionReceipt(config, { hash, chainId: srcChainId })
      setStep('done')
    } catch (e) {
      setError(humanError(e))
      setStep('idle')
    }
  }, [
    address,
    sendParam,
    nativeFee,
    allowance,
    chainId,
    srcChainId,
    adapter,
    token,
    config,
    switchChainAsync,
    writeContractAsync,
  ])

  const reset = useCallback(() => {
    setStep('idle')
    setError(null)
    setTxHash(null)
  }, [])

  /** Cuanto se pierde por el truncado a 6 decimales del adapter. */
  const dust = amount - sendAmount

  return {
    sendAmount,
    dust,
    amountReceived,
    nativeFee,
    allowance,
    needsApproval: allowance !== undefined && allowance < sendAmount,
    isQuoting: quotes.isLoading,
    quoteError,
    bridge,
    step,
    error,
    txHash,
    reset,
  }
}

export function layerZeroScanUrl(hash: string) {
  return `https://layerzeroscan.com/tx/${hash}`
}
