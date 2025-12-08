import { StepByStep } from '@/components/tutorial/StepByStep'
import { CodeBlock } from '@/components/tutorial/CodeBlock'
import { ChecklistItem } from '@/components/tutorial/ChecklistItem'
import { AlertCircle, CheckCircle2, Globe, Lock, Zap } from 'lucide-react'

export default function CustomDomainTutorial() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <Globe className="h-10 w-10 text-blue-600 dark:text-blue-400" />
          <h1 className="text-4xl font-bold">Custom Domains & SSL Certificates</h1>
        </div>
        <p className="text-xl text-gray-600 dark:text-gray-300">
          Configure your own domain name with automatic SSL/TLS encryption for your Flux deployments using CloudFlare
        </p>
      </div>

      {/* Why Use Custom Domains */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/30 dark:to-purple-900/30 border dark:border-gray-700 rounded-lg p-6 mb-8 dark:bg-gray-800 ">
        <h2 className="text-xl font-semibold mb-4">Why Use a Custom Domain?</h2>
        <div className="grid md:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border">
            <Globe className="h-8 w-8 text-blue-600 dark:text-blue-400 mb-2" />
            <h3 className="font-semibold mb-1">Professional Branding</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">Use yourapp.com instead of appname.app.runonflux.io</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border">
            <Lock className="h-8 w-8 text-green-600 dark:text-green-400 mb-2" />
            <h3 className="font-semibold mb-1">Free SSL/TLS</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">Automatic HTTPS encryption via CloudFlare</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border">
            <Zap className="h-8 w-8 text-purple-600 dark:text-purple-400 mb-2" />
            <h3 className="font-semibold mb-1">CDN & Security</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">CloudFlare provides caching, DDoS protection, and more</p>
          </div>
        </div>
      </div>

      {/* Learning Objectives */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border dark:border-gray-700 border-blue-200 dark:border-blue-800 rounded-lg p-6 mb-8">
        <h2 className="text-xl font-semibold mb-3">What You&apos;ll Learn</h2>
        <ul className="space-y-2">
          <ChecklistItem checked>Set up CloudFlare for your domain</ChecklistItem>
          <ChecklistItem checked>Configure CNAME records to point to your Flux app</ChecklistItem>
          <ChecklistItem checked>Enable automatic SSL/TLS encryption</ChecklistItem>
          <ChecklistItem checked>Use subdomains or root domains with Flux</ChecklistItem>
        </ul>
      </div>

      {/* Prerequisites */}
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border dark:border-gray-700 border-yellow-200 dark:border-yellow-800 rounded-lg p-6 mb-8">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-6 w-6 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-1" />
          <div>
            <h2 className="text-xl font-semibold mb-3">Before You Start</h2>
            <ul className="space-y-1 text-sm">
              <li>✓ A domain name (from GoDaddy, Namecheap, Google Domains, etc.)</li>
              <li>✓ A deployed Flux application with its Flux domain name</li>
              <li>✓ Access to your domain registrar&apos;s control panel</li>
              <li>✓ Completed the Basic Deployment tutorial</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Tutorial Steps */}
      <div className="space-y-8">
        {/* Step 1: Understanding the Setup */}
        <StepByStep number={1} title="Understanding the CloudFlare Setup">
          <p className="mb-4">
            In this setup, CloudFlare acts as a secure middleman between your domain registrar and the Flux network:
          </p>

          <div className="bg-gray-50 dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-4 mb-4 dark:bg-gray-800 ">
            <div className="font-mono text-sm space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-gray-600 dark:text-gray-300">User visits:</span>
                <span className="font-semibold text-blue-600 dark:text-blue-400">yourapp.yourdomain.com</span>
              </div>
              <div className="flex items-center gap-2 ml-4">
                <span className="text-gray-400 dark:text-gray-500">↓</span>
              </div>
              <div className="flex items-center gap-2 ml-4">
                <span className="text-gray-600 dark:text-gray-300">DNS lookup via:</span>
                <span className="font-semibold text-purple-600 dark:text-purple-400">CloudFlare</span>
              </div>
              <div className="flex items-center gap-2 ml-4">
                <span className="text-gray-400 dark:text-gray-500">↓</span>
              </div>
              <div className="flex items-center gap-2 ml-4">
                <span className="text-gray-600 dark:text-gray-300">Forwards to:</span>
                <span className="font-semibold text-green-600 dark:text-green-400">yourapp-abc123.app.runonflux.io</span>
              </div>
              <div className="flex items-center gap-2 ml-4">
                <span className="text-gray-400 dark:text-gray-500">↓</span>
              </div>
              <div className="flex items-center gap-2 ml-4">
                <span className="text-gray-600 dark:text-gray-300">Served by:</span>
                <span className="font-semibold">Flux Network</span>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="border dark:border-gray-700 rounded-lg p-4 bg-blue-50 dark:bg-blue-900/20 dark:bg-gray-800 ">
              <h4 className="font-semibold mb-2 text-blue-900">Root Domain</h4>
              <p className="text-sm text-blue-800 mb-2">yourdomain.com</p>
              <p className="text-xs text-blue-700">Can point to your existing website on another host (GoDaddy, etc.)</p>
            </div>
            <div className="border dark:border-gray-700 rounded-lg p-4 bg-green-50 dark:bg-green-900/20 dark:bg-gray-800 ">
              <h4 className="font-semibold mb-2 text-green-900">Subdomain</h4>
              <p className="text-sm text-green-800 mb-2">app.yourdomain.com</p>
              <p className="text-xs text-green-700">Points to your Flux dApp via CloudFlare CNAME</p>
            </div>
          </div>
        </StepByStep>

        {/* Step 2: Create CloudFlare Account */}
        <StepByStep number={2} title="Create a Free CloudFlare Account">
          <p className="mb-4">
            CloudFlare provides free DNS management, SSL/TLS certificates, and CDN services.
          </p>

          <ol className="space-y-4 ml-4 mb-6">
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-600 dark:text-blue-400 flex items-center justify-center text-sm font-bold">1</span>
              <div>
                <p>Go to <a href="https://cloudflare.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">cloudflare.com</a> and click <strong>Sign Up</strong></p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-600 dark:text-blue-400 flex items-center justify-center text-sm font-bold">2</span>
              <div>
                <p>Create your account with email and password</p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-600 dark:text-blue-400 flex items-center justify-center text-sm font-bold">3</span>
              <div>
                <p>Verify your email address</p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-600 dark:text-blue-400 flex items-center justify-center text-sm font-bold">4</span>
              <div>
                <p>Select the <strong>Free Plan</strong> (perfect for most Flux apps)</p>
              </div>
            </li>
          </ol>

          <div className="bg-green-50 dark:bg-green-900/20 border dark:border-gray-700 border-green-200 dark:border-green-800 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold text-green-900 mb-1">CloudFlare Free Plan Includes:</p>
                <ul className="text-green-800 space-y-1">
                  <li>• Unlimited DNS queries</li>
                  <li>• Free SSL/TLS certificates (automatic HTTPS)</li>
                  <li>• Basic DDoS protection</li>
                  <li>• Global CDN for faster loading</li>
                  <li>• Web Application Firewall (WAF)</li>
                </ul>
              </div>
            </div>
          </div>
        </StepByStep>

        {/* Step 3: Add Your Domain to CloudFlare */}
        <StepByStep number={3} title="Add Your Domain to CloudFlare">
          <p className="mb-4">
            CloudFlare will automatically import your existing DNS settings from your current host.
          </p>

          <ol className="space-y-4 ml-4 mb-6">
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-600 dark:text-blue-400 flex items-center justify-center text-sm font-bold">1</span>
              <div>
                <p>Click <strong>&quot;Add a Site&quot;</strong> in your CloudFlare dashboard</p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-600 dark:text-blue-400 flex items-center justify-center text-sm font-bold">2</span>
              <div>
                <p>Enter your domain name (e.g., <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">yourdomain.com</code>)</p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-600 dark:text-blue-400 flex items-center justify-center text-sm font-bold">3</span>
              <div>
                <p>Select the <strong>Free Plan</strong></p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-600 dark:text-blue-400 flex items-center justify-center text-sm font-bold">4</span>
              <div>
                <p>CloudFlare will scan and import your existing DNS records</p>
                <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">Review all imported records to ensure they&apos;re correct (A records, MX records, etc.)</p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-600 dark:text-blue-400 flex items-center justify-center text-sm font-bold">5</span>
              <div>
                <p>Click <strong>Continue</strong></p>
              </div>
            </li>
          </ol>

          <div className="bg-yellow-50 dark:bg-yellow-900/20 border dark:border-gray-700 border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold text-yellow-900 mb-1">Important:</p>
                <p className="text-yellow-800">Double-check all DNS entries were imported correctly. Missing records could break email, subdomains, or other services.</p>
              </div>
            </div>
          </div>
        </StepByStep>

        {/* Step 4: Update Nameservers */}
        <StepByStep number={4} title="Update Nameservers at Your Domain Registrar">
          <p className="mb-4">
            CloudFlare will provide you with custom nameservers that you need to set at your domain registrar.
          </p>

          <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-4 mb-4 dark:bg-gray-800 ">
            <h4 className="font-semibold mb-3">CloudFlare will assign nameservers like:</h4>
            <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm">
              <div>nick.ns.cloudflare.com</div>
              <div>tina.ns.cloudflare.com</div>
            </div>
          </div>

          <div className="mb-6">
            <h4 className="font-semibold mb-3">Steps to update nameservers:</h4>
            <ol className="space-y-3 ml-4 text-sm">
              <li>1. Log into your domain registrar (GoDaddy, Namecheap, Google Domains, etc.)</li>
              <li>2. Find the DNS or Nameserver settings for your domain</li>
              <li>3. Replace the existing nameservers with CloudFlare&apos;s nameservers</li>
              <li>4. Save the changes</li>
              <li>5. Wait for propagation (can take a few minutes to 48 hours)</li>
            </ol>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="border dark:border-gray-700 rounded-lg p-4 dark:bg-gray-800 ">
              <h5 className="font-semibold mb-2 text-red-700">❌ Old Nameservers (Remove)</h5>
              <div className="text-sm font-mono bg-red-50 dark:bg-red-900/20 p-2 rounded">
                <div>ns1.yourdomain.com</div>
                <div>ns2.yourdomain.com</div>
              </div>
            </div>
            <div className="border dark:border-gray-700 rounded-lg p-4 dark:bg-gray-800 ">
              <h5 className="font-semibold mb-2 text-green-700">✓ New Nameservers (Add)</h5>
              <div className="text-sm font-mono bg-green-50 dark:bg-green-900/20 p-2 rounded">
                <div>nick.ns.cloudflare.com</div>
                <div>tina.ns.cloudflare.com</div>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 border dark:border-gray-700 border-blue-200 dark:border-blue-800 rounded-lg p-4 mt-4">
            <p className="text-sm text-blue-900">
              <strong>Propagation time:</strong> DNS changes can take anywhere from a few minutes to 48 hours to fully propagate worldwide. CloudFlare will notify you when your domain is active.
            </p>
          </div>
        </StepByStep>

        {/* Step 5: Get Your Flux Domain */}
        <StepByStep number={5} title="Find Your Flux Application Domain">
          <p className="mb-4">
            Before adding the CNAME record, you need to know your Flux app&apos;s domain name.
          </p>

          <ol className="space-y-4 ml-4 mb-6">
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-600 dark:text-blue-400 flex items-center justify-center text-sm font-bold">1</span>
              <div>
                <p>Go to <a href="https://home.runonflux.io" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">home.runonflux.io</a></p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-600 dark:text-blue-400 flex items-center justify-center text-sm font-bold">2</span>
              <div>
                <p>Navigate to <strong>Applications</strong> → <strong>Management</strong></p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-600 dark:text-blue-400 flex items-center justify-center text-sm font-bold">3</span>
              <div>
                <p>Click on your deployed application</p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-600 dark:text-blue-400 flex items-center justify-center text-sm font-bold">4</span>
              <div>
                <p>Copy the Flux domain name - it will look like:</p>
                <div className="bg-gray-100 dark:bg-gray-700 rounded p-2 font-mono text-sm mt-2">
                  yourapp-componentname-abc123.app.runonflux.io
                </div>
              </div>
            </li>
          </ol>

          <div className="bg-purple-50 dark:bg-purple-900/20 border dark:border-gray-700 border-purple-200 rounded-lg p-4">
            <p className="text-sm text-purple-900 mb-2">
              <strong>Multi-component apps:</strong> Each component gets its own domain. Choose the component you want to expose to your custom domain (usually the frontend).
            </p>
          </div>
        </StepByStep>

        {/* Step 6: Add CNAME Record */}
        <StepByStep number={6} title="Add CNAME Record in CloudFlare">
          <p className="mb-4">
            Now configure the CNAME record to point your custom domain to your Flux app.
          </p>

          <div className="bg-white dark:bg-gray-800 border-2 border-blue-300 rounded-lg p-6 mb-6">
            <h4 className="font-semibold mb-4 text-lg">CNAME Record Configuration:</h4>
            <div className="space-y-4">
              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">Type</label>
                  <div className="bg-blue-50 dark:bg-blue-900/20 border dark:border-gray-700 border-blue-200 dark:border-blue-800 px-3 py-2 rounded font-mono text-sm">
                    CNAME
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">Name</label>
                  <div className="bg-blue-50 dark:bg-blue-900/20 border dark:border-gray-700 border-blue-200 dark:border-blue-800 px-3 py-2 rounded font-mono text-sm">
                    app
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">Or use @ for root domain</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">TTL</label>
                  <div className="bg-blue-50 dark:bg-blue-900/20 border dark:border-gray-700 border-blue-200 dark:border-blue-800 px-3 py-2 rounded font-mono text-sm">
                    Auto
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">Target</label>
                <div className="bg-blue-50 dark:bg-blue-900/20 border dark:border-gray-700 border-blue-200 dark:border-blue-800 px-3 py-2 rounded font-mono text-sm">
                  yourapp-abc123.app.runonflux.io
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">Your Flux application domain</p>
              </div>
              <div className="flex items-center gap-3 pt-2 border-t">
                <input type="checkbox" checked readOnly className="h-4 w-4 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400" />
                <label className="text-sm font-semibold">
                  Proxy status: <span className="text-orange-600 dark:text-orange-400">Proxied (Orange Cloud)</span>
                </label>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="font-semibold">Detailed Steps:</h4>
            <ol className="space-y-3 ml-4 text-sm">
              <li>1. In CloudFlare dashboard, click on your domain</li>
              <li>2. Navigate to <strong>DNS</strong> in the left sidebar</li>
              <li>3. Click <strong>Add Record</strong></li>
              <li>4. Fill in the fields as shown above</li>
              <li>5. <strong>Important:</strong> Make sure the Proxy toggle is ON (orange cloud icon)</li>
              <li>6. Click <strong>Save</strong></li>
            </ol>
          </div>

          <div className="grid md:grid-cols-2 gap-4 mt-6">
            <div className="border dark:border-gray-700 rounded-lg p-4 bg-green-50 dark:bg-green-900/20 dark:bg-gray-800 ">
              <h5 className="font-semibold mb-2 text-green-900">✓ Subdomain Example</h5>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-gray-600 dark:text-gray-300">Name:</span> <code className="bg-green-100 px-2 py-1 rounded ml-1">app</code>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-300">Result:</span> <span className="font-semibold">app.yourdomain.com</span>
                </div>
              </div>
            </div>
            <div className="border dark:border-gray-700 rounded-lg p-4 bg-blue-50 dark:bg-blue-900/20 dark:bg-gray-800 ">
              <h5 className="font-semibold mb-2 text-blue-900">✓ Root Domain Example</h5>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-gray-600 dark:text-gray-300">Name:</span> <code className="bg-blue-100 px-2 py-1 rounded ml-1">@</code>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-300">Result:</span> <span className="font-semibold">yourdomain.com</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-green-50 dark:bg-green-900/20 border dark:border-gray-700 border-green-200 dark:border-green-800 rounded-lg p-4 mt-6">
            <div className="flex items-start gap-3">
              <Lock className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold text-green-900 mb-1">Automatic SSL/TLS:</p>
                <p className="text-green-800">With the proxy enabled (orange cloud), CloudFlare automatically provides a free SSL/TLS certificate. Your site will be accessible via <strong>https://</strong> with no additional setup!</p>
              </div>
            </div>
          </div>
        </StepByStep>

        {/* Step 7: Configure SSL/TLS Settings */}
        <StepByStep number={7} title="Configure SSL/TLS Settings (Optional)">
          <p className="mb-4">
            Optimize your SSL/TLS settings for better security and compatibility.
          </p>

          <ol className="space-y-4 ml-4 mb-6">
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-600 dark:text-blue-400 flex items-center justify-center text-sm font-bold">1</span>
              <div>
                <p>In CloudFlare dashboard, go to <strong>SSL/TLS</strong></p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-600 dark:text-blue-400 flex items-center justify-center text-sm font-bold">2</span>
              <div>
                <p>Set encryption mode to <strong>Full</strong> (recommended)</p>
                <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">This encrypts traffic between CloudFlare and Flux</p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-600 dark:text-blue-400 flex items-center justify-center text-sm font-bold">3</span>
              <div>
                <p>Enable <strong>Always Use HTTPS</strong> under Edge Certificates</p>
                <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">Automatically redirects HTTP to HTTPS</p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-600 dark:text-blue-400 flex items-center justify-center text-sm font-bold">4</span>
              <div>
                <p>Enable <strong>Automatic HTTPS Rewrites</strong></p>
                <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">Fixes mixed content warnings</p>
              </div>
            </li>
          </ol>

          <div className="overflow-x-auto">
            <table className="w-full border dark:border-gray-700 rounded-lg overflow-hidden dark:bg-gray-800 ">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold">SSL Mode</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Description</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Recommended</th>
                </tr>
              </thead>
              <tbody className="divide-y text-sm">
                <tr>
                  <td className="px-4 py-3 font-mono text-xs">Off</td>
                  <td className="px-4 py-3">No encryption - not recommended</td>
                  <td className="px-4 py-3 text-center">❌</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-mono text-xs">Flexible</td>
                  <td className="px-4 py-3">Encrypts browser → CloudFlare only</td>
                  <td className="px-4 py-3 text-center">⚠️</td>
                </tr>
                <tr className="bg-green-50 dark:bg-green-900/20">
                  <td className="px-4 py-3 font-mono text-xs font-semibold">Full</td>
                  <td className="px-4 py-3 font-semibold">Encrypts browser → CloudFlare → Flux</td>
                  <td className="px-4 py-3 text-center">✓</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-mono text-xs">Full (Strict)</td>
                  <td className="px-4 py-3">Full + validates Flux certificate</td>
                  <td className="px-4 py-3 text-center">✓</td>
                </tr>
              </tbody>
            </table>
          </div>
        </StepByStep>

        {/* Step 8: Test Your Setup */}
        <StepByStep number={8} title="Test Your Custom Domain">
          <p className="mb-4">
            Verify everything is working correctly:
          </p>

          <div className="space-y-4 mb-6">
            <div className="border dark:border-gray-700 rounded-lg p-4 dark:bg-gray-800 ">
              <h4 className="font-semibold mb-2">1. DNS Propagation Check</h4>
              <p className="text-sm text-gray-700 dark:text-gray-200 mb-2">Use online tools to verify DNS has propagated:</p>
              <ul className="text-sm space-y-1 ml-4">
                <li>• <a href="https://www.whatsmydns.net" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">whatsmydns.net</a></li>
                <li>• <a href="https://dnschecker.org" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">dnschecker.org</a></li>
              </ul>
            </div>

            <div className="border dark:border-gray-700 rounded-lg p-4 dark:bg-gray-800 ">
              <h4 className="font-semibold mb-2">2. Visit Your Custom Domain</h4>
              <p className="text-sm text-gray-700 dark:text-gray-200">Open your browser and navigate to:</p>
              <div className="bg-gray-100 dark:bg-gray-700 rounded p-2 font-mono text-sm mt-2">
                https://app.yourdomain.com
              </div>
            </div>

            <div className="border dark:border-gray-700 rounded-lg p-4 dark:bg-gray-800 ">
              <h4 className="font-semibold mb-2">3. Verify SSL Certificate</h4>
              <p className="text-sm text-gray-700 dark:text-gray-200 mb-2">Check for the padlock icon in your browser&apos;s address bar. Click it to view:</p>
              <ul className="text-sm space-y-1 ml-4">
                <li>• Certificate should be issued by CloudFlare</li>
                <li>• Connection should show as &quot;Secure&quot;</li>
                <li>• No mixed content warnings</li>
              </ul>
            </div>

            <div className="border dark:border-gray-700 rounded-lg p-4 dark:bg-gray-800 ">
              <h4 className="font-semibold mb-2">4. Test HTTPS Redirect</h4>
              <p className="text-sm text-gray-700 dark:text-gray-200">Try accessing via HTTP (should auto-redirect to HTTPS):</p>
              <div className="bg-gray-100 dark:bg-gray-700 rounded p-2 font-mono text-sm mt-2">
                http://app.yourdomain.com → https://app.yourdomain.com
              </div>
            </div>
          </div>

          <div className="bg-green-50 dark:bg-green-900/20 border dark:border-gray-700 border-green-200 dark:border-green-800 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-2">
              <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
              <h3 className="text-lg font-semibold text-green-900">Success!</h3>
            </div>
            <p className="text-green-800 text-sm">
              Your Flux application is now accessible via your custom domain with automatic SSL/TLS encryption!
            </p>
          </div>
        </StepByStep>
      </div>

      {/* Configuration Examples */}
      <div className="mt-12 border-t pt-8">
        <h2 className="text-2xl font-bold mb-6">Common Configuration Examples</h2>
        <div className="space-y-6">
          <div className="border dark:border-gray-700 rounded-lg p-6 dark:bg-gray-800 ">
            <h3 className="text-lg font-semibold mb-3">Example 1: Subdomain for Flux App, Root for Existing Site</h3>
            <div className="bg-gray-50 dark:bg-gray-800 rounded p-4 space-y-3 text-sm">
              <div className="flex justify-between items-center">
                <code className="font-mono bg-white dark:bg-gray-800 px-3 py-1 rounded border">yourdomain.com</code>
                <span className="text-gray-400 dark:text-gray-500">→</span>
                <span className="text-gray-700 dark:text-gray-200">Your existing website (GoDaddy, Wix, etc.)</span>
              </div>
              <div className="flex justify-between items-center">
                <code className="font-mono bg-blue-50 dark:bg-blue-900/20 px-3 py-1 rounded border dark:border-gray-700 border-blue-200 dark:border-blue-800">app.yourdomain.com</code>
                <span className="text-gray-400 dark:text-gray-500">→</span>
                <span className="text-blue-700 font-semibold">Your Flux dApp</span>
              </div>
            </div>
            <div className="mt-3 text-sm text-gray-600 dark:text-gray-300">
              <strong>CNAME Record:</strong> Name: <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">app</code>, Target: <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">yourapp-abc123.app.runonflux.io</code>
            </div>
          </div>

          <div className="border dark:border-gray-700 rounded-lg p-6 dark:bg-gray-800 ">
            <h3 className="text-lg font-semibold mb-3">Example 2: Root Domain for Flux App</h3>
            <div className="bg-gray-50 dark:bg-gray-800 rounded p-4 space-y-3 text-sm">
              <div className="flex justify-between items-center">
                <code className="font-mono bg-blue-50 dark:bg-blue-900/20 px-3 py-1 rounded border dark:border-gray-700 border-blue-200 dark:border-blue-800">yourdomain.com</code>
                <span className="text-gray-400 dark:text-gray-500">→</span>
                <span className="text-blue-700 font-semibold">Your Flux dApp</span>
              </div>
            </div>
            <div className="mt-3 text-sm text-gray-600 dark:text-gray-300">
              <strong>CNAME Record:</strong> Name: <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">@</code>, Target: <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">yourapp-abc123.app.runonflux.io</code>
            </div>
          </div>

          <div className="border dark:border-gray-700 rounded-lg p-6 dark:bg-gray-800 ">
            <h3 className="text-lg font-semibold mb-3">Example 3: Multiple Subdomains for Multi-Component App</h3>
            <div className="bg-gray-50 dark:bg-gray-800 rounded p-4 space-y-3 text-sm">
              <div className="flex justify-between items-center">
                <code className="font-mono bg-blue-50 dark:bg-blue-900/20 px-3 py-1 rounded border dark:border-gray-700 border-blue-200 dark:border-blue-800">app.yourdomain.com</code>
                <span className="text-gray-400 dark:text-gray-500">→</span>
                <span className="text-blue-700">Frontend component</span>
              </div>
              <div className="flex justify-between items-center">
                <code className="font-mono bg-purple-50 dark:bg-purple-900/20 px-3 py-1 rounded border dark:border-gray-700 border-purple-200">api.yourdomain.com</code>
                <span className="text-gray-400 dark:text-gray-500">→</span>
                <span className="text-purple-700">API component</span>
              </div>
            </div>
            <div className="mt-3 text-sm text-gray-600 dark:text-gray-300">
              <strong>Multiple CNAME Records:</strong> One for each component you want to expose
            </div>
          </div>
        </div>
      </div>

      {/* Troubleshooting */}
      <div className="mt-12 border-t pt-8">
        <h2 className="text-2xl font-bold mb-6">Troubleshooting</h2>
        <div className="space-y-4">
          <div className="border-l-4 border-yellow-400 pl-4 py-2">
            <h4 className="font-semibold mb-1">Domain doesn&apos;t resolve / &quot;Site not found&quot;</h4>
            <p className="text-sm text-gray-700 dark:text-gray-200 mb-2">Possible causes:</p>
            <ul className="text-sm text-gray-700 dark:text-gray-200 ml-4 space-y-1">
              <li>• DNS hasn&apos;t propagated yet (wait up to 48 hours)</li>
              <li>• Nameservers not updated at domain registrar</li>
              <li>• CNAME record not saved or incorrect</li>
              <li>• Typo in Flux domain name</li>
            </ul>
          </div>
          <div className="border-l-4 border-yellow-400 pl-4 py-2">
            <h4 className="font-semibold mb-1">SSL certificate warnings / &quot;Not secure&quot;</h4>
            <p className="text-sm text-gray-700 dark:text-gray-200 mb-2">Solutions:</p>
            <ul className="text-sm text-gray-700 dark:text-gray-200 ml-4 space-y-1">
              <li>• Ensure proxy status is ON (orange cloud) in CloudFlare</li>
              <li>• Set SSL/TLS mode to &quot;Full&quot; or &quot;Full (Strict)&quot;</li>
              <li>• Enable &quot;Always Use HTTPS&quot;</li>
              <li>• Clear browser cache and try again</li>
            </ul>
          </div>
          <div className="border-l-4 border-yellow-400 pl-4 py-2">
            <h4 className="font-semibold mb-1">Redirect loop / Too many redirects</h4>
            <p className="text-sm text-gray-700 dark:text-gray-200">Change SSL/TLS encryption mode from &quot;Flexible&quot; to &quot;Full&quot; in CloudFlare settings.</p>
          </div>
          <div className="border-l-4 border-yellow-400 pl-4 py-2">
            <h4 className="font-semibold mb-1">Some pages work, others don&apos;t</h4>
            <p className="text-sm text-gray-700 dark:text-gray-200">Enable &quot;Automatic HTTPS Rewrites&quot; in CloudFlare SSL/TLS Edge Certificates to fix mixed content issues.</p>
          </div>
        </div>
      </div>

      {/* Best Practices */}
      <div className="mt-12 border-t pt-8">
        <h2 className="text-2xl font-bold mb-6">Best Practices</h2>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="border dark:border-gray-700 rounded-lg p-4 dark:bg-gray-800 ">
            <h3 className="font-semibold mb-3">✓ Do</h3>
            <ul className="text-sm space-y-2 text-gray-700 dark:text-gray-200">
              <li>✓ Always use HTTPS (enable &quot;Always Use HTTPS&quot;)</li>
              <li>✓ Enable CloudFlare proxy (orange cloud) for DDoS protection</li>
              <li>✓ Use Full SSL mode for end-to-end encryption</li>
              <li>✓ Set up page rules for caching and performance</li>
              <li>✓ Monitor CloudFlare Analytics for traffic insights</li>
            </ul>
          </div>
          <div className="border dark:border-gray-700 rounded-lg p-4 dark:bg-gray-800 ">
            <h3 className="font-semibold mb-3">✗ Don&apos;t</h3>
            <ul className="text-sm space-y-2 text-gray-700 dark:text-gray-200">
              <li>✗ Don&apos;t disable CloudFlare proxy unless necessary</li>
              <li>✗ Don&apos;t use &quot;Flexible&quot; SSL mode with Flux</li>
              <li>✗ Don&apos;t forget to test after DNS changes</li>
              <li>✗ Don&apos;t expose sensitive endpoints without WAF rules</li>
              <li>✗ Don&apos;t skip SSL/TLS configuration review</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Next Steps */}
      <div className="mt-12 border-t pt-8">
        <h2 className="text-2xl font-bold mb-6">Next Steps</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <a
            href="/tutorials/multi-component"
            className="block p-6 border dark:border-gray-700 rounded-lg hover:shadow-lg transition-shadow group dark:bg-gray-800 "
          >
            <h3 className="text-lg font-semibold mb-2 group-hover:text-blue-600 dark:text-blue-400">Multi-Component Apps →</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">Learn how to expose multiple components with different subdomains</p>
          </a>
          <a
            href="/reference/flux-spec"
            className="block p-6 border dark:border-gray-700 rounded-lg hover:shadow-lg transition-shadow group dark:bg-gray-800 "
          >
            <h3 className="text-lg font-semibold mb-2 group-hover:text-blue-600 dark:text-blue-400">Flux Spec Reference →</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">Advanced configuration options for your Flux deployments</p>
          </a>
        </div>
      </div>
    </div>
  )
}
