'use client'

import { useCallback, useMemo, useState } from 'react'
import { erc20Abi } from 'viem'
import { useReadContracts, useWriteContract, usePublicClient, useSwitchChain, useAccount } from 'wagmi'
import { vaultAbi } from '@/lib/abi/vault'
import { VAULT_ADDRESS, VAULT_CHAIN_ID } from '@/lib/chains'
import { TOKENS } from '@/lib/tokens'

const ARGT_ARBITRUM = TOKENS.ARGt.addresses[VAULT_CHAIN_ID]!

/** Solo la posicion del usuario, para mostrarla en la home sin traer todo. */
export function useVaultPosition(address?: `0x${string}`) {
  const query = useReadContracts({
    contracts: [
      {
        address: VAULT_ADDRESS,
        abi: vaultAbi,
        functionName: 'balanceOf',
        args: [address ?? '0x0000000000000000000000000000000000000000'],
        chainId: VAULT_CHAIN_ID,
      },
    ],
    query: { enabled: Boolean(address), refetchInterval: 20_000 },
  })

  const shares = query.data?.[0]?.status === 'success' ? (query.data[0].result as bigint) : undefined

  const preview = useReadContracts({
    contracts: [
      {
        address: VAULT_ADDRESS,
        abi: vaultAbi,
        functionName: 'convertToAssets',
        args: [shares ?? 0n],
        chainId: VAULT_CHAIN_ID,
      },
    ],
    query: { enabled: shares !== undefined && shares > 0n },
  })

  const assets =
    shares === 0n
      ? 0n
      : preview.data?.[0]?.status === 'success'
        ? (preview.data[0].result as bigint)
        : undefined

  return {
    shares,
    assets,
    isLoading: query.isLoading,
    refetch: async () => {
      await query.refetch()
      await preview.refetch()
    },
  }
}

export type VaultAction = 'idle' | 'switching' | 'approving' | 'depositing' | 'redeeming' | 'done'

/**
 * Estado completo del vault ARGt Prime + acciones de depositar y retirar.
 *
 * NO usamos maxDeposit() para habilitar el boton: el vault devuelve 0 para
 * cualquier address porque liquidityAdapter() es address(0), pero los depositos
 * funcionan igual (verificado on-chain).
 */
export function useVault() {
  const { address, chainId } = useAccount()
  const publicClient = usePublicClient({ chainId: VAULT_CHAIN_ID })
  const { writeContractAsync } = useWriteContract()
  const { switchChainAsync } = useSwitchChain()

  const [action, setAction] = useState<VaultAction>('idle')
  const [error, setError] = useState<string | null>(null)
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null)

  const reads = useReadContracts({
    contracts: [
      { address: VAULT_ADDRESS, abi: vaultAbi, functionName: 'totalAssets', chainId: VAULT_CHAIN_ID },
      { address: VAULT_ADDRESS, abi: vaultAbi, functionName: 'name', chainId: VAULT_CHAIN_ID },
      {
        address: VAULT_ADDRESS,
        abi: vaultAbi,
        functionName: 'balanceOf',
        args: [address ?? '0x0000000000000000000000000000000000000000'],
        chainId: VAULT_CHAIN_ID,
      },
      {
        address: ARGT_ARBITRUM,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [address ?? '0x0000000000000000000000000000000000000000'],
        chainId: VAULT_CHAIN_ID,
      },
      {
        address: ARGT_ARBITRUM,
        abi: erc20Abi,
        functionName: 'allowance',
        args: [address ?? '0x0000000000000000000000000000000000000000', VAULT_ADDRESS],
        chainId: VAULT_CHAIN_ID,
      },
    ],
    query: { enabled: Boolean(address), refetchInterval: 15_000 },
  })

  const pick = <T,>(i: number): T | undefined =>
    reads.data?.[i]?.status === 'success' ? (reads.data[i].result as T) : undefined

  const shares = pick<bigint>(2)
  const walletBalance = pick<bigint>(3)
  const allowance = pick<bigint>(4)

  const assetsQuery = useReadContracts({
    contracts: [
      {
        address: VAULT_ADDRESS,
        abi: vaultAbi,
        functionName: 'convertToAssets',
        args: [shares ?? 0n],
        chainId: VAULT_CHAIN_ID,
      },
    ],
    query: { enabled: shares !== undefined && shares > 0n },
  })

  const deposited =
    shares === 0n
      ? 0n
      : assetsQuery.data?.[0]?.status === 'success'
        ? (assetsQuery.data[0].result as bigint)
        : undefined

  const refetchAll = useCallback(async () => {
    await reads.refetch()
    await assetsQuery.refetch()
  }, [reads, assetsQuery])

  const ensureChain = useCallback(async () => {
    if (chainId === VAULT_CHAIN_ID) return
    setAction('switching')
    await switchChainAsync({ chainId: VAULT_CHAIN_ID })
  }, [chainId, switchChainAsync])

  const deposit = useCallback(
    async (amount: bigint) => {
      if (!address || !publicClient) return
      setError(null)
      setTxHash(null)
      try {
        await ensureChain()

        if ((allowance ?? 0n) < amount) {
          setAction('approving')
          const approveHash = await writeContractAsync({
            address: ARGT_ARBITRUM,
            abi: erc20Abi,
            functionName: 'approve',
            args: [VAULT_ADDRESS, amount],
            chainId: VAULT_CHAIN_ID,
          })
          await publicClient.waitForTransactionReceipt({ hash: approveHash })
        }

        setAction('depositing')
        const hash = await writeContractAsync({
          address: VAULT_ADDRESS,
          abi: vaultAbi,
          functionName: 'deposit',
          args: [amount, address],
          chainId: VAULT_CHAIN_ID,
        })
        setTxHash(hash)
        await publicClient.waitForTransactionReceipt({ hash })
        setAction('done')
        await refetchAll()
      } catch (e) {
        setError(humanError(e))
        setAction('idle')
      }
    },
    [address, publicClient, allowance, writeContractAsync, ensureChain, refetchAll],
  )

  const redeem = useCallback(
    async (sharesToRedeem: bigint) => {
      if (!address || !publicClient) return
      setError(null)
      setTxHash(null)
      try {
        await ensureChain()
        setAction('redeeming')
        const hash = await writeContractAsync({
          address: VAULT_ADDRESS,
          abi: vaultAbi,
          functionName: 'redeem',
          args: [sharesToRedeem, address, address],
          chainId: VAULT_CHAIN_ID,
        })
        setTxHash(hash)
        await publicClient.waitForTransactionReceipt({ hash })
        setAction('done')
        await refetchAll()
      } catch (e) {
        setError(humanError(e))
        setAction('idle')
      }
    },
    [address, publicClient, writeContractAsync, ensureChain, refetchAll],
  )

  const reset = useCallback(() => {
    setAction('idle')
    setError(null)
    setTxHash(null)
  }, [])

  return useMemo(
    () => ({
      vaultName: pick<string>(1) ?? 'ARGt Prime',
      totalAssets: pick<bigint>(0),
      shares,
      deposited,
      walletBalance,
      allowance,
      isLoading: reads.isLoading,
      action,
      error,
      txHash,
      deposit,
      redeem,
      reset,
      refetch: refetchAll,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [reads.data, reads.isLoading, shares, deposited, walletBalance, allowance, action, error, txHash, deposit, redeem, reset, refetchAll],
  )
}

export function humanError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e)
  if (/User rejected|denied transaction|User denied/i.test(msg)) return 'Cancelaste la operación.'
  if (/insufficient funds/i.test(msg)) return 'No te alcanza el ETH para pagar el gas.'
  if (/exceeds balance|transfer amount exceeds/i.test(msg)) return 'No te alcanza el saldo.'
  // Reverts de Uniswap V4 y Permit2, que salen como selector pelado.
  if (/0xd81b2f2e|AllowanceExpired/i.test(msg)) {
    return 'Se venció el permiso. Reintentá: te va a pedir una firma más.'
  }
  if (/0x8b063d73|TooLittleReceived/i.test(msg)) {
    return 'El precio se movió mientras firmabas. Reintentá.'
  }
  // Los reverts largos de viem no le sirven a nadie: nos quedamos con la 1ra linea.
  return msg.split('\n')[0].slice(0, 160)
}
