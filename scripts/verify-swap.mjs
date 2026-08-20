// Verifica cada ruta de swap contra los pools reales de Uniswap V4 en Base.
// No gasta gas: todo es eth_call.
//
// La seccion 3 de cada ruta es la que importa. Simula el execute() real del
// UniversalRouter y clasifica el revert. Antes de aprobar Permit2 el revert
// ESPERADO es AllowanceExpired: significa que el command byte, el decode del
// input, las tres acciones y el swap contra el pool pasaron, y que murio recien al
// ir a buscar el token. Cualquier otro revert apunta a un error de encoding.
//
// Uso: node scripts/verify-swap.mjs [address]
import {
  createPublicClient, http, encodeAbiParameters, keccak256, parseUnits,
  formatUnits, toFunctionSelector,
} from 'viem'
import { base } from 'viem/chains'

const RPCS = ['https://base.gateway.tenderly.co', 'https://mainnet.base.org']
const USER = process.argv[2] ?? '0xbc58987f6A715dc0EB4dF0Eaa50afdcf8014D29c'

const STATE_VIEW = '0xA3c0c9b65baD0b08107Aa264b0f3dB444b867A71'
const QUOTER = '0x0d5e0F971ED27FBfF6c2837bf31316121532048D'
const ROUTER = '0x6fF5693b99212Da76ad316178A184AB56D299b43'
const PERMIT2 = '0x000000000022D473030F116dDEE9F6B43aC78BA3'
const ZERO = '0x0000000000000000000000000000000000000000'

const TOKEN = {
  USDC: { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6 },
  ARGt: { address: '0xf016413834E6D1A14F3D628B11D6Ef725a6bdbDD', decimals: 18 },
  cbBTC: { address: '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf', decimals: 8 },
  // ETH NATIVO: en V4 se referencia como address cero, no como WETH. Da mejor
  // precio (0,06% de impacto a 10.000 USDC contra 1,34% del pool de WETH) y de
  // entrada no necesita Permit2, viaja como value.
  ETH: { address: '0x0000000000000000000000000000000000000000', decimals: 18 },
  VIRTUAL: { address: '0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b', decimals: 18 },
}

/**
 * Arma el PoolKey ordenando las currencies, que es lo que exige V4: currency0 es
 * SIEMPRE la address menor. El orden no es uniforme entre pares (USDC es la menor
 * frente a ARGt y cbBTC, pero la mayor frente a WETH y VIRTUAL), por eso zeroForOne
 * se DERIVA y no se escribe a mano. Hardcodearlo hace que la mitad de las rutas
 * opere al reves.
 */
function route({ name, from, to, fee, tickSpacing, probes }) {
  const a = TOKEN[from], b = TOKEN[to]
  const aFirst = a.address.toLowerCase() < b.address.toLowerCase()
  return {
    name, from, to, probes,
    tokenIn: a, tokenOut: b,
    zeroForOne: aFirst,
    poolKey: {
      currency0: aFirst ? a.address : b.address,
      currency1: aFirst ? b.address : a.address,
      fee, tickSpacing, hooks: ZERO,
    },
  }
}

const ROUTES = [
  route({ name: 'ARGt -> USDC  (dolarizar)', from: 'ARGt', to: 'USDC', fee: 3000, tickSpacing: 60,
          probes: ['1000', '10000', '100000'] }),
  route({ name: 'USDC -> cbBTC (comprar BTC)', from: 'USDC', to: 'cbBTC', fee: 500, tickSpacing: 10,
          probes: ['1', '100', '10000'] }),
  route({ name: 'USDC -> ETH   (comprar ETH nativo)', from: 'USDC', to: 'ETH', fee: 3000, tickSpacing: 60,
          probes: ['1', '100', '10000'] }),
  route({ name: 'ETH  -> USDC  (vender ETH, sin Permit2)', from: 'ETH', to: 'USDC', fee: 3000, tickSpacing: 60,
          probes: ['0.0001', '0.01', '1'] }),
  route({ name: 'USDC -> VIRTUAL', from: 'USDC', to: 'VIRTUAL', fee: 3000, tickSpacing: 60,
          probes: ['1', '100', '10000'] }),
]

const poolKeyTuple = {
  type: 'tuple',
  components: [
    { name: 'currency0', type: 'address' }, { name: 'currency1', type: 'address' },
    { name: 'fee', type: 'uint24' }, { name: 'tickSpacing', type: 'int24' },
    { name: 'hooks', type: 'address' },
  ],
}
// OJO: 5 campos. sqrtPriceLimitX96 se saco en la version final de v4-periphery;
// agregarlo desalinea el abi.decode. amountIn y amountOutMinimum son uint128.
const exactInSingle = {
  type: 'tuple',
  components: [
    { name: 'poolKey', ...poolKeyTuple },
    { name: 'zeroForOne', type: 'bool' },
    { name: 'amountIn', type: 'uint128' },
    { name: 'amountOutMinimum', type: 'uint128' },
    { name: 'hookData', type: 'bytes' },
  ],
}

const quoterAbi = [{
  type: 'function', name: 'quoteExactInputSingle', stateMutability: 'nonpayable',
  inputs: [{
    name: 'params', type: 'tuple', components: [
      { name: 'poolKey', ...poolKeyTuple },
      { name: 'zeroForOne', type: 'bool' },
      { name: 'exactAmount', type: 'uint128' },
      { name: 'hookData', type: 'bytes' },
    ],
  }],
  outputs: [{ name: 'amountOut', type: 'uint256' }, { name: 'gasEstimate', type: 'uint256' }],
}]
// Solo la sobrecarga de 3 args: con las dos, viem no sabe cual elegir.
const routerAbi = [{
  type: 'function', name: 'execute', stateMutability: 'payable',
  inputs: [
    { name: 'commands', type: 'bytes' }, { name: 'inputs', type: 'bytes[]' },
    { name: 'deadline', type: 'uint256' },
  ],
  outputs: [],
}]
const stateViewAbi = [
  { type: 'function', name: 'getLiquidity', stateMutability: 'view', inputs: [{ type: 'bytes32' }], outputs: [{ type: 'uint128' }] },
  { type: 'function', name: 'getSlot0', stateMutability: 'view', inputs: [{ type: 'bytes32' }], outputs: [{ type: 'uint160' }, { type: 'int24' }, { type: 'uint24' }, { type: 'uint24' }] },
]
const erc20Abi = [
  { type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'allowance', stateMutability: 'view', inputs: [{ type: 'address' }, { type: 'address' }], outputs: [{ type: 'uint256' }] },
]
const permit2Abi = [{
  type: 'function', name: 'allowance', stateMutability: 'view',
  inputs: [{ type: 'address' }, { type: 'address' }, { type: 'address' }],
  outputs: [{ type: 'uint160' }, { type: 'uint48' }, { type: 'uint48' }],
}]

// Que significa cada revert. Los selectores se calculan, no se copian a mano.
const DIAGNOSIS = [
  ['AllowanceExpired(uint256)', 'ENCODING OK (falta aprobar Permit2, que es lo esperado)', true],
  ['InsufficientAllowance(uint256)', 'ENCODING OK (la allowance de Permit2 no alcanza)', true],
  ['InvalidCommandType(uint256)', 'MAL: el command byte no es 0x10 (V4_SWAP)', false],
  ['LengthMismatch()', 'MAL: commands e inputs no tienen el mismo largo', false],
  ['InputLengthMismatch()', 'MAL: actions y params no tienen el mismo largo', false],
  ['UnsupportedAction(uint256)', 'MAL: alguna accion de 0x060c0f esta mal', false],
  ['PoolNotInitialized()', 'MAL: el PoolKey no corresponde a un pool inicializado', false],
  ['V4TooLittleReceived(uint256,uint256)', 'amountOutMinimum quedo demasiado alto', false],
  ['CurrencyNotSettled()', 'MAL: falta un SETTLE o un TAKE', false],
]
const SELECTORS = new Map(DIAGNOSIS.map(([sig, msg, ok]) => [toFunctionSelector(sig), { sig, msg, ok }]))

/**
 * Reverts que llegan como string y no como selector (SafeTransferLib de Solmate).
 * TRANSFER_FROM_FAILED con las aprobaciones puestas significa que el encoding paso
 * TODO y murio al mover el token: casi siempre es que no alcanza el saldo para el
 * monto de prueba. Es una senal buena, no un error.
 */
const STRING_REVERTS = [
  ['TRANSFER_FROM_FAILED', 'ENCODING OK (aprobado, pero no alcanza el saldo para el monto de prueba)', true],
  ['STF', 'ENCODING OK (aprobado, pero no alcanza el saldo para el monto de prueba)', true],
]

async function connect() {
  for (const url of RPCS) {
    const client = createPublicClient({ chain: base, transport: http(url) })
    try { await client.getBlockNumber(); return client } catch { /* siguiente */ }
  }
  throw new Error('ningun RPC de Base respondio')
}
const client = await connect()

const pace = () => new Promise((r) => setTimeout(r, 120))
const line = (n = 74) => console.log('-'.repeat(n))

/**
 * Distingue "el pool no da" de "el RPC fallo". La clasificacion va por el tipo de
 * error de viem y no por el texto: un revert del contrato ES la respuesta (no hay
 * liquidez) y no se reintenta, pero un fallo de transporte si, porque los RPC
 * publicos limitan cuando se los bombardea.
 */
async function quote(r, amountIn, attempts = 4) {
  await pace()
  for (let i = 0; i < attempts; i++) {
    try {
      const { result } = await client.simulateContract({
        address: QUOTER, abi: quoterAbi, functionName: 'quoteExactInputSingle',
        args: [{ poolKey: r.poolKey, zeroForOne: r.zeroForOne, exactAmount: amountIn, hookData: '0x' }],
      })
      return result[0]
    } catch (e) {
      const reverted = e?.cause?.name === 'ContractFunctionRevertedError' ||
        e?.name === 'ContractFunctionRevertedError'
      if (reverted) return null
      if (i === attempts - 1) return null
      await new Promise((r2) => setTimeout(r2, 500 * (i + 1)))
    }
  }
  return null
}

const retry = async (fn, attempts = 4) => {
  for (let i = 0; i < attempts; i++) {
    try { return await fn() } catch (e) {
      if (i === attempts - 1) throw e
      await new Promise((r) => setTimeout(r, 500 * (i + 1)))
    }
  }
}

let failures = 0

for (const r of ROUTES) {
  console.log(`\n${'='.repeat(74)}\n${r.name}\n${'='.repeat(74)}`)

  // ---------------------------------------------------------------- 1. el pool
  const poolId = keccak256(encodeAbiParameters(
    [{ type: 'address' }, { type: 'address' }, { type: 'uint24' }, { type: 'int24' }, { type: 'address' }],
    [r.poolKey.currency0, r.poolKey.currency1, r.poolKey.fee, r.poolKey.tickSpacing, r.poolKey.hooks],
  ))
  console.log('poolId      ', poolId.slice(0, 26) + '...')
  console.log('fee          ' + r.poolKey.fee / 10_000 + '%   tickSpacing ' + r.poolKey.tickSpacing)
  console.log('zeroForOne   ' + r.zeroForOne + '  (derivado: ' + r.from + ' es currency' + (r.zeroForOne ? '0' : '1') + ')')

  let liquidity
  try {
    liquidity = await retry(() => client.readContract({
      address: STATE_VIEW, abi: stateViewAbi, functionName: 'getLiquidity', args: [poolId],
    }))
  } catch {
    console.log('\nno se pudo leer la liquidez del pool')
    failures++
    continue
  }
  if (liquidity === 0n) {
    console.log('\nEL POOL NO TIENE LIQUIDEZ')
    failures++
    continue
  }
  console.log('liquidez    ', liquidity.toString())

  // ------------------------------------------------------ 2. curva de cotizacion
  console.log(`\n  ${r.from} in`.padEnd(16) + `${r.to} out`.padStart(20) + '     impacto')
  line()
  let baseRate = null
  for (const probe of r.probes) {
    const inWei = parseUnits(probe, r.tokenIn.decimals)
    const out = await quote(r, inWei)
    if (out === null) { console.log(`  ${probe.padStart(12)}  revierte (sin profundidad)`); continue }
    const rate = Number(probe) / Number(formatUnits(out, r.tokenOut.decimals))
    if (baseRate === null) baseRate = rate
    const impact = ((rate / baseRate - 1) * 100).toFixed(2)
    console.log(
      `  ${probe.padStart(12)}  ${Number(formatUnits(out, r.tokenOut.decimals)).toFixed(8).padStart(18)}` +
      `  ${(impact + '%').padStart(9)}`,
    )
  }

  // -------------------------------------------------------- 3. el encoding real
  const testIn = parseUnits(r.probes[0], r.tokenIn.decimals)
  const testOut = await quote(r, testIn)
  if (testOut === null) {
    console.log('\nno se pudo cotizar el monto de prueba, se saltea el encoding')
    failures++
    continue
  }
  const minOut = (testOut * 99n) / 100n
  const params = [
    encodeAbiParameters([exactInSingle], [{
      poolKey: r.poolKey, zeroForOne: r.zeroForOne,
      amountIn: testIn, amountOutMinimum: minOut, hookData: '0x',
    }]),
    encodeAbiParameters([{ type: 'address' }, { type: 'uint256' }], [r.tokenIn.address, testIn]),
    encodeAbiParameters([{ type: 'address' }, { type: 'uint256' }], [r.tokenOut.address, minOut]),
  ]
  const input = encodeAbiParameters([{ type: 'bytes' }, { type: 'bytes[]' }], ['0x060c0f', params])
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200)

  console.log(`\nencoding: ${r.probes[0]} ${r.from}, minimo ${formatUnits(minOut, r.tokenOut.decimals)} ${r.to}`)
  try {
    // Con entrada nativa el monto viaja como value y no hay Permit2 de por medio.
    const inIsNative = r.tokenIn.address === ZERO
    await client.simulateContract({
      address: ROUTER, abi: routerAbi, functionName: 'execute',
      args: ['0x10', [input], deadline], account: USER,
      value: inIsNative ? testIn : 0n,
    })
    console.log(
      r.tokenIn.address === ZERO
        ? '  NO REVIRTIO: la entrada nativa no necesita aprobaciones, se puede firmar.'
        : '  NO REVIRTIO: las aprobaciones ya estan puestas, se puede firmar.',
    )
  } catch (e) {
    const raw = JSON.stringify(e.cause ?? e)
    const asString = STRING_REVERTS.find(([needle]) => String(e).includes(needle))
    if (asString) {
      const [needle, msg, ok] = asString
      console.log(`  revert "${needle}"`)
      console.log(`  ${msg}`)
      if (!ok) failures++
      continue
    }
    const found = [...SELECTORS.entries()].find(([sel]) => raw.includes(sel.slice(2)))
    if (found) {
      const [sel, { sig, msg, ok }] = found
      console.log(`  revert ${sel}  ${sig}`)
      console.log(`  ${msg}`)
      if (!ok) failures++
    } else {
      console.log('  revert no reconocido:')
      console.log('  ' + String(e).split('\n').slice(0, 3).join('\n  '))
      failures++
    }
  }
}

// -------------------------------------------------------- 4. estado del wallet
console.log(`\n${'='.repeat(74)}\nESTADO DE ${USER}\n${'='.repeat(74)}`)
const now = Math.floor(Date.now() / 1000)
const eth = await retry(() => client.getBalance({ address: USER }))
console.log('ETH en Base            ', formatUnits(eth, 18), eth === 0n ? '  <-- SIN GAS' : '')

for (const [symbol, t] of Object.entries(TOKEN)) {
  if (t.address === ZERO) continue // el saldo nativo ya se imprimio arriba
  const balance = await retry(() => client.readContract({
    address: t.address, abi: erc20Abi, functionName: 'balanceOf', args: [USER],
  }))
  const toPermit2 = await retry(() => client.readContract({
    address: t.address, abi: erc20Abi, functionName: 'allowance', args: [USER, PERMIT2],
  }))
  const p2 = await retry(() => client.readContract({
    address: PERMIT2, abi: permit2Abi, functionName: 'allowance', args: [USER, t.address, ROUTER],
  }))
  const expired = Number(p2[1]) <= now
  console.log(
    `${symbol.padEnd(8)} saldo ${formatUnits(balance, t.decimals).padStart(22)}   ` +
    `permisos: ${toPermit2 === 0n ? 'sin aprobar' : 'ERC20 ok'} / ` +
    `${p2[0] === 0n ? 'sin aprobar' : expired ? 'VENCIDO' : 'router ok'}`,
  )
}

console.log()
if (failures > 0) {
  console.log(`${failures} ruta(s) con problemas.`)
  process.exit(1)
}
console.log('Todas las rutas OK: pool con liquidez, cotizacion y encoding validos.')
