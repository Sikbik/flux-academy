import { StepByStep } from '@/components/tutorial/StepByStep'
import { CodeBlock } from '@/components/tutorial/CodeBlock'
import { ChecklistItem } from '@/components/tutorial/ChecklistItem'
import { AlertCircle, CheckCircle2, Gamepad2, Globe, Shield, Zap } from 'lucide-react'
import { LivePrice } from '@/components/tutorial/LivePrice'

export default function MinecraftServerTutorial() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <Gamepad2 className="h-10 w-10 text-green-600 dark:text-green-400" />
          <h1 className="text-4xl font-bold">Deploy a Minecraft Server on Flux</h1>
        </div>
        <p className="text-xl text-gray-600 dark:text-gray-300">
          Run your own censorship-resistant, decentralized Minecraft server on Flux&apos;s distributed network
        </p>
      </div>

      {/* Why Minecraft on Flux */}
      <div className="bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/30 dark:to-blue-900/30 border dark:border-gray-700 rounded-lg p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4 dark:text-gray-100">Why Run Minecraft on Flux?</h2>
        <div className="grid md:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border dark:border-gray-700">
            <Shield className="h-8 w-8 text-blue-600 dark:text-blue-400 mb-2" />
            <h3 className="font-semibold mb-1 dark:text-gray-100">Censorship Resistant</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">No single point of failure or control</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border dark:border-gray-700">
            <Globe className="h-8 w-8 text-green-600 dark:text-green-400 mb-2" />
            <h3 className="font-semibold mb-1 dark:text-gray-100">Geographic Redundancy</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">Automatic failover across global nodes</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border dark:border-gray-700">
            <Zap className="h-8 w-8 text-purple-600 dark:text-purple-400 mb-2" />
            <h3 className="font-semibold mb-1 dark:text-gray-100">Cost Effective</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300"><LivePrice cpu={3} ram={4000} hdd={20} volumePrefix="g:/" /></p>
          </div>
        </div>
      </div>

      {/* Learning Objectives */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border dark:border-gray-700 border-blue-200 dark:border-blue-800 rounded-lg p-6 mb-8">
        <h2 className="text-xl font-semibold mb-3">What You&apos;ll Learn</h2>
        <ul className="space-y-2">
          <ChecklistItem checked>Deploy a persistent Minecraft Java Edition server</ChecklistItem>
          <ChecklistItem checked>Configure world persistence with volume prefixes</ChecklistItem>
          <ChecklistItem checked>Manage server properties and whitelist</ChecklistItem>
          <ChecklistItem checked>Connect players to your decentralized server</ChecklistItem>
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
              <li>✓ Have FLUX tokens (starting at <LivePrice cpu={2} ram={3000} hdd={10} volumePrefix="g:/" /> for small servers)</li>
              <li>✓ Minecraft Java Edition (for testing)</li>
              <li>✓ Basic understanding of Minecraft server configuration</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Tutorial Steps */}
      <div className="space-y-8">
        {/* Step 1: Choose Your Minecraft Version */}
        <StepByStep number={1} title="Choose Your Minecraft Server Version">
          <p className="mb-4">
            We&apos;ll use the official <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">itzg/minecraft-server</code> Docker image, which supports all Minecraft versions and server types.
          </p>

          <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-4 mb-4 dark:bg-gray-800 ">
            <h4 className="font-semibold mb-2">Popular Server Types:</h4>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <span className="w-24 font-mono text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">VANILLA</span>
                <span className="text-gray-700 dark:text-gray-200">Official Minecraft server (default)</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-24 font-mono text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">PAPER</span>
                <span className="text-gray-700 dark:text-gray-200">Optimized for performance, plugin support</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-24 font-mono text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">FORGE</span>
                <span className="text-gray-700 dark:text-gray-200">For modded Minecraft</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-24 font-mono text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">FABRIC</span>
                <span className="text-gray-700 dark:text-gray-200">Lightweight modding platform</span>
              </li>
            </ul>
          </div>

          <p className="text-sm text-gray-600 dark:text-gray-300">
            For this tutorial, we&apos;ll use <strong>PAPER</strong> - it&apos;s highly optimized and supports plugins while being compatible with vanilla clients.
          </p>
        </StepByStep>

        {/* Step 2: Create Deployment Specification */}
        <StepByStep number={2} title="Create Your Deployment Specification">
          <p className="mb-4">
            Create a Flux deployment spec for your Minecraft server with persistent world storage:
          </p>

          <CodeBlock title="minecraft-server-spec.json" language="json" downloadable filename="minecraft-server-spec.json">
{`{
  "version": 8,
  "name": "minecraftserver",
  "description": "Decentralized Minecraft Server on Flux",
  "owner": "YOUR_ZELID_HERE",
  "instances": 3,
  "staticip": false,
  "enterprise": "",
  "compose": [
    {
      "name": "minecraft",
      "description": "Minecraft Paper server",
      "repotag": "itzg/minecraft-server:latest",
      "ports": [25565],
      "containerPorts": [25565],
      "domains": [""],
      "environmentParameters": [
        "EULA=TRUE",
        "TYPE=PAPER",
        "VERSION=1.21.4",
        "DIFFICULTY=normal",
        "MAX_PLAYERS=20",
        "SPAWN_PROTECTION=16",
        "VIEW_DISTANCE=10",
        "ONLINE_MODE=true",
        "ALLOW_NETHER=true",
        "ENABLE_COMMAND_BLOCK=false",
        "SERVER_NAME=My Flux Minecraft Server",
        "MOTD=Running on Flux - Decentralized Minecraft!",
        "MEMORY=3G"
      ],
      "commands": [],
      "containerData": "g:/data",
      "cpu": 3.0,
      "ram": 4000,
      "hdd": 20,
      "tiered": false
    }
  ]
}`}
          </CodeBlock>

          <div className="bg-green-50 dark:bg-green-900/20 border dark:border-gray-700 border-green-200 dark:border-green-800 rounded-lg p-4 mt-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold text-green-900 mb-2">Key Configuration Points:</p>
                <ul className="text-green-800 space-y-1">
                  <li>• <strong>EULA=TRUE:</strong> Accepts Minecraft&apos;s End User License Agreement</li>
                  <li>• <strong>TYPE=PAPER:</strong> Uses the optimized Paper server</li>
                  <li>• <strong>VERSION:</strong> Specify Minecraft version (use LATEST for newest)</li>
                  <li>• <strong>containerData: &quot;g:/data&quot;:</strong> Uses primary/standby sync for world persistence (20% discount!)</li>
                  <li>• <strong>MEMORY=3G:</strong> JVM memory allocation (leave ~1GB for system)</li>
                  <li>• <strong>Port 25565:</strong> Standard Minecraft server port</li>
                </ul>
              </div>
            </div>
          </div>
        </StepByStep>

        {/* Step 3: Understanding Resource Requirements */}
        <StepByStep number={3} title="Understanding Resource Requirements">
          <p className="mb-4">
            Minecraft servers can be resource-intensive. Here&apos;s what different player counts typically need:
          </p>

          <div className="overflow-x-auto">
            <table className="w-full border dark:border-gray-700 rounded-lg overflow-hidden dark:bg-gray-800 ">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Players</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">CPU</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">RAM</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Storage</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Est. Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y text-sm">
                <tr>
                  <td className="px-4 py-3">1-5 (Small)</td>
                  <td className="px-4 py-3">2.0 cores</td>
                  <td className="px-4 py-3">3000 MB</td>
                  <td className="px-4 py-3">10 GB</td>
                  <td className="px-4 py-3"><LivePrice cpu={2} ram={3000} hdd={10} volumePrefix="g:/" /></td>
                </tr>
                <tr>
                  <td className="px-4 py-3">5-15 (Medium)</td>
                  <td className="px-4 py-3">3.0 cores</td>
                  <td className="px-4 py-3">4000 MB</td>
                  <td className="px-4 py-3">20 GB</td>
                  <td className="px-4 py-3"><LivePrice cpu={3} ram={4000} hdd={20} volumePrefix="g:/" /></td>
                </tr>
                <tr>
                  <td className="px-4 py-3">15-30 (Large)</td>
                  <td className="px-4 py-3">4.0 cores</td>
                  <td className="px-4 py-3">6000 MB</td>
                  <td className="px-4 py-3">30 GB</td>
                  <td className="px-4 py-3"><LivePrice cpu={4} ram={6000} hdd={30} volumePrefix="g:/" /></td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className="text-sm text-gray-600 dark:text-gray-300 mt-4">
            * Prices include the 20% discount from using <code className="bg-gray-100 dark:bg-gray-700 px-1">g:/</code> volume prefix. Actual FLUX cost varies with market price.
          </p>
        </StepByStep>

        {/* Step 4: Deploy to Flux */}
        <StepByStep number={4} title="Deploy Your Minecraft Server">
          <p className="mb-4">
            Now let&apos;s deploy your server to the Flux network:
          </p>

          <ol className="space-y-4 ml-4">
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-600 dark:text-blue-400 flex items-center justify-center text-sm font-bold">1</span>
              <div>
                <p>Go to <a href="https://home.runonflux.io" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">home.runonflux.io</a></p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-600 dark:text-blue-400 flex items-center justify-center text-sm font-bold">2</span>
              <div>
                <p>Login with your Zelcore wallet</p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-600 dark:text-blue-400 flex items-center justify-center text-sm font-bold">3</span>
              <div>
                <p>Navigate to <strong>&quot;Applications&quot;</strong> → <strong>&quot;Management&quot;</strong> → <strong>&quot;Register New App&quot;</strong></p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-600 dark:text-blue-400 flex items-center justify-center text-sm font-bold">4</span>
              <div>
                <p>Paste your JSON spec or use the interactive builder</p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-600 dark:text-blue-400 flex items-center justify-center text-sm font-bold">5</span>
              <div>
                <p>Review cost (should show ~20% discount for using g:/ prefix)</p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-600 dark:text-blue-400 flex items-center justify-center text-sm font-bold">6</span>
              <div>
                <p>Click <strong>&quot;Deploy App&quot;</strong> and approve the transaction</p>
              </div>
            </li>
          </ol>

          <div className="bg-blue-50 dark:bg-blue-900/20 border dark:border-gray-700 border-blue-200 dark:border-blue-800 rounded-lg p-4 mt-6">
            <p className="text-sm font-semibold mb-2">Deployment Time:</p>
            <p className="text-sm text-gray-700 dark:text-gray-200">
              Initial deployment takes 10-15 minutes as the server downloads the Minecraft server JAR and generates the world. Subsequent restarts are faster.
            </p>
          </div>
        </StepByStep>

        {/* Step 5: Find Your Server IP */}
        <StepByStep number={5} title="Find Your Server IP and Connect">
          <p className="mb-4">
            Once deployed, you need to find your server&apos;s IP address to connect:
          </p>

          <ol className="space-y-3 text-sm mb-6">
            <li>1. Go to home.runonflux.io → <strong>Applications</strong> → <strong>Management</strong></li>
            <li>2. Find your &quot;minecraftserver&quot; app in <strong>My Active Apps</strong></li>
            <li>3. Click on it to see the application details</li>
            <li>4. Scroll to <strong>Running Instances</strong> section</li>
            <li>5. Copy the IP address and port (will look like: <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">123.45.67.89:25565</code>)</li>
          </ol>

          <div className="border dark:border-gray-700 rounded-lg p-4 mb-4 dark:bg-gray-800 ">
            <h4 className="font-semibold mb-3">Connecting from Minecraft:</h4>
            <ol className="space-y-2 text-sm">
              <li>1. Open Minecraft Java Edition</li>
              <li>2. Click &quot;Multiplayer&quot;</li>
              <li>3. Click &quot;Add Server&quot;</li>
              <li>4. Enter your server details:
                <div className="bg-gray-50 dark:bg-gray-800 rounded p-3 mt-2 font-mono text-xs">
                  Server Name: My Flux Server<br/>
                  Server Address: 123.45.67.89:25565
                </div>
              </li>
              <li>5. Click &quot;Done&quot; and join!</li>
            </ol>
          </div>

          <div className="bg-green-50 dark:bg-green-900/20 border dark:border-gray-700 border-green-200 dark:border-green-800 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-2">
              <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
              <h3 className="text-lg font-semibold text-green-900">You&apos;re In!</h3>
            </div>
            <p className="text-green-800 text-sm">
              Your Minecraft server is now running on Flux&apos;s decentralized network with automatic failover and world persistence!
            </p>
          </div>
        </StepByStep>

        {/* Step 6: Server Management */}
        <StepByStep number={6} title="Server Management & Configuration">
          <p className="mb-4">
            You can customize your server further using environment variables:
          </p>

          <div className="space-y-4">
            <div className="border dark:border-gray-700 rounded-lg p-4 dark:bg-gray-800 ">
              <h4 className="font-semibold mb-2">Common Configuration Variables:</h4>
              <div className="space-y-2 text-sm">
                <div className="flex gap-2">
                  <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-xs">DIFFICULTY</code>
                  <span className="text-gray-700 dark:text-gray-200">peaceful, easy, normal, hard</span>
                </div>
                <div className="flex gap-2">
                  <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-xs">GAMEMODE</code>
                  <span className="text-gray-700 dark:text-gray-200">survival, creative, adventure, spectator</span>
                </div>
                <div className="flex gap-2">
                  <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-xs">PVP</code>
                  <span className="text-gray-700 dark:text-gray-200">true, false</span>
                </div>
                <div className="flex gap-2">
                  <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-xs">SEED</code>
                  <span className="text-gray-700 dark:text-gray-200">World generation seed (e.g., -1234567890)</span>
                </div>
                <div className="flex gap-2">
                  <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-xs">LEVEL_TYPE</code>
                  <span className="text-gray-700 dark:text-gray-200">DEFAULT, FLAT, LARGEBIOMES, AMPLIFIED</span>
                </div>
                <div className="flex gap-2">
                  <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-xs">WHITELIST</code>
                  <span className="text-gray-700 dark:text-gray-200">Comma-separated usernames</span>
                </div>
                <div className="flex gap-2">
                  <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-xs">OPS</code>
                  <span className="text-gray-700 dark:text-gray-200">Comma-separated admin usernames</span>
                </div>
              </div>
            </div>

            <div className="border dark:border-gray-700 rounded-lg p-4 dark:bg-gray-800 ">
              <h4 className="font-semibold mb-2">Example: Whitelisted Creative Server</h4>
              <CodeBlock language="json">
{`"environmentParameters": [
  "EULA=TRUE",
  "TYPE=PAPER",
  "VERSION=LATEST",
  "GAMEMODE=creative",
  "DIFFICULTY=peaceful",
  "PVP=false",
  "WHITELIST=PlayerOne,PlayerTwo,PlayerThree",
  "OPS=PlayerOne",
  "SERVER_NAME=Creative Build Server",
  "MOTD=Private creative server on Flux!"
]`}
              </CodeBlock>
            </div>
          </div>
        </StepByStep>
      </div>

      {/* Best Practices */}
      <div className="mt-12 border-t pt-8">
        <h2 className="text-2xl font-bold mb-6">Best Practices & Tips</h2>
        <div className="space-y-4">
          <div className="border dark:border-gray-700 rounded-lg p-4 dark:bg-gray-800 ">
            <h3 className="font-semibold mb-2">💾 World Persistence</h3>
            <ul className="text-sm space-y-1 text-gray-700 dark:text-gray-200 ml-4">
              <li>• Always use <code className="bg-gray-100 dark:bg-gray-700 px-1">g:/data</code> prefix for world saves</li>
              <li>• This ensures your world persists across container restarts</li>
              <li>• Primary/standby mode prevents world corruption from simultaneous writes</li>
              <li>• Bonus: You get a 20% discount on deployment cost!</li>
            </ul>
          </div>
          <div className="border dark:border-gray-700 rounded-lg p-4 dark:bg-gray-800 ">
            <h3 className="font-semibold mb-2">⚡ Performance</h3>
            <ul className="text-sm space-y-1 text-gray-700 dark:text-gray-200 ml-4">
              <li>• Use PAPER or PURPUR for better performance than vanilla</li>
              <li>• Set VIEW_DISTANCE to 8-10 for optimal performance</li>
              <li>• Allocate 75% of total RAM to JVM (e.g., MEMORY=3G for 4GB RAM)</li>
              <li>• Monitor player count and scale resources as needed</li>
            </ul>
          </div>
          <div className="border dark:border-gray-700 rounded-lg p-4 dark:bg-gray-800 ">
            <h3 className="font-semibold mb-2">🔒 Security</h3>
            <ul className="text-sm space-y-1 text-gray-700 dark:text-gray-200 ml-4">
              <li>• Use WHITELIST for private servers</li>
              <li>• Keep ONLINE_MODE=true to verify player accounts</li>
              <li>• Set ENABLE_COMMAND_BLOCK=false unless needed</li>
              <li>• Regularly update VERSION to latest for security patches</li>
            </ul>
          </div>
          <div className="border dark:border-gray-700 rounded-lg p-4 dark:bg-gray-800 ">
            <h3 className="font-semibold mb-2">🌍 Plugins & Mods</h3>
            <ul className="text-sm space-y-1 text-gray-700 dark:text-gray-200 ml-4">
              <li>• Paper servers support Bukkit/Spigot plugins</li>
              <li>• Use FORGE or FABRIC types for modded servers</li>
              <li>• Mods require players to install matching client-side mods</li>
              <li>• Increase RAM and storage for heavily modded servers</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Troubleshooting */}
      <div className="mt-12 border-t pt-8">
        <h2 className="text-2xl font-bold mb-6">Troubleshooting</h2>
        <div className="space-y-4">
          <div className="border-l-4 border-yellow-400 pl-4 py-2">
            <h4 className="font-semibold mb-1">Server won&apos;t start / keeps restarting</h4>
            <p className="text-sm text-gray-700 dark:text-gray-200">Check MEMORY allocation - ensure JVM memory is less than total RAM (leave ~1GB for system). Also verify EULA=TRUE is set.</p>
          </div>
          <div className="border-l-4 border-yellow-400 pl-4 py-2">
            <h4 className="font-semibold mb-1">Can&apos;t connect to server</h4>
            <p className="text-sm text-gray-700 dark:text-gray-200">Wait 10-15 minutes after first deployment. Check the app status on home.runonflux.io - it should show &quot;Running&quot;. Verify you&apos;re using the correct IP:port.</p>
          </div>
          <div className="border-l-4 border-yellow-400 pl-4 py-2">
            <h4 className="font-semibold mb-1">World resets on restart</h4>
            <p className="text-sm text-gray-700 dark:text-gray-200">Ensure containerData is set to <code className="bg-gray-100 dark:bg-gray-700 px-1">g:/data</code> and verify the app has sufficient storage (hdd) allocated.</p>
          </div>
          <div className="border-l-4 border-yellow-400 pl-4 py-2">
            <h4 className="font-semibold mb-1">Poor performance / lag</h4>
            <p className="text-sm text-gray-700 dark:text-gray-200">Increase CPU and RAM resources. Reduce VIEW_DISTANCE. Consider upgrading to PAPER if using vanilla. Check player count vs. resource allocation.</p>
          </div>
        </div>
      </div>

      {/* Next Steps */}
      <div className="mt-12 border-t pt-8">
        <h2 className="text-2xl font-bold mb-6">Next Steps</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <a
            href="/playground"
            className="block p-6 border dark:border-gray-700 rounded-lg hover:shadow-lg transition-shadow group dark:bg-gray-800 "
          >
            <h3 className="text-lg font-semibold mb-2 group-hover:text-blue-600 dark:text-blue-400">Try Different Configurations →</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">Use the playground to experiment with different resource allocations and settings</p>
          </a>
          <a
            href="/reference/flux-spec"
            className="block p-6 border dark:border-gray-700 rounded-lg hover:shadow-lg transition-shadow group dark:bg-gray-800 "
          >
            <h3 className="text-lg font-semibold mb-2 group-hover:text-blue-600 dark:text-blue-400">Flux Spec Reference →</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">Learn about all available configuration options and volume prefixes</p>
          </a>
        </div>
      </div>
    </div>
  )
}
