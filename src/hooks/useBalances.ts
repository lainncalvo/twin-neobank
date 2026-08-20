'use client'

import { useMemo } from 'react'
import { useBalance, useReadContracts } from 'wagmi'
import { arbitrum, base, polygon } from 'wagmi/chains'
import { erc20Abi } from 'viem'
import { allTokenChainPairs, TOKENS, TOKEN_ORDER, type TokenSymbol } from '@/lib/tokens'
import type { SupportedChainId } from '@/lib/chains'

export type TokenBalance = {
  symbol: TokenSymbol
  total: bigint
  byChain: Partial<Record<SupportedChainId, bigint>>
}

/**
 * Un solo useReadContracts con todos los pares (token, chain). wagmi agrupa por
 * chain y manda un multicall por red, asi que son 3 requests y no 18.
 *
 * Las monedas nativas van aparte: no tienen contrato, se leen con eth_getBalance y
 * no entran en un multicall. Son 3 lecturas mas, una por red, con cantidad fija de
 * hooks.
 */
export function useBalances(address?: `0x${string}`) {
  const pairs = useMemo(() => allTokenChainPairs(), [])

  const contracts = useMemo(
    () =>
      pairs.map(({ symbol, chainId }) => ({
        address: TOKENS[symbol].addresses[chainId]!,
        abi: erc20Abi,
        functionName: 'balanceOf' as const,
        args: [address ?? '0x0000000000000000000000000000000000000000'] as const,
        chainId,
      })),
    [pairs, address],
  )

  const query = useReadContracts({
    contracts,
    allowFailure: true,
    query: {
      enabled: Boolean(address),
      refetchInterval: 15_000,
    },
  })

  // Mismo patron que GasGuard. Se refrescan al mismo ritmo que el multicall.
  const nativeQuery = { enabled: Boolean(address), refetchInterval: 15_000 }
  const ethArbitrum = useBalance({ address, chainId: arbitrum.id, query: nativeQuery })
  const ethBase = useBalance({ address, chainId: base.id, query: nativeQuery })
  const polPolygon = useBalance({ address, chainId: polygon.id, query: nativeQuery })

  const balances = useMemo(() => {
    const map = new Map<TokenSymbol, TokenBalance>()
    for (const symbol of TOKEN_ORDER) {
      map.set(symbol, { symbol, total: 0n, byChain: {} })
    }
    query.data?.forEach((result, i) => {
      const { symbol, chainId } = pairs[i]
      const value = result.status === 'success' ? (result.result as bigint) : 0n
      const entry = map.get(symbol)!
      entry.byChain[chainId] = value
      entry.total += value
    })

    // ETH suma Arbitrum y Base porque es el mismo activo. POL no se suma con nada:
    // es otra moneda, solo que tambien paga gas.
    const native: [TokenSymbol, SupportedChainId, bigint | undefined][] = [
      ['ETH', arbitrum.id, ethArbitrum.data?.value],
      ['ETH', base.id, ethBase.data?.value],
      ['POL', polygon.id, polPolygon.data?.value],
    ]
    for (const [symbol, chainId, value] of native) {
      if (value === undefined) continue
      const entry = map.get(symbol)!
      entry.byChain[chainId] = value
      entry.total += value
    }

    return map
  }, [query.data, pairs, ethArbitrum.data?.value, ethBase.data?.value, polPolygon.data?.value])

  /** Solo los tokens con saldo, mas ARGt que siempre se muestra (es el milestone 1). */
  const visible = useMemo(() => {
    const all = TOKEN_ORDER.map((s) => balances.get(s)!)
    return all.filter((b) => b.symbol === 'ARGt' || b.total > 0n)
  }, [balances])

  return {
    balances,
    visible,
    all: TOKEN_ORDER.map((s) => balances.get(s)!),
    isLoading:
      query.isLoading || ethArbitrum.isLoading || ethBase.isLoading || polPolygon.isLoading,
    isFetching: query.isFetching,
    refetch: query.refetch,
    error: query.error,
  }
}

/** Balance de un token en una chain puntual. */
export function useTokenBalance(
  symbol: TokenSymbol,
  chainId: SupportedChainId,
  address?: `0x${string}`,
) {
  const tokenAddress = TOKENS[symbol].addresses[chainId]
  const query = useReadContracts({
    contracts: [
      {
        address: tokenAddress!,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [address ?? '0x0000000000000000000000000000000000000000'],
        chainId,
      },
    ],
    query: { enabled: Boolean(address && tokenAddress), refetchInterval: 10_000 },
  })
  const value =
    query.data?.[0]?.status === 'success' ? (query.data[0].result as bigint) : undefined
  return { value, isLoading: query.isLoading, refetch: query.refetch }
}
