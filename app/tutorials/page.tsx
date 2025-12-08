'use client'

import Link from 'next/link'
import { ArrowRight, Clock, CheckCircle2 } from 'lucide-react'
import { useProgress } from '@/contexts/ProgressContext'
import { ProgressBadge } from '@/components/tutorial/TutorialProgress'

export default function TutorialsPage() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-6xl">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-4xl font-bold">Tutorials</h1>
        <ProgressBadge />
      </div>
      <p className="text-xl text-gray-600 dark:text-gray-300 mb-12">
        Step-by-step guides to deploying applications on Flux
      </p>

      <div className="space-y-12">
        {/* Beginner Section */}
        <section>
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-green-50 dark:bg-green-900/200"></span>
            Beginner Tutorials
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            <TutorialCard
              title="Deploy Your First App"
              description="Learn the basics of deploying a single-container application to Flux. Perfect for beginners who want to understand the deployment process."
              href="/tutorials/basic-deployment"
              duration="30 min"
              level="Beginner"
              topics={['Docker basics', 'Deployment specs', 'Monitoring']}
              tutorialId="basic-deployment"
            />
            <TutorialCard
              title="Minecraft Server on Flux"
              description="Deploy your own decentralized, censorship-resistant Minecraft server with persistent world storage and automatic failover."
              href="/tutorials/minecraft-server"
              duration="15 min"
              level="Beginner"
              topics={['Gaming servers', 'Volume prefixes', 'Resource optimization']}
              tutorialId="minecraft-server"
            />
            <TutorialCard
              title="Managing Your Applications"
              description="Learn how to monitor, manage, and troubleshoot your deployed applications using the Flux dashboard and tools."
              href="/tutorials/app-management"
              duration="20 min"
              level="Beginner"
              topics={['Dashboard navigation', 'Logs', 'Resource monitoring', 'App lifecycle']}
              tutorialId="app-management"
            />
          </div>
        </section>

        {/* Intermediate Section */}
        <section>
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-yellow-50 dark:bg-yellow-900/200"></span>
            Intermediate Tutorials
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            <TutorialCard
              title="Multi-Component Applications"
              description="Learn how to deploy applications with multiple interconnected services using Flux's internal DNS system."
              href="/tutorials/multi-component"
              duration="1 hour"
              level="Intermediate"
              topics={['Component communication', 'Service discovery', 'Environment configuration']}
              tutorialId="multi-component"
            />
            <TutorialCard
              title="Custom Domains & SSL"
              description="Configure your own domain name with automatic SSL/TLS encryption using CloudFlare for your Flux deployments"
              href="/tutorials/custom-domain"
              duration="30 min"
              level="Intermediate"
              topics={['DNS configuration', 'CNAME records', 'SSL/TLS', 'CloudFlare setup']}
              tutorialId="custom-domain"
            />
          </div>
        </section>

        {/* Advanced Section */}
        <section>
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-red-50 dark:bg-red-900/200"></span>
            Advanced Topics
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            <TutorialCard
              title="Shared Database with Auto-Replication"
              description="Deploy a persistent, replicated database with automatic clustering and failover across Flux's decentralized network"
              href="/tutorials/shared-db"
              duration="1 hour"
              level="Advanced"
              topics={['Distributed databases', 'Master-replica', 'Auto-clustering', 'High availability']}
              tutorialId="shared-db"
            />
          </div>
        </section>
      </div>
    </div>
  )
}

function TutorialCard({
  title,
  description,
  href,
  duration,
  level,
  topics,
  tutorialId
}: {
  title: string
  description: string
  href: string
  duration: string
  level: string
  topics: string[]
  tutorialId?: string
}) {
  const { isComplete } = useProgress()
  const levelColor =
    level === 'Beginner' ? 'bg-green-500' :
    level === 'Intermediate' ? 'bg-yellow-500' :
    'bg-red-500'

  const completed = tutorialId ? isComplete(tutorialId) : false

  return (
    <Link
      href={href}
      className={`block p-6 border dark:border-gray-700 rounded-lg hover:shadow-lg hover:border-blue-500 dark:hover:border-blue-400 transition-all group bg-white dark:bg-gray-800 relative ${
        completed ? 'ring-2 ring-green-500' : ''
      }`}
    >
      {completed && (
        <div className="absolute top-3 right-3">
          <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
        </div>
      )}
      <div className="flex items-start justify-between mb-3">
        <h3 className="text-xl font-semibold dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors pr-8">{title}</h3>
        <ArrowRight className="h-5 w-5 text-gray-400 dark:text-gray-500 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-all flex-shrink-0 ml-2" />
      </div>

      <p className="text-gray-600 dark:text-gray-300 mb-4">{description}</p>

      <div className="flex flex-wrap gap-2 mb-4">
        {topics.map((topic) => (
          <span key={topic} className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 px-2 py-1 rounded">
            {topic}
          </span>
        ))}
      </div>

      <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
        <span className="flex items-center gap-1">
          <span className={`w-2 h-2 rounded-full ${levelColor}`}></span>
          {level}
        </span>
        <span className="flex items-center gap-1">
          <Clock className="h-4 w-4" />
          {duration}
        </span>
      </div>
    </Link>
  )
}