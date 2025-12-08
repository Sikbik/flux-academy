import Link from 'next/link'
import { ArrowRight, Zap, Calculator, Wrench, TrendingUp, BookOpen, Code } from 'lucide-react'

export default function HomePage() {
  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800 py-12 sm:py-20 dark:bg-gray-900">
        <div className="container mx-auto px-4 text-center">
          <div className="max-w-3xl mx-auto">
            <h1 className="text-3xl sm:text-5xl md:text-6xl font-bold mb-4 sm:mb-6 bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 bg-clip-text text-transparent">
              Flux Deployment Academy
            </h1>
            <p className="text-base sm:text-xl text-gray-600 dark:text-gray-300 mb-6 sm:mb-8">
              Master the art of deploying applications on Flux&apos;s decentralized cloud network
            </p>
            <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4 justify-center">
              <Link
                href="/getting-started"
                className="inline-flex items-center justify-center gap-2 px-5 sm:px-6 py-2.5 sm:py-3 text-sm sm:text-base bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 transition-colors"
              >
                Start Learning <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5" />
              </Link>
              <Link
                href="/tutorials"
                className="inline-flex items-center justify-center gap-2 px-5 sm:px-6 py-2.5 sm:py-3 text-sm sm:text-base border border-gray-300 dark:border-gray-600 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-800 dark:text-gray-200 transition-colors"
              >
                View Tutorials
              </Link>
              <Link
                href="/playground"
                className="inline-flex items-center justify-center gap-2 px-5 sm:px-6 py-2.5 sm:py-3 text-sm sm:text-base border border-gray-300 dark:border-gray-600 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-800 dark:text-gray-200 transition-colors"
              >
                Try Playground
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-12 sm:py-16 bg-white dark:bg-gray-900">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-8 sm:mb-12 dark:text-gray-100">What You&apos;ll Learn</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            <FeatureCard
              icon={<Zap className="h-8 w-8 text-blue-600 dark:text-blue-400" />}
              title="Interactive Tutorials"
              description="Step-by-step guides with copy-paste commands and real-world examples"
            />
            <FeatureCard
              icon={<Calculator className="h-8 w-8 text-purple-600 dark:text-purple-400" />}
              title="Cost Calculator"
              description="Estimate deployment costs before you commit your FLUX"
            />
            <FeatureCard
              icon={<Wrench className="h-8 w-8 text-green-600 dark:text-green-400" />}
              title="Visual Spec Builder"
              description="Build deployment specifications visually without writing JSON"
            />
            <FeatureCard
              icon={<TrendingUp className="h-8 w-8 text-orange-600 dark:text-orange-400" />}
              title="Progress Tracking"
              description="Track your learning progress through each tutorial"
            />
            <FeatureCard
              icon={<BookOpen className="h-8 w-8 text-red-600 dark:text-red-400" />}
              title="Troubleshooting Guides"
              description="Solutions to common issues based on real deployment experience"
            />
            <FeatureCard
              icon={<Code className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />}
              title="Production-Ready"
              description="Learn best practices for security, scaling, and maintenance"
            />
          </div>
        </div>
      </section>

      {/* Quick Links Section */}
      <section className="py-12 sm:py-16 bg-gray-50 dark:bg-gray-900">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-8 sm:mb-12 dark:text-gray-100">Popular Tutorials</h2>
          <div className="grid sm:grid-cols-2 gap-6 max-w-4xl mx-auto">
            <TutorialCard
              title="Getting Started"
              description="Prerequisites and setup - everything you need before your first deployment"
              href="/getting-started"
              time="5 min read"
              level="Beginner"
            />
            <TutorialCard
              title="Deploy Your First App"
              description="Deploy a simple single-container application to Flux in under 30 minutes"
              href="/tutorials/basic-deployment"
              time="30 min"
              level="Beginner"
            />
            <TutorialCard
              title="Minecraft Server on Flux"
              description="Deploy your own decentralized, censorship-resistant Minecraft server"
              href="/tutorials/minecraft-server"
              time="15 min"
              level="Beginner"
            />
            <TutorialCard
              title="Interactive Playground"
              description="Build deployment specs visually with our interactive spec builder"
              href="/playground"
              time="Interactive"
              level="All Levels"
            />
          </div>
        </div>
      </section>
    </div>
  )
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="p-4 sm:p-6 border dark:border-gray-700 border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-lg dark:bg-gray-800 transition-shadow">
      <div className="mb-3 sm:mb-4">{icon}</div>
      <h3 className="text-lg sm:text-xl font-semibold mb-2 dark:text-gray-100">{title}</h3>
      <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300">{description}</p>
    </div>
  )
}

function TutorialCard({ title, description, href, time, level }: {
  title: string
  description: string
  href: string
  time: string
  level: string
}) {
  return (
    <Link
      href={href}
      className="block p-4 sm:p-6 border dark:border-gray-700 border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-lg hover:border-blue-500 dark:hover:border-blue-400 dark:bg-gray-800 transition-all group"
    >
      <div className="flex items-start justify-between mb-2">
        <h3 className="text-lg sm:text-xl font-semibold group-hover:text-blue-600 dark:text-blue-400 dark:group-hover:text-blue-400 dark:text-gray-100 transition-colors pr-2">{title}</h3>
        <ArrowRight className="h-5 w-5 text-gray-400 dark:text-gray-500 dark:text-gray-400 group-hover:text-blue-600 dark:text-blue-400 dark:group-hover:text-blue-400 group-hover:translate-x-1 transition-all flex-shrink-0" />
      </div>
      <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300 mb-4">{description}</p>
      <div className="flex items-center gap-3 sm:gap-4 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
        <span className="flex items-center gap-1">
          <span className={`w-2 h-2 rounded-full ${
            level === 'Beginner' ? 'bg-green-500' :
            level === 'Intermediate' ? 'bg-yellow-500' :
            'bg-blue-500'
          }`}></span>
          {level}
        </span>
        <span>{time}</span>
      </div>
    </Link>
  )
}
