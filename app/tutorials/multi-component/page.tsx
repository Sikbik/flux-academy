import { StepByStep } from '@/components/tutorial/StepByStep'
import { CommandBox } from '@/components/tutorial/CommandBox'
import { CodeBlock } from '@/components/tutorial/CodeBlock'
import { ChecklistItem } from '@/components/tutorial/ChecklistItem'
import { AlertCircle, CheckCircle2, Network } from 'lucide-react'
import { LivePriceAmount } from '@/components/tutorial/LivePriceAmount'

export default function MultiComponentPage() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-4">Multi-Component Applications</h1>
        <p className="text-xl text-gray-600 dark:text-gray-300">
          Learn how to deploy applications with multiple interconnected services using Flux&apos;s internal DNS system
        </p>
      </div>

      {/* Learning Objectives */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border dark:border-gray-700 border-blue-200 dark:border-blue-800 rounded-lg p-6 mb-8">
        <h2 className="text-xl font-semibold mb-3">What You&apos;ll Learn</h2>
        <ul className="space-y-2">
          <ChecklistItem checked>Deploy multi-component applications</ChecklistItem>
          <ChecklistItem checked>Configure component-to-component communication</ChecklistItem>
          <ChecklistItem checked>Use Flux internal DNS patterns</ChecklistItem>
          <ChecklistItem checked>Manage environment variables across components</ChecklistItem>
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
              <li>✓ Understand Docker networking basics</li>
              <li>✓ Familiar with environment variables</li>
              <li>✓ Have FLUX tokens (~<LivePriceAmount cpu={2.5} ram={5000} hdd={35} enterprisePorts={1} /> FLUX for this tutorial)</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Internal DNS Explanation */}
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/30 dark:to-blue-900/30 border dark:border-gray-700 rounded-lg p-6 mb-8 ">
        <div className="flex items-start gap-3 mb-4">
          <Network className="h-6 w-6 text-purple-600 dark:text-purple-400 flex-shrink-0 mt-1" />
          <div>
            <h2 className="text-xl font-semibold mb-2">Understanding Flux Internal DNS</h2>
            <p className="text-gray-700 dark:text-gray-200 mb-4">
              When you deploy a multi-component app on Flux, each component can communicate with others using a special internal DNS pattern:
            </p>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 font-mono text-sm mb-4">
              flux&#123;componentname&#125;_&#123;appname&#125;
            </div>
            <p className="text-gray-700 dark:text-gray-200 mb-2"><strong>Example:</strong> For an app named &quot;mystack&quot; with components:</p>
            <ul className="space-y-1 text-sm text-gray-700 dark:text-gray-200 ml-4">
              <li>• <code className="bg-white dark:bg-gray-800 px-2 py-1 rounded">database</code> → accessible at <code className="bg-white dark:bg-gray-800 px-2 py-1 rounded">fluxdatabase_mystack:5432</code></li>
              <li>• <code className="bg-white dark:bg-gray-800 px-2 py-1 rounded">api</code> → accessible at <code className="bg-white dark:bg-gray-800 px-2 py-1 rounded">fluxapi_mystack:3000</code></li>
              <li>• <code className="bg-white dark:bg-gray-800 px-2 py-1 rounded">frontend</code> → accessible at <code className="bg-white dark:bg-gray-800 px-2 py-1 rounded">fluxfrontend_mystack:8080</code></li>
            </ul>
          </div>
        </div>
      </div>

      {/* Tutorial Steps */}
      <div className="space-y-8">
        {/* Step 1: Plan Your Architecture */}
        <StepByStep number={1} title="Plan Your Multi-Component Architecture">
          <p className="mb-4">
            Let&apos;s build a simple web application stack with three components:
          </p>

          <div className="grid md:grid-cols-3 gap-4 mb-6">
            <div className="border dark:border-gray-700 rounded-lg p-4 bg-blue-50 dark:bg-blue-900/20 dark:bg-gray-800 ">
              <h4 className="font-semibold mb-2">PostgreSQL Database</h4>
              <p className="text-sm text-gray-700 dark:text-gray-200">Stores application data</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Port: 5432</p>
            </div>
            <div className="border dark:border-gray-700 rounded-lg p-4 bg-green-50 dark:bg-green-900/20 dark:bg-gray-800 ">
              <h4 className="font-semibold mb-2">Node.js API</h4>
              <p className="text-sm text-gray-700 dark:text-gray-200">Backend REST API</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Port: 3000</p>
            </div>
            <div className="border dark:border-gray-700 rounded-lg p-4 bg-purple-50 dark:bg-purple-900/20 dark:bg-gray-800 ">
              <h4 className="font-semibold mb-2">React Frontend</h4>
              <p className="text-sm text-gray-700 dark:text-gray-200">User interface</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Port: 8080</p>
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-4 dark:bg-gray-800 ">
            <p className="text-sm font-semibold mb-2">Communication Flow:</p>
            <div className="text-sm text-gray-700 dark:text-gray-200 font-mono">
              Frontend (8080) → API (3000) → Database (5432)
            </div>
          </div>
        </StepByStep>

        {/* Step 2: Create API Component */}
        <StepByStep number={2} title="Create the API Component">
          <p className="mb-4">
            Create a Node.js API that connects to PostgreSQL:
          </p>

          <CodeBlock title="api/server.js" language="javascript">
{`const express = require('express');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

// Database connection using Flux internal DNS
const pool = new Pool({
  host: process.env.DB_HOST,
  port: 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

app.use(express.json());

// Health check
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'healthy', database: 'connected' });
  } catch (error) {
    res.status(500).json({ status: 'unhealthy', error: error.message });
  }
});

// Get all items
app.get('/api/items', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM items ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create item
app.post('/api/items', async (req, res) => {
  try {
    const { name, description } = req.body;
    const result = await pool.query(
      'INSERT INTO items (name, description) VALUES ($1, $2) RETURNING *',
      [name, description]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(\`API server running on port \${PORT}\`);
  console.log(\`Database host: \${process.env.DB_HOST}\`);
});`}
          </CodeBlock>

          <CommandBox title="Build and push API image">
{`docker build -t yourusername/mystack-api:latest ./api
docker push yourusername/mystack-api:latest`}
          </CommandBox>
        </StepByStep>

        {/* Step 3: Create Frontend Component */}
        <StepByStep number={3} title="Create the Frontend Component">
          <p className="mb-4">
            Create a simple React frontend that calls the API:
          </p>

          <CodeBlock title="frontend/src/App.jsx" language="javascript">
{`import { useState, useEffect } from 'react';

function App() {
  const [items, setItems] = useState([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  // API URL from environment variable
  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    try {
      const response = await fetch(\`\${API_URL}/api/items\`);
      const data = await response.json();
      setItems(data);
    } catch (error) {
      console.error('Error fetching items:', error);
    }
  };

  const addItem = async (e) => {
    e.preventDefault();
    try {
      await fetch(\`\${API_URL}/api/items\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description }),
      });
      setName('');
      setDescription('');
      fetchItems();
    } catch (error) {
      console.error('Error adding item:', error);
    }
  };

  return (
    <div className="App">
      <h1>My Flux App</h1>
      <form onSubmit={addItem}>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name"
          required
        />
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description"
        />
        <button type="submit">Add Item</button>
      </form>
      <ul>
        {items.map((item) => (
          <li key={item.id}>
            <strong>{item.name}</strong>: {item.description}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default App;`}
          </CodeBlock>

          <CommandBox title="Build and push frontend image">
{`docker build -t yourusername/mystack-frontend:latest ./frontend
docker push yourusername/mystack-frontend:latest`}
          </CommandBox>
        </StepByStep>

        {/* Step 4: Create Deployment Spec */}
        <StepByStep number={4} title="Create Multi-Component Deployment Spec">
          <p className="mb-4">
            Now create a deployment spec that ties all three components together:
          </p>

          <CodeBlock title="flux-spec.json" language="json" downloadable filename="multicomponent-spec.json">
{`{
  "version": 8,
  "name": "mystack",
  "description": "Multi-component web application stack",
  "owner": "YOUR_ZELID_HERE",
  "instances": 3,
  "staticip": false,
  "enterprise": "",
  "compose": [
    {
      "name": "database",
      "description": "PostgreSQL database",
      "repotag": "postgres:16-alpine",
      "ports": [5432],
      "containerPorts": [5432],
      "domains": [""],
      "environmentParameters": [
        "POSTGRES_DB=myapp",
        "POSTGRES_USER=myuser",
        "POSTGRES_PASSWORD=mypassword"
      ],
      "commands": [],
      "containerData": "/var/lib/postgresql/data",
      "cpu": 1.0,
      "ram": 2000,
      "hdd": 20,
      "tiered": false
    },
    {
      "name": "api",
      "description": "Node.js API server",
      "repotag": "yourusername/mystack-api:latest",
      "ports": [3000],
      "containerPorts": [3000],
      "domains": [""],
      "environmentParameters": [
        "PORT=3000",
        "DB_HOST=fluxdatabase_mystack",
        "DB_NAME=myapp",
        "DB_USER=myuser",
        "DB_PASSWORD=mypassword"
      ],
      "commands": [],
      "containerData": "/appdata",
      "cpu": 1.0,
      "ram": 2000,
      "hdd": 10,
      "tiered": false
    },
    {
      "name": "frontend",
      "description": "React frontend",
      "repotag": "yourusername/mystack-frontend:latest",
      "ports": [8080],
      "containerPorts": [8080],
      "domains": [""],
      "environmentParameters": [
        "REACT_APP_API_URL=http://fluxapi_mystack:3000"
      ],
      "commands": [],
      "containerData": "/appdata",
      "cpu": 0.5,
      "ram": 1000,
      "hdd": 5,
      "tiered": false
    }
  ]
}`}
          </CodeBlock>

          <div className="bg-green-50 dark:bg-green-900/20 border dark:border-gray-700 border-green-200 dark:border-green-800 rounded-lg p-4 mt-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold text-green-900 mb-1">Key Points</p>
                <ul className="text-green-800 space-y-1">
                  <li>• API connects to database using <code className="bg-green-100 px-1 rounded">fluxdatabase_mystack</code></li>
                  <li>• Frontend connects to API using <code className="bg-green-100 px-1 rounded">fluxapi_mystack:3000</code></li>
                  <li>• All components share the same app name: <code className="bg-green-100 px-1 rounded">mystack</code></li>
                  <li>• Database gets persistent storage for data survival</li>
                </ul>
              </div>
            </div>
          </div>
        </StepByStep>

        {/* Step 5: Deploy and Verify */}
        <StepByStep number={5} title="Deploy and Verify Communication">
          <p className="mb-4">
            Deploy your multi-component stack to Flux:
          </p>

          <ol className="space-y-4 ml-4 mb-6">
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-600 dark:text-blue-400 flex items-center justify-center text-sm font-bold">1</span>
              <div>
                <p>Go to <a href="https://home.runonflux.io" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">home.runonflux.io</a> and paste your spec</p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-600 dark:text-blue-400 flex items-center justify-center text-sm font-bold">2</span>
              <div>
                <p>Review the total cost (~<LivePriceAmount cpu={2.5} ram={5000} hdd={35} enterprisePorts={1} /> FLUX/month for all 3 components)</p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-600 dark:text-blue-400 flex items-center justify-center text-sm font-bold">3</span>
              <div>
                <p>Deploy and wait 5-10 minutes for all components to start</p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-600 dark:text-blue-400 flex items-center justify-center text-sm font-bold">4</span>
              <div>
                <p>Test API health to verify database connection:</p>
                <div className="bg-gray-100 dark:bg-gray-700 rounded p-2 font-mono text-sm mt-2">
                  curl https://mystack-api-abc123.app.runonflux.io/health
                </div>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-600 dark:text-blue-400 flex items-center justify-center text-sm font-bold">5</span>
              <div>
                <p>Access frontend and verify it can communicate with API</p>
              </div>
            </li>
          </ol>

          <div className="bg-blue-50 dark:bg-blue-900/20 border dark:border-gray-700 border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="text-sm font-semibold mb-2">Troubleshooting Component Communication:</p>
            <ul className="text-sm space-y-1 text-gray-700 dark:text-gray-200">
              <li>• Make sure component names in spec match the DNS pattern</li>
              <li>• Check environment variables are set correctly</li>
              <li>• Verify all components are in &quot;Running&quot; state</li>
              <li>• Look at container logs for connection errors</li>
            </ul>
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
              <li>• Don&apos;t expose database ports publicly (Flux handles this automatically)</li>
              <li>• Use strong passwords for databases</li>
              <li>• Consider using Enterprise mode for private images with secrets</li>
            </ul>
          </div>
          <div className="border dark:border-gray-700 rounded-lg p-4 dark:bg-gray-800 ">
            <h3 className="font-semibold mb-2">💾 Data Persistence</h3>
            <ul className="text-sm space-y-1 text-gray-700 dark:text-gray-200 ml-4">
              <li>• Always set <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">containerData</code> for databases</li>
              <li>• Allocate sufficient HDD space for data growth</li>
              <li>• Test backups before going to production</li>
            </ul>
          </div>
          <div className="border dark:border-gray-700 rounded-lg p-4 dark:bg-gray-800 ">
            <h3 className="font-semibold mb-2">⚡ Performance</h3>
            <ul className="text-sm space-y-1 text-gray-700 dark:text-gray-200 ml-4">
              <li>• Start components in order: database → backend → frontend</li>
              <li>• Add health check endpoints to all components</li>
              <li>• Monitor resource usage and scale appropriately</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Next Steps */}
      <div className="mt-12 border-t pt-8">
        <h2 className="text-2xl font-bold mb-6">Next Steps</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <a
            href="/tutorials/minecraft-server"
            className="block p-6 border dark:border-gray-700 rounded-lg hover:shadow-lg transition-shadow group dark:bg-gray-800 "
          >
            <h3 className="text-lg font-semibold mb-2 group-hover:text-blue-600 dark:text-blue-400">FluxIndexer Tutorial →</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">Real-world example with PostgreSQL, indexer, and explorer</p>
          </a>
          <a
            href="/reference/networking"
            className="block p-6 border dark:border-gray-700 rounded-lg hover:shadow-lg transition-shadow group dark:bg-gray-800 "
          >
            <h3 className="text-lg font-semibold mb-2 group-hover:text-blue-600 dark:text-blue-400">Networking Reference →</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">Deep dive into Flux networking patterns</p>
          </a>
        </div>
      </div>
    </div>
  )
}
