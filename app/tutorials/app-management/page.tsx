'use client'

import { StepByStep } from '@/components/tutorial/StepByStep'
import { CodeBlock } from '@/components/tutorial/CodeBlock'
import { ChecklistItem } from '@/components/tutorial/ChecklistItem'
import { TutorialProgress } from '@/components/tutorial/TutorialProgress'
import { AlertCircle, Terminal, BarChart3, Settings, RefreshCw, Power, Trash2, Globe, Database, Calendar } from 'lucide-react'

export default function AppManagementPage() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <div className="mb-8">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-4xl font-bold mb-2">Managing Your Flux Applications</h1>
            <p className="text-xl text-gray-600 dark:text-gray-300">
              Learn how to monitor, manage, and troubleshoot your deployed applications using the Flux dashboard
            </p>
          </div>
          <TutorialProgress tutorialId="app-management" />
        </div>
      </div>

      {/* Learning Objectives */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border dark:border-gray-700 border-blue-200 dark:border-blue-800 rounded-lg p-6 mb-8">
        <h2 className="text-xl font-semibold mb-3">What You&apos;ll Learn</h2>
        <ul className="space-y-2">
          <ChecklistItem checked>Navigate the Flux application dashboard</ChecklistItem>
          <ChecklistItem checked>View and analyze application logs</ChecklistItem>
          <ChecklistItem checked>Monitor resource usage and performance</ChecklistItem>
          <ChecklistItem checked>Manage app lifecycle (start, stop, restart, update)</ChecklistItem>
          <ChecklistItem checked>Understand app status and health indicators</ChecklistItem>
          <ChecklistItem checked>Use interactive terminal, backup/restore, and other advanced features</ChecklistItem>
        </ul>
      </div>

      {/* Prerequisites */}
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border dark:border-gray-700 border-yellow-200 dark:border-yellow-800 rounded-lg p-6 mb-8">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-6 w-6 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-1" />
          <div>
            <h2 className="text-xl font-semibold mb-3">Before You Start</h2>
            <ul className="space-y-1 text-sm">
              <li>✓ Completed the Basic Deployment tutorial</li>
              <li>✓ Have at least one deployed application on Flux</li>
              <li>✓ Access to the Zelcore wallet you used for deployment</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="space-y-8">
        {/* Step 1: Access Your Apps */}
        <StepByStep number={1} title="Accessing Your Applications">
          <p className="mb-4">
            The Flux dashboard is your central hub for managing all your deployed applications.
          </p>

          <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-6 mb-4 dark:bg-gray-800 ">
            <h3 className="font-semibold mb-3">Navigation Steps:</h3>
            <ol className="space-y-3 ml-4">
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-600 dark:text-blue-400 flex items-center justify-center text-sm font-bold">1</span>
                <div>
                  <p className="font-medium">Go to the Flux Home portal</p>
                  <a href="https://home.runonflux.io" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline text-sm">
                    https://home.runonflux.io
                  </a>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-600 dark:text-blue-400 flex items-center justify-center text-sm font-bold">2</span>
                <div>
                  <p className="font-medium">Log in with your Zelcore wallet</p>
                  <p className="text-sm text-gray-600 dark:text-gray-300">Use the same wallet that deployed your application</p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-600 dark:text-blue-400 flex items-center justify-center text-sm font-bold">3</span>
                <div>
                  <p className="font-medium">Navigate to &quot;Applications&quot; → &quot;Management&quot;</p>
                  <p className="text-sm text-gray-600 dark:text-gray-300">You&apos;ll see tabs for &quot;My Active Apps&quot; and &quot;My Expired Apps&quot;</p>
                </div>
              </li>
            </ol>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 border dark:border-gray-700 border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="text-sm text-blue-900">
              <strong>Note:</strong> You can only manage applications deployed with the currently connected Zelcore wallet.
            </p>
          </div>
        </StepByStep>

        {/* Step 2: Understanding App Status */}
        <StepByStep number={2} title="Understanding Application Status">
          <p className="mb-4">
            Each application displays a status indicator that shows its current state.
          </p>

          <div className="space-y-3">
            <div className="border dark:border-gray-700 rounded-lg p-4 bg-green-50 dark:bg-green-900/20 dark:bg-gray-800 ">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 rounded-full bg-green-50 dark:bg-green-900/200"></div>
                <h4 className="font-semibold text-green-900">Running</h4>
              </div>
              <p className="text-sm text-green-800">Application is healthy and accessible. All containers are running normally.</p>
            </div>

            <div className="border dark:border-gray-700 rounded-lg p-4 bg-yellow-50 dark:bg-yellow-900/20 dark:bg-gray-800 ">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 rounded-full bg-yellow-50 dark:bg-yellow-900/200"></div>
                <h4 className="font-semibold text-yellow-900">Starting</h4>
              </div>
              <p className="text-sm text-yellow-800">Application is initializing. This may take 1-3 minutes for containers to start and health checks to pass.</p>
            </div>

            <div className="border dark:border-gray-700 rounded-lg p-4 bg-orange-50 dark:bg-orange-900/20 dark:bg-gray-800 ">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                <h4 className="font-semibold text-orange-900">Restarting</h4>
              </div>
              <p className="text-sm text-orange-800">Container crashed and is automatically restarting. Check logs if this persists.</p>
            </div>

            <div className="border dark:border-gray-700 rounded-lg p-4 bg-red-50 dark:bg-red-900/20 dark:bg-gray-800 ">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 rounded-full bg-red-50 dark:bg-red-900/200"></div>
                <h4 className="font-semibold text-red-900">Stopped / Failed</h4>
              </div>
              <p className="text-sm text-red-800">Application has stopped or failed to start. Check logs and troubleshoot the issue.</p>
            </div>

            <div className="border dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-800 ">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 rounded-full bg-gray-50 dark:bg-gray-8000"></div>
                <h4 className="font-semibold text-gray-900 dark:text-white">Stopped (Manual)</h4>
              </div>
              <p className="text-sm text-gray-800 dark:text-gray-100">You manually stopped the application. It won&apos;t restart until you start it again.</p>
            </div>
          </div>
        </StepByStep>

        {/* Step 3: Viewing Logs */}
        <StepByStep number={3} title="Viewing Application Logs">
          <p className="mb-4">
            Logs are essential for debugging issues and understanding what your application is doing.
          </p>

          <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-6 mb-4 dark:bg-gray-800 ">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Terminal className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              Accessing Logs
            </h3>
            <ol className="space-y-2 ml-4 text-sm">
              <li>1. Click on your application in the &quot;My Active Apps&quot; list</li>
              <li>2. Navigate to the &quot;Logs Management&quot; section in the left sidebar</li>
              <li>3. Select the component from the dropdown (if multi-component app)</li>
              <li>4. View logs in real-time - they update automatically</li>
              <li>5. Use the refresh button to see the latest entries</li>
            </ol>
          </div>

          <div className="grid md:grid-cols-2 gap-4 mb-4">
            <div className="border dark:border-gray-700 rounded-lg p-4 dark:bg-gray-800 ">
              <h4 className="font-semibold mb-2 text-blue-900">stdout Logs</h4>
              <ul className="text-sm text-gray-700 dark:text-gray-200 space-y-1">
                <li>• Normal application output</li>
                <li>• console.log() messages</li>
                <li>• Request/response logging</li>
                <li>• General information</li>
              </ul>
            </div>

            <div className="border dark:border-gray-700 rounded-lg p-4 dark:bg-gray-800 ">
              <h4 className="font-semibold mb-2 text-red-900">stderr Logs</h4>
              <ul className="text-sm text-gray-700 dark:text-gray-200 space-y-1">
                <li>• Error messages</li>
                <li>• console.error() output</li>
                <li>• Stack traces</li>
                <li>• Warning messages</li>
              </ul>
            </div>
          </div>

          <div className="bg-yellow-50 dark:bg-yellow-900/20 border dark:border-gray-700 border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-4">
            <h4 className="font-semibold text-yellow-900 mb-2">Log Tips:</h4>
            <ul className="text-sm text-yellow-800 space-y-1 ml-4">
              <li>• Logs display both stdout and stderr combined in the Logs Management view</li>
              <li>• Use descriptive log messages in your app for easier debugging</li>
              <li>• Logs auto-refresh, but you can manually refresh to ensure latest entries</li>
              <li>• For multi-component apps, switch between components using the dropdown</li>
            </ul>
          </div>

          <CodeBlock title="Example: Adding useful logs to your app" language="javascript">
{`// Good logging practices
console.log('[STARTUP] Server starting on port 3000');
console.log('[DB] Connected to database successfully');
console.log('[REQUEST] GET /api/users - 200 OK');
console.error('[ERROR] Database connection failed:', error.message);

// Include timestamps if your app doesn't log them automatically
const timestamp = new Date().toISOString();
console.log(\`[\${timestamp}] Application started\`);`}
          </CodeBlock>
        </StepByStep>

        {/* Step 4: Resource Monitoring */}
        <StepByStep number={4} title="Monitoring Resource Usage">
          <p className="mb-4">
            Keep track of how your application is using CPU, RAM, and disk space to ensure optimal performance.
          </p>

          <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-6 mb-4 dark:bg-gray-800 ">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              Resource Metrics
            </h3>
            <p className="text-sm text-gray-700 dark:text-gray-200 mb-4">
              In your app details page, you can view real-time resource usage metrics:
            </p>

            <p className="text-sm text-gray-700 dark:text-gray-200 mb-3">
              The &quot;Monitoring&quot; section displays these real-time graphs:
            </p>
            <div className="space-y-3">
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-2">CPU Usage</h4>
                <ul className="text-sm text-blue-800 space-y-1 ml-4">
                  <li>• Shows percentage of allocated CPU being used over time</li>
                  <li>• Consistent high usage (80%+) may indicate need to scale up</li>
                  <li>• Spikes are normal during traffic bursts</li>
                </ul>
              </div>

              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                <h4 className="font-semibold text-green-900 mb-2">Memory Usage</h4>
                <ul className="text-sm text-green-800 space-y-1 ml-4">
                  <li>• Displays current RAM usage vs. allocated amount</li>
                  <li>• Running at 90%+ consistently means you should increase RAM</li>
                  <li>• Gradual increase over time may indicate memory leak</li>
                </ul>
              </div>

              <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-4">
                <h4 className="font-semibold text-indigo-900 mb-2">Network Usage (aggregate)</h4>
                <ul className="text-sm text-indigo-800 space-y-1 ml-4">
                  <li>• Shows incoming and outgoing network traffic</li>
                  <li>• Useful for understanding bandwidth usage patterns</li>
                  <li>• High traffic spikes may correlate with user activity</li>
                </ul>
              </div>

              <div className="bg-cyan-50 dark:bg-cyan-900/20 rounded-lg p-4">
                <h4 className="font-semibold text-cyan-900 mb-2">I/O Usage (aggregate)</h4>
                <ul className="text-sm text-cyan-800 space-y-1 ml-4">
                  <li>• Displays disk read/write operations</li>
                  <li>• High I/O may indicate database queries or file operations</li>
                  <li>• Persistent high I/O could affect performance</li>
                </ul>
              </div>

              <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
                <h4 className="font-semibold text-purple-900 mb-2">Persistent Storage</h4>
                <ul className="text-sm text-purple-800 space-y-1 ml-4">
                  <li>• Shows used vs. total allocated persistent storage (containerData)</li>
                  <li>• Monitor if your app writes logs or user uploads</li>
                  <li>• Increase HDD allocation if running low (&lt;20% free)</li>
                </ul>
              </div>

              <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4">
                <h4 className="font-semibold text-orange-900 mb-2">Root Filesystem (rootfs)</h4>
                <ul className="text-sm text-orange-800 space-y-1 ml-4">
                  <li>• Shows space used in the container&apos;s root filesystem</li>
                  <li>• Separate from persistent storage volumes</li>
                  <li>• Filling up may indicate app writing to non-persistent locations</li>
                </ul>
              </div>

              <div className="bg-teal-50 dark:bg-teal-900/20 rounded-lg p-4">
                <h4 className="font-semibold text-teal-900 mb-2">Processes</h4>
                <ul className="text-sm text-teal-800 space-y-1 ml-4">
                  <li>• Shows running processes inside your container</li>
                  <li>• Useful for debugging unexpected processes</li>
                  <li>• Can help identify zombie processes or runaway tasks</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="bg-orange-50 dark:bg-orange-900/20 border dark:border-gray-700 border-orange-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold text-orange-900 mb-1">Performance Tip:</p>
                <p className="text-orange-800">
                  If you consistently use 80%+ of allocated resources, consider updating your app specification to increase CPU, RAM, or HDD.
                </p>
              </div>
            </div>
          </div>
        </StepByStep>

        {/* Step 5: App Actions */}
        <StepByStep number={5} title="Managing Application Lifecycle">
          <p className="mb-4">
            You can perform various actions to manage your running applications.
          </p>

          <p className="mb-4 text-sm text-gray-700 dark:text-gray-200">
            In the &quot;Application Control&quot; section, you&apos;ll find these action buttons:
          </p>

          <div className="space-y-4">
            <div className="border dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800 ">
              <div className="flex items-center gap-2 mb-3">
                <Power className="h-5 w-5 text-green-600 dark:text-green-400" />
                <h3 className="font-semibold text-lg">Start Application</h3>
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-200 mb-2">
                <strong>When to use:</strong> Resume a stopped application
              </p>
              <ul className="text-sm text-gray-600 dark:text-gray-300 space-y-1 ml-4">
                <li>• Starts containers that were manually stopped</li>
                <li>• App becomes accessible again at its URL</li>
                <li>• Persistent data is preserved from before it was stopped</li>
              </ul>
            </div>

            <div className="border dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800 ">
              <div className="flex items-center gap-2 mb-3">
                <Power className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                <h3 className="font-semibold text-lg">Stop Application</h3>
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-200 mb-2">
                <strong>When to use:</strong> Temporarily disable app or save FLUX costs
              </p>
              <ul className="text-sm text-gray-600 dark:text-gray-300 space-y-1 ml-4">
                <li>• Stops all containers without deleting the app</li>
                <li>• App becomes inaccessible but data is preserved</li>
                <li>• Stops FLUX payments for compute resources</li>
                <li>• Can start anytime to resume service</li>
              </ul>
            </div>

            <div className="border dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800 ">
              <div className="flex items-center gap-2 mb-3">
                <RefreshCw className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                <h3 className="font-semibold text-lg">Restart Application</h3>
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-200 mb-2">
                <strong>When to use:</strong> When app is stuck or to clear memory
              </p>
              <ul className="text-sm text-gray-600 dark:text-gray-300 space-y-1 ml-4">
                <li>• Gracefully stops and restarts all containers</li>
                <li>• Brief downtime (30-60 seconds typically)</li>
                <li>• Persistent data (with containerData) is preserved</li>
                <li>• Useful for clearing temporary issues</li>
              </ul>
            </div>

            <div className="border dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800 ">
              <div className="flex items-center gap-2 mb-3">
                <Settings className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                <h3 className="font-semibold text-lg">Pause / Unpause Application</h3>
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-200 mb-2">
                <strong>When to use:</strong> Temporarily freeze app execution without stopping
              </p>
              <ul className="text-sm text-gray-600 dark:text-gray-300 space-y-1 ml-4">
                <li>• Pauses all processes in the container</li>
                <li>• Different from Stop - container remains in memory</li>
                <li>• Unpause resumes exactly where it left off</li>
                <li>• Quick way to temporarily suspend without full restart</li>
              </ul>
            </div>

            <div className="border dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800 ">
              <div className="flex items-center gap-2 mb-3">
                <RefreshCw className="h-5 w-5 text-indigo-600" />
                <h3 className="font-semibold text-lg">Soft Reinstall</h3>
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-200 mb-2">
                <strong>When to use:</strong> Refresh container while preserving data
              </p>
              <ul className="text-sm text-gray-600 dark:text-gray-300 space-y-1 ml-4">
                <li>• Recreates container from the same image</li>
                <li>• Preserves containerData volumes</li>
                <li>• Useful for applying minor fixes or refreshing state</li>
                <li>• Less disruptive than hard reinstall</li>
              </ul>
            </div>

            <div className="border dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800 ">
              <div className="flex items-center gap-2 mb-3">
                <RefreshCw className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                <h3 className="font-semibold text-lg">Hard Reinstall</h3>
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-200 mb-2">
                <strong>When to use:</strong> Complete fresh start with persistent data
              </p>
              <ul className="text-sm text-gray-600 dark:text-gray-300 space-y-1 ml-4">
                <li>• Completely removes and recreates container</li>
                <li>• Preserves containerData but clears everything else</li>
                <li>• More thorough than soft reinstall</li>
                <li>• Use when soft reinstall doesn&apos;t resolve issues</li>
              </ul>
            </div>

            <div className="border dark:border-gray-700 rounded-lg p-4 bg-red-50 dark:bg-red-900/20 dark:bg-gray-800 ">
              <div className="flex items-center gap-2 mb-3">
                <Trash2 className="h-5 w-5 text-red-600 dark:text-red-400" />
                <h3 className="font-semibold text-lg text-red-900">Remove Application</h3>
              </div>
              <p className="text-sm text-red-800 mb-2">
                <strong>⚠️ Permanent action - cannot be undone!</strong>
              </p>
              <ul className="text-sm text-red-700 space-y-1 ml-4">
                <li>• Completely removes the application from Flux</li>
                <li>• All data is deleted (including containerData volumes)</li>
                <li>• Stops FLUX payments immediately</li>
                <li>• You&apos;ll need to redeploy from scratch to restore</li>
              </ul>
            </div>
          </div>

          <div className="bg-yellow-50 dark:bg-yellow-900/20 border dark:border-gray-700 border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mt-4">
            <p className="text-sm text-yellow-900">
              <strong>Best Practice:</strong> Always backup important data before stopping, updating, or deleting applications. Use containerData with appropriate volume prefixes for data that must persist.
            </p>
          </div>
        </StepByStep>

        {/* Step 6: Advanced Features */}
        <StepByStep number={6} title="Advanced Management Features">
          <p className="mb-4">
            The Flux dashboard provides several powerful features for managing your applications beyond basic operations.
          </p>

          <div className="space-y-4">
            <div className="border dark:border-gray-700 rounded-lg p-6 bg-gradient-to-r from-green-50 to-white dark:from-green-900/20 dark:to-gray-800 ">
              <div className="flex items-center gap-2 mb-3">
                <Terminal className="h-6 w-6 text-green-600 dark:text-green-400" />
                <h3 className="font-semibold text-lg">Interactive Terminal</h3>
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-200 mb-3">
                Access a shell inside your running container directly from the browser. Useful for debugging, inspecting files, or running commands.
              </p>
              <ul className="text-sm text-gray-600 dark:text-gray-300 space-y-1 ml-4">
                <li>• Choose shell type: sh, bash, or ash (depending on your container)</li>
                <li>• Run commands interactively in your container environment</li>
                <li>• Inspect logs, check processes, or troubleshoot issues</li>
                <li>• View environment variables and file system state</li>
              </ul>
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border dark:border-gray-700 border-yellow-200 dark:border-yellow-800 rounded p-3 mt-3 text-sm text-yellow-900">
                <strong>Note:</strong> Terminal sessions are temporary - any changes made are lost on container restart unless saved to containerData volumes.
              </div>
            </div>

            <div className="border dark:border-gray-700 rounded-lg p-6 bg-gradient-to-r from-blue-50 to-white dark:from-blue-900/20 dark:to-gray-800 ">
              <div className="flex items-center gap-2 mb-3">
                <Database className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                <h3 className="font-semibold text-lg">Backup and Restore</h3>
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-200 mb-3">
                Create backups of your persistent data and restore them when needed. Critical for protecting important application data.
              </p>
              <ul className="text-sm text-gray-600 dark:text-gray-300 space-y-2 ml-4">
                <li><strong>Backup:</strong> Creates a snapshot of all containerData volumes</li>
                <li><strong>Restore:</strong> Restores data from a previous backup point</li>
                <li><strong>Use cases:</strong> Before major updates, regular data protection, disaster recovery</li>
              </ul>
              <div className="bg-blue-100 rounded p-3 mt-3 text-sm text-blue-900">
                <strong>Best Practice:</strong> Create backups before major updates or configuration changes. Regular backups help protect against data loss.
              </div>
            </div>

            <div className="border dark:border-gray-700 rounded-lg p-6 bg-gradient-to-r from-purple-50 to-white dark:from-purple-900/20 dark:to-gray-800 ">
              <div className="flex items-center gap-2 mb-3">
                <Globe className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                <h3 className="font-semibold text-lg">Running Instances Map</h3>
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-200 mb-3">
                View a world map showing the geographic distribution of nodes running your application instances.
              </p>
              <ul className="text-sm text-gray-600 dark:text-gray-300 space-y-1 ml-4">
                <li>• Visual map showing where your app is deployed globally</li>
                <li>• See which Flux nodes are running your containers</li>
                <li>• Understand geographic redundancy and distribution</li>
                <li>• Monitor individual instance health per node</li>
              </ul>
            </div>

            <div className="border dark:border-gray-700 rounded-lg p-6 bg-gradient-to-r from-orange-50 to-white dark:from-orange-900/20 dark:to-gray-800 ">
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                <h3 className="font-semibold text-lg">Update / Renew Subscription</h3>
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-200 mb-3">
                Modify your application&apos;s deployment specification or extend the subscription period using a slider interface.
              </p>
              <ul className="text-sm text-gray-600 dark:text-gray-300 space-y-2 ml-4">
                <li><strong>Update Spec:</strong> Modify Docker image, resources (CPU/RAM/HDD), ports, environment variables</li>
                <li><strong>Renew:</strong> Extend subscription period with the slider - longer periods ensure continuity</li>
                <li><strong>Resource Changes:</strong> Adjust allocated resources as your needs change</li>
                <li><strong>Version Updates:</strong> Deploy new versions by changing the repotag</li>
              </ul>
              <div className="bg-orange-100 rounded p-3 mt-3 text-sm text-orange-900">
                <strong>Tip:</strong> Use the slider to renew subscriptions well before expiration to avoid service interruptions.
              </div>
            </div>
          </div>
        </StepByStep>

        {/* Step 7: App Information */}
        <StepByStep number={7} title="Viewing Application Details">
          <p className="mb-4">
            The app details page shows comprehensive information about your deployment.
          </p>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="border dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800 ">
              <h4 className="font-semibold mb-3 text-blue-900">Deployment Information</h4>
              <ul className="text-sm text-gray-700 dark:text-gray-200 space-y-2">
                <li className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-300">App Name:</span>
                  <span className="font-mono">myapp</span>
                </li>
                <li className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-300">Version:</span>
                  <span className="font-mono">4</span>
                </li>
                <li className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-300">Image:</span>
                  <span className="font-mono text-xs">user/app:latest</span>
                </li>
                <li className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-300">Status:</span>
                  <span className="text-green-600 dark:text-green-400">Running</span>
                </li>
              </ul>
            </div>

            <div className="border dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800 ">
              <h4 className="font-semibold mb-3 text-green-900">Resource Allocation</h4>
              <ul className="text-sm text-gray-700 dark:text-gray-200 space-y-2">
                <li className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-300">CPU:</span>
                  <span className="font-mono">2.0 cores</span>
                </li>
                <li className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-300">RAM:</span>
                  <span className="font-mono">4000 MB</span>
                </li>
                <li className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-300">Storage:</span>
                  <span className="font-mono">20 GB</span>
                </li>
                <li className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-300">Monthly Cost:</span>
                  <span className="font-mono">~150 FLUX</span>
                </li>
              </ul>
            </div>

            <div className="border dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800 ">
              <h4 className="font-semibold mb-3 text-purple-900">Network Information</h4>
              <ul className="text-sm text-gray-700 dark:text-gray-200 space-y-2">
                <li>
                  <span className="text-gray-600 dark:text-gray-300">Public URL:</span>
                  <a href="#" className="block font-mono text-xs text-blue-600 dark:text-blue-400 hover:underline break-all">
                    myapp.app.runonflux.io
                  </a>
                </li>
                <li>
                  <span className="text-gray-600 dark:text-gray-300">Ports:</span>
                  <span className="block font-mono text-xs">80 → 3000</span>
                </li>
              </ul>
            </div>

            <div className="border dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800 ">
              <h4 className="font-semibold mb-3 text-orange-900">Running Instances</h4>
              <p className="text-sm text-gray-700 dark:text-gray-200 mb-2">
                Shows which Flux nodes are running your app
              </p>
              <ul className="text-sm text-gray-600 dark:text-gray-300 space-y-1 ml-4">
                <li>• Geographic distribution</li>
                <li>• Node IP addresses</li>
                <li>• Individual instance health</li>
              </ul>
            </div>
          </div>
        </StepByStep>

        {/* Step 8: Common Management Tasks */}
        <StepByStep number={8} title="Common Management Tasks">
          <div className="space-y-6">
            <div className="border dark:border-gray-700 rounded-lg p-6 bg-gradient-to-r from-blue-50 to-white dark:from-blue-900/20 dark:to-gray-800 ">
              <h3 className="font-semibold text-lg mb-3">Deploying a New Version</h3>
              <ol className="space-y-2 text-sm ml-4">
                <li>1. Build and push new Docker image with updated tag</li>
                <li>2. Go to your app in Flux dashboard</li>
                <li>3. Navigate to &quot;Update / Renew&quot; section</li>
                <li>4. Modify the repotag to reference new image version</li>
                <li>5. Submit the update</li>
                <li>6. Wait 2-3 minutes for new version to deploy</li>
                <li>7. Check logs to confirm successful startup</li>
              </ol>
            </div>

            <div className="border dark:border-gray-700 rounded-lg p-6 bg-gradient-to-r from-green-50 to-white dark:from-green-900/20 dark:to-gray-800 ">
              <h3 className="font-semibold text-lg mb-3">Scaling Resources</h3>
              <p className="text-sm text-gray-700 dark:text-gray-200 mb-3">
                If your app is running out of CPU, RAM, or disk:
              </p>
              <ol className="space-y-2 text-sm ml-4">
                <li>1. Monitor resource usage in the dashboard</li>
                <li>2. Navigate to &quot;Update / Renew&quot; section</li>
                <li>3. Increase cpu, ram, or hdd values as needed</li>
                <li>4. Note: Higher resources = higher monthly cost</li>
                <li>5. Submit update and wait for redeployment</li>
              </ol>
              <div className="bg-green-100 rounded p-3 mt-3 text-sm text-green-900">
                <strong>Tip:</strong> Use the playground calculator to estimate new costs before updating
              </div>
            </div>

            <div className="border dark:border-gray-700 rounded-lg p-6 bg-gradient-to-r from-purple-50 to-white dark:from-purple-900/20 dark:to-gray-800 ">
              <h3 className="font-semibold text-lg mb-3">Updating Environment Variables</h3>
              <ol className="space-y-2 text-sm ml-4">
                <li>1. Navigate to &quot;Update / Renew&quot; section</li>
                <li>2. Modify the environmentParameters array</li>
                <li>3. Add, remove, or change environment variables</li>
                <li>4. Submit the update</li>
                <li>5. App will restart with new environment</li>
              </ol>
              <CodeBlock title="Example: Update API key" language="json">
{`{
  "environmentParameters": [
    "NODE_ENV=production",
    "API_KEY=new_key_here",  // Updated
    "DB_HOST=fluxpostgres_myapp"
  ]
}`}
              </CodeBlock>
            </div>

            <div className="border dark:border-gray-700 rounded-lg p-6 bg-gradient-to-r from-orange-50 to-white dark:from-orange-900/20 dark:to-gray-800 ">
              <h3 className="font-semibold text-lg mb-3">Troubleshooting Issues</h3>
              <ol className="space-y-2 text-sm ml-4">
                <li>1. Check application status (green = healthy)</li>
                <li>2. Review stderr logs for error messages</li>
                <li>3. Verify resource usage isn&apos;t at 100%</li>
                <li>4. Try restarting the application</li>
                <li>5. Check if recent code changes caused issues</li>
                <li>6. Verify environment variables are correct</li>
                <li>7. Check the <a href="/troubleshooting" className="text-blue-600 dark:text-blue-400 hover:underline">Troubleshooting Guide</a> for common issues</li>
              </ol>
            </div>
          </div>
        </StepByStep>
      </div>

      {/* Best Practices */}
      <div className="mt-12 border-t pt-8">
        <h2 className="text-2xl font-bold mb-6">Management Best Practices</h2>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="border dark:border-gray-700 rounded-lg p-4 bg-green-50 dark:bg-green-900/20 dark:bg-gray-800 ">
            <h3 className="font-semibold mb-3 text-green-900">✓ Do</h3>
            <ul className="text-sm space-y-2 text-green-800">
              <li>✓ Monitor logs regularly, especially after deployments</li>
              <li>✓ Check resource usage weekly to catch issues early</li>
              <li>✓ Test updates in a separate test deployment first</li>
              <li>✓ Use semantic versioning for Docker image tags (v1.0.0, v1.0.1)</li>
              <li>✓ Set up health check endpoints in your app</li>
              <li>✓ Keep FLUX balance sufficient for at least 1 month</li>
            </ul>
          </div>
          <div className="border dark:border-gray-700 rounded-lg p-4 bg-red-50 dark:bg-red-900/20 dark:bg-gray-800 ">
            <h3 className="font-semibold mb-3 text-red-900">✗ Don&apos;t</h3>
            <ul className="text-sm space-y-2 text-red-800">
              <li>✗ Don&apos;t use :latest tag in production (use specific versions)</li>
              <li>✗ Don&apos;t delete apps without backing up data first</li>
              <li>✗ Don&apos;t ignore persistent high resource usage</li>
              <li>✗ Don&apos;t update production apps without testing</li>
              <li>✗ Don&apos;t store secrets in logs (they&apos;re visible in dashboard)</li>
              <li>✗ Don&apos;t let FLUX balance run to zero (app may stop)</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Next Steps */}
      <div className="mt-12 border-t pt-8">
        <h2 className="text-2xl font-bold mb-6">Next Steps</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <a
            href="/troubleshooting"
            className="block p-6 border dark:border-gray-700 rounded-lg hover:shadow-lg transition-shadow group dark:bg-gray-800 "
          >
            <h3 className="text-lg font-semibold mb-2 group-hover:text-blue-600 dark:text-blue-400">Troubleshooting Guide →</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">Solutions to common issues when managing Flux applications</p>
          </a>
          <a
            href="/tutorials/multi-component"
            className="block p-6 border dark:border-gray-700 rounded-lg hover:shadow-lg transition-shadow group dark:bg-gray-800 "
          >
            <h3 className="text-lg font-semibold mb-2 group-hover:text-blue-600 dark:text-blue-400">Multi-Component Apps →</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">Learn to manage applications with multiple interconnected services</p>
          </a>
        </div>
      </div>
    </div>
  )
}
