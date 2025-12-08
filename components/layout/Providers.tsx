'use client'

import { FluxPriceProvider } from '@/contexts/FluxPriceContext'
import { ProgressProvider } from '@/contexts/ProgressContext'
import { DarkModeProvider } from '@/contexts/DarkModeContext'
import { Navigation } from './Navigation'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <DarkModeProvider>
      <FluxPriceProvider>
        <ProgressProvider>
          <Navigation />
          <main className="min-h-screen">
            {children}
          </main>
        </ProgressProvider>
      </FluxPriceProvider>
    </DarkModeProvider>
  )
}
