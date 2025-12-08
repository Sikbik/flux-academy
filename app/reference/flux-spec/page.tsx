import { CodeBlock } from '@/components/tutorial/CodeBlock'

export default function FluxSpecReferencePage() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <h1 className="text-4xl font-bold mb-4">Flux Specification Reference</h1>
      <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
        Complete reference for the Flux deployment specification format (version 8)
      </p>

      {/* Basic Structure */}
      <section className="mb-12 dark:bg-gray-900">
        <h2 className="text-2xl font-bold mb-4">Basic Structure</h2>
        <CodeBlock language="json" title="Complete Spec Example (Version 8)">
{`{
  "version": 8,
  "name": "myapp",
  "description": "Application description",
  "owner": "ZELID_ADDRESS",
  "instances": 3,
  "staticip": false,
  "enterprise": "",
  "compose": [
    {
      "name": "component1",
      "description": "Component description",
      "repotag": "username/image:tag",
      "ports": [3000],
      "containerPorts": [3000],
      "domains": [""],
      "environmentParameters": [
        "KEY=value"
      ],
      "commands": [],
      "containerData": "/appdata",
      "cpu": 2.0,
      "ram": 4000,
      "hdd": 10,
      "tiered": false
    }
  ]
}`}
        </CodeBlock>
      </section>

      {/* Field Reference */}
      <section className="mb-12 dark:bg-gray-900">
        <h2 className="text-2xl font-bold mb-6">Field Reference</h2>

        <div className="space-y-6">
          <FieldDoc
            name="version"
            type="number"
            required
            description="Specification version. Use 8 for latest features (instances, staticip, enterprise)."
            example="8"
          />

          <FieldDoc
            name="name"
            type="string"
            required
            description="Unique application name. Must be unique across Flux network. Alphanumeric characters only (a-z, A-Z, 0-9). No hyphens, underscores, or spaces."
            example='"myapp"'
          />

          <FieldDoc
            name="instances"
            type="number"
            required
            description="Number of redundant copies of your app. Minimum is 3. Additional instances cost ~$0.50 for small apps or basePrice/3 for larger apps."
            example="3"
          />

          <FieldDoc
            name="staticip"
            type="boolean"
            required
            description="Restrict deployment to nodes with static IP addresses. Increases deployment cost based on application resources. Useful for apps requiring consistent external IP."
            example="false"
          />

          <FieldDoc
            name="enterprise"
            type="string"
            required
            description="Deploy to ArcaneOS enterprise nodes with enhanced security: OS-level encrypted volumes where node operators cannot access your data, support for private Docker images, and encrypted environment secrets. Set to 'enabled' or empty string ''. Increases deployment cost based on application resources."
            example='""'
          />

          <FieldDoc
            name="description"
            type="string"
            required
            description="Human-readable description of your application."
            example='"My awesome blockchain application"'
          />

          <FieldDoc
            name="owner"
            type="string"
            required
            description="Your ZelID address from Zelcore wallet. This identifies you as the app owner."
            example='"1ABC...xyz"'
          />

          <FieldDoc
            name="compose"
            type="array"
            required
            description="Array of component specifications. Each component represents a Docker container."
          />

          <div className="ml-6 border-l-2 border-blue-200 dark:border-blue-800 pl-6 space-y-6">
            <h3 className="text-lg font-bold text-blue-600 dark:text-blue-400">Component Fields</h3>

            <FieldDoc
              name="name"
              type="string"
              required
              description="Component name. Used in internal DNS: flux{name}_{appname}"
              example='"postgres"'
            />

            <FieldDoc
              name="repotag"
              type="string"
              required
              description="Docker image reference. Must be publicly accessible."
              example='"postgres:15-alpine" or "username/myapp:latest"'
            />

            <FieldDoc
              name="ports"
              type="array of numbers"
              required
              description="Array of external port numbers exposed to the internet. Valid range: 0-65535. Ports <1024, 8080, 8443, or 9090 require enterprise mode and add $2/port."
              example="[3000, 8080]"
            />

            <FieldDoc
              name="containerPorts"
              type="array of numbers"
              required
              description="Array of ports your application listens on inside the container. Valid range: 0-65535. Must match the length of 'ports' array."
              example="[3000, 8080]"
            />

            <FieldDoc
              name="domains"
              type="array of strings"
              required
              description="Array of custom domains for each port. Leave as empty strings to use Flux-assigned domains. Must match the length of 'ports' array."
              example='["", "mydomain.com"]'
            />

            <FieldDoc
              name="cpu"
              type="number"
              required
              description="Number of CPU cores. Minimum 0.5, increment by 0.5."
              example="2.0"
            />

            <FieldDoc
              name="ram"
              type="number"
              required
              description="Memory in megabytes (MB). Minimum 512."
              example="4096"
            />

            <FieldDoc
              name="hdd"
              type="number"
              required
              description="Disk space in gigabytes (GB). Minimum 1."
              example="10"
            />

            <FieldDoc
              name="environmentParameters"
              type="array"
              description="Array of environment variables in KEY=value format."
              example='["NODE_ENV=production", "PORT=3000"]'
            />

            <FieldDoc
              name="containerData"
              type="string"
              required
              description="Path to persistent data volume inside container. Required field. Use '/appdata' for general apps or specific paths like '/var/lib/postgresql/data' for databases."
              example='"/appdata"'
            />

            <FieldDoc
              name="commands"
              type="array"
              description="Override container CMD. Usually empty to use Dockerfile CMD."
              example="[]"
            />

            <FieldDoc
              name="tiered"
              type="boolean"
              description="Whether to allow deployment on different node tiers. Usually false."
              example="false"
            />
          </div>
        </div>
      </section>

      {/* Common Patterns */}
      <section className="mb-12 dark:bg-gray-900">
        <h2 className="text-2xl font-bold mb-6">Common Patterns</h2>

        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold mb-3">Multi-Component Internal Communication</h3>
            <p className="text-gray-700 dark:text-gray-200 mb-3">
              Components use internal DNS to communicate. For app named &quot;myapp&quot; with components &quot;db&quot; and &quot;api&quot;:
            </p>
            <CodeBlock language="bash">
{`# API connects to database using:
DB_HOST=fluxdb_myapp
DB_PORT=5432

# Full connection string:
postgresql://user:pass@fluxdb_myapp:5432/dbname`}
            </CodeBlock>
          </div>
        </div>
      </section>

      {/* Volume Prefixes Section */}
      <section className="mb-12 dark:bg-gray-900">
        <h2 className="text-2xl font-bold mb-6">Container Data Volume Prefixes</h2>
        <p className="text-gray-700 dark:text-gray-200 mb-6">
          Flux supports special volume prefixes that enable data synchronization and sharing across instances. Understanding these prefixes is crucial for multi-instance deployments.
        </p>

        <div className="space-y-6">
          <div className="border dark:border-gray-700 rounded-lg p-3 sm:p-6 bg-white dark:bg-gray-800 ">
            <div className="flex items-start gap-2 sm:gap-3 mb-3 flex-col sm:flex-row">
              <code className="bg-purple-100 text-purple-700 px-3 py-1 rounded font-bold text-sm whitespace-nowrap">g:/</code>
              <div className="flex-1 w-full min-w-0">
                <h3 className="text-lg font-semibold mb-2">Global Syncthing (Primary/Standby)</h3>
                <p className="text-sm text-gray-700 dark:text-gray-200 mb-3">
                  Enables data synchronization with a primary/standby (master/slave) architecture. Only ONE instance acts as the primary writer, while others maintain read-only synchronized replicas.
                </p>
                <ul className="text-sm text-gray-700 dark:text-gray-200 space-y-1 ml-4">
                  <li>• <strong>Sync mode:</strong> Primary (write) + Standby (read-only replicas)</li>
                  <li>• <strong>Use case:</strong> Single-writer databases, applications requiring data consistency</li>
                  <li>• <strong>Auto-restart:</strong> No (uses restart policy &quot;no&quot;)</li>
                  <li>• <strong>Pricing:</strong> 20% discount on base price</li>
                  <li>• <strong>Failover:</strong> If primary fails, a standby can be promoted</li>
                </ul>
                <CodeBlock language="json" title="Example">
{`{
  "containerData": "g:/var/lib/postgresql/data"
}`}
                </CodeBlock>
              </div>
            </div>
          </div>

          <div className="border dark:border-gray-700 rounded-lg p-3 sm:p-6 bg-white dark:bg-gray-800 ">
            <div className="flex items-start gap-2 sm:gap-3 mb-3 flex-col sm:flex-row">
              <code className="bg-blue-100 text-blue-700 px-3 py-1 rounded font-bold text-sm whitespace-nowrap">r:/</code>
              <div className="flex-1 w-full min-w-0">
                <h3 className="text-lg font-semibold mb-2">Read-Write Syncthing (Replica)</h3>
                <p className="text-sm text-gray-700 dark:text-gray-200 mb-3">
                  Enables bidirectional data synchronization. All instances can read and write to their local copies, with changes propagating to all other instances.
                </p>
                <ul className="text-sm text-gray-700 dark:text-gray-200 space-y-1 ml-4">
                  <li>• <strong>Sync mode:</strong> Bidirectional (all instances can write)</li>
                  <li>• <strong>Use case:</strong> Distributed file systems, shared application data</li>
                  <li>• <strong>Auto-start:</strong> No (containers not automatically started)</li>
                  <li>• <strong>Conflict resolution:</strong> Handled by Syncthing</li>
                </ul>
                <CodeBlock language="json" title="Example">
{`{
  "containerData": "r:/app/shared-data"
}`}
                </CodeBlock>
              </div>
            </div>
          </div>

          <div className="border dark:border-gray-700 rounded-lg p-3 sm:p-6 bg-white dark:bg-gray-800 ">
            <div className="flex items-start gap-2 sm:gap-3 mb-3 flex-col sm:flex-row">
              <code className="bg-green-100 text-green-700 px-3 py-1 rounded font-bold text-sm whitespace-nowrap">s:/</code>
              <div className="flex-1 w-full min-w-0">
                <h3 className="text-lg font-semibold mb-2">Standard Syncthing</h3>
                <p className="text-sm text-gray-700 dark:text-gray-200 mb-3">
                  Basic Syncthing synchronization with standard behavior.
                </p>
                <ul className="text-sm text-gray-700 dark:text-gray-200 space-y-1 ml-4">
                  <li>• <strong>Sync mode:</strong> Bidirectional synchronization</li>
                  <li>• <strong>Auto-restart:</strong> Yes (unless-stopped)</li>
                </ul>
                <CodeBlock language="json" title="Example">
{`{
  "containerData": "s:/data"
}`}
                </CodeBlock>
              </div>
            </div>
          </div>

          <div className="border dark:border-gray-700 rounded-lg p-3 sm:p-6 bg-white dark:bg-gray-800 ">
            <div className="flex items-start gap-2 sm:gap-3 mb-3 flex-col sm:flex-row">
              <code className="bg-orange-100 text-orange-700 px-3 py-1 rounded font-bold text-sm whitespace-nowrap">0:/ 1:/ 2:/</code>
              <div className="flex-1 w-full min-w-0">
                <h3 className="text-lg font-semibold mb-2">Component Volume Mounting</h3>
                <p className="text-sm text-gray-700 dark:text-gray-200 mb-3">
                  Mount volumes from other components within the same multi-component application. The number represents the component index to mount from.
                </p>
                <ul className="text-sm text-gray-700 dark:text-gray-200 space-y-1 ml-4">
                  <li>• <strong>Requirements:</strong> Version 4+ applications (compose apps only)</li>
                  <li>• <strong>Limitation:</strong> Components can only mount from lower-numbered components</li>
                  <li>• <strong>Use case:</strong> Sharing data between microservices (e.g., API accessing database files)</li>
                  <li>• <strong>Syntax:</strong> Separate multiple volumes with <code className="bg-gray-100 dark:bg-gray-700 px-1">|</code></li>
                </ul>
                <CodeBlock language="json" title="Example: Multi-volume setup">
{`{
  "compose": [
    {
      "name": "database",
      "containerData": "g:/var/lib/postgresql/data"
    },
    {
      "name": "api",
      "containerData": "/app/data|0:/db-data"
    }
  ]
}`}
                </CodeBlock>
                <p className="text-xs text-gray-600 dark:text-gray-300 mt-2">
                  In this example, component 1 (api) mounts component 0&apos;s (database) volume at /db-data
                </p>
              </div>
            </div>
          </div>

          <div className="border dark:border-gray-700 rounded-lg p-3 sm:p-6 bg-white dark:bg-gray-800 ">
            <div className="flex items-start gap-2 sm:gap-3 mb-3 flex-col sm:flex-row">
              <code className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 px-3 py-1 rounded font-bold text-sm whitespace-nowrap">No prefix</code>
              <div className="flex-1 w-full min-w-0">
                <h3 className="text-lg font-semibold mb-2">Standard Local Volume</h3>
                <p className="text-sm text-gray-700 dark:text-gray-200 mb-3">
                  Standard Docker volume with no synchronization. Each instance has independent, isolated data.
                </p>
                <ul className="text-sm text-gray-700 dark:text-gray-200 space-y-1 ml-4">
                  <li>• <strong>Sync mode:</strong> None (independent volumes per instance)</li>
                  <li>• <strong>Auto-restart:</strong> Yes (unless-stopped)</li>
                  <li>• <strong>Use case:</strong> Stateless apps, cache directories, temporary data</li>
                  <li>• <strong>Warning:</strong> Data is lost if instance is destroyed</li>
                </ul>
                <CodeBlock language="json" title="Example">
{`{
  "containerData": "/appdata"
}`}
                </CodeBlock>
              </div>
            </div>
          </div>
        </div>

        {/* Comparison Table */}
        <div className="mt-8 overflow-x-auto">
          <h3 className="text-lg font-semibold mb-4">Volume Prefix Comparison</h3>
          <table className="w-full border dark:border-gray-700 rounded-lg overflow-hidden dark:bg-gray-800 ">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold">Prefix</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Syncthing</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Sync Mode</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Auto-Restart</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Discount</th>
              </tr>
            </thead>
            <tbody className="divide-y text-sm">
              <tr>
                <td className="px-4 py-3"><code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">None</code></td>
                <td className="px-4 py-3">No</td>
                <td className="px-4 py-3">None</td>
                <td className="px-4 py-3">Yes</td>
                <td className="px-4 py-3">-</td>
              </tr>
              <tr>
                <td className="px-4 py-3"><code className="bg-green-100 text-green-700 px-2 py-1 rounded">s:/</code></td>
                <td className="px-4 py-3">Yes</td>
                <td className="px-4 py-3">Bidirectional</td>
                <td className="px-4 py-3">Yes</td>
                <td className="px-4 py-3">-</td>
              </tr>
              <tr>
                <td className="px-4 py-3"><code className="bg-blue-100 text-blue-700 px-2 py-1 rounded">r:/</code></td>
                <td className="px-4 py-3">Yes</td>
                <td className="px-4 py-3">Bidirectional</td>
                <td className="px-4 py-3">No</td>
                <td className="px-4 py-3">-</td>
              </tr>
              <tr>
                <td className="px-4 py-3"><code className="bg-purple-100 text-purple-700 px-2 py-1 rounded">g:/</code></td>
                <td className="px-4 py-3">Yes</td>
                <td className="px-4 py-3">Primary/Standby</td>
                <td className="px-4 py-3">No</td>
                <td className="px-4 py-3 font-semibold text-green-600 dark:text-green-400">20%</td>
              </tr>
              <tr>
                <td className="px-4 py-3"><code className="bg-orange-100 text-orange-700 px-2 py-1 rounded">0:/ 1:/ etc.</code></td>
                <td className="px-4 py-3">N/A</td>
                <td className="px-4 py-3">Component mount</td>
                <td className="px-4 py-3">N/A</td>
                <td className="px-4 py-3">-</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-6 bg-yellow-50 dark:bg-yellow-900/20 border dark:border-gray-700 border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <p className="text-sm font-semibold text-yellow-900 mb-2">Important Notes:</p>
          <ul className="text-sm text-yellow-800 space-y-1 ml-4">
            <li>• Using <code className="bg-yellow-100 px-1">g:/</code> prefix provides a 20% discount on your base deployment cost</li>
            <li>• Component mounting (0:/, 1:/, etc.) only works in multi-component applications (version 4+)</li>
            <li>• Higher-numbered components can only mount volumes from lower-numbered ones</li>
            <li>• Syncthing prefixes provide data redundancy across instances</li>
            <li>• Without a sync prefix, data is isolated per instance and lost if the instance fails</li>
          </ul>
        </div>
      </section>

      {/* Validation Rules */}
      <section className="mb-12 dark:bg-gray-900">
        <h2 className="text-2xl font-bold mb-6">Validation Rules</h2>
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border dark:border-gray-700 border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
          <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-200">
            <li>• App name must be unique across the entire Flux network</li>
            <li>• App name must contain only alphanumeric characters (a-z, A-Z, 0-9) - no hyphens, spaces, or special characters</li>
            <li>• Component names must be unique within the app</li>
            <li>• Minimum 3 instances required</li>
            <li>• Enterprise field must be either &quot;enabled&quot; or empty string &quot;&quot;</li>
            <li>• ports, containerPorts, and domains arrays must have matching lengths</li>
            <li>• Privileged ports (&lt;1024, 8080, 8443, 9090) require enterprise mode</li>
            <li>• CPU can increment by 0.1 (e.g., 0.1, 0.5, 1.0, 2.5, etc.)</li>
            <li>• RAM increments by 100 MB (e.g., 100, 1000, 2000, 4000, etc.)</li>
            <li>• Storage (hdd) must be at least 1 GB</li>
            <li>• Docker image must be publicly accessible (unless using enterprise mode)</li>
            <li>• Port numbers must be valid (1-65535)</li>
            <li>• Environment variables must be in KEY=value format</li>
            <li>• containerData path is required (use /appdata if unsure)</li>
          </ul>
        </div>
      </section>

      {/* Enterprise Mode & ArcaneOS */}
      <section className="mb-12 dark:bg-gray-900">
        <h2 className="text-2xl font-bold mb-6">Enterprise Mode & ArcaneOS Nodes</h2>
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/30 dark:to-blue-900/30 border dark:border-purple-800 border-purple-200 rounded-lg p-6 mb-6">
          <h3 className="text-lg font-semibold mb-3">What is Enterprise Mode?</h3>
          <p className="text-gray-700 dark:text-gray-200 mb-4">
            Enterprise mode deploys your application exclusively to <strong>ArcaneOS nodes</strong> - specialized Flux nodes that provide enhanced security features for sensitive applications.
          </p>
          <p className="text-gray-700 dark:text-gray-200">
            Set <code className="bg-white dark:bg-gray-800 px-2 py-1 rounded">enterprise: &quot;enabled&quot;</code> in your spec to enable enterprise mode. Enterprise mode increases deployment cost based on application resources.
          </p>
        </div>

        <div className="space-y-6">
          <div className="border dark:border-gray-700 rounded-lg p-6 dark:bg-gray-800 ">
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              🔒 OS-Level Encrypted Volumes
            </h3>
            <p className="text-gray-700 dark:text-gray-200 mb-3">
              ArcaneOS nodes run a specialized operating system with full-disk encryption. Your application data is encrypted at the OS level, meaning:
            </p>
            <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-200 ml-4">
              <li>• <strong>Node operators cannot access your data</strong> - Even the physical server owner cannot read your encrypted volumes</li>
              <li>• <strong>Automatic encryption</strong> - All containerData volumes are encrypted without additional configuration</li>
              <li>• <strong>Protection at rest</strong> - Data is encrypted when stored on disk</li>
              <li>• <strong>Decrypted only in memory</strong> - Your application accesses unencrypted data in RAM during execution</li>
            </ul>
          </div>

          <div className="border dark:border-gray-700 rounded-lg p-6 dark:bg-gray-800 ">
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              🔐 Encrypted Environment Secrets
            </h3>
            <p className="text-gray-700 dark:text-gray-200 mb-3">
              Environment variables containing sensitive data (API keys, passwords, database credentials) are encrypted when stored on ArcaneOS nodes:
            </p>
            <CodeBlock language="json" title="Environment secrets are encrypted">
{`{
  "environmentParameters": [
    "DATABASE_PASSWORD=supersecret123",
    "API_KEY=sk-proj-abc123xyz",
    "JWT_SECRET=my-signing-key"
  ]
}`}
            </CodeBlock>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-3">
              These secrets are encrypted at rest and only decrypted when passed to your container at runtime.
            </p>
          </div>

          <div className="border dark:border-gray-700 rounded-lg p-6 dark:bg-gray-800 ">
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              📦 Private Docker Images
            </h3>
            <p className="text-gray-700 dark:text-gray-200 mb-3">
              Enterprise mode allows you to use private Docker images from registries like:
            </p>
            <ul className="space-y-1 text-sm text-gray-700 dark:text-gray-200 ml-4">
              <li>• GitHub Container Registry (ghcr.io)</li>
              <li>• GitLab Container Registry</li>
              <li>• Private Docker Hub repositories</li>
              <li>• Self-hosted registries</li>
            </ul>
            <CodeBlock language="json" title="Using private images">
{`{
  "name": "privateapp",
  "enterprise": "enabled",
  "compose": [{
    "repotag": "ghcr.io/yourorg/private-app:latest",
    ...
  }]
}`}
            </CodeBlock>
          </div>

          <div className="bg-yellow-50 dark:bg-yellow-900/20 border dark:border-gray-700 border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-3 text-yellow-900">When to Use Enterprise Mode</h3>
            <p className="text-sm text-yellow-800 mb-3">
              Consider enterprise mode for applications that handle:
            </p>
            <ul className="space-y-1 text-sm text-yellow-800 ml-4">
              <li>✓ Sensitive user data (PII, health records, financial information)</li>
              <li>✓ Private business logic in proprietary Docker images</li>
              <li>✓ API keys and credentials that must remain confidential</li>
              <li>✓ Compliance requirements (GDPR, HIPAA, SOC 2)</li>
              <li>✓ Applications where node operator trust is a concern</li>
            </ul>
            <p className="text-sm text-yellow-700 mt-3">
              <strong>Cost:</strong> Enterprise mode increases deployment cost based on application resources (scales with CPU, RAM, and storage).
            </p>
          </div>
        </div>
      </section>

      {/* Pricing Information */}
      <section>
        <h2 className="text-2xl font-bold mb-6">Pricing Calculation</h2>
        <div className="bg-blue-50 dark:bg-blue-900/20 border dark:border-gray-700 border-blue-200 dark:border-blue-800 rounded-lg p-6">
          <p className="text-sm text-gray-700 dark:text-gray-200 mb-4">
            <strong>Base pricing formula (per month):</strong>
          </p>
          <div className="bg-white dark:bg-gray-800 rounded p-4 font-mono text-xs mb-4">
            basePrice = (CPU × $0.15 × 10) + (RAM_MB × $0.05 ÷ 100) + (HDD × $0.02)
          </div>
          <p className="text-sm text-gray-700 dark:text-gray-200 mb-2"><strong>Additional costs:</strong></p>
          <ul className="space-y-1 text-sm text-gray-700 dark:text-gray-200 ml-4">
            <li>• Static IP: Increases cost based on application resources</li>
            <li>• Enterprise: Increases cost based on application resources</li>
            <li>• Additional instances (small apps &lt;$1.50): +$0.50 per instance</li>
            <li>• Additional instances (larger apps): +(basePrice ÷ 3) per instance</li>
          </ul>
          <p className="text-sm text-gray-700 dark:text-gray-200 mt-4"><strong>Tier discounts:</strong></p>
          <ul className="space-y-1 text-sm text-gray-700 dark:text-gray-200 ml-4">
            <li>• Small apps (CPU &lt;3, RAM &lt;6000 MB, HDD &lt;150 GB): 20% discount</li>
            <li>• Medium apps (CPU &lt;7, RAM &lt;29000 MB, HDD &lt;370 GB): 10% discount</li>
          </ul>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">
            * When paying with FLUX tokens, you get an additional 5% discount. Prices are calculated in USD then converted to FLUX using current market rates.
          </p>
        </div>
      </section>
    </div>
  )
}

function FieldDoc({
  name,
  type,
  required = false,
  description,
  example
}: {
  name: string
  type: string
  required?: boolean
  description: string
  example?: string
}) {
  return (
    <div className="border-b pb-4 overflow-hidden">
      <div className="flex items-start gap-2 sm:gap-3 mb-2 flex-wrap">
        <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded font-mono text-xs sm:text-sm break-all">{name}</code>
        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded whitespace-nowrap">{type}</span>
        {required && <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded whitespace-nowrap">required</span>}
      </div>
      <p className="text-sm text-gray-700 dark:text-gray-200 mb-2 break-words">{description}</p>
      {example && (
        <div className="text-xs overflow-x-auto">
          <span className="text-gray-500 dark:text-gray-400">Example: </span>
          <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded break-all inline-block max-w-full">{example}</code>
        </div>
      )}
    </div>
  )
}
