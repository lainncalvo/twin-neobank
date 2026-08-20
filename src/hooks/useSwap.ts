'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { encodeAbiParameters, erc20Abi, maxUint256 } from 'viem'
import {
  useAccount, useConfig, usePublicClient, useReadContracts, useSwitchChain, useWriteContract,
} from 'wagmi'
import { waitForTransactionReceipt } from 'wagmi/actions'
import {
  exactInputSingleTuple, universalRouterAbi, UR_COMMAND_V4_SWAP, V4_ACTIONS, v4QuoterAbi,
} from '@/lib/abi/v4'
import { permit2Abi, PERMIT2_MAX_AMOUNT, PERMIT2_MAX_EXPIRATION } from '@/lib/abi/permit2'
import {
  ARGT_USDC_POOL, PERMIT2, SWAP_CHAIN_ID, SWAP_SLIPPAGE_BPS, UNIVERSAL_ROUTER, V4_QUOTER,
} from '@/lib/chains'
import { humanError } from './useVault'

export type SwapStep =
  | 'idle'
  | 'switching'
  | 'approving-token'  // ARGt -> Permit2
  | 'approving-router' // Permit2 -> UniversalRouter
  | 'swapping'
  | 'confirming'
  | 'done'

const ARGT = ARGT_USDC_POOL.currency1
const USDC = ARGT_USDC_POOL.currency0

/**
 * Dolarizar: vender ARGt por USDC en el pool de Uniswap V4 que Twin usa en Base.
 *
 * Un solo par y un solo sentido, a proposito. Se chequearon las cinco stablecoins
 * de Twin que viven en Base y solo ARGt/USDC tiene liquidez; y el sentido inverso
 * (comprar ARGt con USDC) revierte con montos minimos, asi que ofrecerlo seria
 * mentir.
 *
 * El encoding esta verificado por scripts/verify-swap.mjs, que simula el execute()
 * real. Si hay que tocarlo, corre ese script primero.
 */
export function useSwap({ amount }: { amount: bigint }) {
  const { address, chainId } = useAccount()
  const config = useConfig()
  const client = usePublicClient({ chainId: SWAP_CHAIN_ID })
  const { writeContractAsync } = useWriteContract()
  const { switchChainAsync } = useSwitchChain()

  const [step, setStep] = useState<SwapStep>('idle')
  const [error, setError] = useState<string | null>(null)
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null)

  // Una sola pieza de estado, con el monto que la produjo adentro. Asi "estoy
  // cotizando" se deriva (el resultado guardado no corresponde al monto actual) en
  // vez de setearse a mano desde el efecto.
  const [quote, setQuote] = useState<
    { amount: bigint; out?: bigint; error?: string } | null
  >(null)

  // Sin debounce cada tecla dispara una simulacion, y el RPC publico de Base
  // responde "over rate limit" enseguida.
  const [debounced, setDebounced] = useState(amount)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(amount), 400)
    return () => clearTimeout(t)
  }, [amount])

  // Se recotiza sola: el pool es chico y el precio se mueve. El mismo reloj sirve
  // para saber si vencio el permiso de Permit2, que no se puede leer con Date.now()
  // en render porque haria impuro el render.
  const [now, setNow] = useState(() => BigInt(Math.floor(Date.now() / 1000)))
  useEffect(() => {
    const id = setInterval(() => setNow(BigInt(Math.floor(Date.now() / 1000))), 30_000)
    return () => clearInterval(id)
  }, [])

  const quoteRun = useRef(0)
  useEffect(() => {
    // Sin monto no se cotiza y tampoco se limpia estado aca: los valores que salen
    // del hook se derivan mas abajo, asi el efecto no dispara renders en cascada.
    if (!client || debounced <= 0n) return
    const run = ++quoteRun.current
    // quoteExactInputSingle es nonpayable, no view: va con simulateContract.
    // Anda sin `account`, asi que cotiza aunque Privy todavia no haya creado la wallet.
    client
      .simulateContract({
        address: V4_QUOTER,
        abi: v4QuoterAbi,
        functionName: 'quoteExactInputSingle',
        args: [{ poolKey: ARGT_USDC_POOL, zeroForOne: false, exactAmount: debounced, hookData: '0x' }],
      })
      .then(({ result }) => {
        if (run === quoteRun.current) setQuote({ amount: debounced, out: result[0] })
      })
      .catch((e: unknown) => {
        if (run !== quoteRun.current) return
        // Que el quoter revierta ES la señal de que no hay profundidad. No se
        // hardcodea un maximo: el techo del pool se mueve solo.
        const reverted =
          (e as { cause?: { name?: string } })?.cause?.name === 'ContractFunctionRevertedError'
        setQuote({
          amount: debounced,
          error: reverted
            ? 'El mercado no tiene profundidad para ese monto. Probá con menos.'
            : 'No pudimos cotizar. Reintentá en unos segundos.',
        })
      })
  }, [client, debounced, now])

  const settled = quote !== null && quote.amount === debounced
  const amountOut = settled ? quote.out : undefined
  const quoteError = settled ? (quote.error ?? null) : null
  const isQuoting = debounced > 0n && !settled

  const amountOutMin = useMemo(() => {
    if (amountOut === undefined) return undefined
    return (amountOut * (10_000n - SWAP_SLIPPAGE_BPS)) / 10_000n
  }, [amountOut])

  const approvals = useReadContracts({
    contracts: address
      ? [
          {
            address: ARGT,
            abi: erc20Abi,
            functionName: 'allowance',
            args: [address, PERMIT2],
            chainId: SWAP_CHAIN_ID,
          },
          {
            address: PERMIT2,
            abi: permit2Abi,
            functionName: 'allowance',
            args: [address, ARGT, UNIVERSAL_ROUTER],
            chainId: SWAP_CHAIN_ID,
          },
        ]
      : [],
    query: { enabled: Boolean(address), refetchInterval: 30_000 },
  })

  const pick = <T,>(i: number): T | undefined =>
    approvals.data?.[i]?.status === 'success' ? (approvals.data[i].result as T) : undefined

  const tokenAllowance = pick<bigint>(0)
  const permit2Allowance = pick<readonly [bigint, number, number]>(1)

  const needsTokenApproval = tokenAllowance !== undefined && amount > 0n && tokenAllowance < amount
  const needsRouterApproval =
    permit2Allowance !== undefined &&
    amount > 0n &&
    // Ojo: la allowance de Permit2 vence. Mirar solo el monto deja pasar una
    // vencida y el swap revierte despues de que el usuario ya firmo.
    (permit2Allowance[0] < amount || BigInt(permit2Allowance[1]) <= now)

  const approvalsNeeded = (needsTokenApproval ? 1 : 0) + (needsRouterApproval ? 1 : 0)

  const swap = useCallback(async () => {
    if (!address || amount <= 0n || amountOutMin === undefined) return
    setError(null)
    setTxHash(null)
    try {
      if (chainId !== SWAP_CHAIN_ID) {
        setStep('switching')
        await switchChainAsync({ chainId: SWAP_CHAIN_ID })
      }

      // Son dos aprobaciones a contratos distintos y ninguna reemplaza a la otra.
      // Van por el maximo, no por el monto exacto como en el vault y el bridge: si
      // no, el usuario firma tres veces en CADA swap. Asi el segundo es una firma.
      if (needsTokenApproval) {
        setStep('approving-token')
        const hash = await writeContractAsync({
          address: ARGT,
          abi: erc20Abi,
          functionName: 'approve',
          args: [PERMIT2, maxUint256],
          chainId: SWAP_CHAIN_ID,
        })
        await waitForTransactionReceipt(config, { hash, chainId: SWAP_CHAIN_ID })
      }

      if (needsRouterApproval) {
        setStep('approving-router')
        const hash = await writeContractAsync({
          address: PERMIT2,
          abi: permit2Abi,
          functionName: 'approve',
          args: [ARGT, UNIVERSAL_ROUTER, PERMIT2_MAX_AMOUNT, Number(PERMIT2_MAX_EXPIRATION)],
          chainId: SWAP_CHAIN_ID,
        })
        await waitForTransactionReceipt(config, { hash, chainId: SWAP_CHAIN_ID })
      }

      const input = encodeAbiParameters(
        [{ type: 'bytes' }, { type: 'bytes[]' }],
        [
          V4_ACTIONS,
          [
            encodeAbiParameters(
              [exactInputSingleTuple],
              [{
                poolKey: ARGT_USDC_POOL,
                zeroForOne: false,
                amountIn: amount,
                amountOutMinimum: amountOutMin,
                hookData: '0x',
              }],
            ),
            encodeAbiParameters([{ type: 'address' }, { type: 'uint256' }], [ARGT, amount]),
            encodeAbiParameters([{ type: 'address' }, { type: 'uint256' }], [USDC, amountOutMin]),
          ],
        ],
      )
      // El deadline se calcula aca, no en un useMemo: memoizado se congela al montar
      // y vence solo si la pantalla queda abierta un rato.
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200)

      setStep('swapping')
      const hash = await writeContractAsync({
        address: UNIVERSAL_ROUTER,
        abi: universalRouterAbi,
        functionName: 'execute',
        args: [UR_COMMAND_V4_SWAP, [input], deadline],
        chainId: SWAP_CHAIN_ID,
      })
      setTxHash(hash)

      setStep('confirming')
      await waitForTransactionReceipt(config, { hash, chainId: SWAP_CHAIN_ID })
      setStep('done')
      await approvals.refetch()
    } catch (e) {
      setError(humanError(e))
      setStep('idle')
    }
  }, [
    address,
    amount,
    amountOutMin,
    chainId,
    needsTokenApproval,
    needsRouterApproval,
    config,
    switchChainAsync,
    writeContractAsync,
    approvals,
  ])

  const reset = useCallback(() => {
    setStep('idle')
    setError(null)
    setTxHash(null)
  }, [])

  const hasAmount = debounced > 0n
  return {
    amountOut: hasAmount ? amountOut : undefined,
    amountOutMin: hasAmount ? amountOutMin : undefined,
    isQuoting: hasAmount && isQuoting,
    quoteError: hasAmount ? quoteError : null,
    needsTokenApproval,
    needsRouterApproval,
    approvalsNeeded,
    swap,
    step,
    error,
    txHash,
    reset,
  }
}
