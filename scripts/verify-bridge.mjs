// Cotiza las seis rutas del bridge contra los contratos reales, sin gastar gas.
// Usa el mismo SendParam que arma la app: si esto anda, el encoding es correcto.
import { createPublicClient, http, pad, formatUnits, parseUnits } from 'viem'
import { arbitrum, base, polygon } from 'viem/chains'

const sendParamTuple = {
  name: 'sendParam', type: 'tuple',
  components: [
    { name: 'dstEid', type: 'uint32' }, { name: 'to', type: 'bytes32' },
    { name: 'amountLD', type: 'uint256' }, { name: 'minAmountLD', type: 'uint256' },
    { name: 'extraOptions', type: 'bytes' }, { name: 'composeMsg', type: 'bytes' },
    { name: 'oftCmd', type: 'bytes' },
  ],
}
const feeTuple = { type: 'tuple', components: [{ name: 'nativeFee', type: 'uint256' }, { name: 'lzTokenFee', type: 'uint256' }] }
const abi = [
  { type: 'function', name: 'quoteSend', stateMutability: 'view',
    inputs: [sendParamTuple, { name: 'payInLzToken', type: 'bool' }], outputs: [{ ...feeTuple, name: 'msgFee' }] },
  { type: 'function', name: 'quoteOFT', stateMutability: 'view', inputs: [sendParamTuple],
    outputs: [
      { name: 'oftLimit', type: 'tuple', components: [{ name: 'minAmountLD', type: 'uint256' }, { name: 'maxAmountLD', type: 'uint256' }] },
      { name: 'oftFeeDetails', type: 'tuple[]', components: [{ name: 'feeAmountLD', type: 'int256' }, { name: 'description', type: 'string' }] },
      { name: 'oftReceipt', type: 'tuple', components: [{ name: 'amountSentLD', type: 'uint256' }, { name: 'amountReceivedLD', type: 'uint256' }] },
    ] },
]

const ADAPTERS = {
  [arbitrum.id]: '0x4821FBf47B261F0D52Ba0F941CF67b8648f82691',
  [base.id]: '0xe80Af1d12426dB4394b147e04f179a38e7C5Dfe7',
  [polygon.id]: '0xD70ad085684b2A9f4B5d54D7BDB2ecA37a273216',
}
const EID = { [arbitrum.id]: 30110, [base.id]: 30184, [polygon.id]: 30109 }
const RPC = {
  [arbitrum.id]: 'https://arb1.arbitrum.io/rpc',
  [base.id]: 'https://mainnet.base.org',
  [polygon.id]: 'https://polygon-bor-rpc.publicnode.com',
}
const NAME = { [arbitrum.id]: 'Arbitrum', [base.id]: 'Base', [polygon.id]: 'Polygon' }
const CHAINS = { [arbitrum.id]: arbitrum, [base.id]: base, [polygon.id]: polygon }

const USER = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'
const AMOUNT = parseUnits('1000', 18)

for (const src of [arbitrum.id, base.id, polygon.id]) {
  const client = createPublicClient({ chain: CHAINS[src], transport: http(RPC[src]) })
  for (const dst of [arbitrum.id, base.id, polygon.id]) {
    if (src === dst) continue
    const param = {
      dstEid: EID[dst], to: pad(USER, { size: 32 }),
      amountLD: AMOUNT, minAmountLD: AMOUNT,
      extraOptions: '0x', composeMsg: '0x', oftCmd: '0x',
    }
    try {
      const [fee, oft] = await Promise.all([
        client.readContract({ address: ADAPTERS[src], abi, functionName: 'quoteSend', args: [param, false] }),
        client.readContract({ address: ADAPTERS[src], abi, functionName: 'quoteOFT', args: [param] }),
      ])
      const native = CHAINS[src].nativeCurrency.symbol
      console.log(
        `${NAME[src]} -> ${NAME[dst]}: fee ${formatUnits(fee.nativeFee, 18)} ${native} | ` +
        `manda ${formatUnits(oft[2].amountSentLD, 18)} recibe ${formatUnits(oft[2].amountReceivedLD, 18)} ARGt`,
      )
    } catch (e) {
      console.log(`${NAME[src]} -> ${NAME[dst]}: FALLA -> ${String(e.message).split('\n')[0]}`)
    }
  }
}
