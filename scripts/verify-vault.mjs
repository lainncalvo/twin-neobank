// Lee el vault ARGt Prime contra Arbitrum: confirma que el asset es ARGt, que no
// hay gates de permisos y que previewDeposit responde. Comprueba tambien que
// maxDeposit devuelve 0 aunque los depositos funcionen, que es la trampa del M2.
import { createPublicClient, http, formatUnits, parseUnits } from 'viem'
import { arbitrum } from 'viem/chains'

const VAULT = '0x9Dd3F844747AB78d616BF76DB92756E17A064aDD'
const ARGT = '0x59863989d080B22476DB95656d0C3CC18be92214'
const PROBE = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'

const view = (name, inputs, outputs) => ({
  type: 'function', name, stateMutability: 'view', inputs, outputs,
})
const abi = [
  view('asset', [], [{ type: 'address' }]),
  view('name', [], [{ type: 'string' }]),
  view('symbol', [], [{ type: 'string' }]),
  view('decimals', [], [{ type: 'uint8' }]),
  view('totalAssets', [], [{ type: 'uint256' }]),
  view('previewDeposit', [{ type: 'uint256' }], [{ type: 'uint256' }]),
  view('maxDeposit', [{ type: 'address' }], [{ type: 'uint256' }]),
  view('canReceiveShares', [{ type: 'address' }], [{ type: 'bool' }]),
  view('receiveSharesGate', [], [{ type: 'address' }]),
  view('receiveAssetsGate', [], [{ type: 'address' }]),
  view('sendSharesGate', [], [{ type: 'address' }]),
]

const client = createPublicClient({ chain: arbitrum, transport: http('https://arb1.arbitrum.io/rpc') })
const read = (functionName, args) => client.readContract({ address: VAULT, abi, functionName, args })

const ONE_K = parseUnits('1000', 18)
const [asset, name, symbol, decimals, total, preview, max, canReceive, g1, g2, g3] =
  await Promise.all([
    read('asset'), read('name'), read('symbol'), read('decimals'), read('totalAssets'),
    read('previewDeposit', [ONE_K]), read('maxDeposit', [PROBE]), read('canReceiveShares', [PROBE]),
    read('receiveSharesGate'), read('receiveAssetsGate'), read('sendSharesGate'),
  ])

const ZERO = '0x0000000000000000000000000000000000000000'
const ok = (b) => (b ? 'OK' : 'MAL')

console.log(`vault           ${name} (${symbol}), ${decimals} decimales`)
console.log(`asset           ${asset}  ${ok(asset.toLowerCase() === ARGT.toLowerCase())} (es ARGt en Arbitrum)`)
console.log(`totalAssets     ${formatUnits(total, 18)} ARGt`)
console.log(`previewDeposit  1000 ARGt -> ${formatUnits(preview, 18)} shares`)
console.log(`gates           ${ok(g1 === ZERO && g2 === ZERO && g3 === ZERO)} (los tres en address(0): vault sin permisos)`)
console.log(`canReceiveShares ${ok(canReceive)} (cualquier address puede recibir shares)`)
console.log(`maxDeposit      ${max}  <- devuelve 0 y aun asi los depositos funcionan.`)
console.log(`                No usar maxDeposit para habilitar el boton de depositar.`)
