'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { usePrivy } from '@privy-io/react-auth'
import { useAccount } from 'wagmi'
import { shortAddress } from '@/lib/format'
import { Button, Spinner, cn } from './ui'

const NAV = [
  { href: '/', label: 'Inicio', icon: 'M10 2.5 2.5 8.4V17a.5.5 0 0 0 .5.5h4.5v-5h5v5H17a.5.5 0 0 0 .5-.5V8.4L10 2.5Z' },
  { href: '/enviar', label: 'Enviar', icon: 'M17 3 3 9.2l5.3 2.1L10.4 17 17 3Z' },
  { href: '/ahorro', label: 'Ahorro', icon: 'M3 6.5A2.5 2.5 0 0 1 5.5 4h9A2.5 2.5 0 0 1 17 6.5v7a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 3 13.5v-7Zm10.5 5.5a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5Z' },
  { href: '/mover', label: 'Mover', icon: 'M6.5 3 2 7.5l4.5 4.5V9h7V6h-7V3Zm7 6v3h-7v3h7v3L18 13.5 13.5 9Z' },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const { ready, authenticated } = usePrivy()
  const pathname = usePathname()

  if (!ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Spinner className="size-6 text-ink-600" />
      </div>
    )
  }

  if (!authenticated) return <LoginScreen />

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
      <Header />
      <main className="flex-1 px-4 pb-28">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-md border-t border-ink-800 bg-ink-950/95 backdrop-blur">
        <ul className="grid grid-cols-4">
          {NAV.map((item) => {
            const active = pathname === item.href
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    'flex flex-col items-center gap-1 py-3 text-[11px] font-medium transition-colors',
                    active ? 'text-mint-400' : 'text-ink-400 hover:text-ink-100',
                  )}
                >
                  <svg viewBox="0 0 20 20" className="size-5" fill="currentColor" aria-hidden>
                    <path d={item.icon} />
                  </svg>
                  {item.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </div>
  )
}

function Header() {
  const { logout, user } = usePrivy()
  const { address } = useAccount()
  const handle = user?.email?.address ?? user?.google?.email ?? shortAddress(address)

  return (
    <header className="flex items-center justify-between px-4 py-5">
      <Link href="/" className="flex items-center gap-2">
        <span className="grid size-8 place-items-center rounded-lg bg-mint-400 text-sm font-bold text-ink-950">
          T
        </span>
        <span className="text-sm font-semibold tracking-tight">Twin</span>
      </Link>
      <button
        onClick={logout}
        className="max-w-[55%] truncate rounded-full border border-ink-800 px-3 py-1.5 text-xs text-ink-300 transition-colors hover:border-ink-600 hover:text-ink-100"
        title="Cerrar sesión"
      >
        {handle || 'Salir'}
      </button>
    </header>
  )
}

function LoginScreen() {
  const { login } = usePrivy()
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-between px-6 py-14">
      <div>
        <span className="grid size-12 place-items-center rounded-2xl bg-mint-400 text-xl font-bold text-ink-950">
          T
        </span>
        <h1 className="mt-10 text-4xl font-semibold leading-[1.1] tracking-tight">
          Tu plata,
          <br />
          en cualquier
          <br />
          <span className="text-mint-400">moneda.</span>
        </h1>
        <p className="mt-5 max-w-xs text-base leading-relaxed text-ink-400">
          Pesos, reales y soles en una sola cuenta. Enviá al instante, ganá rendimiento y mové tu
          plata entre redes sin pensar en cripto.
        </p>
      </div>

      <div className="space-y-4">
        <Button onClick={login}>Entrar</Button>
        <p className="text-center text-xs leading-relaxed text-ink-600">
          Con tu email o Google. Te creamos la cuenta sola, sin seed phrase.
        </p>
      </div>
    </div>
  )
}
