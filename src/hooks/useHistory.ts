'use client'

import { useQuery } from '@tanstack/react-query'
import { parseAbiItem, type Log, type PublicClient } from 'viem'
import { SUPPORTED_CHAINS, type SupportedChainId } from '@/lib/chains'
import { knownName, logsClients, TOKEN_BY_ADDRESS, tokensOnChain } from '@/lib/logs'
import { TOKENS, type TokenSymbol } from '@/lib/tokens'

const TRANSFER = parseAbiItem(
  'event Transfer(address indexed from, address indexed to, uint256 value)',
)

export type Leg = { symbol: TokenSymbol; value: bigint }

export type Movement = {
  id: string
  chainId: SupportedChainId
  txHash: `0x${string}`
  blockNumber: bigint
  timestamp: number
  kind: 'in' | 'out' | 'swap'
  out?: Leg
  in?: Leg
  counterparty: `0x${string}`
  label: string
}

/** Cuantos movimientos se muestran. Corta antes de pedir timestamps. */
const LIMIT = 40

type TransferLog = Log<bigint, number, false, typeof TRANSFER>

/** Prueba los RPC de la red en orden. Si ninguno anda, la red se saltea. */
async function logsForChain(chainId: SupportedChainId, address: `0x${string}`) {
  const tokens = tokensOnChain(chainId)
  if (tokens.length === 0) return []
  let lastError: unknown
  for (const client of logsClients(chainId)) {
    try {
      // Dos consultas porque no se puede pedir un OR entre topics distintos.
      const [sent, received] = await Promise.all([
        client.getLogs({ address: tokens, event: TRANSFER, args: { from: address }, fromBlock: 0n, toBlock: 'latest' }),
        client.getLogs({ address: tokens, event: TRANSFER, args: { to: address }, fromBlock: 0n, toBlock: 'latest' }),
      ])
      return [...sent, ...received] as TransferLog[]
    } catch (e) {
      lastError = e
    }
  }
  throw lastError
}

function buildMovements(
  chainId: SupportedChainId,
  logs: TransferLog[],
  address: `0x${string}`,
): Omit<Movement, 'timestamp'>[] {
  const me = address.toLowerCase()
  const byTx = new Map<string, TransferLog[]>()
  for (const log of logs) {
    const list = byTx.get(log.transactionHash) ?? []
    list.push(log)
    byTx.set(log.transactionHash, list)
  }

  const movements: Omit<Movement, 'timestamp'>[] = []
  for (const [txHash, group] of byTx) {
    let outLeg: Leg | undefined
    let inLeg: Leg | undefined
    let counterparty = '0x0000000000000000000000000000000000000000' as `0x${string}`

    for (const log of group) {
      const symbol = TOKEN_BY_ADDRESS[chainId]?.[log.address.toLowerCase()]
      if (!symbol) continue
      const { from, to, value } = log.args
      if (!from || !to || value === undefined) continue
      const leg = { symbol, value }
      if (from.toLowerCase() === me) {
        // Nos quedamos con la pata mas grande de cada lado: un swap puede emitir
        // transferencias intermedias por la comision.
        if (!outLeg || value > outLeg.value) { outLeg = leg; counterparty = to }
      } else if (to.toLowerCase() === me) {
        if (!inLeg || value > inLeg.value) { inLeg = leg; counterparty = from }
      }
    }

    if (!outLeg && !inLeg) continue
    const kind: Movement['kind'] = outLeg && inLeg ? 'swap' : outLeg ? 'out' : 'in'
    const known = knownName(chainId, counterparty)

    // Un swap sale como dos logs y tiene que verse como una sola fila. La etiqueta
    // se arma con los simbolos de las patas: antes decia "Cambiaste a dolares" para
    // cualquier swap, asi que comprar bitcoin aparecia como si fuera dolarizar.
    const swapLabel = () => {
      if (!outLeg || !inLeg) return 'Cambiaste'
      if (inLeg.symbol === 'USDC') {
        return outLeg.symbol === 'ARGt' ? 'Cambiaste a dólares' : `Vendiste ${outLeg.symbol}`
      }
      if (outLeg.symbol === 'USDC') return `Compraste ${inLeg.symbol}`
      return `Cambiaste ${outLeg.symbol} por ${inLeg.symbol}`
    }

    const label =
      kind === 'swap'
        ? swapLabel()
        : kind === 'out'
          ? (known === 'Ahorro ARGt Prime' ? 'Depositaste en ahorro'
            : known === 'Puente entre redes' ? 'Moviste a otra red'
            : known ?? 'Enviaste')
          : (known === 'Ahorro ARGt Prime' ? 'Retiraste del ahorro'
            : known === 'Puente entre redes' ? 'Llegó de otra red'
            : known === 'Emisión' ? 'Recibiste'
            : known ?? 'Recibiste')

    movements.push({
      id: `${chainId}:${txHash}`,
      chainId,
      txHash: txHash as `0x${string}`,
      blockNumber: group[0].blockNumber,
      kind,
      out: outLeg,
      in: inLeg,
      counterparty,
      label,
    })
  }
  return movements
}

/**
 * Historial leido de los logs de la cadena, sin indexer ni backend.
 *
 * Agrupa por transaccion: un swap emite dos Transfer (sale ARGt, entra USDC) y
 * tiene que verse como una fila, no como dos movimientos sueltos.
 */
export function useHistory(address?: `0x${string}`) {
  const query = useQuery({
    queryKey: ['history', address],
    enabled: Boolean(address),
    staleTime: 30_000,
    queryFn: async () => {
      const chainIds = SUPPORTED_CHAINS.map((c) => c.id) as SupportedChainId[]
      const partial: SupportedChainId[] = []

      const perChain = await Promise.all(
        chainIds.map(async (chainId) => {
          try {
            const logs = await logsForChain(chainId, address!)
            return buildMovements(chainId, logs, address!)
          } catch {
            // Una red caida no deja la pantalla en blanco: se avisa y se sigue.
            partial.push(chainId)
            return []
          }
        }),
      )

      const flat = perChain.flat()
      flat.sort((a, b) => (a.blockNumber > b.blockNumber ? -1 : 1))
      const top = flat.slice(0, LIMIT)

      // Los timestamps salen de getBlock; el batch del transport los junta en una
      // sola request HTTP por red.
      const clients = new Map<SupportedChainId, PublicClient>()
      const stamped = await Promise.all(
        top.map(async (m) => {
          if (!clients.has(m.chainId)) clients.set(m.chainId, logsClients(m.chainId)[0])
          try {
            const block = await clients.get(m.chainId)!.getBlock({ blockNumber: m.blockNumber })
            return { ...m, timestamp: Number(block.timestamp) }
          } catch {
            return { ...m, timestamp: 0 }
          }
        }),
      )

      stamped.sort((a, b) => b.timestamp - a.timestamp)
      return { movements: stamped as Movement[], partial }
    },
  })

  return {
    movements: query.data?.movements ?? [],
    partial: query.data?.partial ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  }
}

/** Etiqueta del monto, ya con signo y decimales del token. */
export function legLabel(leg: Leg, sign: '+' | '-') {
  return { sign, symbol: leg.symbol, value: leg.value, decimals: TOKENS[leg.symbol].decimals }
}
