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
import { PERMIT2, UNIVERSAL_ROUTER, V4_QUOTER } from '@/lib/chains'
import { NATIVE_CURRENCY, type SwapRoute } from '@/lib/swap'
import { TOKENS } from '@/lib/tokens'
import { humanError } from './useVault'

export type SwapStep =
  | 'idle'
  | 'switching'
  | 'approving-token'  // ERC-20 -> Permit2
  | 'approving-router' // Permit2 -> UniversalRouter
  | 'swapping'
  | 'confirming'
  | 'done'

/**
 * Swap exact-in de un salto sobre Uniswap V4.
 *
 * Sirve para cualquier ruta de `SWAP_ROUTES`: dolarizar ARGt, comprar BTC o ETH con
 * dolares, y los sentidos inversos. Lo unico que cambia entre rutas es el PoolKey y
 * quien es el token de entrada.
 *
 * Dos caminos distintos segun la entrada:
 *  - ERC-20: dos aprobaciones (al contrato Permit2, y dentro de Permit2 al router).
 *  - Moneda nativa: ninguna aprobacion, el monto viaja como `value`.
 *
 * El encoding esta verificado por scripts/verify-swap.mjs, que simula el execute()
 * real de cada ruta. Si hay que tocarlo, corre ese script primero.
 */
export function useSwap({ amount, route }: { amount: bigint; route: SwapRoute }) {
  const { address, chainId } = useAccount()
  const config = useConfig()
  const client = usePublicClient({ chainId: route.chainId })
  const { writeContractAsync } = useWriteContract()
  const { switchChainAsync } = useSwitchChain()

  const [step, setStep] = useState<SwapStep>('idle')
  const [error, setError] = useState<string | null>(null)
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null)

  // El token de entrada es el lado del pool que indica zeroForOne. Derivarlo asi
  // evita que la ruta y el encoding se desincronicen.
  const tokenInAddress = route.zeroForOne ? route.poolKey.currency0 : route.poolKey.currency1
  const tokenOutAddress = route.zeroForOne ? route.poolKey.currency1 : route.poolKey.currency0
  const inIsNative = tokenInAddress === NATIVE_CURRENCY
  const decimalsOut = TOKENS[route.to].decimals

  // Sin debounce cada tecla dispara una simulacion, y el RPC publico de Base
  // responde "over rate limit" enseguida.
  const [debounced, setDebounced] = useState(amount)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(amount), 400)
    return () => clearTimeout(t)
  }, [amount])

  // El mismo reloj sirve para recotizar y para saber si vencio el permiso de
  // Permit2, que no se puede leer con Date.now() en render porque lo hace impuro.
  const [now, setNow] = useState(() => BigInt(Math.floor(Date.now() / 1000)))
  useEffect(() => {
    const id = setInterval(() => setNow(BigInt(Math.floor(Date.now() / 1000))), 30_000)
    return () => clearInterval(id)
  }, [])

  // Una sola pieza de estado, con el monto y la ruta que la produjeron adentro. Asi
  // "estoy cotizando" se deriva en vez de setearse a mano desde el efecto.
  const [quote, setQuote] = useState<
    { amount: bigint; routeId: string; out?: bigint; error?: string } | null
  >(null)

  const quoteRun = useRef(0)
  useEffect(() => {
    if (!client || debounced <= 0n) return
    const run = ++quoteRun.current
    // quoteExactInputSingle es nonpayable, no view: va con simulateContract.
    // Anda sin `account`, asi que cotiza aunque Privy no haya creado la wallet.
    client
      .simulateContract({
        address: V4_QUOTER,
        abi: v4QuoterAbi,
        functionName: 'quoteExactInputSingle',
        args: [{
          poolKey: route.poolKey,
          zeroForOne: route.zeroForOne,
          exactAmount: debounced,
          hookData: '0x',
        }],
      })
      .then(({ result }) => {
        if (run === quoteRun.current) setQuote({ amount: debounced, routeId: route.id, out: result[0] })
      })
      .catch((e: unknown) => {
        if (run !== quoteRun.current) return
        // Que el quoter revierta ES la señal de que no hay profundidad. No se
        // hardcodea un maximo: el techo del pool se mueve solo.
        const reverted =
          (e as { cause?: { name?: string } })?.cause?.name === 'ContractFunctionRevertedError'
        setQuote({
          amount: debounced,
          routeId: route.id,
          error: reverted
            ? 'El mercado no tiene profundidad para ese monto. Probá con menos.'
            : 'No pudimos cotizar. Reintentá en unos segundos.',
        })
      })
  }, [client, debounced, now, route])

  const settled = quote !== null && quote.amount === debounced && quote.routeId === route.id
  const amountOut = settled ? quote.out : undefined
  const quoteError = settled ? (quote.error ?? null) : null
  const isQuoting = debounced > 0n && !settled

  const amountOutMin = useMemo(() => {
    if (amountOut === undefined) return undefined
    return (amountOut * (10_000n - route.slippageBps)) / 10_000n
  }, [amountOut, route.slippageBps])

  // La moneda nativa no tiene allowance: no hay contrato al que aprobarle nada.
  const approvals = useReadContracts({
    contracts: address && !inIsNative
      ? [
          {
            address: tokenInAddress,
            abi: erc20Abi,
            functionName: 'allowance',
            args: [address, PERMIT2],
            chainId: route.chainId,
          },
          {
            address: PERMIT2,
            abi: permit2Abi,
            functionName: 'allowance',
            args: [address, tokenInAddress, UNIVERSAL_ROUTER],
            chainId: route.chainId,
          },
        ]
      : [],
    query: { enabled: Boolean(address) && !inIsNative, refetchInterval: 30_000 },
  })

  const pick = <T,>(i: number): T | undefined =>
    approvals.data?.[i]?.status === 'success' ? (approvals.data[i].result as T) : undefined

  const tokenAllowance = pick<bigint>(0)
  const permit2Allowance = pick<readonly [bigint, number, number]>(1)

  const needsTokenApproval =
    !inIsNative && tokenAllowance !== undefined && amount > 0n && tokenAllowance < amount
  const needsRouterApproval =
    !inIsNative &&
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
      if (chainId !== route.chainId) {
        setStep('switching')
        await switchChainAsync({ chainId: route.chainId })
      }

      // Con entrada nativa no hay nada que aprobar: el monto viaja como value.
      // Con un ERC-20 son dos aprobaciones a contratos distintos, y ninguna
      // reemplaza a la otra. Van por el maximo para que el segundo swap del mismo
      // token sea una sola firma.
      if (needsTokenApproval) {
        setStep('approving-token')
        const hash = await writeContractAsync({
          address: tokenInAddress,
          abi: erc20Abi,
          functionName: 'approve',
          args: [PERMIT2, maxUint256],
          chainId: route.chainId,
        })
        await waitForTransactionReceipt(config, { hash, chainId: route.chainId })
      }

      if (needsRouterApproval) {
        setStep('approving-router')
        const hash = await writeContractAsync({
          address: PERMIT2,
          abi: permit2Abi,
          functionName: 'approve',
          args: [tokenInAddress, UNIVERSAL_ROUTER, PERMIT2_MAX_AMOUNT, Number(PERMIT2_MAX_EXPIRATION)],
          chainId: route.chainId,
        })
        await waitForTransactionReceipt(config, { hash, chainId: route.chainId })
      }

      const input = encodeAbiParameters(
        [{ type: 'bytes' }, { type: 'bytes[]' }],
        [
          V4_ACTIONS,
          [
            encodeAbiParameters(
              [exactInputSingleTuple],
              [{
                poolKey: route.poolKey,
                zeroForOne: route.zeroForOne,
                amountIn: amount,
                amountOutMinimum: amountOutMin,
                hookData: '0x',
              }],
            ),
            encodeAbiParameters([{ type: 'address' }, { type: 'uint256' }], [tokenInAddress, amount]),
            encodeAbiParameters([{ type: 'address' }, { type: 'uint256' }], [tokenOutAddress, amountOutMin]),
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
        chainId: route.chainId,
        value: inIsNative ? amount : 0n,
      })
      setTxHash(hash)

      setStep('confirming')
      await waitForTransactionReceipt(config, { hash, chainId: route.chainId })
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
    route,
    tokenInAddress,
    tokenOutAddress,
    inIsNative,
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
    decimalsOut,
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
