import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { ThemeProvider } from 'next-themes'
import { Toaster } from 'sonner'
import { QueryProvider } from '@/components/layout/QueryProvider'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: {
    default: 'HyperGuest B2B Manager',
    template: '%s | HyperGuest B2B Manager',
  },
  description: 'HyperGuest B2B Channel Management Platform by Eglobe Solutions',
  keywords: ['HyperGuest', 'B2B', 'Channel Manager', 'Hotel', 'ARI', 'Subscriptions'],
  authors: [{ name: 'Eglobe Solutions', url: 'https://www.eglobe-solutions.com' }],
  robots: { index: false, follow: false },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <body className="font-sans antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange={false}
        >
          <QueryProvider>
            <div className="flex h-screen overflow-hidden bg-background">
              {children}
            </div>
            <Toaster
              position="top-right"
              richColors
              closeButton
              toastOptions={{
                duration: 4000,
                style: {
                  fontFamily: 'var(--font-inter, Inter, sans-serif)',
                },
              }}
            />
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
