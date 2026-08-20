import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Twin — tu neobanco',
  description:
    'Pesos, reales y soles en un solo lugar. Enviá, ahorrá y mové tu plata entre redes con las stablecoins de Twin.',
}

export const viewport: Viewport = {
  themeColor: '#07090d',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="es-AR" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      {/* Grammarly y otras extensiones inyectan atributos en el body antes de
          que React hidrate. Sin esto, el overlay de dev tira un hydration error
          que no es nuestro. */}
      <body className="min-h-full" suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
