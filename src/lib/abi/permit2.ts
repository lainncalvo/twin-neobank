/**
 * Permit2. Ojo: su allowance NO es la de un ERC-20.
 *
 * Devuelve un triple (amount, expiration, nonce) y vence. Chequear solo el monto
 * y no `expiration > now` hace que el swap revierta con AllowanceExpired despues
 * de que el usuario ya firmo, que es la peor forma de descubrirlo.
 *
 * Y son dos aprobaciones distintas, ninguna reemplaza a la otra:
 *   1. ARGt.approve(PERMIT2, max)              <- el approve de ERC-20 de siempre
 *   2. PERMIT2.approve(ARGt, ROUTER, max, exp) <- este registro, aparte
 */
export const permit2Abi = [
  {
    type: 'function',
    name: 'allowance',
    stateMutability: 'view',
    inputs: [
      { name: 'user', type: 'address' },
      { name: 'token', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [
      { name: 'amount', type: 'uint160' },
      { name: 'expiration', type: 'uint48' },
      { name: 'nonce', type: 'uint48' },
    ],
  },
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint160' },
      { name: 'expiration', type: 'uint48' },
    ],
    outputs: [],
  },
] as const

/** Permit2 trata este expiration como "no vence nunca". */
export const PERMIT2_MAX_AMOUNT = 2n ** 160n - 1n
export const PERMIT2_MAX_EXPIRATION = 2n ** 48n - 1n
