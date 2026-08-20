// Verifica los saldos nativos y el costo de enviarlos, en las tres redes.
//
// Existe por una razon concreta: un envio de valor nativo no puede mandar el 100%
// del saldo, porque el gas se paga con la misma moneda. Este script mide cuanto
// hay que reservar en cada red, que no es lo mismo en todas: en Base la reserva es
// polvo y en Polygon se come una parte real del saldo.
//
// Ojo tambien con el simbolo: Arbitrum y Base usan ETH, pero Polygon usa POL.
//
// Uso: node scripts/verify-native.mjs [address]
import { createPublicClient, http, formatEther } from 'viem'
import { arbitrum, base, polygon } from 'viem/chains'

const USER = process.argv[2] ?? '0xbc58987f6A715dc0EB4dF0Eaa50afdcf8014D29c'

// Varios por red: los publicos fallan de a ratos y un falso negativo aca hace
// pensar que no hay saldo.
const RPC = {
  [arbitrum.id]: ['https://arb1.arbitrum.io/rpc', 'https://arbitrum.gateway.tenderly.co'],
  [base.id]: ['https://mainnet.base.org', 'https://base.gateway.tenderly.co'],
  [polygon.id]: ['https://polygon-bor-rpc.publicnode.com', 'https://polygon.gateway.tenderly.co'],
}

/** Un envio de valor nativo sin data consume exactamente esto. No hace falta estimar. */
const TRANSFER_GAS = 21_000n
/** El precio de gas se mueve entre que se cotiza y que se firma. */
const GAS_BUFFER = 2n

async function read(chain) {
  let lastError
  for (const url of RPC[chain.id]) {
    const client = createPublicClient({ chain, transport: http(url) })
    try {
      const [balance, gasPrice] = await Promise.all([
        client.getBalance({ address: USER }),
        client.getGasPrice(),
      ])
      return { balance, gasPrice, url }
    } catch (e) {
      lastError = e
    }
  }
  throw lastError
}

console.log(`\nSaldos nativos de ${USER}\n`)
console.log('red         moneda        saldo              reserva de gas     enviable')
console.log('-'.repeat(82))

let warnings = 0

for (const chain of [arbitrum, base, polygon]) {
  const native = chain.nativeCurrency.symbol
  let row
  try {
    row = await read(chain)
  } catch (e) {
    console.log(`${chain.name.padEnd(11)} ${native.padEnd(6)} NINGUN RPC RESPONDIO`)
    console.log(`            ${String(e).split('\n')[0].slice(0, 64)}`)
    warnings++
    continue
  }

  const { balance, gasPrice } = row
  const reserve = gasPrice * TRANSFER_GAS * GAS_BUFFER
  const sendable = balance > reserve ? balance - reserve : 0n

  console.log(
    `${chain.name.padEnd(11)} ${native.padEnd(6)} ` +
    `${formatEther(balance).padStart(20)} ${formatEther(reserve).padStart(18)} ` +
    `${formatEther(sendable).padStart(20)}`,
  )

  if (balance === 0n) {
    console.log(`            sin saldo: no se puede firmar nada en ${chain.name}`)
    warnings++
  } else if (sendable === 0n) {
    console.log(`            LA RESERVA SE COME TODO EL SALDO: no alcanza ni para un envio`)
    warnings++
  } else {
    const pct = Number((reserve * 10_000n) / balance) / 100
    if (pct > 1) {
      console.log(`            la reserva es el ${pct.toFixed(1)}% del saldo`)
    }
  }
}

console.log('-'.repeat(82))
console.log(
  `reserva = precio de gas x ${TRANSFER_GAS} x ${GAS_BUFFER} (margen)\n` +
  'Polygon usa POL, no ETH: son activos distintos y no se suman.',
)
if (warnings > 0) console.log(`\n${warnings} aviso(s).`)
console.log()
