'use client'

import Link from 'next/link'
import type { ComponentProps, ReactNode } from 'react'

export function cn(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ')
}

export function Card({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-ink-800 bg-ink-900/80 backdrop-blur',
        className,
      )}
      {...props}
    />
  )
}

type ButtonProps = ComponentProps<'button'> & {
  variant?: 'primary' | 'ghost' | 'danger'
  loading?: boolean
}

export function Button({ variant = 'primary', loading, className, children, disabled, ...props }: ButtonProps) {
  const styles = {
    primary:
      'bg-mint-400 text-ink-950 hover:bg-mint-500 disabled:bg-ink-700 disabled:text-ink-400',
    ghost:
      'border border-ink-700 bg-transparent text-ink-100 hover:bg-ink-800 disabled:text-ink-400',
    danger: 'bg-red-500/90 text-white hover:bg-red-500 disabled:bg-ink-700 disabled:text-ink-400',
  }[variant]

  return (
    <button
      className={cn(
        'inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold transition-colors disabled:cursor-not-allowed',
        styles,
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Spinner />}
      {children}
    </button>
  )
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent',
        className,
      )}
      aria-hidden
    />
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton rounded-lg', className)} />
}

export function Label({ children }: { children: ReactNode }) {
  return <span className="text-xs font-medium uppercase tracking-wide text-ink-400">{children}</span>
}

export function ErrorNote({ children }: { children: ReactNode }) {
  if (!children) return null
  return (
    <p className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">
      {children}
    </p>
  )
}

export function BackLink({ href = '/', label = 'Volver' }: { href?: string; label?: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 text-sm text-ink-400 transition-colors hover:text-ink-100"
    >
      <svg viewBox="0 0 20 20" className="size-4" fill="currentColor" aria-hidden>
        <path d="M12.28 4.22a.75.75 0 0 1 0 1.06L7.56 10l4.72 4.72a.75.75 0 1 1-1.06 1.06l-5.25-5.25a.75.75 0 0 1 0-1.06l5.25-5.25a.75.75 0 0 1 1.06 0Z" />
      </svg>
      {label}
    </Link>
  )
}
