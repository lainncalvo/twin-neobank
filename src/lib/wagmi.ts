import { http } from 'wagmi'
import { arbitrum, base, polygon } from 'wagmi/chains'
import { createConfig } from '@privy-io/wagmi'

/**
 * RPCs publicos. Se pueden pisar por env si algun endpoint tira rate limit
 * durante la demo.
 */
export const wagmiConfig = createConfig({
  chains: [arbitrum, base, polygon],
  transports: {
    [arbitrum.id]: http(process.env.NEXT_PUBLIC_RPC_ARBITRUM || 'https://arb1.arbitrum.io/rpc'),
    [base.id]: http(process.env.NEXT_PUBLIC_RPC_BASE || 'https://mainnet.base.org'),
    [polygon.id]: http(process.env.NEXT_PUBLIC_RPC_POLYGON || 'https://polygon-bor-rpc.publicnode.com'),
  },
  ssr: true,
})

declare module 'wagmi' {
  interface Register {
    config: typeof wagmiConfig
  }
}
