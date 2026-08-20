'use client'

import { useAccount } from 'wagmi'
import { AppShell } from '@/components/AppShell'
import { BackLink, Card, ErrorNote, Skeleton } from '@/components/ui'
import { MovementRow } from '@/components/MovementRow'
import { useHistory, type Movement } from '@/hooks/useHistory'
import { CHAIN_META } from '@/lib/chains'

export default function MovimientosPage() {
  return (
    <AppShell>
      <Movimientos />
    </AppShell>
  )
}

/** 'Hoy', 'Ayer' o la fecha. Agrupar por dia es lo que lo hace leible. */
function dayLabel(timestamp: number) {
  if (!timestamp) return 'Sin fecha'
  const date = new Date(timestamp * 1000)
  const today = new Date()
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString()
  if (sameDay(date, today)) return 'Hoy'
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (sameDay(date, yesterday)) return 'Ayer'
  return new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'long' }).format(date)
}

function Movimientos() {
  const { address } = useAccount()
  const { movements, partial, isLoading } = useHistory(address)

  const groups: { day: string; items: Movement[] }[] = []
  for (const movement of movements) {
    const day = dayLabel(movement.timestamp)
    const last = groups[groups.length - 1]
    if (last?.day === day) last.items.push(movement)
    else groups.push({ day, items: [movement] })
  }

  return (
    <div className="space-y-6">
      <BackLink />

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Movimientos</h1>
        <p className="mt-1 text-sm text-ink-400">
          Todo lo que entró y salió de tu cuenta, en las tres redes.
        </p>
      </div>

      {partial.length > 0 && (
        <ErrorNote>
          No pudimos leer los movimientos de {partial.map((c) => CHAIN_META[c].name).join(', ')}.
        </ErrorNote>
      )}

      {isLoading && (
        <div className="space-y-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-16 rounded-2xl" />
          ))}
        </div>
      )}

      {!isLoading && movements.length === 0 && (
        <Card className="p-6 text-center text-sm text-ink-400">
          Todavía no hay movimientos.
        </Card>
      )}

      {groups.map((group) => (
        <section key={group.day}>
          <h2 className="px-3 pb-1 text-xs font-medium uppercase tracking-wide text-ink-400">
            {group.day}
          </h2>
          <Card className="divide-y divide-ink-800/70 p-1">
            {group.items.map((m) => (
              <MovementRow key={m.id} movement={m} />
            ))}
          </Card>
        </section>
      ))}
    </div>
  )
}
