import { AlertTriangle, CheckCircle2, XCircle, HelpCircle, Wrench } from 'lucide-react'
import { CodeBlock } from '@/components/tutorial/CodeBlock'

export default function TroubleshootingPage() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <Wrench className="h-10 w-10 text-orange-600 dark:text-orange-400" />
          <h1 className="text-4xl font-bold">Troubleshooting Guide</h1>
        </div>
        <p className="text-xl text-gray-600 dark:text-gray-300">
          Solutions to common issues when deploying applications on Flux
        </p>
      </div>

      {/* Quick Navigation */}
      <nav className="bg-gray-50 dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-6 mb-8 dark:bg-gray-800 ">
        <h2 className="text-lg font-semibold mb-3">Common Issues</h2>
        <div className="grid md:grid-cols-2 gap-2 text-sm">
          <a href="#deployment-failed" className="text-blue-600 dark:text-blue-400 hover:underline">• Deployment Failed</a>
          <a href="#app-not-starting" className="text-blue-600 dark:text-blue-400 hover:underline">• Application Not Starting</a>
          <a href="#domain-not-working" className="text-blue-600 dark:text-blue-400 hover:underline">• Domain Not Working</a>
          <a href="#database-connection" className="text-blue-600 dark:text-blue-400 hover:underline">• Database Connection Issues</a>
          <a href="#port-issues" className="text-blue-600 dark:text-blue-400 hover:underline">• Port Not Accessible</a>
          <a href="#ssl-errors" className="text-blue-600 dark:text-blue-400 hover:underline">• SSL/TLS Errors</a>
          <a href="#storage-issues" className="text-blue-600 dark:text-blue-400 hover:underline">• Storage/Volume Issues</a>
          <a href="#performance" className="text-blue-600 dark:text-blue-400 hover:underline">• Performance Problems</a>
        </div>
      </nav>

      <div className="space-y-8">
        {/* Deployment Failed */}
        <section id="deployment-failed" className="border dark:border-gray-700 rounded-lg p-6 dark:bg-gray-800 ">
          <div className="flex items-center gap-2 mb-4">
            <XCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
            <h2 className="text-2xl font-bold">Deployment Failed</h2>
          </div>

          <div className="space-y-4">
            <ProblemSolution
              problem="Error: Image not found or pull access denied"
              symptoms={[
                "Deployment shows 'Failed to pull image'",
                "Error: repository does not exist"
              ]}
              solutions={[
                "Verify your Docker image exists on Docker Hub",
                "Ensure the image is public (Flux cannot pull private images without credentials)",
                "Check for typos in your repotag (format: username/imagename:tag)",
                "Try pulling the image locally: docker pull yourimage:tag"
              ]}
              example={
                <CodeBlock title="Correct repotag format" language="json">
{`{
  "repotag": "username/app:latest",  ✓ Correct
  // NOT "username:app:latest" or "app:latest"
}`}
                </CodeBlock>
              }
            />


            <ProblemSolution
              problem="Error: Invalid deployment specification"
              symptoms={[
                "JSON validation error",
                "Missing required fields error"
              ]}
              solutions={[
                "Validate your JSON syntax (use jsonlint.com)",
                "Ensure all required fields are present: version, name, repotag, cpu, ram, hdd",
                "Check that version is 4 or higher for compose deployments",
                "Verify numeric values are numbers, not strings"
              ]}
              example={
                <CodeBlock title="Common mistakes" language="json">
{`{
  "cpu": "1.0",      // ❌ Wrong - should be number
  "cpu": 1.0,        // ✓ Correct

  "ram": "2000",     // ❌ Wrong
  "ram": 2000,       // ✓ Correct

  "port": 80,            // External port users access
  "containerPort": 3000  // Port your app listens on internally
}`}
                </CodeBlock>
              }
            />

            <ProblemSolution
              problem="Error: Port not within system limits 0-65535"
              symptoms={[
                "Container Port XXXXX is not within system limits",
                "Invalid port number error",
                "Port validation failed"
              ]}
              solutions={[
                "Ensure all port numbers are between 0 and 65535",
                "Check both 'port' and 'containerPort' values",
                "For multi-port apps, validate each port in the ports array",
                "Common mistake: typing extra digits (e.g., 69420 instead of 6942)"
              ]}
              example={
                <CodeBlock title="Port validation" language="json">
{`{
  // ❌ WRONG - Port too high
  "port": 69420,
  "containerPort": 69420,

  // ✓ CORRECT - Within valid range
  "port": 6942,
  "containerPort": 6942,

  // Valid port range: 0-65535
  // Common ports:
  // - 80 (HTTP)
  // - 443 (HTTPS)
  // - 3000 (Node.js dev)
  // - 8080 (Alternative HTTP)
  // - 5432 (PostgreSQL)
}`}
                </CodeBlock>
              }
            />
          </div>
        </section>

        {/* App Not Starting */}
        <section id="app-not-starting" className="border dark:border-gray-700 rounded-lg p-6 dark:bg-gray-800 ">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
            <h2 className="text-2xl font-bold">Application Not Starting</h2>
          </div>

          <div className="space-y-4">
            <ProblemSolution
              problem="Container keeps restarting"
              symptoms={[
                "App status shows restarting",
                "Container crashes immediately"
              ]}
              solutions={[
                "Check that your app is listening on 0.0.0.0, not localhost",
                "Verify the PORT environment variable matches your containerPort",
                "Ensure your app doesn't exit immediately (add blocking code)",
                "Check application logs in Applications → Management → (your app) → Logs Management"
              ]}
              example={
                <CodeBlock title="Listen on correct interface" language="javascript">
{`// ❌ Wrong - only listens on localhost
app.listen(3000, 'localhost')

// ✓ Correct - listens on all interfaces
app.listen(3000, '0.0.0.0')

// ✓ Also correct - defaults to 0.0.0.0
app.listen(3000)`}
                </CodeBlock>
              }
            />

            <ProblemSolution
              problem="Application exits immediately"
              symptoms={[
                "Container runs but exits with code 0",
                "No error messages but app doesn't stay running"
              ]}
              solutions={[
                "Your app must have a long-running process (web server, event loop, etc.)",
                "Don't use one-off scripts - they will exit after completion",
                "For Node.js: ensure you have app.listen() or similar blocking code",
                "For Python: use flask.run() or equivalent server"
              ]}
            />

            <ProblemSolution
              problem="Missing environment variables"
              symptoms={[
                "App crashes with undefined variable errors",
                "Database connection failures"
              ]}
              solutions={[
                "Add all required environment variables to environmentParameters in your spec",
                "Check variable names for typos",
                "Ensure sensitive values are properly set",
                "Use defaults in your app code for non-critical variables"
              ]}
              example={
                <CodeBlock title="Environment variables in spec" language="json">
{`{
  "environmentParameters": [
    "NODE_ENV=production",
    "DB_HOST=fluxpostgres_myapp",
    "DB_PORT=5432",
    "API_KEY=your_key_here"
  ]
}`}
                </CodeBlock>
              }
            />
          </div>
        </section>

        {/* Domain Not Working */}
        <section id="domain-not-working" className="border dark:border-gray-700 rounded-lg p-6 dark:bg-gray-800 ">
          <div className="flex items-center gap-2 mb-4">
            <HelpCircle className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            <h2 className="text-2xl font-bold">Domain Not Working</h2>
          </div>

          <div className="space-y-4">
            <ProblemSolution
              problem="Flux domain not accessible (*.app.runonflux.io)"
              symptoms={[
                "Site not found or connection timeout",
                "DNS resolution fails"
              ]}
              solutions={[
                "Wait 2-5 minutes after deployment for DNS propagation",
                "Verify deployment is running and healthy",
                "Check the correct domain format: appname.app.runonflux.io",
                "For multi-component: componentname-appname.app.runonflux.io",
                "Try accessing with port number if using non-standard port"
              ]}
            />

            <ProblemSolution
              problem="Custom domain not working"
              symptoms={[
                "Custom domain shows 'Site not found'",
                "DNS doesn't resolve",
                "Connection refused"
              ]}
              solutions={[
                "Wait up to 48 hours for DNS propagation",
                "Verify CloudFlare CNAME record is correct",
                "Ensure proxy (orange cloud) is enabled in CloudFlare",
                "Check CNAME target: appname.app.runonflux.io (not just appname)",
                "Try accessing the Flux domain directly first to ensure app is running"
              ]}
              example={
                <CodeBlock title="Correct CNAME setup" language="text">
{`Type: CNAME
Name: app (or @ for root)
Target: myapp.app.runonflux.io  ✓ Include .app.
Proxy: ON (orange cloud)`}
                </CodeBlock>
              }
            />
          </div>
        </section>

        {/* Database Connection */}
        <section id="database-connection" className="border dark:border-gray-700 rounded-lg p-6 dark:bg-gray-800 ">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
            <h2 className="text-2xl font-bold">Database Connection Issues</h2>
          </div>

          <div className="space-y-4">
            <ProblemSolution
              problem="Cannot connect to database component"
              symptoms={[
                "Connection timeout",
                "ENOTFOUND or DNS error",
                "Connection refused"
              ]}
              solutions={[
                "Use Flux internal DNS: flux{componentname}_{appname}",
                "Verify database component is running and healthy",
                "Check database is listening on correct port (5432 for PostgreSQL, 3306 for MySQL)",
                "Ensure both components are in the same app deployment",
                "Wait for database to fully initialize (30-60 seconds)"
              ]}
              example={
                <CodeBlock title="Correct database connection" language="javascript">
{`// ❌ Wrong
const db = new Pool({
  host: 'postgres.app.runonflux.io',  // External domain won't work
  port: 5432
});

// ✓ Correct - using internal DNS
const db = new Pool({
  host: 'fluxpostgres_myapp',  // Internal DNS pattern
  port: 5432
});`}
                </CodeBlock>
              }
            />

            <ProblemSolution
              problem="Database authentication failed"
              symptoms={[
                "Password authentication failed",
                "Access denied for user"
              ]}
              solutions={[
                "Verify credentials in environment variables match database component",
                "Check for typos in username/password",
                "Ensure password doesn't contain special characters that need escaping",
                "For PostgreSQL: wait for database to fully initialize before connecting"
              ]}
            />
          </div>
        </section>

        {/* Port Issues */}
        <section id="port-issues" className="border dark:border-gray-700 rounded-lg p-6 dark:bg-gray-800 ">
          <div className="flex items-center gap-2 mb-4">
            <XCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
            <h2 className="text-2xl font-bold">Port Not Accessible</h2>
          </div>

          <div className="space-y-4">
            <ProblemSolution
              problem="Cannot access application port"
              symptoms={[
                "Connection refused on port",
                "Port not responding"
              ]}
              solutions={[
                "Ensure containerPort matches the port your app actually listens on",
                "Check app is listening on 0.0.0.0, not localhost",
                "Verify port is EXPOSE'd in Dockerfile",
                "For non-standard ports: access via domain:port format",
                "External port can be different from container port (Flux handles routing)"
              ]}
              example={
                <CodeBlock title="Port configuration" language="json">
{`{
  "port": 80,              // External port users access
  "containerPort": 3000    // Port your app listens on inside container
}

// App must listen on containerPort (3000)
// Users access via port (80)`}
                </CodeBlock>
              }
            />

            <ProblemSolution
              problem="Need to expose multiple ports"
              symptoms={[
                "Need separate ports for app and admin panel",
                "Multiple services on one container",
                "Want to expose metrics endpoint on different port"
              ]}
              solutions={[
                "Any app can expose multiple ports using the ports array in the spec",
                "Add additional port mappings to your deployment specification",
                "Each port can have different external and internal mapping",
                "Alternative: deploy separate components for completely different services"
              ]}
              example={
                <CodeBlock title="Multiple ports configuration" language="json">
{`{
  "name": "myapp",
  "ports": [80, 9090, 9100],
  "containerPorts": [8080, 9090, 9100],
  "cpu": 2.0,
  "ram": 4000,
  "hdd": 20
}`}
                </CodeBlock>
              }
            />
          </div>
        </section>

        {/* SSL/TLS Errors */}
        <section id="ssl-errors" className="border dark:border-gray-700 rounded-lg p-6 dark:bg-gray-800 ">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
            <h2 className="text-2xl font-bold">SSL/TLS Errors</h2>
          </div>

          <div className="space-y-4">
            <ProblemSolution
              problem="SSL certificate warnings"
              symptoms={[
                "Browser shows 'Not Secure'",
                "Certificate error",
                "Mixed content warnings"
              ]}
              solutions={[
                "Ensure CloudFlare proxy is enabled (orange cloud)",
                "Set SSL/TLS mode to 'Full' in CloudFlare",
                "Enable 'Always Use HTTPS' in CloudFlare",
                "Enable 'Automatic HTTPS Rewrites' to fix mixed content",
                "Wait a few minutes for certificate provisioning"
              ]}
            />

            <ProblemSolution
              problem="Redirect loop (too many redirects)"
              symptoms={[
                "ERR_TOO_MANY_REDIRECTS",
                "Page keeps redirecting"
              ]}
              solutions={[
                "Change CloudFlare SSL/TLS mode from 'Flexible' to 'Full'",
                "Don't force HTTPS redirects in your application code",
                "Let CloudFlare handle HTTPS redirection"
              ]}
            />
          </div>
        </section>

        {/* Storage Issues */}
        <section id="storage-issues" className="border dark:border-gray-700 rounded-lg p-6 dark:bg-gray-800 ">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
            <h2 className="text-2xl font-bold">Storage/Volume Issues</h2>
          </div>

          <div className="space-y-4">
            <ProblemSolution
              problem="Data not persisting between restarts"
              symptoms={[
                "Uploads/data lost after restart",
                "Database data disappears"
              ]}
              solutions={[
                "Add containerData field to your spec with the appropriate volume prefix",
                "Choose the right prefix: s:/ (single node), r:/ (replicated), or g:/ (geo-distributed with 20% discount)",
                "Ensure path matches where your app writes data",
                "For databases: specify correct data directory"
              ]}
              example={
                <CodeBlock title="Persistent storage examples" language="json">
{`{
  "name": "postgres",
  "repotag": "postgres:15-alpine",
  "containerData": "s:/var/lib/postgresql/data",  // Single node storage
  "cpu": 1.0,
  "ram": 2000,
  "hdd": 20
}

// For geo-distributed apps (20% cost discount)
{
  "name": "minecraft",
  "containerData": "g:/data/minecraft",  // Geo-distributed with syncing
  "cpu": 2.0,
  "ram": 4000,
  "hdd": 30
}`}
                </CodeBlock>
              }
            />

            <ProblemSolution
              problem="Out of disk space"
              symptoms={[
                "Write failed: no space left on device",
                "Application crashes when writing files"
              ]}
              solutions={[
                "Increase hdd value in your spec",
                "Clean up unnecessary files in your Docker image",
                "Use multi-stage builds to reduce image size",
                "Implement log rotation in your app",
                "Monitor disk usage and scale up before hitting limits"
              ]}
            />
          </div>
        </section>

        {/* Performance Issues */}
        <section id="performance" className="border dark:border-gray-700 rounded-lg p-6 dark:bg-gray-800 ">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
            <h2 className="text-2xl font-bold">Performance Problems</h2>
          </div>

          <div className="space-y-4">
            <ProblemSolution
              problem="Application running slow or timing out"
              symptoms={[
                "Slow response times",
                "Requests timing out",
                "High latency"
              ]}
              solutions={[
                "Increase CPU allocation in your spec",
                "Increase RAM if app is memory-intensive",
                "Optimize database queries and add indexes",
                "Add caching layer (Redis) to reduce database load",
                "Use CDN for static assets",
                "Profile your application to find bottlenecks",
                "Check for memory leaks in your application"
              ]}
            />

            <ProblemSolution
              problem="Out of memory errors"
              symptoms={[
                "Container killed",
                "OOM (Out of Memory) errors"
              ]}
              solutions={[
                "Increase ram value in your spec",
                "Optimize memory usage in your application",
                "Implement pagination for large datasets",
                "Use streaming for large file operations",
                "Check for memory leaks"
              ]}
              example={
                <CodeBlock title="Resource allocation" language="json">
{`{
  // Small app
  "cpu": 0.5,
  "ram": 1000,
  "hdd": 5,

  // Medium app
  "cpu": 2.0,
  "ram": 4000,
  "hdd": 20,

  // Large app
  "cpu": 4.0,
  "ram": 8000,
  "hdd": 50
}`}
                </CodeBlock>
              }
            />
          </div>
        </section>

        {/* Getting Help */}
        <section className="border-t pt-8 dark:bg-gray-900">
          <h2 className="text-2xl font-bold mb-6">Still Need Help?</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="border dark:border-gray-700 rounded-lg p-6 bg-blue-50 dark:bg-blue-900/20">
              <h3 className="font-semibold text-blue-900 dark:text-blue-200 mb-2">Flux Discord</h3>
              <p className="text-sm text-blue-800 dark:text-blue-200 mb-3">
                Join the Flux community Discord for real-time help and support
              </p>
              <a
                href="https://discord.com/invite/runonflux"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
              >
                Join Discord
              </a>
            </div>
            <div className="border dark:border-gray-700 rounded-lg p-6 bg-purple-50 dark:bg-purple-900/20">
              <h3 className="font-semibold text-purple-900 dark:text-purple-200 mb-2">Flux Documentation</h3>
              <p className="text-sm text-purple-800 dark:text-purple-200 mb-3">
                Official Flux documentation and guides
              </p>
              <a
                href="https://docs.runonflux.io"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 text-sm"
              >
                View Docs
              </a>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

function ProblemSolution({
  problem,
  symptoms,
  solutions,
  example
}: {
  problem: string
  symptoms: string[]
  solutions: string[]
  example?: React.ReactNode
}) {
  return (
    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
      <h3 className="font-semibold text-lg mb-3">{problem}</h3>

      {symptoms && (
        <div className="mb-3">
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">Symptoms:</p>
          <ul className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
            {symptoms.map((symptom, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-red-500 mt-0.5">•</span>
                <span>{symptom}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mb-3">
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">Solutions:</p>
        <ul className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
          {solutions.map((solution, i) => (
            <li key={i} className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
              <span>{solution}</span>
            </li>
          ))}
        </ul>
      </div>

      {example && (
        <div className="mt-3">
          {example}
        </div>
      )}
    </div>
  )
}
