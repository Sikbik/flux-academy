'use client'

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

interface CommandBoxProps {
  children: string
  copyable?: boolean
  language?: string
  title?: string
}

export function CommandBox({
  children,
  copyable = true,
  language = 'bash',
  title
}: CommandBoxProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(children)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="my-4">
      {title && (
        <div className="bg-gray-700 text-gray-200 px-3 sm:px-4 py-2 rounded-t-lg text-xs sm:text-sm font-medium">
          {title}
        </div>
      )}
      <div className={`relative bg-gray-900 ${title ? 'rounded-b-lg' : 'rounded-lg'} p-3 sm:p-4`}>
        <pre className="text-green-400 overflow-x-auto font-mono text-xs sm:text-sm">
          <code>{children}</code>
        </pre>
        {copyable && (
          <button
            onClick={handleCopy}
            className="absolute top-2 right-2 px-2 sm:px-3 py-1 sm:py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded text-xs sm:text-sm flex items-center gap-1 sm:gap-2 transition-colors"
          >
            {copied ? (
              <>
                <Check className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Copy</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  )
}
