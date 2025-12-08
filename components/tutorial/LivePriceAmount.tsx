'use client'

import { useFluxPrice } from '@/contexts/FluxPriceContext'

interface LivePriceAmountProps {
  cpu: number
  ram: number  // in MB
  hdd: number  // in GB
  staticip?: boolean
  enterprise?: boolean
  enterprisePorts?: number
  volumePrefix?: 'g:/' | 'r:/' | 's:/' | ''
  instances?: number
}

export function LivePriceAmount({
  cpu,
  ram,
  hdd,
  staticip = false,
  enterprise = false,
  enterprisePorts = 0,
  volumePrefix = '',
  instances = 3
}: LivePriceAmountProps) {
  const { fluxPrice, loading } = useFluxPrice()

  const calculatePrice = () => {
    if (!fluxPrice) return 0

    // 1. Base resource cost calculation
    let basePrice = (cpu * 0.15 * 10) + (ram * 0.05 / 100) + (hdd * 0.02)

    // 2. Add enterprise and static IP costs (BEFORE tier discounts)
    if (enterprise) {
      basePrice += 4  // Enterprise base cost
    }

    if (staticip) {
      basePrice += 2  // Static IP cost
    }

    // 3. Add enterprise port fees (8080, 8443, 9090 only)
    //    Note: Privileged ports (< 1024) don't incur fees
    if (enterprisePorts > 0) {
      basePrice += enterprisePorts * 2
    }

    // 4. Apply tier discounts
    if (cpu < 3 && ram < 6000 && hdd < 150) {
      // Small tier: 20% discount
      basePrice *= 0.8
    } else if (cpu < 7 && ram < 29000 && hdd < 370) {
      // Medium tier: 10% discount
      basePrice *= 0.9
    }

    // 5. Apply volume prefix discount (g:/ gets 20% off)
    if (volumePrefix === 'g:/') {
      basePrice *= 0.8
    }

    // 6. Apply minimum price floor
    const costUSD = Math.max(basePrice, 0.99)

    // 7. Calculate instance pricing (matching SpecBuilder logic)
    let totalPrice = costUSD
    const additionalInstances = Math.max(0, instances - 3)
    if (additionalInstances > 0) {
      let additionalPrice = 0
      if (costUSD < 1.50) {
        // For small apps, $0.50 per additional instance
        additionalPrice = additionalInstances * 0.50
      } else {
        // For larger apps, costUSD/3 per additional instance
        additionalPrice = costUSD * additionalInstances / 3
      }
      totalPrice = costUSD + additionalPrice
    }

    // 8. Ceiling round to 2 decimals
    const finalUSD = Math.ceil(totalPrice * 100) / 100

    // 9. Apply FLUX payment discount (5%)
    const discountedUSD = finalUSD * 0.95

    // 10. Convert USD to FLUX
    const fluxAmount = discountedUSD / fluxPrice

    return fluxAmount
  }

  const price = calculatePrice()

  if (loading) {
    return <>calculating...</>
  }

  return <>{Math.round(price)}</>
}
