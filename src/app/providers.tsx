'use client'

import { PrivyProvider } from '@privy-io/react-auth'
import { WagmiProvider } from '@privy-io/wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { arbitrum, base, polygon } from 'wagmi/chains'
import { wagmiConfig } from '@/lib/wagmi'

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 10_000, refetchOnWindowFocus: false, retry: 1 },
        },
      }),
  )

  // Sin App ID, PrivyProvider tira y se cae toda la app. Mejor un cartel claro.
  if (!PRIVY_APP_ID) return <MissingPrivyConfig />

  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        loginMethods: ['email', 'google', 'wallet'],
        appearance: {
          theme: '#0B0D12',
          accentColor: '#6EE7B7',
          landingHeader: 'Entrá a tu banco',
          loginMessage: 'Tu plata en pesos, reales o soles. En un solo lugar.',
          showWalletLoginFirst: false,
        },
        embeddedWallets: {
          ethereum: { createOnLogin: 'users-without-wallets' },
          showWalletUIs: true,
        },
        defaultChain: arbitrum,
        supportedChains: [arbitrum, base, polygon],
      }}
    >
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={wagmiConfig}>{children}</WagmiProvider>
      </QueryClientProvider>
    </PrivyProvider>
  )
}

function MissingPrivyConfig() {
  return (
    <div className="flex min-h-dvh items-center justify-center p-6">
      <div className="max-w-md rounded-2xl border border-amber-500/30 bg-amber-500/5 p-6 text-sm">
        <h1 className="mb-2 text-base font-semibold text-amber-200">Falta configurar Privy</h1>
        <p className="text-neutral-400">
          Creá una app en <span className="text-neutral-200">dashboard.privy.io</span> y poné el App
          ID en <code className="rounded bg-black/40 px-1">.env.local</code>:
        </p>
        <pre className="mt-3 overflow-x-auto rounded-lg bg-black/40 p-3 text-xs text-neutral-300">
          NEXT_PUBLIC_PRIVY_APP_ID=tu-app-id
        </pre>
      </div>
    </div>
  )
}
