import { fallback, http } from 'wagmi'
import { arbitrum, base, polygon } from 'wagmi/chains'
import { createConfig } from '@privy-io/wagmi'

/**
 * RPCs publicos, cada uno con un suplente.
 *
 * No es precaucion teorica: mainnet.base.org devuelve {"details":"over rate limit"}
 * apenas se le mandan unas pocas llamadas seguidas, y la pantalla de dolarizar
 * cotiza cada vez que el usuario escribe. Con fallback, viem pasa al siguiente
 * recien cuando el primero falla, asi que el camino feliz no cambia.
 *
 * Se pueden pisar los primarios por env.
 */
const withFallback = (primary: string | undefined, base_: string, backup: string) =>
  fallback([http(primary || base_), http(backup)])

export const wagmiConfig = createConfig({
  chains: [arbitrum, base, polygon],
  transports: {
    [arbitrum.id]: withFallback(
      process.env.NEXT_PUBLIC_RPC_ARBITRUM,
      'https://arb1.arbitrum.io/rpc',
      'https://arbitrum.gateway.tenderly.co',
    ),
    [base.id]: withFallback(
      process.env.NEXT_PUBLIC_RPC_BASE,
      'https://mainnet.base.org',
      'https://base.gateway.tenderly.co',
    ),
    [polygon.id]: withFallback(
      process.env.NEXT_PUBLIC_RPC_POLYGON,
      'https://polygon-bor-rpc.publicnode.com',
      'https://polygon.gateway.tenderly.co',
    ),
  },
  ssr: true,
})

declare module 'wagmi' {
  interface Register {
    config: typeof wagmiConfig
  }
}
