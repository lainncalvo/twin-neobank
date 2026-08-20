/**
 * ABI del OFT Adapter de LayerZero V2 que usa el bridge de Twin.
 * Solo las funciones que necesitamos. Verificado on-chain: los tres adapters
 * responden approvalRequired() = true (patron lockbox: hay que approve el ERC-20
 * al adapter antes de send) y tienen enforcedOptions ya seteadas, asi que
 * extraOptions puede ir en '0x'.
 */
export const oftAdapterAbi = [
  {
    type: 'function',
    name: 'token',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'approvalRequired',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'sharedDecimals',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint8' }],
  },
  {
    type: 'function',
    name: 'peers',
    stateMutability: 'view',
    inputs: [{ name: 'eid', type: 'uint32' }],
    outputs: [{ type: 'bytes32' }],
  },
  {
    type: 'function',
    name: 'quoteOFT',
    stateMutability: 'view',
    inputs: [
      {
        name: 'sendParam',
        type: 'tuple',
        components: [
          { name: 'dstEid', type: 'uint32' },
          { name: 'to', type: 'bytes32' },
          { name: 'amountLD', type: 'uint256' },
          { name: 'minAmountLD', type: 'uint256' },
          { name: 'extraOptions', type: 'bytes' },
          { name: 'composeMsg', type: 'bytes' },
          { name: 'oftCmd', type: 'bytes' },
        ],
      },
    ],
    outputs: [
      {
        name: 'oftLimit',
        type: 'tuple',
        components: [
          { name: 'minAmountLD', type: 'uint256' },
          { name: 'maxAmountLD', type: 'uint256' },
        ],
      },
      {
        name: 'oftFeeDetails',
        type: 'tuple[]',
        components: [
          { name: 'feeAmountLD', type: 'int256' },
          { name: 'description', type: 'string' },
        ],
      },
      {
        name: 'oftReceipt',
        type: 'tuple',
        components: [
          { name: 'amountSentLD', type: 'uint256' },
          { name: 'amountReceivedLD', type: 'uint256' },
        ],
      },
    ],
  },
  {
    type: 'function',
    name: 'quoteSend',
    stateMutability: 'view',
    inputs: [
      {
        name: 'sendParam',
        type: 'tuple',
        components: [
          { name: 'dstEid', type: 'uint32' },
          { name: 'to', type: 'bytes32' },
          { name: 'amountLD', type: 'uint256' },
          { name: 'minAmountLD', type: 'uint256' },
          { name: 'extraOptions', type: 'bytes' },
          { name: 'composeMsg', type: 'bytes' },
          { name: 'oftCmd', type: 'bytes' },
        ],
      },
      { name: 'payInLzToken', type: 'bool' },
    ],
    outputs: [
      {
        name: 'msgFee',
        type: 'tuple',
        components: [
          { name: 'nativeFee', type: 'uint256' },
          { name: 'lzTokenFee', type: 'uint256' },
        ],
      },
    ],
  },
  {
    type: 'function',
    name: 'send',
    stateMutability: 'payable',
    inputs: [
      {
        name: 'sendParam',
        type: 'tuple',
        components: [
          { name: 'dstEid', type: 'uint32' },
          { name: 'to', type: 'bytes32' },
          { name: 'amountLD', type: 'uint256' },
          { name: 'minAmountLD', type: 'uint256' },
          { name: 'extraOptions', type: 'bytes' },
          { name: 'composeMsg', type: 'bytes' },
          { name: 'oftCmd', type: 'bytes' },
        ],
      },
      {
        name: 'fee',
        type: 'tuple',
        components: [
          { name: 'nativeFee', type: 'uint256' },
          { name: 'lzTokenFee', type: 'uint256' },
        ],
      },
      { name: 'refundAddress', type: 'address' },
    ],
    outputs: [
      {
        name: 'msgReceipt',
        type: 'tuple',
        components: [
          { name: 'guid', type: 'bytes32' },
          { name: 'nonce', type: 'uint64' },
          {
            name: 'fee',
            type: 'tuple',
            components: [
              { name: 'nativeFee', type: 'uint256' },
              { name: 'lzTokenFee', type: 'uint256' },
            ],
          },
        ],
      },
      {
        name: 'oftReceipt',
        type: 'tuple',
        components: [
          { name: 'amountSentLD', type: 'uint256' },
          { name: 'amountReceivedLD', type: 'uint256' },
        ],
      },
    ],
  },
] as const

export type SendParam = {
  dstEid: number
  to: `0x${string}`
  amountLD: bigint
  minAmountLD: bigint
  extraOptions: `0x${string}`
  composeMsg: `0x${string}`
  oftCmd: `0x${string}`
}
