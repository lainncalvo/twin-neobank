/**
 * Uniswap V4 en Base: lo minimo para cotizar y ejecutar ARGt -> USDC.
 * Todo verificado con scripts/verify-swap.mjs, que simula el execute() real.
 *
 * Tres trampas que costaron y que no hay que "corregir":
 *
 * 1. `quoteExactInputSingle` es nonpayable, NO view. Va con simulateContract,
 *    no con readContract ni useReadContracts.
 * 2. `ExactInputSingleParams` tiene 5 campos, sin sqrtPriceLimitX96: se saco en
 *    la version final de v4-periphery. Agregarlo desalinea el abi.decode y el
 *    swap revierte con un error que no ayuda.
 * 3. `amountIn` y `amountOutMinimum` son uint128. En SETTLE_ALL y TAKE_ALL los
 *    montos si son uint256.
 */

/** El PoolKey, tal como lo espera el contrato. */
export const poolKeyTuple = {
  type: 'tuple',
  components: [
    { name: 'currency0', type: 'address' },
    { name: 'currency1', type: 'address' },
    { name: 'fee', type: 'uint24' },
    { name: 'tickSpacing', type: 'int24' },
    { name: 'hooks', type: 'address' },
  ],
} as const

/** Params de la accion SWAP_EXACT_IN_SINGLE. Cinco campos, ver nota 2 arriba. */
export const exactInputSingleTuple = {
  type: 'tuple',
  components: [
    { name: 'poolKey', ...poolKeyTuple },
    { name: 'zeroForOne', type: 'bool' },
    { name: 'amountIn', type: 'uint128' },
    { name: 'amountOutMinimum', type: 'uint128' },
    { name: 'hookData', type: 'bytes' },
  ],
} as const

export const v4QuoterAbi = [
  {
    type: 'function',
    name: 'quoteExactInputSingle',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'poolKey', ...poolKeyTuple },
          { name: 'zeroForOne', type: 'bool' },
          { name: 'exactAmount', type: 'uint128' },
          { name: 'hookData', type: 'bytes' },
        ],
      },
    ],
    outputs: [
      { name: 'amountOut', type: 'uint256' },
      { name: 'gasEstimate', type: 'uint256' },
    ],
  },
] as const

/**
 * Solo la sobrecarga de 3 argumentos de execute(). El router tiene otra sin
 * deadline; si estan las dos, viem no sabe cual elegir y tira error de ambiguedad.
 */
export const universalRouterAbi = [
  {
    type: 'function',
    name: 'execute',
    stateMutability: 'payable',
    inputs: [
      { name: 'commands', type: 'bytes' },
      { name: 'inputs', type: 'bytes[]' },
      { name: 'deadline', type: 'uint256' },
    ],
    outputs: [],
  },
] as const

/** Command del UniversalRouter que enruta al PoolManager de V4. */
export const UR_COMMAND_V4_SWAP = '0x10' as const

/**
 * Las tres acciones, en orden: hacer el swap, pagar lo que ponemos, retirar lo que
 * sacamos. TAKE_ALL manda el output a msgSender() implicitamente, no lleva
 * parametro de destinatario.
 */
export const V4_ACTIONS = '0x060c0f' as const
