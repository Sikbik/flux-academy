import { CodeBlock } from '@/components/tutorial/CodeBlock'
import { CheckCircle2, AlertTriangle, XCircle, Package, Shield, Zap, Layers } from 'lucide-react'

export default function DockerBestPracticesPage() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-4">Docker Best Practices for Flux</h1>
        <p className="text-xl text-gray-600 dark:text-gray-300">
          Optimize your Docker images for size, security, and performance on the Flux network
        </p>
      </div>

      {/* Key Principles */}
      <div className="grid md:grid-cols-2 gap-6 mb-12">
        <div className="border dark:border-gray-700 rounded-lg p-6 bg-gradient-to-br from-blue-50 to-white dark:from-blue-900/20 dark:to-gray-800">
          <Package className="h-8 w-8 text-blue-600 dark:text-blue-400 mb-3" />
          <h3 className="text-lg font-semibold mb-2 dark:text-gray-100">Minimize Image Size</h3>
          <p className="text-sm text-gray-700 dark:text-gray-200">Smaller images deploy faster and use less bandwidth across the decentralized network</p>
        </div>
        <div className="border dark:border-gray-700 rounded-lg p-6 bg-gradient-to-br from-green-50 to-white dark:from-green-900/20 dark:to-gray-800">
          <Shield className="h-8 w-8 text-green-600 dark:text-green-400 mb-3" />
          <h3 className="text-lg font-semibold mb-2 dark:text-gray-100">Security First</h3>
          <p className="text-sm text-gray-700 dark:text-gray-200">Run as non-root users and keep dependencies updated to reduce vulnerabilities</p>
        </div>
        <div className="border dark:border-gray-700 rounded-lg p-6 bg-gradient-to-br from-purple-50 to-white dark:from-purple-900/20 dark:to-gray-800">
          <Zap className="h-8 w-8 text-purple-600 dark:text-purple-400 mb-3" />
          <h3 className="text-lg font-semibold mb-2 dark:text-gray-100">Optimize Caching</h3>
          <p className="text-sm text-gray-700 dark:text-gray-200">Layer your Dockerfile properly to maximize Docker build cache efficiency</p>
        </div>
        <div className="border dark:border-gray-700 rounded-lg p-6 bg-gradient-to-br from-orange-50 to-white dark:from-orange-900/20 dark:to-gray-800">
          <Layers className="h-8 w-8 text-orange-600 dark:text-orange-400 mb-3" />
          <h3 className="text-lg font-semibold mb-2 dark:text-gray-100">Multi-Stage Builds</h3>
          <p className="text-sm text-gray-700 dark:text-gray-200">Separate build and runtime environments for minimal production images</p>
        </div>
      </div>

      {/* Table of Contents */}
      <nav className="bg-gray-50 dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-6 mb-8">
        <h2 className="text-lg font-semibold mb-3 dark:text-gray-100">Quick Navigation</h2>
        <ul className="space-y-2 text-sm">
          <li><a href="#multi-stage" className="text-blue-600 dark:text-blue-400 hover:underline">1. Multi-Stage Builds</a></li>
          <li><a href="#base-images" className="text-blue-600 dark:text-blue-400 hover:underline">2. Choose Minimal Base Images</a></li>
          <li><a href="#layers" className="text-blue-600 dark:text-blue-400 hover:underline">3. Layer Optimization</a></li>
          <li><a href="#security" className="text-blue-600 dark:text-blue-400 hover:underline">4. Security Best Practices</a></li>
          <li><a href="#health-checks" className="text-blue-600 dark:text-blue-400 hover:underline">5. Health Checks</a></li>
          <li><a href="#env-vars" className="text-blue-600 dark:text-blue-400 hover:underline">6. Environment Variables</a></li>
          <li><a href="#common-mistakes" className="text-blue-600 dark:text-blue-400 hover:underline">7. Common Mistakes to Avoid</a></li>
        </ul>
      </nav>

      <div className="space-y-12">
        {/* Multi-Stage Builds */}
        <section id="multi-stage">
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
            <span className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 dark:text-blue-400 flex items-center justify-center text-sm font-bold">1</span>
            Multi-Stage Builds
          </h2>
          <p className="text-gray-700 dark:text-gray-200 mb-4">
            Multi-stage builds allow you to separate build dependencies from runtime dependencies, dramatically reducing final image size.
          </p>

          <div className="grid md:grid-cols-2 gap-4 mb-6">
            <div className="border-l-4 border-red-400 bg-red-50 dark:bg-red-900/20 dark:border-red-500 p-4 rounded">
              <div className="flex items-center gap-2 mb-2">
                <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                <h4 className="font-semibold text-red-900 dark:text-red-300">Bad: Single Stage</h4>
              </div>
              <p className="text-sm text-red-800 dark:text-red-200">Includes build tools in production image</p>
              <p className="text-xs text-red-700 dark:text-red-300 mt-2">Final size: ~500MB+</p>
            </div>
            <div className="border-l-4 border-green-400 bg-green-50 dark:bg-green-900/20 dark:border-green-500 p-4 rounded">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                <h4 className="font-semibold text-green-900 dark:text-green-300">Good: Multi-Stage</h4>
              </div>
              <p className="text-sm text-green-800 dark:text-green-200">Only includes runtime dependencies</p>
              <p className="text-xs text-green-700 dark:text-green-300 mt-2">Final size: ~50-100MB</p>
            </div>
          </div>

          <CodeBlock title="Dockerfile (Node.js Multi-Stage Example)" language="dockerfile">
{`# Stage 1: Build
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including devDependencies)
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Stage 2: Production
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \\
    adduser -S nodejs -u 1001

USER nodejs

EXPOSE 3000

CMD ["node", "dist/index.js"]`}
          </CodeBlock>

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mt-4">
            <p className="text-sm text-blue-900 dark:text-blue-200">
              <strong>Result:</strong> Build dependencies (TypeScript, webpack, etc.) stay in the builder stage.
              Production image only contains compiled code and runtime dependencies.
            </p>
          </div>
        </section>

        {/* Base Images */}
        <section id="base-images">
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
            <span className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 dark:text-blue-400 flex items-center justify-center text-sm font-bold">2</span>
            Choose Minimal Base Images
          </h2>
          <p className="text-gray-700 dark:text-gray-200 mb-4">
            Use the smallest base image that meets your needs. Alpine Linux variants are typically 5-10x smaller than standard images.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full border dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-800">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold dark:text-gray-100">Base Image</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold dark:text-gray-100">Size</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold dark:text-gray-100">Use Case</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold dark:text-gray-100">Recommended</th>
                </tr>
              </thead>
              <tbody className="divide-y text-sm">
                <tr>
                  <td className="px-4 py-3 font-mono text-xs">node:18</td>
                  <td className="px-4 py-3">~900MB</td>
                  <td className="px-4 py-3">Full Debian system</td>
                  <td className="px-4 py-3 text-center dark:text-gray-200">❌</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-mono text-xs">node:18-slim</td>
                  <td className="px-4 py-3">~170MB</td>
                  <td className="px-4 py-3">Minimal Debian</td>
                  <td className="px-4 py-3 text-center dark:text-gray-200">⚠️</td>
                </tr>
                <tr className="bg-green-50 dark:bg-green-900/20">
                  <td className="px-4 py-3 font-mono text-xs font-semibold">node:18-alpine</td>
                  <td className="px-4 py-3 font-semibold">~40MB</td>
                  <td className="px-4 py-3">Alpine Linux</td>
                  <td className="px-4 py-3 text-center dark:text-gray-200">✓</td>
                </tr>
                <tr className="bg-green-50 dark:bg-green-900/20">
                  <td className="px-4 py-3 font-mono text-xs font-semibold">python:3.11-alpine</td>
                  <td className="px-4 py-3 font-semibold">~50MB</td>
                  <td className="px-4 py-3">Python on Alpine</td>
                  <td className="px-4 py-3 text-center dark:text-gray-200">✓</td>
                </tr>
                <tr className="bg-green-50 dark:bg-green-900/20">
                  <td className="px-4 py-3 font-mono text-xs font-semibold">nginx:alpine</td>
                  <td className="px-4 py-3 font-semibold">~40MB</td>
                  <td className="px-4 py-3">Static sites</td>
                  <td className="px-4 py-3 text-center dark:text-gray-200">✓</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="bg-yellow-50 dark:bg-yellow-900/20 border dark:border-gray-700 border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mt-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold text-yellow-900 mb-1">Alpine Considerations:</p>
                <p className="text-yellow-800 dark:text-yellow-200">Alpine uses musl libc instead of glibc. Some packages may need compilation. If you encounter issues, use -slim variants instead.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Layer Optimization */}
        <section id="layers">
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
            <span className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 dark:text-blue-400 flex items-center justify-center text-sm font-bold">3</span>
            Layer Optimization
          </h2>
          <p className="text-gray-700 dark:text-gray-200 mb-4">
            Each instruction in a Dockerfile creates a new layer. Order matters for build cache efficiency.
          </p>

          <div className="grid md:grid-cols-2 gap-6 mb-6">
            <div>
              <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-400 p-4 rounded mb-2">
                <h4 className="font-semibold text-red-900 mb-2">❌ Poor Layer Ordering</h4>
              </div>
              <CodeBlock language="dockerfile">
{`FROM node:18-alpine

WORKDIR /app

# ❌ Copies everything first
COPY . .

# Cache breaks on ANY file change
RUN npm install

CMD ["node", "index.js"]`}
              </CodeBlock>
              <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">Every code change invalidates npm install cache</p>
            </div>

            <div>
              <div className="bg-green-50 dark:bg-green-900/20 border-l-4 border-green-400 p-4 rounded mb-2">
                <h4 className="font-semibold text-green-900 mb-2">✓ Optimized Layer Ordering</h4>
              </div>
              <CodeBlock language="dockerfile">
{`FROM node:18-alpine

WORKDIR /app

# ✓ Copy dependency files first
COPY package*.json ./

# This layer is cached unless deps change
RUN npm ci

# Copy source code last
COPY . .

CMD ["node", "index.js"]`}
              </CodeBlock>
              <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">npm install only runs when dependencies change</p>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-6 dark:bg-gray-800 ">
            <h4 className="font-semibold mb-3">Additional Layer Tips:</h4>
            <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-200">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                <span>Combine RUN commands with <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">&&</code> to reduce layers</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                <span>Use <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">.dockerignore</code> to exclude unnecessary files (node_modules, .git, etc.)</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                <span>Clean up package manager caches in the same RUN command</span>
              </li>
            </ul>
          </div>

          <CodeBlock title="Example: Combining Commands" language="dockerfile">
{`# Install and clean up in one layer
RUN apk add --no-cache git curl && \\
    npm ci --only=production && \\
    npm cache clean --force && \\
    rm -rf /tmp/*`}
          </CodeBlock>
        </section>

        {/* Security */}
        <section id="security">
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
            <span className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 dark:text-blue-400 flex items-center justify-center text-sm font-bold">4</span>
            Security Best Practices
          </h2>

          <div className="space-y-6">
            <div className="border dark:border-gray-700 rounded-lg p-6 bg-gradient-to-r from-red-50 to-white dark:from-red-900/20 dark:to-gray-800">
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Shield className="h-6 w-6 text-red-600 dark:text-red-400" />
                Never Run as Root
              </h3>
              <p className="text-sm text-gray-700 dark:text-gray-200 mb-4">
                Running containers as root is a security risk. Always create and use a non-root user.
              </p>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-semibold text-red-700 dark:text-red-300 mb-2">❌ Running as root</p>
                  <CodeBlock language="dockerfile">
{`FROM node:18-alpine
WORKDIR /app
COPY . .
RUN npm install
# Runs as root (dangerous!)
CMD ["node", "index.js"]`}
                  </CodeBlock>
                </div>
                <div>
                  <p className="text-xs font-semibold text-green-700 dark:text-green-300 mb-2">✓ Non-root user</p>
                  <CodeBlock language="dockerfile">
{`FROM node:18-alpine
WORKDIR /app
COPY . .
RUN npm install
# Create and switch to non-root user
RUN addgroup -g 1001 -S nodejs && \\
    adduser -S nodejs -u 1001 && \\
    chown -R nodejs:nodejs /app
USER nodejs
CMD ["node", "index.js"]`}
                  </CodeBlock>
                </div>
              </div>
            </div>

            <div className="border dark:border-gray-700 rounded-lg p-6 dark:bg-gray-800 ">
              <h3 className="text-lg font-semibold mb-3">Other Security Practices</h3>
              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold mb-1">Pin specific image versions</p>
                    <p className="text-gray-600 dark:text-gray-300">Use <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">node:18.17.0-alpine</code> instead of <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">node:18-alpine</code></p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold mb-1">Scan for vulnerabilities</p>
                    <p className="text-gray-600 dark:text-gray-300">Use <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">docker scan yourimage:latest</code> or Snyk to check for known vulnerabilities</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold mb-1">Never include secrets in images</p>
                    <p className="text-gray-600 dark:text-gray-300">Use environment variables for secrets, never hardcode or COPY them into images</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold mb-1">Minimize installed packages</p>
                    <p className="text-gray-600 dark:text-gray-300">Each package is a potential security vulnerability - only install what you need</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Health Checks */}
        <section id="health-checks">
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
            <span className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 dark:text-blue-400 flex items-center justify-center text-sm font-bold">5</span>
            Implement Health Checks
          </h2>
          <p className="text-gray-700 dark:text-gray-200 mb-4">
            Health checks help Flux monitor your application and restart it if it becomes unhealthy.
          </p>

          <CodeBlock title="Dockerfile with Health Check" language="dockerfile">
{`FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .

# Health check endpoint
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
  CMD node healthcheck.js

EXPOSE 3000
CMD ["node", "index.js"]`}
          </CodeBlock>

          <CodeBlock title="healthcheck.js" language="javascript">
{`const http = require('http');

const options = {
  host: 'localhost',
  port: 3000,
  path: '/health',
  timeout: 2000
};

const healthCheck = http.request(options, (res) => {
  console.log(\`Health check status: \${res.statusCode}\`);
  if (res.statusCode === 200) {
    process.exit(0);
  } else {
    process.exit(1);
  }
});

healthCheck.on('error', (err) => {
  console.error('Health check failed:', err);
  process.exit(1);
});

healthCheck.end();`}
          </CodeBlock>

          <div className="grid md:grid-cols-2 gap-4 mt-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 border dark:border-gray-700 border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <h4 className="font-semibold text-blue-900 dark:text-blue-200 mb-2">Health Check Parameters</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li><code className="bg-blue-100 px-1 rounded">--interval</code>: Time between checks</li>
                <li><code className="bg-blue-100 px-1 rounded">--timeout</code>: Max time for check</li>
                <li><code className="bg-blue-100 px-1 rounded">--start-period</code>: Grace period on startup</li>
                <li><code className="bg-blue-100 px-1 rounded">--retries</code>: Failures before unhealthy</li>
              </ul>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 border dark:border-gray-700 border-green-200 dark:border-green-800 rounded-lg p-4">
              <h4 className="font-semibold text-green-900 mb-2">Alternative: Curl</h4>
              <CodeBlock language="dockerfile">
{`HEALTHCHECK --interval=30s \\
  CMD wget --quiet --tries=1 \\
    --spider http://localhost:3000/health \\
  || exit 1`}
              </CodeBlock>
            </div>
          </div>
        </section>

        {/* Environment Variables */}
        <section id="env-vars">
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
            <span className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 dark:text-blue-400 flex items-center justify-center text-sm font-bold">6</span>
            Environment Variables
          </h2>
          <p className="text-gray-700 dark:text-gray-200 mb-4">
            Use environment variables for configuration that changes between environments (dev, staging, production).
          </p>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold mb-3">In Your Application</h4>
              <CodeBlock language="javascript">
{`// config.js
module.exports = {
  port: process.env.PORT || 3000,
  dbHost: process.env.DB_HOST || 'localhost',
  dbPort: process.env.DB_PORT || 5432,
  nodeEnv: process.env.NODE_ENV || 'development',
  apiKey: process.env.API_KEY // required
};`}
              </CodeBlock>
            </div>

            <div>
              <h4 className="font-semibold mb-3">In Flux Deployment Spec</h4>
              <CodeBlock language="json">
{`{
  "name": "myapp",
  "repotag": "myuser/myapp:latest",
  "environmentParameters": [
    "PORT=3000",
    "DB_HOST=fluxpostgres_myapp",
    "DB_PORT=5432",
    "NODE_ENV=production",
    "API_KEY=your_api_key_here"
  ]
}`}
              </CodeBlock>
            </div>
          </div>

          <div className="bg-yellow-50 dark:bg-yellow-900/20 border dark:border-gray-700 border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mt-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold text-yellow-900 mb-1">Security Warning:</p>
                <p className="text-yellow-800 dark:text-yellow-200">Never include sensitive data in your Docker image. Always pass secrets via environment variables in the deployment spec.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Common Mistakes */}
        <section id="common-mistakes">
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
            <span className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 dark:text-blue-400 flex items-center justify-center text-sm font-bold">7</span>
            Common Mistakes to Avoid
          </h2>

          <div className="space-y-4">
            <div className="border-l-4 border-red-400 bg-red-50 dark:bg-red-900/20 p-4 rounded">
              <h4 className="font-semibold text-red-900 mb-2">❌ Installing development dependencies in production</h4>
              <p className="text-sm text-red-800 mb-2">Use <code className="bg-red-100 px-1 rounded">npm ci --only=production</code> to exclude devDependencies</p>
              <CodeBlock language="dockerfile">
{`# Good
RUN npm ci --only=production

# Also good (for multi-stage)
RUN npm ci --omit=dev`}
              </CodeBlock>
            </div>

            <div className="border-l-4 border-red-400 bg-red-50 dark:bg-red-900/20 p-4 rounded">
              <h4 className="font-semibold text-red-900 mb-2">❌ Not using .dockerignore</h4>
              <p className="text-sm text-red-800 mb-2">Exclude unnecessary files to reduce context size and build time</p>
              <CodeBlock title=".dockerignore" language="text">
{`node_modules
npm-debug.log
.git
.gitignore
.env
.env.local
*.md
.vscode
.idea
dist
build
coverage
.DS_Store`}
              </CodeBlock>
            </div>

            <div className="border-l-4 border-red-400 bg-red-50 dark:bg-red-900/20 p-4 rounded">
              <h4 className="font-semibold text-red-900 mb-2">❌ Using latest tags</h4>
              <p className="text-sm text-red-800">Pin specific versions for reproducible builds</p>
              <div className="grid md:grid-cols-2 gap-4 mt-2">
                <CodeBlock language="dockerfile">
{`# Bad
FROM node:latest

# Good
FROM node:18.17.0-alpine`}
                </CodeBlock>
                <p className="text-xs text-red-700 self-center">
                  <code className="bg-red-100 px-1 rounded">latest</code> can change unexpectedly and break your app
                </p>
              </div>
            </div>

            <div className="border-l-4 border-red-400 bg-red-50 dark:bg-red-900/20 p-4 rounded">
              <h4 className="font-semibold text-red-900 mb-2">❌ Rebuilding dependencies on every code change</h4>
              <p className="text-sm text-red-800">Copy package.json before source code to leverage layer caching (see Layer Optimization section)</p>
            </div>

            <div className="border-l-4 border-red-400 bg-red-50 dark:bg-red-900/20 p-4 rounded">
              <h4 className="font-semibold text-red-900 mb-2">❌ Exposing unnecessary ports</h4>
              <p className="text-sm text-red-800">Only EXPOSE ports that your application actually listens on</p>
              <CodeBlock language="dockerfile">
{`# Only expose what you need
EXPOSE 3000

# Don't expose internal/debug ports unless necessary`}
              </CodeBlock>
            </div>
          </div>
        </section>

        {/* Complete Example */}
        <section className="border-t pt-8 dark:bg-gray-900">
          <h2 className="text-2xl font-bold mb-4">Complete Example: Production-Ready Dockerfile</h2>
          <p className="text-gray-700 dark:text-gray-200 mb-4">
            Putting it all together - a production-ready Dockerfile following all best practices:
          </p>

          <CodeBlock title="Dockerfile (Production Ready)" language="dockerfile">
{`# Use specific version for reproducibility
FROM node:18.17.0-alpine AS builder

# Set working directory
WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install all dependencies (including dev) for building
RUN npm ci

# Copy source code
COPY . .

# Build application
RUN npm run build

# Production stage
FROM node:18.17.0-alpine

WORKDIR /app

# Install security updates
RUN apk upgrade --no-cache

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production && \\
    npm cache clean --force

# Copy built application from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/healthcheck.js ./

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \\
    adduser -S nodejs -u 1001 && \\
    chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose application port
EXPOSE 3000

# Add health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
  CMD node healthcheck.js

# Start application
CMD ["node", "dist/index.js"]`}
          </CodeBlock>

          <div className="bg-green-50 dark:bg-green-900/20 border dark:border-gray-700 border-green-200 dark:border-green-800 rounded-lg p-4 mt-4">
            <h4 className="font-semibold text-green-900 mb-2">This Dockerfile includes:</h4>
            <ul className="text-sm text-green-800 space-y-1 ml-4">
              <li>✓ Multi-stage build for minimal image size</li>
              <li>✓ Alpine base image</li>
              <li>✓ Pinned version numbers</li>
              <li>✓ Optimized layer ordering</li>
              <li>✓ Non-root user</li>
              <li>✓ Health check implementation</li>
              <li>✓ Production-only dependencies</li>
              <li>✓ Cache cleanup</li>
            </ul>
          </div>
        </section>
      </div>

      {/* Next Steps */}
      <div className="mt-12 border-t pt-8">
        <h2 className="text-2xl font-bold mb-6">Next Steps</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <a
            href="/reference/flux-spec"
            className="block p-6 border dark:border-gray-700 rounded-lg hover:shadow-lg transition-shadow group dark:bg-gray-800 "
          >
            <h3 className="text-lg font-semibold mb-2 group-hover:text-blue-600 dark:text-blue-400">Flux Spec Reference →</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">Learn about Flux deployment specification format</p>
          </a>
          <a
            href="/tutorials/basic-deployment"
            className="block p-6 border dark:border-gray-700 rounded-lg hover:shadow-lg transition-shadow group dark:bg-gray-800 "
          >
            <h3 className="text-lg font-semibold mb-2 group-hover:text-blue-600 dark:text-blue-400">Deploy Your First App →</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">Put these practices into action with a real deployment</p>
          </a>
        </div>
      </div>
    </div>
  )
}
