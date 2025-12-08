import Link from 'next/link'
import { FileCode, BookOpen, Network } from 'lucide-react'

export default function ReferencePage() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <h1 className="text-4xl font-bold mb-4">Reference Documentation</h1>
      <p className="text-xl text-gray-600 dark:text-gray-300 mb-12">
        Complete reference materials for Flux deployment
      </p>

      <div className="grid md:grid-cols-2 gap-6">
        <ReferenceCard
          icon={<FileCode className="h-8 w-8 text-blue-600 dark:text-blue-400" />}
          title="Flux Spec Reference"
          description="Complete specification format, all available fields, validation rules, and examples"
          href="/reference/flux-spec"
        />
        <ReferenceCard
          icon={<BookOpen className="h-8 w-8 text-purple-600 dark:text-purple-400" />}
          title="Docker Best Practices"
          description="Multi-stage builds, layer optimization, security practices, and health checks"
          href="/reference/docker-tips"
        />
        <ReferenceCard
          icon={<Network className="h-8 w-8 text-green-600 dark:text-green-400" />}
          title="Networking Patterns"
          description="Internal DNS, port mapping, load balancing, and SSL/TLS configuration"
          href="/reference/networking"
        />
      </div>
    </div>
  )
}

function ReferenceCard({
  icon,
  title,
  description,
  href
}: {
  icon: React.ReactNode
  title: string
  description: string
  href: string
}) {
  return (
    <Link
      href={href}
      className="block p-6 border dark:border-gray-700 rounded-lg hover:shadow-lg hover:border-blue-500 transition-all group bg-white dark:bg-gray-800 "
    >
      <div className="mb-4">{icon}</div>
      <h3 className="text-xl font-semibold mb-2 group-hover:text-blue-600 dark:text-blue-400 transition-colors">
        {title}
      </h3>
      <p className="text-gray-600 dark:text-gray-300">{description}</p>
    </Link>
  )
}
