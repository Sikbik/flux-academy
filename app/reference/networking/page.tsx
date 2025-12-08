import { CodeBlock } from '@/components/tutorial/CodeBlock'
import { Network, Globe, Lock, ArrowRightLeft } from 'lucide-react'

export default function NetworkingPatternsPage() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-4">Networking Patterns on Flux</h1>
        <p className="text-xl text-gray-600 dark:text-gray-300">
          Complete guide to networking, DNS, port mapping, and SSL/TLS configuration for Flux applications
        </p>
      </div>

      {/* Key Concepts */}
      <div className="grid md:grid-cols-3 gap-6 mb-12">
        <div className="border dark:border-gray-700 rounded-lg p-6 bg-gradient-to-br from-blue-50 to-white dark:from-blue-900/20 dark:to-gray-800">
          <Network className="h-8 w-8 text-blue-600 dark:text-blue-400 mb-3" />
          <h3 className="text-lg font-semibold mb-2 dark:text-gray-100">Internal DNS</h3>
          <p className="text-sm text-gray-700 dark:text-gray-200">Component-to-component communication within your app</p>
        </div>
        <div className="border dark:border-gray-700 rounded-lg p-6 bg-gradient-to-br from-green-50 to-white dark:from-green-900/20 dark:to-gray-800">
          <Globe className="h-8 w-8 text-green-600 dark:text-green-400 mb-3" />
          <h3 className="text-lg font-semibold mb-2 dark:text-gray-100">External Access</h3>
          <p className="text-sm text-gray-700 dark:text-gray-200">Public endpoints and custom domain configuration</p>
        </div>
        <div className="border dark:border-gray-700 rounded-lg p-6 bg-gradient-to-br from-purple-50 to-white dark:from-purple-900/20 dark:to-gray-800">
          <Lock className="h-8 w-8 text-purple-600 dark:text-purple-400 mb-3" />
          <h3 className="text-lg font-semibold mb-2 dark:text-gray-100">SSL/TLS</h3>
          <p className="text-sm text-gray-700 dark:text-gray-200">Automatic HTTPS encryption for your deployments</p>
        </div>
      </div>

      {/* Table of Contents */}
      <nav className="bg-gray-50 dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-6 mb-8">
        <h2 className="text-lg font-semibold mb-3 dark:text-gray-100">Quick Navigation</h2>
        <ul className="space-y-2 text-sm">
          <li><a href="#internal-dns" className="text-blue-600 dark:text-blue-400 hover:underline">1. Flux Internal DNS Pattern</a></li>
          <li><a href="#port-mapping" className="text-blue-600 dark:text-blue-400 hover:underline">2. Port Mapping & Exposure</a></li>
          <li><a href="#public-access" className="text-blue-600 dark:text-blue-400 hover:underline">3. Public Access & Domains</a></li>
          <li><a href="#multi-component" className="text-blue-600 dark:text-blue-400 hover:underline">4. Multi-Component Communication</a></li>
          <li><a href="#ssl-tls" className="text-blue-600 dark:text-blue-400 hover:underline">5. SSL/TLS Configuration</a></li>
          <li><a href="#common-patterns" className="text-blue-600 dark:text-blue-400 hover:underline">6. Common Networking Patterns</a></li>
        </ul>
      </nav>

      <div className="space-y-12">
        {/* Internal DNS */}
        <section id="internal-dns">
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
            <span className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 dark:text-blue-400 flex items-center justify-center text-sm font-bold">1</span>
            Flux Internal DNS Pattern
          </h2>
          <p className="text-gray-700 dark:text-gray-200 mb-4">
            Flux provides automatic service discovery for multi-component applications using a predictable DNS pattern.
          </p>

          <div className="bg-white dark:bg-gray-800 border-2 border-blue-300 dark:border-blue-700 rounded-lg p-6 mb-6">
            <h3 className="text-lg font-semibold mb-3 dark:text-gray-100">DNS Pattern Formula</h3>
            <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-lg mb-4 text-center">
              flux&#123;componentname&#125;_&#123;appname&#125;
            </div>
            <div className="grid md:grid-cols-3 gap-4 text-sm">
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded p-3">
                <p className="font-semibold text-blue-900 dark:text-blue-200 mb-1">flux</p>
                <p className="text-blue-700 dark:text-blue-300">Fixed prefix</p>
              </div>
              <div className="bg-green-50 dark:bg-green-900/20 rounded p-3">
                <p className="font-semibold text-green-900 dark:text-green-200 mb-1">&#123;componentname&#125;</p>
                <p className="text-green-700 dark:text-green-300">From your spec</p>
              </div>
              <div className="bg-purple-50 dark:bg-purple-900/20 rounded p-3">
                <p className="font-semibold text-purple-900 dark:text-purple-200 mb-1">&#123;appname&#125;</p>
                <p className="text-purple-700 dark:text-purple-300">Your app name</p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/30 dark:to-purple-900/30 border dark:border-gray-700 rounded-lg p-6 mb-6">
            <h3 className="text-lg font-semibold mb-3 dark:text-gray-100">Example: Three-Tier Web App</h3>
            <p className="text-sm text-gray-700 dark:text-gray-200 mb-4">App name: <code className="bg-white dark:bg-gray-800 px-2 py-1 rounded font-semibold">webapp</code></p>

            <div className="space-y-3">
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border dark:border-gray-700">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold dark:text-gray-100">PostgreSQL Database</span>
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">Component: postgres</span>
                </div>
                <code className="text-sm bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded block">fluxpostgres_webapp:5432</code>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border dark:border-gray-700">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold dark:text-gray-100">API Backend</span>
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">Component: api</span>
                </div>
                <code className="text-sm bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded block">fluxapi_webapp:3000</code>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border dark:border-gray-700">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold dark:text-gray-100">React Frontend</span>
                  <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">Component: frontend</span>
                </div>
                <code className="text-sm bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded block">fluxfrontend_webapp:8080</code>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-6 dark:bg-gray-800 ">
            <h3 className="font-semibold mb-3">Using Internal DNS in Your Code</h3>

            <CodeBlock title="Node.js API connecting to database" language="javascript">
{`const { Pool } = require('pg');

const pool = new Pool({
  host: 'fluxpostgres_webapp',  // Internal DNS name
  port: 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});`}
            </CodeBlock>

            <CodeBlock title="React app calling API" language="javascript">
{`// For internal component calls (backend to backend)
const API_URL = 'http://fluxapi_webapp:3000';

// For browser calls (external)
const API_URL = process.env.REACT_APP_API_URL || 'https://api.myapp.com';`}
            </CodeBlock>
          </div>
        </section>

        {/* Port Mapping */}
        <section id="port-mapping">
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
            <span className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 dark:text-blue-400 flex items-center justify-center text-sm font-bold">2</span>
            Port Mapping & Exposure
          </h2>
          <p className="text-gray-700 dark:text-gray-200 mb-4">
            Understanding how ports work in Flux deployments and how to expose services.
          </p>

          <div className="bg-blue-50 dark:bg-blue-900/20 border dark:border-gray-700 border-blue-200 dark:border-blue-800 rounded-lg p-6 mb-6">
            <h3 className="text-lg font-semibold mb-3 text-blue-900">Key Concepts</h3>
            <ul className="space-y-2 text-sm text-blue-800">
              <li>• <strong>Container Port:</strong> Port your application listens on inside the container</li>
              <li>• <strong>Exposed Port:</strong> Port accessible from outside (Flux handles mapping automatically)</li>
              <li>• <strong>Internal Communication:</strong> Components can access each other on any port</li>
              <li>• <strong>External Access:</strong> Only explicitly exposed ports are publicly accessible</li>
            </ul>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mb-6">
            <div>
              <h4 className="font-semibold mb-3">Standard Deployment</h4>
              <CodeBlock language="json">
{`{
  "name": "api",
  "repotag": "myuser/api:latest",
  "port": 3000,
  "containerPort": 3000,
  "cpu": 1.0,
  "ram": 2000,
  "hdd": 10
}`}
              </CodeBlock>
              <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">
                Application listens on port 3000. Flux exposes it automatically at <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">api.app.runonflux.io:3000</code>
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-3">Different Port Mapping</h4>
              <CodeBlock language="json">
{`{
  "name": "web",
  "repotag": "nginx:alpine",
  "port": 80,
  "containerPort": 80,
  "cpu": 0.5,
  "ram": 1000,
  "hdd": 5
}`}
              </CodeBlock>
              <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">
                NGINX listens on port 80 inside container. Accessible at <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">web.app.runonflux.io:80</code>
              </p>
            </div>
          </div>

          <div className="bg-yellow-50 dark:bg-yellow-900/20 border dark:border-gray-700 border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <h4 className="font-semibold text-yellow-900 mb-2">Important Notes:</h4>
            <ul className="text-sm text-yellow-800 space-y-1 ml-4">
              <li>• In most cases, <code className="bg-yellow-100 px-1 rounded">port</code> and <code className="bg-yellow-100 px-1 rounded">containerPort</code> should be the same</li>
              <li>• Standard ports: HTTP (80), HTTPS (443), but you can use any port</li>
              <li>• Internal DNS works regardless of which ports you expose</li>
            </ul>
          </div>
        </section>

        {/* Public Access */}
        <section id="public-access">
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
            <span className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 dark:text-blue-400 flex items-center justify-center text-sm font-bold">3</span>
            Public Access & Domains
          </h2>

          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-6 dark:bg-gray-800 ">
              <h3 className="text-lg font-semibold mb-3 dark:text-gray-100">Automatic Flux Domains</h3>
              <p className="text-gray-700 dark:text-gray-200 mb-4">
                Every deployed application automatically gets a Flux domain:
              </p>

              <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm mb-4">
                &#123;appname&#125;.app.runonflux.io
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                <p className="text-sm text-blue-900 mb-2"><strong>Example:</strong></p>
                <p className="text-sm text-blue-800">App: <code className="bg-blue-100 px-2 py-1 rounded">myblog</code></p>
                <p className="text-sm text-blue-800 mt-1">Domain: <code className="bg-blue-100 px-2 py-1 rounded">myblog.app.runonflux.io</code></p>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-6 dark:bg-gray-800 ">
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Globe className="h-6 w-6 text-green-600 dark:text-green-400" />
                Custom Domains
              </h3>
              <p className="text-gray-700 dark:text-gray-200 mb-4">
                Point your own domain to your Flux app using CNAME records via CloudFlare:
              </p>

              <div className="grid md:grid-cols-2 gap-4 mb-4">
                <div className="bg-green-50 dark:bg-green-900/20 border dark:border-gray-700 border-green-200 dark:border-green-800 rounded-lg p-4">
                  <h4 className="font-semibold text-green-900 mb-2">Subdomain Setup</h4>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-gray-600 dark:text-gray-300">Type:</span> <code className="bg-white dark:bg-gray-800 px-2 py-1 rounded ml-1">CNAME</code>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-300">Name:</span> <code className="bg-white dark:bg-gray-800 px-2 py-1 rounded ml-1">app</code>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-300">Target:</span> <code className="bg-white dark:bg-gray-800 px-2 py-1 rounded ml-1">myblog.app.runonflux.io</code>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-300">Result:</span> <code className="bg-green-100 px-2 py-1 rounded ml-1 font-semibold">app.yourdomain.com</code>
                    </div>
                  </div>
                </div>

                <div className="bg-blue-50 dark:bg-blue-900/20 border dark:border-gray-700 border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <h4 className="font-semibold text-blue-900 mb-2">Root Domain Setup</h4>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-gray-600 dark:text-gray-300">Type:</span> <code className="bg-white dark:bg-gray-800 px-2 py-1 rounded ml-1">CNAME</code>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-300">Name:</span> <code className="bg-white dark:bg-gray-800 px-2 py-1 rounded ml-1">@</code>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-300">Target:</span> <code className="bg-white dark:bg-gray-800 px-2 py-1 rounded ml-1">myblog.app.runonflux.io</code>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-300">Result:</span> <code className="bg-blue-100 px-2 py-1 rounded ml-1 font-semibold">yourdomain.com</code>
                    </div>
                  </div>
                </div>
              </div>

              <a href="/tutorials/custom-domain" className="inline-flex items-center text-blue-600 dark:text-blue-400 hover:underline text-sm">
                Learn more in the Custom Domains tutorial →
              </a>
            </div>

            <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-6 dark:bg-gray-800 ">
              <h3 className="text-lg font-semibold mb-3 dark:text-gray-100">Multi-Component Public Access</h3>
              <p className="text-gray-700 dark:text-gray-200 mb-4">
                Each component gets its own subdomain automatically:
              </p>

              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 p-3 rounded">
                  <span>Frontend component</span>
                  <code className="bg-gray-200 dark:bg-gray-700 px-3 py-1 rounded">frontend-webapp.app.runonflux.io</code>
                </div>
                <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 p-3 rounded">
                  <span>API component</span>
                  <code className="bg-gray-200 dark:bg-gray-700 px-3 py-1 rounded">api-webapp.app.runonflux.io</code>
                </div>
                <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 p-3 rounded">
                  <span>Admin component</span>
                  <code className="bg-gray-200 dark:bg-gray-700 px-3 py-1 rounded">admin-webapp.app.runonflux.io</code>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Multi-Component Communication */}
        <section id="multi-component">
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
            <span className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 dark:text-blue-400 flex items-center justify-center text-sm font-bold">4</span>
            Multi-Component Communication
          </h2>
          <p className="text-gray-700 dark:text-gray-200 mb-4">
            How different components in your application communicate with each other.
          </p>

          <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/30 dark:to-blue-900/30 border dark:border-gray-700 rounded-lg p-6 mb-6 ">
            <h3 className="text-lg font-semibold mb-4">Communication Flow Example</h3>

            <div className="space-y-4">
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border-l-4 border-blue-500">
                <h4 className="font-semibold mb-2">1. Frontend → API (Browser Request)</h4>
                <code className="text-sm bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded block">
                  https://api-myapp.app.runonflux.io/users
                </code>
                <p className="text-xs text-gray-600 dark:text-gray-300 mt-2">Public endpoint accessed from user's browser</p>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border-l-4 border-green-500">
                <h4 className="font-semibold mb-2">2. API → Database (Internal)</h4>
                <code className="text-sm bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded block">
                  postgresql://fluxpostgres_myapp:5432/dbname
                </code>
                <p className="text-xs text-gray-600 dark:text-gray-300 mt-2">Internal DNS - only accessible within app</p>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border-l-4 border-purple-500">
                <h4 className="font-semibold mb-2">3. API → Cache (Internal)</h4>
                <code className="text-sm bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded block">
                  redis://fluxredis_myapp:6379
                </code>
                <p className="text-xs text-gray-600 dark:text-gray-300 mt-2">Internal DNS for Redis cache</p>
              </div>
            </div>
          </div>

          <CodeBlock title="Full Stack Example - Deployment Spec" language="json">
{`{
  "version": 4,
  "name": "fullstack",
  "description": "Complete web application stack",
  "compose": [
    {
      "name": "postgres",
      "description": "PostgreSQL database",
      "repotag": "postgres:15-alpine",
      "port": 5432,
      "containerPort": 5432,
      "environmentParameters": [
        "POSTGRES_DB=appdb",
        "POSTGRES_USER=appuser",
        "POSTGRES_PASSWORD=securepass123"
      ],
      "containerData": "s:/var/lib/postgresql/data",
      "cpu": 1.0,
      "ram": 2000,
      "hdd": 20
    },
    {
      "name": "api",
      "description": "Node.js API backend",
      "repotag": "myuser/api:latest",
      "port": 3000,
      "containerPort": 3000,
      "environmentParameters": [
        "NODE_ENV=production",
        "DB_HOST=fluxpostgres_fullstack",
        "DB_PORT=5432",
        "DB_NAME=appdb",
        "DB_USER=appuser",
        "DB_PASSWORD=securepass123"
      ],
      "cpu": 1.0,
      "ram": 2000,
      "hdd": 10
    },
    {
      "name": "frontend",
      "description": "React frontend",
      "repotag": "myuser/frontend:latest",
      "port": 80,
      "containerPort": 80,
      "environmentParameters": [
        "REACT_APP_API_URL=https://api-fullstack.app.runonflux.io"
      ],
      "cpu": 0.5,
      "ram": 1000,
      "hdd": 5
    }
  ]
}`}
          </CodeBlock>
        </section>

        {/* SSL/TLS */}
        <section id="ssl-tls">
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
            <span className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 dark:text-blue-400 flex items-center justify-center text-sm font-bold">5</span>
            SSL/TLS Configuration
          </h2>

          <div className="bg-green-50 dark:bg-green-900/20 border dark:border-gray-700 border-green-200 dark:border-green-800 rounded-lg p-6 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Lock className="h-6 w-6 text-green-600 dark:text-green-400" />
              <h3 className="text-lg font-semibold text-green-900">Automatic HTTPS</h3>
            </div>
            <p className="text-green-800 mb-2">
              All Flux domains (<code className="bg-green-100 px-2 py-1 rounded">*.app.runonflux.io</code>) automatically get SSL/TLS certificates.
            </p>
            <p className="text-sm text-green-700 dark:text-green-300">
              No configuration required - your app is automatically accessible via HTTPS.
            </p>
          </div>

          <div className="space-y-6">
            <div className="border dark:border-gray-700 rounded-lg p-6 dark:bg-gray-800 ">
              <h3 className="text-lg font-semibold mb-3 dark:text-gray-100">Custom Domain SSL (via CloudFlare)</h3>
              <p className="text-gray-700 dark:text-gray-200 mb-4">
                When using custom domains with CloudFlare, SSL is handled automatically:
              </p>

              <div className="space-y-3">
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                  <h4 className="font-semibold mb-2">Step 1: CloudFlare Proxy</h4>
                  <p className="text-sm text-gray-700 dark:text-gray-200">Enable the orange cloud (proxy) in CloudFlare DNS settings</p>
                </div>

                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                  <h4 className="font-semibold mb-2">Step 2: SSL/TLS Mode</h4>
                  <p className="text-sm text-gray-700 dark:text-gray-200 mb-2">Set to <strong>Full</strong> mode in CloudFlare SSL/TLS settings</p>
                  <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded p-3 mt-2 dark:bg-gray-800 ">
                    <table className="w-full text-sm">
                      <tbody>
                        <tr>
                          <td className="py-1">Browser → CloudFlare</td>
                          <td className="text-green-600 dark:text-green-400">✓ Encrypted</td>
                        </tr>
                        <tr>
                          <td className="py-1">CloudFlare → Flux</td>
                          <td className="text-green-600 dark:text-green-400">✓ Encrypted</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                  <h4 className="font-semibold mb-2">Step 3: Always Use HTTPS</h4>
                  <p className="text-sm text-gray-700 dark:text-gray-200">Enable to automatically redirect HTTP → HTTPS</p>
                </div>
              </div>

              <a href="/tutorials/custom-domain" className="inline-flex items-center text-blue-600 dark:text-blue-400 hover:underline text-sm mt-4">
                Full SSL setup guide in Custom Domains tutorial →
              </a>
            </div>

            <div className="border dark:border-gray-700 rounded-lg p-6 dark:bg-gray-800 ">
              <h3 className="text-lg font-semibold mb-3 dark:text-gray-100">Application Configuration</h3>
              <p className="text-gray-700 dark:text-gray-200 mb-4">
                Your application doesn't need to handle SSL - Flux handles it at the edge.
              </p>

              <CodeBlock title="Dockerfile - No SSL required" language="dockerfile">
{`FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .

# App listens on HTTP port only
# Flux handles HTTPS termination
EXPOSE 3000

CMD ["node", "index.js"]`}
              </CodeBlock>

              <div className="bg-blue-50 dark:bg-blue-900/20 border dark:border-gray-700 border-blue-200 dark:border-blue-800 rounded-lg p-4 mt-4">
                <p className="text-sm text-blue-900">
                  <strong>Note:</strong> Your application can listen on plain HTTP. Flux terminates SSL at the edge and forwards requests to your container.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Common Patterns */}
        <section id="common-patterns">
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
            <span className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 dark:text-blue-400 flex items-center justify-center text-sm font-bold">6</span>
            Common Networking Patterns
          </h2>

          <div className="space-y-6">
            <div className="border dark:border-gray-700 rounded-lg p-6 dark:bg-gray-800 ">
              <h3 className="text-lg font-semibold mb-3 dark:text-gray-100">Pattern 1: API + Database</h3>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold text-sm mb-2">Architecture</h4>
                  <div className="bg-gray-50 dark:bg-gray-800 rounded p-4 text-sm space-y-2">
                    <div className="flex items-center gap-2">
                      <ArrowRightLeft className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      <span>Public API endpoint</span>
                    </div>
                    <div className="flex items-center gap-2 ml-6">
                      <span className="text-gray-400 dark:text-gray-500">↓</span>
                      <span className="text-gray-600 dark:text-gray-300">Internal DNS</span>
                    </div>
                    <div className="flex items-center gap-2 ml-6">
                      <span>🔒 Private database</span>
                    </div>
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold text-sm mb-2">Connection String</h4>
                  <CodeBlock language="javascript">
{`const dbUrl =
  'postgresql://' +
  'user:pass@' +
  'fluxpostgres_myapi:5432/' +
  'database';`}
                  </CodeBlock>
                </div>
              </div>
            </div>

            <div className="border dark:border-gray-700 rounded-lg p-6 dark:bg-gray-800 ">
              <h3 className="text-lg font-semibold mb-3 dark:text-gray-100">Pattern 2: Frontend + API + Database</h3>
              <div className="bg-gray-50 dark:bg-gray-800 rounded p-4 mb-4">
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span>User Browser</span>
                    <span className="text-gray-400 dark:text-gray-500">→</span>
                    <code className="bg-white dark:bg-gray-800 px-2 py-1 rounded">frontend-app.app.runonflux.io</code>
                  </div>
                  <div className="flex items-center justify-between ml-6">
                    <span>Frontend calls API</span>
                    <span className="text-gray-400 dark:text-gray-500">→</span>
                    <code className="bg-white dark:bg-gray-800 px-2 py-1 rounded">api-app.app.runonflux.io</code>
                  </div>
                  <div className="flex items-center justify-between ml-12">
                    <span>API calls DB</span>
                    <span className="text-gray-400 dark:text-gray-500">→</span>
                    <code className="bg-white dark:bg-gray-800 px-2 py-1 rounded">fluxpostgres_app:5432</code>
                  </div>
                </div>
              </div>
              <CodeBlock title="Frontend environment variables" language="bash">
{`# Browser makes requests to public API endpoint
REACT_APP_API_URL=https://api-myapp.app.runonflux.io`}
              </CodeBlock>
            </div>

            <div className="border dark:border-gray-700 rounded-lg p-6 dark:bg-gray-800 ">
              <h3 className="text-lg font-semibold mb-3 dark:text-gray-100">Pattern 3: Microservices with Shared Database</h3>
              <CodeBlock title="Multiple services accessing shared database" language="yaml">
{`# Service 1: User Service
DB_HOST=fluxpostgres_platform:5432

# Service 2: Order Service
DB_HOST=fluxpostgres_platform:5432

# Service 3: Payment Service
DB_HOST=fluxpostgres_platform:5432

# All services share the same database
# Using internal DNS pattern`}
              </CodeBlock>
            </div>

            <div className="border dark:border-gray-700 rounded-lg p-6 dark:bg-gray-800 ">
              <h3 className="text-lg font-semibold mb-3 dark:text-gray-100">Pattern 4: Redis Cache Layer</h3>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <CodeBlock title="Deployment Spec" language="json">
{`{
  "name": "redis",
  "repotag": "redis:7-alpine",
  "port": 6379,
  "containerPort": 6379,
  "cpu": 0.5,
  "ram": 1000,
  "hdd": 5
}`}
                  </CodeBlock>
                </div>
                <div>
                  <CodeBlock title="Connect from API" language="javascript">
{`const redis = require('redis');

const client = redis.createClient({
  socket: {
    host: 'fluxredis_myapp',
    port: 6379
  }
});`}
                  </CodeBlock>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Quick Reference */}
        <section className="border-t pt-8 dark:bg-gray-900">
          <h2 className="text-2xl font-bold mb-6">Quick Reference Card</h2>
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/30 dark:to-purple-900/30 border dark:border-gray-700 rounded-lg p-6 ">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold mb-3">Internal Communication</h3>
                <div className="space-y-2 text-sm">
                  <div className="bg-white dark:bg-gray-800 rounded p-2">
                    <code className="text-xs">flux&#123;component&#125;_&#123;app&#125;</code>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded p-2">
                    <code className="text-xs">fluxpostgres_myapp:5432</code>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded p-2">
                    <code className="text-xs">fluxapi_myapp:3000</code>
                  </div>
                </div>
              </div>
              <div>
                <h3 className="font-semibold mb-3">External Access</h3>
                <div className="space-y-2 text-sm">
                  <div className="bg-white dark:bg-gray-800 rounded p-2">
                    <code className="text-xs">&#123;app&#125;.app.runonflux.io</code>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded p-2">
                    <code className="text-xs">&#123;component&#125;-&#123;app&#125;.app.runonflux.io</code>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded p-2">
                    <code className="text-xs">yourdomain.com (CNAME)</code>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Next Steps */}
      <div className="mt-12 border-t pt-8">
        <h2 className="text-2xl font-bold mb-6">Next Steps</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <a
            href="/tutorials/multi-component"
            className="block p-6 border dark:border-gray-700 rounded-lg hover:shadow-lg transition-shadow group dark:bg-gray-800 "
          >
            <h3 className="text-lg font-semibold mb-2 group-hover:text-blue-600 dark:text-blue-400">Multi-Component Tutorial →</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">Build a full-stack app with multiple interconnected services</p>
          </a>
          <a
            href="/tutorials/custom-domain"
            className="block p-6 border dark:border-gray-700 rounded-lg hover:shadow-lg transition-shadow group dark:bg-gray-800 "
          >
            <h3 className="text-lg font-semibold mb-2 group-hover:text-blue-600 dark:text-blue-400">Custom Domains Tutorial →</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">Set up your own domain with SSL/TLS encryption</p>
          </a>
        </div>
      </div>
    </div>
  )
}
