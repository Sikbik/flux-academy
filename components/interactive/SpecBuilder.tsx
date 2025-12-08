'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2, Download, RefreshCw, HelpCircle } from 'lucide-react'
import { CodeBlock } from '../tutorial/CodeBlock'

interface Component {
  id: string
  name: string
  description: string
  repotag: string
  repoauth: string
  ports: number[]
  containerPorts: number[]
  cpu: number
  ram: number
  hdd: number
  environmentParameters: string[]
  commands: string[]
  containerData: string
  domains: string[]
}

interface FluxPricing {
  cpu: number
  ram: number
  hdd: number
  port: number
  scope: number
  staticip: number
  fluxmultiplier: number
  minUSDPrice: number
}

function Tooltip({ text }: { text: string }) {
  return (
    <span className="group relative inline-block ml-1">
      <HelpCircle className="h-3.5 w-3.5 text-gray-400 dark:text-gray-500 hover:text-gray-600 cursor-help" />
      <span className="invisible group-hover:visible absolute z-50 w-64 p-2 mt-1 text-xs text-white bg-gray-900 rounded-lg shadow-lg -left-24 block">
        {text}
        <span className="absolute w-2 h-2 bg-gray-900 transform rotate-45 -top-1 left-24 block"></span>
      </span>
    </span>
  )
}

export function SpecBuilder() {
  const [appName, setAppName] = useState('myapp')
  const [appDescription, setAppDescription] = useState('My Flux Application')
  const [zelId, setZelId] = useState('')
  const [pricing, setPricing] = useState<FluxPricing | null>(null)
  const [fluxUsdPrice, setFluxUsdPrice] = useState(0.15)
  const [pricingLoading, setPricingLoading] = useState(true)
  const [instanceCount, setInstanceCount] = useState(3)
  const [staticIp, setStaticIp] = useState(false)
  const [enterprise, setEnterprise] = useState(false)
  const [components, setComponents] = useState<Component[]>([{
    id: '1',
    name: 'app',
    description: 'Main application',
    repotag: 'username/my-app:latest',
    repoauth: '',
    ports: [3000],
    containerPorts: [3000],
    cpu: 2,
    ram: 4000,
    hdd: 10,
    environmentParameters: ['NODE_ENV=production'],
    commands: [],
    containerData: '/appdata',
    domains: ['']
  }])

  // Fetch real-time pricing from Flux API
  useEffect(() => {
    fetchPricing()
  }, [])

  const fetchPricing = async () => {
    setPricingLoading(true)
    try {
      const response = await fetch('https://api.runonflux.io/apps/getappspecsusdprice', {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()

      if (data.status === 'success' && data.data) {
        setPricing(data.data)
        console.log('✓ Successfully fetched Flux pricing from API')

        // Fetch current FLUX price from official Flux rates API (used by home.runonflux.io)
        try {
          const ratesResponse = await fetch('https://vipbrates.zelcore.io/rates', {
            method: 'GET',
            headers: {
              'Accept': 'application/json',
            },
          })

          if (!ratesResponse.ok) {
            throw new Error(`HTTP error! status: ${ratesResponse.status}`)
          }

          const ratesData = await ratesResponse.json()

          // The API returns an array of arrays, first array has base rates
          const baseRates = ratesData[0]

          // Find BTC/USD rate
          const btcUsdRate = baseRates.find((r: any) => r.code === 'USD')?.rate || 100000

          // The second item in the response has altcoin rates including FLUX
          const altcoinRates = ratesData[1]
          const fluxBtcRate = altcoinRates?.FLUX || 0.00000111

          // Calculate FLUX/USD price
          const fluxUsdRate = fluxBtcRate * btcUsdRate
          setFluxUsdPrice(fluxUsdRate)
          console.log('✓ Successfully fetched FLUX price:', fluxUsdRate.toFixed(4))
        } catch (err) {
          console.warn('⚠ Failed to fetch FLUX price from rates API:', err)
          console.log('Using default FLUX price: $0.15')
        }
      }
    } catch (error) {
      console.error('⚠ Failed to fetch pricing from Flux API:', error)
      console.log('Using fallback pricing values')
    } finally {
      setPricingLoading(false)
    }
  }

  const addComponent = () => {
    const newId = (Math.max(...components.map(c => parseInt(c.id))) + 1).toString()
    const portNum = 3000 + parseInt(newId)
    setComponents([...components, {
      id: newId,
      name: `component${newId}`,
      description: 'New component',
      repotag: 'username/component:latest',
      repoauth: '',
      ports: [portNum],
      containerPorts: [portNum],
      cpu: 1,
      ram: 2000,
      hdd: 5,
      environmentParameters: [],
      commands: [],
      containerData: '/appdata',
      domains: ['']
    }])
  }

  const removeComponent = (id: string) => {
    if (components.length > 1) {
      setComponents(components.filter(c => c.id !== id))
    }
  }

  const updateComponent = (id: string, field: keyof Component, value: any) => {
    setComponents(components.map(c =>
      c.id === id ? { ...c, [field]: value } : c
    ))
  }

  const addEnvVar = (id: string) => {
    setComponents(components.map(c =>
      c.id === id ? {
        ...c,
        environmentParameters: [...c.environmentParameters, 'KEY=value']
      } : c
    ))
  }

  const updateEnvVar = (id: string, index: number, value: string) => {
    setComponents(components.map(c =>
      c.id === id ? {
        ...c,
        environmentParameters: c.environmentParameters.map((env, i) => i === index ? value : env)
      } : c
    ))
  }

  const removeEnvVar = (id: string, index: number) => {
    setComponents(components.map(c =>
      c.id === id ? {
        ...c,
        environmentParameters: c.environmentParameters.filter((_, i) => i !== index)
      } : c
    ))
  }

  const addCommand = (id: string) => {
    setComponents(components.map(c =>
      c.id === id ? {
        ...c,
        commands: [...c.commands, '']
      } : c
    ))
  }

  const updateCommand = (id: string, index: number, value: string) => {
    setComponents(components.map(c =>
      c.id === id ? {
        ...c,
        commands: c.commands.map((cmd, i) => i === index ? value : cmd)
      } : c
    ))
  }

  const removeCommand = (id: string, index: number) => {
    setComponents(components.map(c =>
      c.id === id ? {
        ...c,
        commands: c.commands.filter((_, i) => i !== index)
      } : c
    ))
  }

  const addPort = (id: string) => {
    setComponents(components.map(c => {
      if (c.id === id) {
        const lastPort = c.ports[c.ports.length - 1]
        const lastContainerPort = c.containerPorts[c.containerPorts.length - 1]
        return {
          ...c,
          ports: [...c.ports, lastPort + 1],
          containerPorts: [...c.containerPorts, lastContainerPort + 1],
          domains: [...c.domains, '']
        }
      }
      return c
    }))
  }

  const removePort = (id: string, portIndex: number) => {
    setComponents(components.map(c => {
      if (c.id === id && c.ports.length > 1) {
        return {
          ...c,
          ports: c.ports.filter((_, i) => i !== portIndex),
          containerPorts: c.containerPorts.filter((_, i) => i !== portIndex),
          domains: c.domains.filter((_, i) => i !== portIndex)
        }
      }
      return c
    }))
  }

  const updatePort = (id: string, portIndex: number, field: 'port' | 'containerPort' | 'domain', value: number | string) => {
    setComponents(components.map(c => {
      if (c.id === id) {
        if (field === 'port') {
          const newPorts = [...c.ports]
          newPorts[portIndex] = value as number
          return { ...c, ports: newPorts }
        } else if (field === 'containerPort') {
          const newContainerPorts = [...c.containerPorts]
          newContainerPorts[portIndex] = value as number
          return { ...c, containerPorts: newContainerPorts }
        } else if (field === 'domain') {
          const newDomains = [...c.domains]
          newDomains[portIndex] = value as string
          return { ...c, domains: newDomains }
        }
      }
      return c
    }))
  }

  const calculateCost = () => {
    const totalCpu = components.reduce((sum, c) => sum + c.cpu, 0)
    const totalRamMB = components.reduce((sum, c) => sum + c.ram, 0)
    const totalHdd = components.reduce((sum, c) => sum + c.hdd, 0)

    // Use real-time pricing from Flux API if available, otherwise use fallback
    const costPerCpu = pricing?.cpu || 0.15       // Base rate per 0.1 CPU core
    const costPerRam = pricing?.ram || 0.05       // Base rate per 100 MB RAM
    const costPerHdd = pricing?.hdd || 0.02       // Base rate per 1 GB storage

    // EXACT FLUX PRICING FORMULA (from ZelBack/src/services/utils/appUtilities.js)
    // Source: https://github.com/RunOnFlux/flux

    // 1. Calculate base resource costs with proper multipliers
    //    - CPU: multiplied by 10 because rate is per 0.1 core
    //    - RAM: divided by 100 because rate is per 100 MB
    //    - HDD: no modifier because rate is per 1 GB
    const cpuPrice = totalCpu * costPerCpu * 10
    const ramPrice = (totalRamMB * costPerRam) / 100
    const hddPrice = totalHdd * costPerHdd

    let basePrice = cpuPrice + ramPrice + hddPrice

    // 2. Add enterprise and static IP costs (v7+)
    //    These are added BEFORE tier discounts
    if (enterprise) {
      const scopePrice = pricing?.scope || 4
      basePrice += scopePrice
    }

    if (staticIp) {
      const staticIpPrice = pricing?.staticip || 2
      basePrice += staticIpPrice
    }

    // 3. Count enterprise ports (8080, 8443, 9090) and add fees
    //    Only specific enterprise ports (8080, 8443, 9090) incur fees
    //    Privileged ports (< 1024) don't incur additional fees
    const enterprisePorts = components.reduce((count, c) => {
      const entPorts = c.ports.filter(p =>
        p === 8080 || p === 8443 || p === 9090
      )
      return count + entPorts.length
    }, 0)

    if (enterprisePorts > 0) {
      const portPrice = pricing?.port || 2
      basePrice += enterprisePorts * portPrice
    }

    // 4. Apply tier-based discounts
    //    - Small apps (CPU < 3, RAM < 6000 MB, HDD < 150 GB): 20% discount
    //    - Medium apps (CPU < 7, RAM < 29000 MB, HDD < 370 GB): 10% discount
    if (totalCpu < 3 && totalRamMB < 6000 && totalHdd < 150) {
      basePrice *= 0.8  // 20% discount
    } else if (totalCpu < 7 && totalRamMB < 29000 && totalHdd < 370) {
      basePrice *= 0.9  // 10% discount
    }

    // 4.5. Apply volume prefix discount (g:/ primary/standby sync gets 20% off)
    //      Check if any component uses g:/ volume prefix
    const hasGVolumePrefix = components.some(c =>
      c.containerData && c.containerData.trim().toLowerCase().startsWith('g:/')
    )
    if (hasGVolumePrefix) {
      basePrice *= 0.8  // 20% discount for g:/ volume prefix
    }

    // 5. Apply minimum price floor
    const minUSDPrice = pricing?.minUSDPrice || 0.99
    const costUSD = Math.max(basePrice, minUSDPrice)

    // 6. Calculate instance pricing (beyond base 3 instances)
    //    Formula from ZelBack/src/services/utils/appSpecHelpers.js getAppFiatAndFluxPrice()
    let totalPrice = costUSD
    const additionalInstances = Math.max(0, instanceCount - 3)

    if (additionalInstances > 0) {
      let additionalPrice = 0
      if (costUSD < 1.50) {
        // For small apps, $0.50 per additional instance
        additionalPrice = additionalInstances * 0.50
      } else {
        // For larger apps, basePrice/3 per additional instance
        additionalPrice = (costUSD * additionalInstances) / 3
      }
      totalPrice = costUSD + additionalPrice
    }

    // 7. Round to 2 decimals (ceiling)
    const finalUSD = Math.ceil(totalPrice * 100) / 100

    // 8. Convert USD to FLUX using current market price
    //    Apply 5% FLUX discount (fluxmultiplier: 0.95)
    const fluxDiscount = pricing?.fluxmultiplier || 0.95
    const discountedUSD = finalUSD * fluxDiscount
    const costFLUX = discountedUSD / fluxUsdPrice

    return {
      flux: Math.ceil(costFLUX * 100) / 100,  // Round to 2 decimals
      usd: finalUSD,
      baseUsd: Math.ceil(costUSD * 100) / 100,  // Base price for 3 instances
      instances: instanceCount
    }
  }

  const generateSpec = () => {
    return {
      version: 8,
      name: appName,
      description: appDescription,
      owner: zelId || 'YOUR_ZELID_HERE',
      instances: instanceCount,
      staticip: staticIp,
      enterprise: enterprise ? 'enabled' : '',
      compose: components.map(c => {
        const component: any = {
          name: c.name,
          description: c.description,
          repotag: c.repotag,
          ports: c.ports,
          containerPorts: c.containerPorts,
          domains: c.domains,
          environmentParameters: c.environmentParameters,
          commands: c.commands,
          containerData: c.containerData,
          cpu: c.cpu,
          ram: c.ram,
          hdd: c.hdd,
          tiered: false
        }
        // Only include repoauth if enterprise is enabled and repoauth is not empty
        if (enterprise && c.repoauth.trim()) {
          component.repoauth = c.repoauth
        }
        return component
      })
    }
  }

  const downloadSpec = () => {
    const spec = generateSpec()
    const blob = new Blob([JSON.stringify(spec, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${appName}-spec.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const specJson = JSON.stringify(generateSpec(), null, 2)
  const costEstimate = calculateCost()

  return (
    <div className="grid lg:grid-cols-2 gap-4 sm:gap-6">
      {/* Configuration Panel */}
      <div className="space-y-4 sm:space-y-6">
        <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-4 sm:p-6 dark:bg-gray-800 dark:text-white dark:placeholder-gray-400">
          <h2 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4">Application Details</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1 flex items-center">
                App Name
                <Tooltip text="The unique name for your application across the Flux network. Only letters (a-z, A-Z) and numbers (0-9) are allowed. No special characters or spaces." />
              </label>
              <input
                type="text"
                value={appName}
                onChange={(e) => setAppName(e.target.value)}
                className="w-full px-2 sm:px-3 py-2 text-sm sm:text-base border dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-white dark:placeholder-gray-400"
                placeholder="myapp"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 flex items-center">
                Description
                <Tooltip text="A brief description of your application. This will be displayed on the Flux app marketplace and dashboard." />
              </label>
              <input
                type="text"
                value={appDescription}
                onChange={(e) => setAppDescription(e.target.value)}
                className="w-full px-2 sm:px-3 py-2 text-sm sm:text-base border dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-white dark:placeholder-gray-400"
                placeholder="My Flux Application"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 flex items-center">
                ZelID (Optional)
                <Tooltip text="Your Flux ZelID that will own this app. Leave empty to set it during deployment. Required to manage and update your app." />
              </label>
              <input
                type="text"
                value={zelId}
                onChange={(e) => setZelId(e.target.value)}
                className="w-full px-2 sm:px-3 py-2 text-sm sm:text-base border dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-white dark:placeholder-gray-400"
                placeholder="Will be set at deployment time"
              />
            </div>

            {/* Advanced Options */}
            <div className="border-t pt-4 space-y-3">
              <h3 className="text-sm font-semibold text-gray-700">Advanced Options</h3>

              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 flex items-center">
                    Static IP
                    <Tooltip text="Restricts deployment to Flux nodes with static IP addresses. Increases deployment cost based on resources. Useful for apps requiring consistent external IP." />
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">Deploy only on nodes with static IP addresses</p>
                </div>
                <button
                  onClick={() => setStaticIp(!staticIp)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    staticIp ? 'bg-blue-600' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      staticIp ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 flex items-center">
                    Enterprise Application
                    <Tooltip text="Deploy to ArcaneOS enterprise nodes with OS-level encrypted volumes where node operators cannot access your data. Enables private Docker images and encrypted environment secrets. Increases deployment cost based on resources." />
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">Enhanced security: encrypted volumes, private images, protected secrets</p>
                </div>
                <button
                  onClick={() => setEnterprise(!enterprise)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    enterprise ? 'bg-blue-600' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      enterprise ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Components */}
        <div className="space-y-4">
          {components.map((component, index) => (
            <ComponentEditor
              key={component.id}
              component={component}
              index={index}
              totalComponents={components.length}
              enterprise={enterprise}
              onUpdate={updateComponent}
              onRemove={removeComponent}
              onAddEnvVar={addEnvVar}
              onUpdateEnvVar={updateEnvVar}
              onRemoveEnvVar={removeEnvVar}
              onAddCommand={addCommand}
              onUpdateCommand={updateCommand}
              onRemoveCommand={removeCommand}
              onAddPort={addPort}
              onRemovePort={removePort}
              onUpdatePort={updatePort}
            />
          ))}

          <button
            onClick={addComponent}
            className="w-full flex items-center justify-center gap-2 px-3 sm:px-4 py-2.5 sm:py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors text-sm sm:text-base"
          >
            <Plus className="h-4 w-4 sm:h-5 sm:w-5" />
            Add Component
          </button>
        </div>
      </div>

      {/* Preview Panel */}
      <div className="space-y-4 sm:space-y-6">
        {/* Cost Estimate */}
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/30 dark:to-purple-900/30 border dark:border-gray-700 rounded-lg p-4 sm:p-6 dark:bg-gray-800 dark:text-white dark:placeholder-gray-400">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <h2 className="text-lg sm:text-xl font-bold">Cost Estimate</h2>
            <button
              onClick={fetchPricing}
              disabled={pricingLoading}
              className="flex items-center gap-1 px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 dark:bg-gray-800 dark:text-white dark:placeholder-gray-400"
              title="Refresh pricing"
            >
              <RefreshCw className={`h-3 w-3 sm:h-4 sm:w-4 ${pricingLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{pricingLoading ? 'Loading...' : 'Refresh'}</span>
            </button>
          </div>
          <div className="space-y-2 text-xs sm:text-sm">
            <div className="flex justify-between">
              <span>Total CPU:</span>
              <span className="font-semibold">{components.reduce((sum, c) => sum + c.cpu, 0)} cores</span>
            </div>
            <div className="flex justify-between">
              <span>Total RAM:</span>
              <span className="font-semibold">{components.reduce((sum, c) => sum + c.ram, 0)} MB</span>
            </div>
            <div className="flex justify-between">
              <span>Total Storage:</span>
              <span className="font-semibold">{components.reduce((sum, c) => sum + c.hdd, 0)} GB</span>
            </div>
            <div className="flex justify-between">
              <span>Components (ports):</span>
              <span className="font-semibold">{components.length}</span>
            </div>

            {/* Instance Count Slider */}
            <div className="border-t pt-2 sm:pt-3 mt-2 sm:mt-3">
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs sm:text-sm font-medium flex items-center">
                  Instance Count:
                  <Tooltip text="Number of redundant copies of your app. Base price covers 3 instances. Additional instances cost ~$0.50 each for small apps or basePrice/3 for larger apps." />
                </label>
                <span className="text-base sm:text-lg font-bold text-blue-600">{instanceCount}</span>
              </div>
              <input
                type="range"
                min="3"
                max="100"
                value={instanceCount}
                onChange={(e) => setInstanceCount(parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 mt-1">
                <span>3 (base)</span>
                <span>100 (max)</span>
              </div>
              {instanceCount > 3 && (
                <p className="text-xs text-gray-600 mt-2">
                  +{instanceCount - 3} additional instance{instanceCount > 4 ? 's' : ''} beyond base 3
                </p>
              )}
            </div>

            <div className="border-t pt-2 mt-2">
              {instanceCount > 3 && (
                <div className="mb-2 pb-2 border-b border-gray-200">
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>Base (3 instances):</span>
                    <span className="font-semibold">${costEstimate.baseUsd}/month</span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-600 mt-1">
                    <span>Additional instances:</span>
                    <span className="font-semibold">+${(costEstimate.usd - costEstimate.baseUsd).toFixed(2)}/month</span>
                  </div>
                </div>
              )}
              <div className="flex justify-between items-center mb-1">
                <span className="font-bold text-sm sm:text-base">Total Cost:</span>
                <span className="text-xl sm:text-2xl font-bold text-blue-600">{costEstimate.flux} FLUX/month</span>
              </div>
              <div className="flex justify-between text-xs text-gray-600">
                <span>Approximately:</span>
                <span className="font-semibold">${costEstimate.usd}/month</span>
              </div>
              {pricing && (
                <p className="text-xs text-green-600 mt-2">
                  ✓ Using live pricing from Flux API
                </p>
              )}
              {!pricing && !pricingLoading && (
                <p className="text-xs text-yellow-600 mt-2">
                  ⚠ Using fallback pricing (API unavailable)
                </p>
              )}
              {components.some(c => c.containerData && c.containerData.trim().toLowerCase().startsWith('g:/')) && (
                <p className="text-xs text-green-600 mt-1">
                  ✓ 20% discount applied for g:/ volume prefix
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Generated Spec */}
        <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-4 sm:p-6 dark:bg-gray-800 dark:text-white dark:placeholder-gray-400">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <h2 className="text-lg sm:text-xl font-bold">Generated Spec</h2>
            <button
              onClick={downloadSpec}
              className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Download className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Download</span>
            </button>
          </div>
          <div className="max-h-[400px] sm:max-h-[600px] overflow-y-auto">
            <CodeBlock language="json">
              {specJson}
            </CodeBlock>
          </div>
        </div>
      </div>
    </div>
  )
}

function ComponentEditor({
  component,
  index,
  totalComponents,
  enterprise,
  onUpdate,
  onRemove,
  onAddEnvVar,
  onUpdateEnvVar,
  onRemoveEnvVar,
  onAddCommand,
  onUpdateCommand,
  onRemoveCommand,
  onAddPort,
  onRemovePort,
  onUpdatePort
}: {
  component: Component
  index: number
  totalComponents: number
  enterprise: boolean
  onUpdate: (id: string, field: keyof Component, value: any) => void
  onRemove: (id: string) => void
  onAddEnvVar: (id: string) => void
  onUpdateEnvVar: (id: string, index: number, value: string) => void
  onRemoveEnvVar: (id: string, index: number) => void
  onAddCommand: (id: string) => void
  onUpdateCommand: (id: string, index: number, value: string) => void
  onRemoveCommand: (id: string, index: number) => void
  onAddPort: (id: string) => void
  onRemovePort: (id: string, portIndex: number) => void
  onUpdatePort: (id: string, portIndex: number, field: 'port' | 'containerPort' | 'domain', value: number | string) => void
}) {
  return (
    <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-4 sm:p-6 dark:bg-gray-800 dark:text-white dark:placeholder-gray-400">
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <h3 className="font-bold text-base sm:text-lg truncate pr-2">Component {index + 1}: {component.name}</h3>
        {totalComponents > 1 && (
          <button
            onClick={() => onRemove(component.id)}
            className="p-1.5 sm:p-2 text-red-600 hover:bg-red-50 rounded transition-colors flex-shrink-0"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="space-y-3 sm:space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium mb-1 flex items-center">
              Component Name
              <Tooltip text="A unique name for this component within your app. Used for internal DNS (e.g., flux{componentname}_{appname})." />
            </label>
            <input
              type="text"
              value={component.name}
              onChange={(e) => onUpdate(component.id, 'name', e.target.value)}
              className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border dark:border-gray-700 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-white dark:placeholder-gray-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1 flex items-center">
              Description
              <Tooltip text="A brief description of what this component does in your application." />
            </label>
            <input
              type="text"
              value={component.description}
              onChange={(e) => onUpdate(component.id, 'description', e.target.value)}
              className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border dark:border-gray-700 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-white dark:placeholder-gray-400"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium mb-1 flex items-center">
            Docker Image
            <Tooltip text="The Docker image repository and tag. Format: username/image:tag. Public images work on all nodes. Private images from GHCR, GitLab, or private registries require enterprise mode (ArcaneOS nodes)." />
          </label>
          <input
            type="text"
            value={component.repotag}
            onChange={(e) => onUpdate(component.id, 'repotag', e.target.value)}
            className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border dark:border-gray-700 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-white dark:placeholder-gray-400"
            placeholder="username/image:tag"
          />
        </div>

        {/* Repository Authentication - Only show when enterprise is enabled */}
        {enterprise && (
          <div>
            <label className="block text-xs font-medium mb-1 flex items-center">
              Repository Authentication (optional)
              <Tooltip text="Docker image authentication for private images in the format of username:apikey. Only required if using private Docker registries. This field will be encrypted and accessible to selected enterprise nodes only." />
            </label>
            <input
              type="text"
              value={component.repoauth}
              onChange={(e) => onUpdate(component.id, 'repoauth', e.target.value)}
              className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border dark:border-gray-700 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-white dark:placeholder-gray-400"
              placeholder="username:apikey (leave empty for public images)"
            />
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium mb-1 flex items-center">
              CPU (cores)
              <Tooltip text="Number of CPU cores allocated to this component. Increments by 0.1. Priced at $0.15 per 0.1 core per month." />
            </label>
            <input
              type="number"
              step="0.1"
              min="0.1"
              value={component.cpu}
              onChange={(e) => {
                const val = parseFloat(e.target.value)
                onUpdate(component.id, 'cpu', isNaN(val) ? 0.1 : val)
              }}
              className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border dark:border-gray-700 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-white dark:placeholder-gray-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1 flex items-center">
              RAM (MB)
              <Tooltip text="Memory allocated in megabytes. Increments by 100 MB. Priced at $0.05 per 100 MB per month." />
            </label>
            <input
              type="number"
              step="100"
              min="100"
              value={component.ram}
              onChange={(e) => {
                const val = parseInt(e.target.value)
                onUpdate(component.id, 'ram', isNaN(val) ? 100 : val)
              }}
              className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border dark:border-gray-700 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-white dark:placeholder-gray-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1 flex items-center">
              Storage (GB)
              <Tooltip text="Persistent storage in gigabytes. Increments by 1 GB. Priced at $0.02 per GB per month." />
            </label>
            <input
              type="number"
              step="1"
              min="1"
              value={component.hdd}
              onChange={(e) => {
                const val = parseInt(e.target.value)
                onUpdate(component.id, 'hdd', isNaN(val) ? 1 : val)
              }}
              className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border dark:border-gray-700 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-white dark:placeholder-gray-400"
            />
          </div>
        </div>

        {/* Ports & Domains */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs font-medium flex items-center">
              Ports & Domains
              <Tooltip text="Map external ports to container ports for public access. Valid port range: 0-65535. Domains allow you to route custom hostnames via CloudFlare CNAME records to your app's ports." />
            </label>
            <button
              onClick={() => onAddPort(component.id)}
              className="text-xs text-blue-600 hover:underline"
            >
              + Add Port
            </button>
          </div>
          <div className="space-y-2">
            {component.ports.map((port, portIndex) => (
              <div key={portIndex} className="grid grid-cols-12 gap-2 items-start">
                {/* External Port - Full width on mobile, 3 cols on sm+ */}
                <div className="col-span-12 sm:col-span-3">
                  <input
                    type="number"
                    min="0"
                    max="65535"
                    value={port}
                    onChange={(e) => {
                      const val = parseInt(e.target.value)
                      if (!isNaN(val) && val >= 0 && val <= 65535) {
                        onUpdatePort(component.id, portIndex, 'port', val)
                      }
                    }}
                    className={`w-full px-2 py-1.5 text-xs sm:text-sm border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-white dark:placeholder-gray-400 dark:border-gray-700 ${
                      port > 65535 ? 'border-red-500 bg-red-50 dark:bg-red-900/20' : ''
                    }`}
                    placeholder="External Port"
                    title="Valid range: 0-65535"
                  />
                  {portIndex === 0 && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 flex items-center">
                      External (0-65535)
                      <Tooltip text="The port exposed on the Flux network that users connect to. Must be between 0 and 65535." />
                    </p>
                  )}
                </div>

                {/* Container Port */}
                <div className="col-span-12 sm:col-span-3">
                  <input
                    type="number"
                    min="0"
                    max="65535"
                    value={component.containerPorts[portIndex]}
                    onChange={(e) => {
                      const val = parseInt(e.target.value)
                      if (!isNaN(val) && val >= 0 && val <= 65535) {
                        onUpdatePort(component.id, portIndex, 'containerPort', val)
                      }
                    }}
                    className={`w-full px-2 py-1.5 text-xs sm:text-sm border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-white dark:placeholder-gray-400 dark:border-gray-700 ${
                      component.containerPorts[portIndex] > 65535 ? 'border-red-500 bg-red-50 dark:bg-red-900/20' : ''
                    }`}
                    placeholder="Container Port"
                    title="Valid range: 0-65535"
                  />
                  {portIndex === 0 && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 flex items-center">
                      Container (0-65535)
                      <Tooltip text="The port your application listens on inside the container. Must be between 0 and 65535." />
                    </p>
                  )}
                </div>

                {/* Domain - 11 cols on mobile to leave room for delete button */}
                <div className="col-span-11 sm:col-span-5">
                  <input
                    type="text"
                    value={component.domains[portIndex] || ''}
                    onChange={(e) => onUpdatePort(component.id, portIndex, 'domain', e.target.value)}
                    className="w-full px-2 py-1.5 text-xs sm:text-sm border dark:border-gray-700 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-white dark:placeholder-gray-400"
                    placeholder="domain.com (optional)"
                  />
                  {portIndex === 0 && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 flex items-center">
                      Domain (leave empty for Flux default)
                      <Tooltip text="Optional custom domain. Point your DNS A record to your app's IP to use. Leave empty to use the Flux-provided domain." />
                    </p>
                  )}
                </div>

                {/* Delete button */}
                <div className="col-span-1">
                  {component.ports.length > 1 && (
                    <button
                      onClick={() => onRemovePort(component.id, portIndex)}
                      className="p-1 sm:p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                      title="Remove port"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium mb-1 flex items-center">
            Data Volume
            <Tooltip text="Path inside the container where persistent data is stored. Data survives container restarts. Example: /appdata, /data, /var/lib/postgresql/data" />
          </label>
          <input
            type="text"
            value={component.containerData}
            onChange={(e) => onUpdate(component.id, 'containerData', e.target.value)}
            className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border dark:border-gray-700 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-white dark:placeholder-gray-400"
            placeholder="/appdata"
            required
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs font-medium flex items-center">
              Environment Variables
              <Tooltip text="Key-value pairs passed to your container. Format: KEY=value. Common uses: NODE_ENV=production, DATABASE_URL=postgres://..." />
            </label>
            <button
              onClick={() => onAddEnvVar(component.id)}
              className="text-xs text-blue-600 hover:underline whitespace-nowrap"
            >
              + Add Variable
            </button>
          </div>
          <div className="space-y-2">
            {component.environmentParameters.map((env, envIndex) => (
              <div key={envIndex} className="flex gap-1 sm:gap-2">
                <input
                  type="text"
                  value={env}
                  onChange={(e) => onUpdateEnvVar(component.id, envIndex, e.target.value)}
                  className="flex-1 px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border dark:border-gray-700 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-white dark:placeholder-gray-400"
                  placeholder="KEY=value"
                />
                <button
                  onClick={() => onRemoveEnvVar(component.id, envIndex)}
                  className="p-1.5 sm:p-2 text-red-600 hover:bg-red-50 rounded transition-colors flex-shrink-0"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs font-medium flex items-center">
              Commands
              <Tooltip text="Optional startup commands to run when the container starts. Each command runs in sequence. Example: npm install, npm start" />
            </label>
            <button
              onClick={() => onAddCommand(component.id)}
              className="text-xs text-blue-600 hover:underline whitespace-nowrap"
            >
              + Add Command
            </button>
          </div>
          <div className="space-y-2">
            {component.commands.map((cmd, cmdIndex) => (
              <div key={cmdIndex} className="flex gap-1 sm:gap-2">
                <input
                  type="text"
                  value={cmd}
                  onChange={(e) => onUpdateCommand(component.id, cmdIndex, e.target.value)}
                  className="flex-1 px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border dark:border-gray-700 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-white dark:placeholder-gray-400"
                  placeholder="command"
                />
                <button
                  onClick={() => onRemoveCommand(component.id, cmdIndex)}
                  className="p-1.5 sm:p-2 text-red-600 hover:bg-red-50 rounded transition-colors flex-shrink-0"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
