import { Circle, ExternalLink, Wallet, Package, Terminal, Coins } from 'lucide-react'
import { LivePrice } from '@/components/tutorial/LivePrice'

export default function GettingStartedPage() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <h1 className="text-4xl font-bold mb-4">Getting Started</h1>
      <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
        Everything you need to know before deploying your first application to Flux
      </p>

      {/* Prerequisites Checklist */}
      <section className="mb-12 dark:bg-gray-900">
        <h2 className="text-2xl font-bold mb-6">Prerequisites Checklist</h2>
        <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-6 space-y-4 dark:bg-gray-800 ">
          <PrerequisiteItem
            icon={<Terminal className="h-5 w-5" />}
            title="Docker installed locally"
            description="Install Docker Desktop for your operating system"
            link="https://docs.docker.com/get-docker/"
          />
          <PrerequisiteItem
            icon={<Package className="h-5 w-5" />}
            title="Docker Hub account created"
            description="You'll need to push your images to a public registry"
            link="https://hub.docker.com/signup"
          />
          <PrerequisiteItem
            icon={<Wallet className="h-5 w-5" />}
            title="Zelcore wallet setup"
            description="Download Zelcore wallet to manage your FLUX tokens"
            link="https://zelcore.io"
          />
          <PrerequisiteItem
            icon={<Coins className="h-5 w-5" />}
            title="FLUX cryptocurrency"
            description="Purchase FLUX tokens for deployment costs (varies by app size)"
          />
          <PrerequisiteItem
            icon={<Terminal className="h-5 w-5" />}
            title="Basic command line knowledge"
            description="Familiarity with terminal commands and Docker basics"
          />
        </div>
      </section>

      {/* What You'll Learn */}
      <section className="mb-12 dark:bg-gray-900">
        <h2 className="text-2xl font-bold mb-6">What You&apos;ll Learn</h2>
        <div className="grid md:grid-cols-2 gap-6">
          <LearningCard
            number="1"
            title="Flux Network Architecture"
            description="Understand how Flux's decentralized cloud works and the different node tiers"
          />
          <LearningCard
            number="2"
            title="Component Communication"
            description="Learn how multi-component apps communicate using Flux internal DNS"
          />
          <LearningCard
            number="3"
            title="Docker Image Preparation"
            description="Best practices for building optimized Docker images for Flux"
          />
          <LearningCard
            number="4"
            title="Deployment Specifications"
            description="Understanding the Flux deployment spec format and all available options"
          />
          <LearningCard
            number="5"
            title="Cost Estimation"
            description="Calculate monthly costs based on CPU, RAM, and storage requirements"
          />
          <LearningCard
            number="6"
            title="Monitoring & Troubleshooting"
            description="How to monitor your deployments and fix common issues"
          />
        </div>
      </section>

      {/* Flux Architecture Overview */}
      <section className="mb-12 dark:bg-gray-900">
        <h2 className="text-2xl font-bold mb-6">Flux Network Architecture</h2>
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/30 dark:to-purple-900/30 border dark:border-gray-700 rounded-lg p-6 ">
          <h3 className="text-xl font-semibold mb-4">Decentralized Cloud Computing</h3>
          <p className="text-gray-700 dark:text-gray-200 mb-4">
            Flux is a decentralized cloud computing platform powered by thousands of FluxNodes around the world.
            Unlike traditional cloud providers, Flux distributes your applications across multiple independent nodes,
            providing censorship resistance, geographic redundancy, and competitive pricing.
          </p>

          <h4 className="font-semibold mb-2 mt-6">Node Tiers</h4>
          <div className="space-y-3">
            <NodeTier
              name="CUMULUS"
              cpu="2 V-Cores / 4 Threads"
              ram="8 GB RAM"
              storage="220 GB SSD/NVMe"
              description="Entry-level nodes, suitable for small applications"
            />
            <NodeTier
              name="NIMBUS"
              cpu="4 V-Cores / 8 Threads"
              ram="32 GB RAM"
              storage="440 GB SSD/NVMe"
              description="Mid-tier nodes, recommended for most applications"
            />
            <NodeTier
              name="STRATUS"
              cpu="8 V-Cores / 16 Threads"
              ram="64 GB RAM"
              storage="880 GB SSD/NVMe"
              description="High-performance nodes for resource-intensive applications"
            />
          </div>
        </div>
      </section>

      {/* Internal DNS Pattern */}
      <section className="mb-12 dark:bg-gray-900">
        <h2 className="text-2xl font-bold mb-6">Multi-Component Networking</h2>
        <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-6 dark:bg-gray-800 ">
          <p className="text-gray-700 dark:text-gray-200 mb-4">
            When deploying multi-component applications (like a database + backend + frontend), Flux provides
            internal DNS for component communication using this pattern:
          </p>
          <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm mb-4">
            flux&#123;componentname&#125;_&#123;appname&#125;
          </div>
          <p className="text-gray-700 dark:text-gray-200 mb-4">
            <strong>Example:</strong> For an app named &quot;todoapp&quot; with components &quot;postgres&quot;, &quot;api&quot;, and &quot;frontend&quot;:
          </p>
          <ul className="space-y-2 ml-6 text-gray-700 dark:text-gray-200">
            <li className="flex items-center gap-2">
              <Circle className="h-2 w-2 fill-blue-600 text-blue-600 dark:text-blue-400" />
              PostgreSQL: <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">fluxpostgres_todoapp:5432</code>
            </li>
            <li className="flex items-center gap-2">
              <Circle className="h-2 w-2 fill-blue-600 text-blue-600 dark:text-blue-400" />
              API Backend: <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">fluxapi_todoapp:3000</code>
            </li>
            <li className="flex items-center gap-2">
              <Circle className="h-2 w-2 fill-blue-600 text-blue-600 dark:text-blue-400" />
              Frontend UI: <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">fluxfrontend_todoapp:8080</code>
            </li>
          </ul>
        </div>
      </section>

      {/* Cost Estimation */}
      <section className="mb-12 dark:bg-gray-900">
        <h2 className="text-2xl font-bold mb-6">Cost Estimation</h2>
        <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-6 dark:bg-gray-800 ">
          <p className="text-gray-700 dark:text-gray-200 mb-4">
            Deployment costs on Flux are determined by your resource requirements. Here&apos;s a rough guide:
          </p>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Resources</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Approximate Cost</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Example Use Case</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                <tr>
                  <td className="px-4 py-3 text-sm">1 CPU, 2GB RAM, 5GB storage</td>
                  <td className="px-4 py-3 text-sm"><LivePrice cpu={1} ram={2000} hdd={5} /></td>
                  <td className="px-4 py-3 text-sm">Simple web app</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-sm">3 CPU, 4GB RAM, 20GB storage</td>
                  <td className="px-4 py-3 text-sm"><LivePrice cpu={3} ram={4000} hdd={20} /></td>
                  <td className="px-4 py-3 text-sm">Minecraft server</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-sm">4.5 CPU, 8GB RAM, 35GB storage</td>
                  <td className="px-4 py-3 text-sm"><LivePrice cpu={4.5} ram={8000} hdd={35} /></td>
                  <td className="px-4 py-3 text-sm">Multi-component app stack</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">
            * Prices are calculated in real-time based on current FLUX market price, including tier discounts and 5% FLUX payment discount. Use the{' '}
            <a href="/playground" className="text-blue-600 dark:text-blue-400 hover:underline">interactive playground</a> for detailed pricing with additional options.
          </p>
        </div>
      </section>

      {/* Next Steps */}
      <section>
        <h2 className="text-2xl font-bold mb-6">Ready to Deploy?</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <a
            href="/tutorials/basic-deployment"
            className="block p-6 border dark:border-gray-700 border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 rounded-lg hover:shadow-lg transition-shadow group"
          >
            <h3 className="text-xl font-semibold mb-2 group-hover:text-blue-600 dark:text-blue-400">Basic Deployment Tutorial →</h3>
            <p className="text-gray-600 dark:text-gray-300">Deploy a simple single-container app in under 30 minutes</p>
          </a>
          <a
            href="/playground"
            className="block p-6 border dark:border-gray-700 rounded-lg hover:shadow-lg transition-shadow group dark:bg-gray-800 "
          >
            <h3 className="text-xl font-semibold mb-2 group-hover:text-blue-600 dark:text-blue-400">Try the Playground →</h3>
            <p className="text-gray-600 dark:text-gray-300">Build a deployment spec visually before you commit</p>
          </a>
        </div>
      </section>
    </div>
  )
}

function PrerequisiteItem({ icon, title, description, link }: {
  icon: React.ReactNode
  title: string
  description: string
  link?: string
}) {
  return (
    <div className="flex items-start gap-4">
      <div className="flex-shrink-0 mt-1">
        <Circle className="h-6 w-6 text-gray-300" />
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="font-semibold">{title}</h3>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{description}</p>
        {link && (
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline mt-1"
          >
            Learn more <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
    </div>
  )
}

function LearningCard({ number, title, description }: {
  number: string
  title: string
  description: string
}) {
  return (
    <div className="border dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow dark:bg-gray-800 ">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
          {number}
        </div>
        <div>
          <h3 className="font-semibold mb-1">{title}</h3>
          <p className="text-sm text-gray-600 dark:text-gray-300">{description}</p>
        </div>
      </div>
    </div>
  )
}

function NodeTier({ name, cpu, ram, storage, description }: {
  name: string
  cpu: string
  ram: string
  storage: string
  description: string
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border">
      <div className="flex items-start justify-between mb-2">
        <h5 className="font-bold text-lg">{name}</h5>
        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">Node Tier</span>
      </div>
      <div className="flex gap-4 text-sm text-gray-600 dark:text-gray-300 mb-2">
        <span>{cpu}</span>
        <span>•</span>
        <span>{ram}</span>
        <span>•</span>
        <span>{storage}</span>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-300">{description}</p>
    </div>
  )
}
