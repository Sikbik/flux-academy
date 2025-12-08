'use client'

import { useFluxPrice } from '@/contexts/FluxPriceContext'

interface LivePriceProps {
  cpu: number
  ram: number  // in MB
  hdd: number  // in GB
  staticip?: boolean
  enterprise?: boolean
  enterprisePorts?: number
  volumePrefix?: 'g:/' | 'r:/' | 's:/' | ''
  className?: string
}

export function LivePrice({
  cpu,
  ram,
  hdd,
  staticip = false,
  enterprise = false,
  enterprisePorts = 0,
  volumePrefix = '',
  className = ''
}: LivePriceProps) {
  const { fluxPrice, loading } = useFluxPrice()

  const calculatePrice = () => {
    if (!fluxPrice) return 0

    // Base price calculation
    let basePrice = (cpu * 0.15 * 10) + (ram * 0.05 / 100) + (hdd * 0.02)

    // Add static IP cost
    if (staticip) {
      basePrice += 2
    }

    // Add enterprise costs
    if (enterprise) {
      basePrice += 4 + (enterprisePorts * 2)
    }

    // Apply tier discounts
    if (cpu < 3 && ram < 6000 && hdd < 150) {
      // Small tier: 20% discount
      basePrice *= 0.8
    } else if (cpu < 7 && ram < 29000 && hdd < 370) {
      // Medium tier: 10% discount
      basePrice *= 0.9
    }

    // Apply volume prefix discount (g:/ gets 20% off)
    if (volumePrefix === 'g:/') {
      basePrice *= 0.8
    }

    // Apply FLUX payment discount (5%)
    basePrice *= 0.95

    // Convert USD to FLUX
    const fluxAmount = basePrice / fluxPrice

    return fluxAmount
  }

  const price = calculatePrice()
  const usdPrice = price * (fluxPrice || 0.15)

  if (loading) {
    return <span className={className}>calculating...</span>
  }

  return (
    <span className={className}>
      ~{Math.round(price)} FLUX/mo (~${usdPrice.toFixed(2)} USD)
    </span>
  )
}
