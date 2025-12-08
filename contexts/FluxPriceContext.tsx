'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

interface FluxPriceContextType {
  fluxPrice: number | null
  loading: boolean
}

const FluxPriceContext = createContext<FluxPriceContextType>({
  fluxPrice: null,
  loading: true
})

export function FluxPriceProvider({ children }: { children: ReactNode }) {
  const [fluxPrice, setFluxPrice] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('https://vipbrates.zelcore.io/rates')
      .then(res => res.json())
      .then(data => {
        // API returns [currencies_array, rates_object, errors_object]
        // FLUX price is in BTC, we need data[1].FLUX
        const fluxInBtc = parseFloat(data[1]?.FLUX)
        const btcInUsd = parseFloat(data[0]?.find((c: any) => c.code === 'USD')?.rate)

        if (fluxInBtc && btcInUsd && fluxInBtc > 0 && btcInUsd > 0) {
          // Convert FLUX/BTC to FLUX/USD
          const fluxPriceUsd = fluxInBtc * btcInUsd
          setFluxPrice(fluxPriceUsd)
        } else {
          setFluxPrice(0.15)
        }
        setLoading(false)
      })
      .catch(() => {
        // Fallback to $0.15 if API fails
        setFluxPrice(0.15)
        setLoading(false)
      })
  }, [])

  return (
    <FluxPriceContext.Provider value={{ fluxPrice, loading }}>
      {children}
    </FluxPriceContext.Provider>
  )
}

export function useFluxPrice() {
  return useContext(FluxPriceContext)
}
