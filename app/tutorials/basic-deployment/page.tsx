'use client'

import { StepByStep } from '@/components/tutorial/StepByStep'
import { CommandBox } from '@/components/tutorial/CommandBox'
import { CodeBlock } from '@/components/tutorial/CodeBlock'
import { ChecklistItem } from '@/components/tutorial/ChecklistItem'
import { TutorialProgress } from '@/components/tutorial/TutorialProgress'
import { AlertCircle, CheckCircle2 } from 'lucide-react'
import { LivePriceAmount } from '@/components/tutorial/LivePriceAmount'

export default function BasicDeploymentPage() {
  return (
    <div className="container mx-auto px-4 py-6 sm:py-12 max-w-4xl">
      <div className="mb-6 sm:mb-8">
        <div className="flex flex-col sm:flex-row items-start justify-between mb-4 gap-3">
          <div className="flex-1">
            <h1 className="text-2xl sm:text-4xl font-bold mb-2">Deploy Your First App</h1>
            <p className="text-base sm:text-xl text-gray-600 dark:text-gray-300">
              Learn how to deploy a simple single-container application to Flux in under 30 minutes
            </p>
          </div>
          <div className="self-start sm:self-auto">
            <TutorialProgress tutorialId="basic-deployment" />
          </div>
        </div>
      </div>

      {/* Learning Objectives */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border dark:border-gray-700 border-blue-200 dark:border-blue-800 rounded-lg p-4 sm:p-6 mb-6 sm:mb-8">
        <h2 className="text-lg sm:text-xl font-semibold mb-3">What You&apos;ll Learn</h2>
        <ul className="space-y-2">
          <ChecklistItem checked>Deploy a single-container application</ChecklistItem>
          <ChecklistItem checked>Understand Flux deployment specifications</ChecklistItem>
          <ChecklistItem checked>Monitor deployment status</ChecklistItem>
          <ChecklistItem checked>Access your deployed application</ChecklistItem>
        </ul>
      </div>

      {/* Prerequisites */}
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border dark:border-gray-700 border-yellow-200 dark:border-yellow-800 rounded-lg p-4 sm:p-6 mb-6 sm:mb-8">
        <div className="flex items-start gap-2 sm:gap-3">
          <AlertCircle className="h-5 w-5 sm:h-6 sm:w-6 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-1" />
          <div>
            <h2 className="text-lg sm:text-xl font-semibold mb-3">Before You Start</h2>
            <ul className="space-y-1 text-xs sm:text-sm">
              <li>✓ Docker installed and running</li>
              <li>✓ Docker Hub account created</li>
              <li>✓ Zelcore wallet with FLUX tokens (~<LivePriceAmount cpu={1} ram={2000} hdd={5} /> FLUX for this tutorial)</li>
              <li>✓ Basic understanding of Docker</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Tutorial Steps */}
      <div className="space-y-6 sm:space-y-8">
        {/* Step 1: Create Simple App */}
        <StepByStep number={1} title="Create a Simple Application">
          <p className="mb-4">
            Let&apos;s start with a simple Node.js web application. Create a new directory and add these files:
          </p>

          <CodeBlock title="package.json" language="json">
{`{
  "name": "hello-flux",
  "version": "1.0.0",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "express": "^4.18.0"
  }
}`}
          </CodeBlock>

          <CodeBlock title="server.js" language="javascript">
{`const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('<h1>Hello from Flux!</h1><p>This app is running on Flux decentralized cloud.</p>');
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(\`Server running on port \${PORT}\`);
});`}
          </CodeBlock>

          <CodeBlock title="Dockerfile" language="dockerfile">
{`FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY server.js ./

EXPOSE 3000

CMD ["npm", "start"]`}
          </CodeBlock>
        </StepByStep>

        {/* Step 2: Build and Push Docker Image */}
        <StepByStep number={2} title="Build and Push Docker Image">
          <p className="mb-4">
            Build your Docker image and push it to Docker Hub. Replace <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">yourusername</code> with your Docker Hub username:
          </p>

          <CommandBox title="Build the image">
{`docker build -t yourusername/hello-flux:latest .`}
          </CommandBox>

          <CommandBox title="Login to Docker Hub">
{`docker login`}
          </CommandBox>

          <CommandBox title="Push the image">
{`docker push yourusername/hello-flux:latest`}
          </CommandBox>

          <div className="bg-green-50 dark:bg-green-900/20 border dark:border-gray-700 border-green-200 dark:border-green-800 rounded-lg p-4 mt-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold text-green-900 mb-1">Pro Tip</p>
                <p className="text-green-800">Make sure your image is public on Docker Hub so Flux nodes can pull it.</p>
              </div>
            </div>
          </div>
        </StepByStep>

        {/* Step 3: Create Deployment Spec */}
        <StepByStep number={3} title="Create Deployment Specification">
          <p className="mb-4">
            Create a <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">flux-spec.json</code> file with your deployment configuration:
          </p>

          <CodeBlock title="flux-spec.json" language="json" downloadable filename="flux-spec.json">
{`{
  "version": 8,
  "name": "helloflux",
  "description": "My first Flux deployment",
  "owner": "YOUR_ZELID_HERE",
  "instances": 3,
  "staticip": false,
  "enterprise": "",
  "compose": [
    {
      "name": "hello",
      "description": "Simple Node.js web server",
      "repotag": "yourusername/hello-flux:latest",
      "ports": [3000],
      "containerPorts": [3000],
      "domains": [""],
      "environmentParameters": [
        "NODE_ENV=production",
        "PORT=3000"
      ],
      "commands": [],
      "containerData": "/appdata",
      "cpu": 1.0,
      "ram": 2000,
      "hdd": 5,
      "tiered": false
    }
  ]
}`}
          </CodeBlock>

          <div className="bg-blue-50 dark:bg-blue-900/20 border dark:border-gray-700 border-blue-200 dark:border-blue-800 rounded-lg p-4 mt-4">
            <p className="text-sm font-semibold mb-2">Understanding the Spec (Version 8)</p>
            <ul className="text-sm space-y-1 text-gray-700 dark:text-gray-200">
              <li>• <strong>version:</strong> Spec version (use 8 for latest features)</li>
              <li>• <strong>name:</strong> App name (alphanumeric only, no hyphens or spaces)</li>
              <li>• <strong>instances:</strong> Number of redundant copies (minimum 3)</li>
              <li>• <strong>staticip:</strong> Require static IP nodes (costs extra $2/month)</li>
              <li>• <strong>enterprise:</strong> Enable enterprise features ("enabled" or "")</li>
              <li>• <strong>ports:</strong> Array of external ports (valid range: 0-65535)</li>
              <li>• <strong>containerPorts:</strong> Array of ports your app listens on (valid range: 0-65535)</li>
              <li>• <strong>domains:</strong> Array of custom domains (leave empty for Flux default)</li>
              <li>• <strong>containerData:</strong> Persistent data volume path</li>
              <li>• <strong>cpu:</strong> Number of CPU cores (1.0 = 1 core)</li>
              <li>• <strong>ram:</strong> Memory in MB (2000 = 2GB)</li>
              <li>• <strong>hdd:</strong> Disk space in GB</li>
            </ul>
          </div>
        </StepByStep>

        {/* Step 4: Deploy to Flux */}
        <StepByStep number={4} title="Deploy to Flux">
          <p className="mb-4">
            Now it&apos;s time to deploy! Go to the Flux web interface:
          </p>

          <ol className="space-y-4 ml-4">
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-600 dark:text-blue-400 flex items-center justify-center text-sm font-bold">1</span>
              <div>
                <p>Navigate to <a href="https://home.runonflux.io" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">https://home.runonflux.io</a></p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-600 dark:text-blue-400 flex items-center justify-center text-sm font-bold">2</span>
              <div>
                <p>Login with Zelcore wallet</p>
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
                <p>Fill in the form using values from your <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">flux-spec.json</code></p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-600 dark:text-blue-400 flex items-center justify-center text-sm font-bold">5</span>
              <div>
                <p>Review the estimated cost (should be ~<LivePriceAmount cpu={1} ram={2000} hdd={5} /> FLUX/month)</p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-600 dark:text-blue-400 flex items-center justify-center text-sm font-bold">6</span>
              <div>
                <p>Click <strong>&quot;Deploy App&quot;</strong> and approve the transaction in Zelcore</p>
              </div>
            </li>
          </ol>
        </StepByStep>

        {/* Step 5: Monitor Deployment */}
        <StepByStep number={5} title="Monitor Your Deployment">
          <p className="mb-4">
            After deploying, monitor your application&apos;s status:
          </p>

          <div className="space-y-4">
            <div className="border dark:border-gray-700 rounded-lg p-4 dark:bg-gray-800 ">
              <h4 className="font-semibold mb-2">Deployment Stages</h4>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-yellow-50 dark:bg-yellow-900/200"></span>
                  <strong>Pending:</strong> Waiting for nodes to accept deployment
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-50 dark:bg-blue-900/200"></span>
                  <strong>Starting:</strong> Nodes are pulling your Docker image
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-50 dark:bg-green-900/200"></span>
                  <strong>Running:</strong> App is live and accessible!
                </li>
              </ul>
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-300">
              This typically takes 5-10 minutes. You&apos;ll receive a URL like:
            </p>
            <div className="bg-gray-100 dark:bg-gray-700 rounded p-3 font-mono text-sm">
              https://hello-flux-abc123.app.runonflux.io
            </div>
          </div>
        </StepByStep>

        {/* Step 6: Access Application */}
        <StepByStep number={6} title="Access Your Application">
          <p className="mb-4">
            Once your app is running, you can access it through the Flux-provided URL. Test these endpoints:
          </p>

          <CommandBox title="Test the home page">
{`curl https://your-app-url.app.runonflux.io`}
          </CommandBox>

          <CommandBox title="Test the health endpoint">
{`curl https://your-app-url.app.runonflux.io/health`}
          </CommandBox>

          <div className="bg-green-50 dark:bg-green-900/20 border dark:border-gray-700 border-green-200 dark:border-green-800 rounded-lg p-6 mt-6">
            <div className="flex items-center gap-3 mb-3">
              <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
              <h3 className="text-lg font-semibold text-green-900">Congratulations!</h3>
            </div>
            <p className="text-green-800">
              You&apos;ve successfully deployed your first application to Flux&apos;s decentralized cloud network!
            </p>
          </div>
        </StepByStep>
      </div>

      {/* Next Steps */}
      <div className="mt-8 sm:mt-12 border-t pt-6 sm:pt-8">
        <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">Next Steps</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <a
            href="/tutorials/minecraft-server"
            className="block p-4 sm:p-6 border dark:border-gray-700 rounded-lg hover:shadow-lg transition-shadow group dark:bg-gray-800 "
          >
            <h3 className="text-base sm:text-lg font-semibold mb-2 group-hover:text-blue-600 dark:text-blue-400">Minecraft Server Tutorial →</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">Deploy a game server with persistent storage and volume prefixes</p>
          </a>
          <a
            href="/playground"
            className="block p-4 sm:p-6 border dark:border-gray-700 rounded-lg hover:shadow-lg transition-shadow group dark:bg-gray-800 "
          >
            <h3 className="text-base sm:text-lg font-semibold mb-2 group-hover:text-blue-600 dark:text-blue-400">Try the Playground →</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">Build complex deployment specs visually</p>
          </a>
        </div>
      </div>
    </div>
  )
}
