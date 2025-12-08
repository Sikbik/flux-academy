import { StepByStep } from '@/components/tutorial/StepByStep'
import { CodeBlock } from '@/components/tutorial/CodeBlock'
import { ChecklistItem } from '@/components/tutorial/ChecklistItem'
import { AlertCircle, CheckCircle2, Database, GitBranch, Shield, Zap } from 'lucide-react'
import { LivePriceAmount } from '@/components/tutorial/LivePriceAmount'

export default function SharedDBTutorial() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <Database className="h-10 w-10 text-purple-600 dark:text-purple-400" />
          <h1 className="text-4xl font-bold">Shared Database with Automatic Replication</h1>
        </div>
        <p className="text-xl text-gray-600 dark:text-gray-300">
          Deploy a persistent, replicated database across Flux&apos;s decentralized network with automatic clustering and failover
        </p>
      </div>

      {/* Why Shared DB */}
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/30 dark:to-blue-900/30 border dark:border-gray-700 rounded-lg p-6 mb-8 ">
        <h2 className="text-xl font-semibold mb-4">Why Use Flux Shared DB?</h2>
        <div className="grid md:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border">
            <GitBranch className="h-8 w-8 text-blue-600 dark:text-blue-400 mb-2" />
            <h3 className="font-semibold mb-1">Automatic Replication</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">Data syncs across all instances with master-replica architecture</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border">
            <Shield className="h-8 w-8 text-green-600 dark:text-green-400 mb-2" />
            <h3 className="font-semibold mb-1">High Availability</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">Automatic failover and cluster self-healing</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border">
            <Zap className="h-8 w-8 text-purple-600 dark:text-purple-400 mb-2" />
            <h3 className="font-semibold mb-1">Zero Configuration</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">Nodes discover each other and auto-cluster via FluxOS API</p>
          </div>
        </div>
      </div>

      {/* Learning Objectives */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border dark:border-gray-700 border-blue-200 dark:border-blue-800 rounded-lg p-6 mb-8">
        <h2 className="text-xl font-semibold mb-3">What You&apos;ll Learn</h2>
        <ul className="space-y-2">
          <ChecklistItem checked>Deploy MySQL with Flux Shared DB operator</ChecklistItem>
          <ChecklistItem checked>Configure automatic database replication</ChecklistItem>
          <ChecklistItem checked>Understand master-replica architecture</ChecklistItem>
          <ChecklistItem checked>Connect applications to the shared database</ChecklistItem>
        </ul>
      </div>

      {/* Prerequisites */}
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border dark:border-gray-700 border-yellow-200 dark:border-yellow-800 rounded-lg p-6 mb-8">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-6 w-6 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-1" />
          <div>
            <h2 className="text-xl font-semibold mb-3">Before You Start</h2>
            <ul className="space-y-1 text-sm">
              <li>✓ Completed the Multi-Component Applications tutorial</li>
              <li>✓ Understanding of databases (MySQL, PostgreSQL, or MongoDB)</li>
              <li>✓ Familiar with environment variables and Docker networking</li>
              <li>✓ Have FLUX tokens (~<LivePriceAmount cpu={4} ram={8000} hdd={40} volumePrefix="s:/" /> FLUX recommended)</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Tutorial Steps */}
      <div className="space-y-8">
        {/* Step 1: Understanding the Architecture */}
        <StepByStep number={1} title="Understanding Shared DB Architecture">
          <p className="mb-4">
            Flux Shared DB uses a distributed operator pattern with three key interfaces:
          </p>

          <div className="space-y-3 mb-6">
            <div className="border-l-4 border-purple-400 pl-4 py-2 bg-purple-50 dark:bg-purple-900/20">
              <h4 className="font-semibold text-purple-900">DB Interface (Port 3307)</h4>
              <p className="text-sm text-purple-800">Acts as a database proxy - your application connects here instead of directly to the database</p>
            </div>
            <div className="border-l-4 border-blue-400 pl-4 py-2 bg-blue-50 dark:bg-blue-900/20">
              <h4 className="font-semibold text-blue-900">Internal API</h4>
              <p className="text-sm text-blue-800">Handles inter-node communication for clustering and replication</p>
            </div>
            <div className="border-l-4 border-green-400 pl-4 py-2 bg-green-50 dark:bg-green-900/20">
              <h4 className="font-semibold text-green-900">UI API</h4>
              <p className="text-sm text-green-800">Provides cluster management and monitoring capabilities</p>
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-4 dark:bg-gray-800 ">
            <h4 className="font-semibold mb-2">How It Works:</h4>
            <ol className="space-y-2 text-sm text-gray-700 dark:text-gray-200 ml-4">
              <li>1. Operator nodes discover each other using FluxOS API</li>
              <li>2. Nodes automatically form a cluster with master-replica architecture</li>
              <li>3. <strong>Read queries</strong> → Route directly to local database instance (fast!)</li>
              <li>4. <strong>Write queries</strong> → Funnel to master node, which timestamps and sequences them</li>
              <li>5. Master forwards writes to all replica nodes for synchronization</li>
            </ol>
          </div>
        </StepByStep>

        {/* Step 2: Create Deployment Specification */}
        <StepByStep number={2} title="Create Shared DB Deployment Specification">
          <p className="mb-4">
            Create a deployment spec with three components: MySQL database, Shared DB operator, and your application.
          </p>

          <CodeBlock title="shared-db-spec.json" language="json" downloadable filename="shared-db-spec.json">
{`{
  "version": 8,
  "name": "myshareddb",
  "description": "Application with shared replicated database",
  "owner": "YOUR_ZELID_HERE",
  "instances": 3,
  "staticip": false,
  "enterprise": "",
  "compose": [
    {
      "name": "mysql",
      "description": "MySQL database engine",
      "repotag": "mysql:8.0",
      "ports": [3306],
      "containerPorts": [3306],
      "domains": [""],
      "environmentParameters": [
        "MYSQL_ROOT_PASSWORD=myRootPassword123",
        "MYSQL_DATABASE=myapp"
      ],
      "commands": [],
      "containerData": "s:/var/lib/mysql",
      "cpu": 1.0,
      "ram": 2000,
      "hdd": 10,
      "tiered": false
    },
    {
      "name": "operator",
      "description": "Flux Shared DB operator",
      "repotag": "runonflux/shared-db:latest",
      "ports": [3307, 8080],
      "containerPorts": [3307, 8080],
      "domains": [""],
      "environmentParameters": [
        "DB_COMPONENT_NAME=fluxmysql_myshareddb",
        "DB_APPNAME=myshareddb",
        "CLIENT_APPNAME=myapp",
        "DB_INIT_PASS=myRootPassword123",
        "INIT_DB_NAME=myapp",
        "DB_USER=root",
        "DB_PORT=3307",
        "API_PORT=8080"
      ],
      "commands": [],
      "containerData": "s:/app/dumps",
      "cpu": 1.0,
      "ram": 2000,
      "hdd": 10,
      "tiered": false
    },
    {
      "name": "app",
      "description": "Application using shared database",
      "repotag": "yourusername/yourapp:latest",
      "ports": [3000],
      "containerPorts": [3000],
      "domains": [""],
      "environmentParameters": [
        "DB_HOST=fluxoperator_myshareddb",
        "DB_PORT=3307",
        "DB_NAME=myapp",
        "DB_USER=root",
        "DB_PASSWORD=myRootPassword123"
      ],
      "commands": [],
      "containerData": "/appdata",
      "cpu": 2.0,
      "ram": 4000,
      "hdd": 20,
      "tiered": false
    }
  ]
}`}
          </CodeBlock>

          <div className="bg-blue-50 dark:bg-blue-900/20 border dark:border-gray-700 border-blue-200 dark:border-blue-800 rounded-lg p-4 mt-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold text-blue-900 mb-2">Critical Configuration Notes:</p>
                <ul className="text-blue-800 space-y-1">
                  <li>• <strong>DB_COMPONENT_NAME</strong>: Must match Flux internal DNS pattern <code className="bg-blue-100 px-1 rounded">flux&#123;componentname&#125;_&#123;appname&#125;</code></li>
                  <li>• <strong>DB_APPNAME</strong>: Must match your Flux app name exactly</li>
                  <li>• <strong>CLIENT_APPNAME</strong>: Identifies which app can access this database</li>
                  <li>• <strong>containerData</strong>: Use <code className="bg-blue-100 px-1 rounded">s:/</code> prefix for Syncthing replication</li>
                  <li>• <strong>Instances</strong>: Use 3+ for high availability (one master, two+ replicas)</li>
                </ul>
              </div>
            </div>
          </div>
        </StepByStep>

        {/* Step 3: Environment Variables Explained */}
        <StepByStep number={3} title="Configure Environment Variables">
          <p className="mb-4">
            Understanding the operator&apos;s environment variables is crucial for proper setup:
          </p>

          <div className="overflow-x-auto">
            <table className="w-full border dark:border-gray-700 rounded-lg overflow-hidden dark:bg-gray-800 ">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Variable</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Description</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Required</th>
                </tr>
              </thead>
              <tbody className="divide-y text-sm">
                <tr>
                  <td className="px-4 py-3 font-mono text-xs bg-purple-50 dark:bg-purple-900/20">DB_COMPONENT_NAME</td>
                  <td className="px-4 py-3">MySQL component hostname on Flux network</td>
                  <td className="px-4 py-3 text-center">✓</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-mono text-xs bg-purple-50 dark:bg-purple-900/20">DB_APPNAME</td>
                  <td className="px-4 py-3">Your Flux application name</td>
                  <td className="px-4 py-3 text-center">✓</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-mono text-xs bg-purple-50 dark:bg-purple-900/20">CLIENT_APPNAME</td>
                  <td className="px-4 py-3">Client application identifier</td>
                  <td className="px-4 py-3 text-center">✓</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-mono text-xs">DB_INIT_PASS</td>
                  <td className="px-4 py-3">Root database password (must match MySQL password)</td>
                  <td className="px-4 py-3 text-center">○</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-mono text-xs">INIT_DB_NAME</td>
                  <td className="px-4 py-3">Initial database to create on first run</td>
                  <td className="px-4 py-3 text-center">○</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-mono text-xs">DB_USER</td>
                  <td className="px-4 py-3">Authentication username (default: root)</td>
                  <td className="px-4 py-3 text-center">○</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-mono text-xs">DB_PORT</td>
                  <td className="px-4 py-3">External DB proxy port (default: 3307)</td>
                  <td className="px-4 py-3 text-center">○</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-mono text-xs">API_PORT</td>
                  <td className="px-4 py-3">External API port for management UI</td>
                  <td className="px-4 py-3 text-center">○</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-mono text-xs">WHITELIST</td>
                  <td className="px-4 py-3">Comma-separated IP whitelist for security</td>
                  <td className="px-4 py-3 text-center">○</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-mono text-xs">authMasterOnly</td>
                  <td className="px-4 py-3">Restrict authentication to master node only</td>
                  <td className="px-4 py-3 text-center">○</td>
                </tr>
              </tbody>
            </table>
          </div>
        </StepByStep>

        {/* Step 4: Deploy to Flux */}
        <StepByStep number={4} title="Deploy to Flux Network">
          <p className="mb-4">
            Deploy your shared database application to Flux:
          </p>

          <ol className="space-y-4 ml-4 mb-6">
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-600 dark:text-blue-400 flex items-center justify-center text-sm font-bold">1</span>
              <div>
                <p>Go to <a href="https://home.runonflux.io" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">home.runonflux.io</a> and login</p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-600 dark:text-blue-400 flex items-center justify-center text-sm font-bold">2</span>
              <div>
                <p>Navigate to <strong>Applications</strong> → <strong>Management</strong> → <strong>Register New App</strong></p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-600 dark:text-blue-400 flex items-center justify-center text-sm font-bold">3</span>
              <div>
                <p>Paste your JSON spec and review the configuration</p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-600 dark:text-blue-400 flex items-center justify-center text-sm font-bold">4</span>
              <div>
                <p>Review the total cost (~<LivePriceAmount cpu={4} ram={8000} hdd={40} volumePrefix="s:/" /> FLUX/month for all 3 components)</p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-600 dark:text-blue-400 flex items-center justify-center text-sm font-bold">5</span>
              <div>
                <p>Deploy and wait 10-15 minutes for cluster formation</p>
              </div>
            </li>
          </ol>

          <div className="bg-yellow-50 dark:bg-yellow-900/20 border dark:border-gray-700 border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold text-yellow-900 mb-1">Initial Cluster Formation</p>
                <p className="text-yellow-800">The first deployment may take 10-15 minutes as the operator nodes discover each other via FluxOS API and elect a master. Monitor the operator logs for &quot;Cluster formed&quot; messages.</p>
              </div>
            </div>
          </div>
        </StepByStep>

        {/* Step 5: Connect Your Application */}
        <StepByStep number={5} title="Connect Your Application to Shared DB">
          <p className="mb-4">
            Connect your application to the database through the operator proxy:
          </p>

          <CodeBlock title="app/db.js" language="javascript">
{`const mysql = require('mysql2/promise');

// Connect to Flux Shared DB operator, NOT directly to MySQL
const pool = mysql.createPool({
  host: process.env.DB_HOST,        // fluxoperator_myshareddb
  port: process.env.DB_PORT || 3307, // Operator proxy port
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Test connection
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log('✓ Connected to Flux Shared DB');

    // This query will be routed to local replica (fast!)
    const [rows] = await connection.query('SELECT 1 + 1 AS result');
    console.log('✓ Query test successful:', rows);

    connection.release();
  } catch (error) {
    console.error('✗ Database connection failed:', error);
  }
}

// Write operation (routed to master, then replicated)
async function createUser(name, email) {
  const [result] = await pool.execute(
    'INSERT INTO users (name, email) VALUES (?, ?)',
    [name, email]
  );
  return result.insertId;
}

// Read operation (routed to local replica)
async function getUsers() {
  const [rows] = await pool.query('SELECT * FROM users');
  return rows;
}

module.exports = { testConnection, createUser, getUsers };`}
          </CodeBlock>

          <div className="bg-green-50 dark:bg-green-900/20 border dark:border-gray-700 border-green-200 dark:border-green-800 rounded-lg p-4 mt-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold text-green-900 mb-2">Key Points:</p>
                <ul className="text-green-800 space-y-1">
                  <li>• Always connect to <strong>operator</strong> component, not MySQL directly</li>
                  <li>• Use port <strong>3307</strong> (operator proxy), not 3306 (MySQL)</li>
                  <li>• Read queries are fast - served from local replica</li>
                  <li>• Write queries are coordinated through master for consistency</li>
                  <li>• Connection pooling is recommended for best performance</li>
                </ul>
              </div>
            </div>
          </div>
        </StepByStep>

        {/* Step 6: Monitoring and Management */}
        <StepByStep number={6} title="Monitor Cluster Health">
          <p className="mb-4">
            Use the operator&apos;s management API to monitor cluster status:
          </p>

          <CodeBlock title="Check cluster status" language="bash">
{`# Get cluster information
curl https://myshareddb-operator-abc123.app.runonflux.io:8080/cluster

# Response shows master node and all replicas
{
  "master": "192.168.1.10:3307",
  "replicas": [
    "192.168.1.11:3307",
    "192.168.1.12:3307"
  ],
  "status": "healthy"
}`}
          </CodeBlock>

          <div className="space-y-4 mt-6">
            <div className="border dark:border-gray-700 rounded-lg p-4 dark:bg-gray-800 ">
              <h4 className="font-semibold mb-2">Cluster Operations:</h4>
              <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-200">
                <li>• <strong>Master Election:</strong> Automatic when master node fails</li>
                <li>• <strong>Node Discovery:</strong> New instances automatically join cluster</li>
                <li>• <strong>Data Sync:</strong> Replicas catch up automatically after downtime</li>
                <li>• <strong>Failover:</strong> Client connections redirect to new master seamlessly</li>
              </ul>
            </div>

            <div className="border dark:border-gray-700 rounded-lg p-4 dark:bg-gray-800 ">
              <h4 className="font-semibold mb-2">Monitoring Best Practices:</h4>
              <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-200">
                <li>• Monitor operator logs for replication lag warnings</li>
                <li>• Check cluster status API regularly for node health</li>
                <li>• Watch for master election events in logs</li>
                <li>• Monitor database size to ensure adequate storage</li>
              </ul>
            </div>
          </div>
        </StepByStep>
      </div>

      {/* Best Practices */}
      <div className="mt-12 border-t pt-8">
        <h2 className="text-2xl font-bold mb-6">Best Practices</h2>
        <div className="space-y-4">
          <div className="border dark:border-gray-700 rounded-lg p-4 dark:bg-gray-800 ">
            <h3 className="font-semibold mb-2">🔒 Security</h3>
            <ul className="text-sm space-y-1 text-gray-700 dark:text-gray-200 ml-4">
              <li>• Use strong database passwords (min 16 characters)</li>
              <li>• Consider <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">WHITELIST</code> to restrict access by IP</li>
              <li>• Enable <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">authMasterOnly</code> for stricter authentication</li>
              <li>• Never expose MySQL port 3306 directly - only use operator proxy</li>
              <li>• Use Enterprise mode if storing sensitive data</li>
            </ul>
          </div>
          <div className="border dark:border-gray-700 rounded-lg p-4 dark:bg-gray-800 ">
            <h3 className="font-semibold mb-2">⚡ Performance</h3>
            <ul className="text-sm space-y-1 text-gray-700 dark:text-gray-200 ml-4">
              <li>• Deploy at least 3 instances for optimal read distribution</li>
              <li>• Use connection pooling in your application</li>
              <li>• Batch write operations when possible to reduce master load</li>
              <li>• Monitor replication lag - scale if consistently high</li>
              <li>• Allocate sufficient RAM for MySQL query cache</li>
            </ul>
          </div>
          <div className="border dark:border-gray-700 rounded-lg p-4 dark:bg-gray-800 ">
            <h3 className="font-semibold mb-2">💾 Data Management</h3>
            <ul className="text-sm space-y-1 text-gray-700 dark:text-gray-200 ml-4">
              <li>• Always use <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">s:/</code> volume prefix for Syncthing replication</li>
              <li>• Allocate 2-3x your expected data size for growth</li>
              <li>• Implement regular backup strategy outside of Flux replication</li>
              <li>• Test restore procedures periodically</li>
              <li>• Monitor disk usage across all instances</li>
            </ul>
          </div>
          <div className="border dark:border-gray-700 rounded-lg p-4 dark:bg-gray-800 ">
            <h3 className="font-semibold mb-2">🔧 Deployment</h3>
            <ul className="text-sm space-y-1 text-gray-700 dark:text-gray-200 ml-4">
              <li>• Test with 1 instance first, then scale to 3+</li>
              <li>• Verify all environment variables before deployment</li>
              <li>• Wait for cluster formation before sending queries</li>
              <li>• Use semantic versioning for operator image updates</li>
              <li>• Keep operator and MySQL versions in sync across instances</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Troubleshooting */}
      <div className="mt-12 border-t pt-8">
        <h2 className="text-2xl font-bold mb-6">Troubleshooting</h2>
        <div className="space-y-4">
          <div className="border-l-4 border-red-400 pl-4 py-2">
            <h4 className="font-semibold mb-1">Cluster won&apos;t form / nodes can&apos;t discover each other</h4>
            <p className="text-sm text-gray-700 dark:text-gray-200 mb-2">Check that:</p>
            <ul className="text-sm text-gray-700 dark:text-gray-200 ml-4 space-y-1">
              <li>• <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">DB_APPNAME</code> exactly matches your Flux app name</li>
              <li>• All instances are in &quot;Running&quot; state on home.runonflux.io</li>
              <li>• FluxOS API is accessible from operator containers</li>
              <li>• Wait 10-15 minutes for initial cluster formation</li>
            </ul>
          </div>
          <div className="border-l-4 border-yellow-400 pl-4 py-2">
            <h4 className="font-semibold mb-1">Application can&apos;t connect to database</h4>
            <p className="text-sm text-gray-700 dark:text-gray-200 mb-2">Verify:</p>
            <ul className="text-sm text-gray-700 dark:text-gray-200 ml-4 space-y-1">
              <li>• Using operator hostname: <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">fluxoperator_&#123;appname&#125;</code></li>
              <li>• Using port <strong>3307</strong>, not 3306</li>
              <li>• <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">DB_INIT_PASS</code> matches MySQL root password</li>
              <li>• Database name exists (check <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">INIT_DB_NAME</code>)</li>
            </ul>
          </div>
          <div className="border-l-4 border-yellow-400 pl-4 py-2">
            <h4 className="font-semibold mb-1">Replication lag is high</h4>
            <p className="text-sm text-gray-700 dark:text-gray-200">Increase operator CPU/RAM allocation, or reduce write frequency. Consider scaling to more instances to distribute read load.</p>
          </div>
          <div className="border-l-4 border-yellow-400 pl-4 py-2">
            <h4 className="font-semibold mb-1">Data not persisting after restart</h4>
            <p className="text-sm text-gray-700 dark:text-gray-200">Ensure MySQL <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">containerData</code> uses <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">s:/var/lib/mysql</code> and operator uses <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">s:/app/dumps</code>. Check storage allocation is sufficient.</p>
          </div>
        </div>
      </div>

      {/* Current Limitations */}
      <div className="mt-12 border-t pt-8">
        <h2 className="text-2xl font-bold mb-6">Current Limitations & Roadmap</h2>
        <div className="bg-blue-50 dark:bg-blue-900/20 border dark:border-gray-700 border-blue-200 dark:border-blue-800 rounded-lg p-6">
          <h3 className="font-semibold mb-3">Supported:</h3>
          <ul className="space-y-1 text-sm text-blue-900 mb-4">
            <li>✓ MySQL 5.7 and 8.0 (full support)</li>
            <li>✓ Master-replica replication</li>
            <li>✓ Automatic cluster formation</li>
            <li>✓ Read/write query routing</li>
          </ul>
          <h3 className="font-semibold mb-3">Coming Soon:</h3>
          <ul className="space-y-1 text-sm text-gray-700 dark:text-gray-200">
            <li>○ PostgreSQL support</li>
            <li>○ MongoDB support</li>
            <li>○ Enhanced date/time function handling</li>
            <li>○ Multi-master configurations</li>
          </ul>
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
            <h3 className="text-lg font-semibold mb-2 group-hover:text-blue-600 dark:text-blue-400">Calculate Exact Costs →</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">Use the interactive playground to calculate precise costs for your database configuration</p>
          </a>
          <a
            href="/reference/flux-spec"
            className="block p-6 border dark:border-gray-700 rounded-lg hover:shadow-lg transition-shadow group dark:bg-gray-800 "
          >
            <h3 className="text-lg font-semibold mb-2 group-hover:text-blue-600 dark:text-blue-400">Flux Spec Reference →</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">Deep dive into volume prefixes, networking, and advanced configuration options</p>
          </a>
        </div>
      </div>
    </div>
  )
}
