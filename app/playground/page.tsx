import { SpecBuilder } from '@/components/interactive/SpecBuilder'
import { Wrench, Lightbulb, Copy, ArrowRight } from 'lucide-react'

export default function PlaygroundPage() {
  return (
    <div className="container mx-auto px-4 py-6 sm:py-12 max-w-7xl">
      <div className="mb-6 sm:mb-8">
        <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
          <Wrench className="h-8 w-8 sm:h-10 sm:w-10 text-blue-600 dark:text-blue-400" />
          <h1 className="text-2xl sm:text-4xl font-bold">Interactive Playground</h1>
        </div>
        <p className="text-base sm:text-xl text-gray-600 dark:text-gray-300">
          Build your Flux deployment specification visually - no JSON editing required!
        </p>
      </div>

      {/* Tips Section */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border dark:border-gray-700 border-blue-200 dark:border-blue-800 rounded-lg p-4 sm:p-6 mb-6 sm:mb-8">
        <div className="flex items-start gap-2 sm:gap-3">
          <Lightbulb className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-1" />
          <div>
            <h2 className="text-base sm:text-lg font-semibold mb-2">Quick Tips</h2>
            <ul className="space-y-1 text-xs sm:text-sm text-gray-700 dark:text-gray-200">
              <li>• Configure your application details and add as many components as needed</li>
              <li>• The cost estimate updates in real-time as you adjust resources</li>
              <li>• <strong>Port range:</strong> All ports must be between 0 and 65535 (system limit)</li>
              <li>• Use the internal DNS pattern for multi-component communication: <code className="bg-white dark:bg-gray-800 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-xs">flux&#123;componentname&#125;_&#123;appname&#125;</code></li>
              <li>• Download the generated spec and deploy it via <a href="https://home.runonflux.io" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">home.runonflux.io</a></li>
              <li>• Start with smaller resources and scale up if needed to save costs</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Spec Builder Component */}
      <SpecBuilder />

      {/* Easy Deployment Section */}
      <div className="mt-8 sm:mt-12 bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/30 dark:to-blue-900/30 border border-green-200 dark:border-green-800 rounded-lg p-4 sm:p-6">
        <div className="flex flex-col md:flex-row items-start md:items-center gap-4 sm:gap-6">
          <div className="flex-1">
            <h2 className="text-lg sm:text-xl font-bold mb-2 flex items-center gap-2 dark:text-white">
              <Copy className="h-5 w-5 sm:h-6 sm:w-6 text-green-600 dark:text-green-400" />
              Easy Copy-Paste Deployment
            </h2>
            <p className="text-sm sm:text-base text-gray-700 dark:text-gray-200 mb-3">
              Once you&apos;ve built your specification above, simply copy the generated JSON and paste it into the <strong>&quot;Import Application Specifications&quot;</strong> dialog on the Flux deployment page. No manual typing or file uploads required!
            </p>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 text-xs sm:text-sm dark:text-gray-200">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center w-5 h-5 sm:w-6 sm:h-6 bg-green-600 dark:bg-green-500 text-white rounded-full font-bold text-xs">1</span>
                <span>Click &quot;Copy&quot; on the generated spec</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center w-5 h-5 sm:w-6 sm:h-6 bg-green-600 dark:bg-green-500 text-white rounded-full font-bold text-xs">2</span>
                <span>Go to Register New App</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center w-5 h-5 sm:w-6 sm:h-6 bg-green-600 dark:bg-green-500 text-white rounded-full font-bold text-xs">3</span>
                <span>Click &quot;Import&quot; and paste</span>
              </div>
            </div>
          </div>
          <div className="flex-shrink-0">
            <a
              href="https://home.runonflux.io"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors text-sm sm:text-base"
            >
              Deploy Now <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5" />
            </a>
          </div>
        </div>
      </div>

      {/* Help Section */}
      <div className="mt-8 sm:mt-12 border-t pt-6 sm:pt-8">
        <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">Need Help?</h2>
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
          <a
            href="/tutorials/basic-deployment"
            className="block p-4 sm:p-6 border dark:border-gray-700 rounded-lg hover:shadow-lg transition-shadow group dark:bg-gray-800 "
          >
            <h3 className="text-base sm:text-lg font-semibold mb-2 group-hover:text-blue-600 dark:text-blue-400">Basic Tutorial →</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">Learn how to deploy your first app</p>
          </a>
          <a
            href="/tutorials/multi-component"
            className="block p-4 sm:p-6 border dark:border-gray-700 rounded-lg hover:shadow-lg transition-shadow group dark:bg-gray-800 "
          >
            <h3 className="text-base sm:text-lg font-semibold mb-2 group-hover:text-blue-600 dark:text-blue-400">Multi-Component →</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">Deploy complex multi-component applications</p>
          </a>
          <a
            href="/reference/flux-spec"
            className="block p-4 sm:p-6 border dark:border-gray-700 rounded-lg hover:shadow-lg transition-shadow group dark:bg-gray-800 "
          >
            <h3 className="text-base sm:text-lg font-semibold mb-2 group-hover:text-blue-600 dark:text-blue-400">Spec Reference →</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">Complete specification documentation</p>
          </a>
        </div>
      </div>
    </div>
  )
}
