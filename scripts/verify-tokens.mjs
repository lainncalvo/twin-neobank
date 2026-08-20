// Verifica las direcciones de USDC, USDT y EURC en las tres redes antes de meterlas
// al registry. Dos trampas que este script existe para cachar:
//
// 1. Las versiones bridgeadas (USDC.e) tambien devuelven symbol() = "USDC". Se
//    distinguen por name(): "USD Coin (Arb1)" y "USD Coin (PoS)" son las viejas.
// 2. El symbol() on-chain de USDT no es "USDT": es "USD?0" en Arbitrum y "USDT0"
//    en Polygon, por el rebrand omnichain de Tether. Nuestro registry manda.
import { createPublicClient, http, formatUnits } from 'viem'
import { arbitrum, base, polygon } from 'viem/chains'

// Varios por red: los RPC publicos fallan de a ratos y un falso negativo aca te
// hace descartar una direccion que estaba bien.
const RPC = {
  [arbitrum.id]: ['https://arb1.arbitrum.io/rpc', 'https://arbitrum.gateway.tenderly.co'],
  [base.id]: ['https://mainnet.base.org', 'https://base.gateway.tenderly.co'],
  [polygon.id]: ['https://polygon-bor-rpc.publicnode.com', 'https://polygon.gateway.tenderly.co'],
}

const CANDIDATES = [
  ['USDC', arbitrum, '0xaf88d065e77c8cC2239327C5EDb3A432268e5831'],
  ['USDC', base, '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'],
  ['USDC', polygon, '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359'],
  ['USDT', arbitrum, '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9'],
  ['USDT', base, '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2'],
  ['USDT', polygon, '0xc2132D05D31c914a87C6611C10748AEb04B58e8F'],
  ['EURC', base, '0x60a3E35Cc302bFA44Cb288Bc5a4F316Fdb1adb42'],
]

const view = (name, outputs) => ({ type: 'function', name, stateMutability: 'view', inputs: [], outputs })
const abi = [
  view('symbol', [{ type: 'string' }]),
  view('name', [{ type: 'string' }]),
  view('decimals', [{ type: 'uint8' }]),
  view('totalSupply', [{ type: 'uint256' }]),
]

const clientFor = (chain, url) => createPublicClient({ chain, transport: http(url) })

/** Prueba cada RPC de la red hasta que uno responda. Devuelve tambien cual sirvio. */
async function readAll(chain, address) {
  let lastError
  for (const url of RPC[chain.id]) {
    const client = clientFor(chain, url)
    const read = (functionName) => client.readContract({ address, abi, functionName })
    try {
      const [symbol, name, decimals, supply] = await Promise.all([
        read('symbol'), read('name'), read('decimals'), read('totalSupply'),
      ])
      return { symbol, name, decimals, supply, url }
    } catch (e) {
      lastError = e
    }
  }
  throw lastError
}

const BRIDGED = ['(Arb1)', '(PoS)', '.e']
let failures = 0

console.log('token  red        symbol    dec  supply           name')
console.log('-'.repeat(78))

for (const [want, chain, address] of CANDIDATES) {
  let row
  try {
    row = await readAll(chain, address)
  } catch (e) {
    console.log(`${want.padEnd(6)} ${chain.name.padEnd(10)} NINGUN RPC RESPONDIO -> ${address}`)
    console.log(`       ${String(e).split('\n')[0].slice(0, 70)}`)
    failures++
    continue
  }

  const { symbol, name, decimals, supply } = row
  console.log(
    `${want.padEnd(6)} ${chain.name.padEnd(10)} ${symbol.padEnd(9)} ${String(decimals).padEnd(4)} ` +
    `${Number(formatUnits(supply, decimals)).toLocaleString('es-AR', { maximumFractionDigits: 0 }).padStart(15)}  ${name}`,
  )

  if (decimals !== 6) {
    console.log(`       MAL: esperabamos 6 decimales, no ${decimals}`)
    failures++
  }
  const bridged = BRIDGED.find((tag) => name.includes(tag))
  if (bridged) {
    console.log(`       MAL: el name incluye "${bridged}" -> es la version bridgeada, no la nativa`)
    failures++
  }
}

console.log('-'.repeat(78))
if (failures > 0) {
  console.log(`${failures} problema(s). No metas estas direcciones al registry todavia.`)
  process.exit(1)
}
console.log('Las 7 direcciones estan OK: nativas, 6 decimales, con supply real.')
