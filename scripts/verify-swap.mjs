// Verifica el camino completo de "dolarizar": ARGt -> USDC en el pool de Uniswap V4
// que Twin usa en Base. No gasta gas: todo es eth_call.
//
// La seccion 3 es la que importa. Simula el execute() real del UniversalRouter y
// clasifica el revert. Antes de aprobar Permit2 el revert ESPERADO es
// AllowanceExpired: significa que el command byte, el decode del input, las tres
// acciones y el swap contra el pool pasaron, y que murio recien al ir a buscar el
// ARGt. Cualquier otro revert apunta a un error de encoding concreto.
//
// Uso: node scripts/verify-swap.mjs [address]
import {
  createPublicClient, http, encodeAbiParameters, keccak256, parseUnits,
  formatUnits, toFunctionSelector,
} from 'viem'
import { base } from 'viem/chains'

// Tenderly primero: mainnet.base.org devuelve "over rate limit" apenas se le
// mandan unas pocas llamadas seguidas, y este script hace decenas.
const RPCS = ['https://base.gateway.tenderly.co', 'https://mainnet.base.org']
const USER = process.argv[2] ?? '0xbc58987f6A715dc0EB4dF0Eaa50afdcf8014D29c'

const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
const ARGT = '0xf016413834E6D1A14F3D628B11D6Ef725a6bdbDD'
const STATE_VIEW = '0xA3c0c9b65baD0b08107Aa264b0f3dB444b867A71'
const QUOTER = '0x0d5e0F971ED27FBfF6c2837bf31316121532048D'
const ROUTER = '0x6fF5693b99212Da76ad316178A184AB56D299b43'
const PERMIT2 = '0x000000000022D473030F116dDEE9F6B43aC78BA3'
const ZERO = '0x0000000000000000000000000000000000000000'

// currency0 es SIEMPRE la address menor. USDC < ARGt, por eso ARGt->USDC es zeroForOne=false.
const POOL = { currency0: USDC, currency1: ARGT, fee: 3000, tickSpacing: 60, hooks: ZERO }

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
  ['AllowanceExpired(uint256)', 'ENCODING OK. Falta la aprobacion de Permit2, que es lo esperado antes de aprobar.', true],
  ['InvalidCommandType(uint256)', 'MAL: el command byte no es 0x10 (V4_SWAP).', false],
  ['LengthMismatch()', 'MAL: commands e inputs no tienen el mismo largo.', false],
  ['InputLengthMismatch()', 'MAL: actions y params no tienen el mismo largo.', false],
  ['UnsupportedAction(uint256)', 'MAL: alguna de las acciones de 0x060c0f esta mal.', false],
  ['PoolNotInitialized()', 'MAL: el PoolKey no corresponde a ningun pool inicializado.', false],
  ['V4TooLittleReceived(uint256,uint256)', 'amountOutMinimum quedo demasiado alto.', false],
  ['CurrencyNotSettled()', 'MAL: falta un SETTLE o un TAKE en las acciones.', false],
  ['InsufficientAllowance(uint256)', 'ENCODING OK. La allowance de Permit2 no alcanza.', true],
]
const SELECTORS = new Map(DIAGNOSIS.map(([sig, msg, ok]) => [toFunctionSelector(sig), { sig, msg, ok }]))

async function connect() {
  for (const url of RPCS) {
    const client = createPublicClient({ chain: base, transport: http(url) })
    try { await client.getBlockNumber(); return client } catch { /* siguiente */ }
  }
  throw new Error('ningun RPC de Base respondio')
}
const client = await connect()

const line = (n = 74) => console.log('-'.repeat(n))

// ---------------------------------------------------------------- 1. el pool
console.log('\n1. EL POOL')
line()
const poolId = keccak256(encodeAbiParameters(
  [{ type: 'address' }, { type: 'address' }, { type: 'uint24' }, { type: 'int24' }, { type: 'address' }],
  [POOL.currency0, POOL.currency1, POOL.fee, POOL.tickSpacing, POOL.hooks],
))
console.log('poolId     ', poolId)
console.log('esperado   0xba3ea6f7... ->', poolId.startsWith('0xba3ea6f7') ? 'COINCIDE' : 'NO COINCIDE')
const [liquidity, slot0] = await Promise.all([
  client.readContract({ address: STATE_VIEW, abi: stateViewAbi, functionName: 'getLiquidity', args: [poolId] }),
  client.readContract({ address: STATE_VIEW, abi: stateViewAbi, functionName: 'getSlot0', args: [poolId] }),
])
console.log('liquidez   ', liquidity.toString())
console.log('tick       ', slot0[1])
if (liquidity === 0n) {
  console.log('\nEL POOL NO TIENE LIQUIDEZ. La pantalla de cambio no puede funcionar.')
  process.exit(1)
}

// ------------------------------------------------------ 2. curva de cotizacion
// Distingue "el pool no da" de "el RPC fallo": el segundo se reintenta, si no un
// hipo del RPC se lee como falta de liquidez y el techo sale mal.
const pace = () => new Promise((r) => setTimeout(r, 120))
const quote = async (amountArgt, attempts = 4) => {
  await pace()
  for (let i = 0; i < attempts; i++) {
    try {
      const { result } = await client.simulateContract({
        address: QUOTER, abi: quoterAbi, functionName: 'quoteExactInputSingle',
        args: [{ poolKey: POOL, zeroForOne: false, exactAmount: amountArgt, hookData: '0x' }],
      })
      return result[0]
    } catch (e) {
      // Clasificar por el tipo de error de viem, no por el texto: un revert del
      // contrato ES la respuesta (no hay liquidez) y no se reintenta, pero un fallo
      // de transporte sí, porque los RPC publicos limitan cuando se los bombardea.
      const reverted = e?.cause?.name === 'ContractFunctionRevertedError' ||
        e?.name === 'ContractFunctionRevertedError'
      if (reverted) return null
      if (i === attempts - 1) return null
      await new Promise((r) => setTimeout(r, 500 * (i + 1)))
    }
  }
  return null
}

console.log('\n2. COTIZACIONES')
line()
console.log('   ARGt       ->        USDC     1 USDC =        costo')
let baseRate = null
for (const amount of ['1000', '10000', '100000', '300000']) {
  const inWei = parseUnits(amount, 18)
  const out = await quote(inWei)
  if (out === null) { console.log(`${amount.padStart(8)}  revierte`); continue }
  const rate = Number(amount) / Number(formatUnits(out, 6))
  if (baseRate === null) baseRate = rate
  const cost = ((rate / baseRate - 1) * 100).toFixed(2)
  console.log(
    `${amount.padStart(8)}  -> ${Number(formatUnits(out, 6)).toFixed(6).padStart(12)}  ` +
    `${rate.toFixed(2).padStart(10)}  ${(cost + '%').padStart(8)}`,
  )
}

// Techo real del pool. Primero busca un piso que cotice, despues bisecta: el techo
// se mueve con la liquidez, asi que no se puede asumir que 300k entra.
const fmt = (v) => Number(formatUnits(v, 18)).toLocaleString('es-AR', { maximumFractionDigits: 0 })
let lo = 0n, hi = null
for (const probe of ['1000', '10000', '100000', '300000', '600000', '1000000']) {
  const value = parseUnits(probe, 18)
  if ((await quote(value)) !== null) lo = value
  else { hi = value; break }
}
if (hi === null) console.log(`\ntecho: mas de ${fmt(lo)} ARGt`)
else if (lo === 0n) console.log('\ntecho: menos de 1.000 ARGt, el pool esta casi vacio')
else {
  for (let i = 0; i < 14; i++) {
    const mid = (lo + hi) / 2n
    if ((await quote(mid)) !== null) lo = mid; else hi = mid
  }
  console.log(`\ntecho: entran ${fmt(lo)} ARGt, revierte en ${fmt(hi)}`)
}

// -------------------------------------------------------- 3. el encoding real
console.log('\n3. ENCODING DEL UNIVERSAL ROUTER')
line()
const TEST_IN = parseUnits('20', 18)
const testOut = await quote(TEST_IN)
if (testOut === null) { console.log('no se pudo cotizar el monto de prueba'); process.exit(1) }
const minOut = (testOut * 99n) / 100n

const actions = '0x060c0f' // SWAP_EXACT_IN_SINGLE, SETTLE_ALL, TAKE_ALL
const params = [
  encodeAbiParameters([exactInSingle], [{
    poolKey: POOL, zeroForOne: false, amountIn: TEST_IN, amountOutMinimum: minOut, hookData: '0x',
  }]),
  encodeAbiParameters([{ type: 'address' }, { type: 'uint256' }], [ARGT, TEST_IN]),
  encodeAbiParameters([{ type: 'address' }, { type: 'uint256' }], [USDC, minOut]),
]
const input = encodeAbiParameters([{ type: 'bytes' }, { type: 'bytes[]' }], [actions, params])
const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200)

console.log('probando con 20 ARGt, minimo', formatUnits(minOut, 6), 'USDC')
console.log('commands  0x10        actions  ' + actions)
try {
  await client.simulateContract({
    address: ROUTER, abi: routerAbi, functionName: 'execute',
    args: ['0x10', [input], deadline], account: USER, value: 0n,
  })
  console.log('\nNO REVIRTIO: las dos aprobaciones ya estan puestas, se puede firmar.')
} catch (e) {
  const raw = JSON.stringify(e.cause ?? e)
  const found = [...SELECTORS.entries()].find(([sel]) => raw.includes(sel.slice(2)))
  if (found) {
    const [sel, { sig, msg, ok }] = found
    console.log(`\nrevert ${sel}  ${sig}`)
    console.log((ok ? '\n' : '\n') + msg)
    if (!ok) process.exitCode = 1
  } else {
    console.log('\nrevert no reconocido:')
    console.log(String(e).split('\n').slice(0, 4).join('\n'))
    process.exitCode = 1
  }
}

// -------------------------------------------------------- 4. estado del wallet
console.log('\n4. ESTADO DE ' + USER)
line()
/** Reintenta las lecturas: el rate limit del RPC no deberia tumbar el reporte. */
const retry = async (fn, attempts = 4) => {
  for (let i = 0; i < attempts; i++) {
    try { return await fn() } catch (e) {
      if (i === attempts - 1) throw e
      await new Promise((r) => setTimeout(r, 500 * (i + 1)))
    }
  }
}
const [argt, usdc, eth, tokenAllowance, p2] = [
  await retry(() => client.readContract({ address: ARGT, abi: erc20Abi, functionName: 'balanceOf', args: [USER] })),
  await retry(() => client.readContract({ address: USDC, abi: erc20Abi, functionName: 'balanceOf', args: [USER] })),
  await retry(() => client.getBalance({ address: USER })),
  await retry(() => client.readContract({ address: ARGT, abi: erc20Abi, functionName: 'allowance', args: [USER, PERMIT2] })),
  await retry(() => client.readContract({ address: PERMIT2, abi: permit2Abi, functionName: 'allowance', args: [USER, ARGT, ROUTER] })),
]
const now = Math.floor(Date.now() / 1000)
console.log('ARGt en Base           ', formatUnits(argt, 18))
console.log('USDC en Base           ', formatUnits(usdc, 6))
console.log('ETH  en Base           ', formatUnits(eth, 18), eth === 0n ? '  <-- SIN GAS, no vas a poder firmar' : '')
console.log('ARGt -> Permit2        ', tokenAllowance === 0n ? 'sin aprobar' : formatUnits(tokenAllowance, 18))
console.log('Permit2 -> Router      ', p2[0] === 0n ? 'sin aprobar' : `${formatUnits(p2[0], 18)}, vence ${p2[1]}` +
  (Number(p2[1]) <= now ? '  <-- VENCIDA' : ''))
console.log()
