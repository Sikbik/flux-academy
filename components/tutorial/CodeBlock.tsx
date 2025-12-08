'use client'

import { useState } from 'react'
import { Copy, Check, Download } from 'lucide-react'

interface CodeBlockProps {
  children: string
  language?: string
  title?: string
  downloadable?: boolean
  filename?: string
}

export function CodeBlock({
  children,
  language = 'javascript',
  title,
  downloadable = false,
  filename = 'code.txt'
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(children)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownload = () => {
    const blob = new Blob([children], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="my-4 overflow-hidden w-full max-w-full border border-gray-200 dark:border-gray-700 rounded-lg">
      {title && (
        <div className="bg-gray-700 dark:bg-gray-800 text-gray-200 dark:text-gray-300 px-3 sm:px-4 py-2 rounded-t-lg text-xs sm:text-sm font-medium flex items-center justify-between flex-wrap gap-2">
          <span className="truncate">{title}</span>
          {language && (
            <span className="text-xs bg-gray-600 dark:bg-gray-700 px-2 py-1 rounded whitespace-nowrap">{language}</span>
          )}
        </div>
      )}
      <div className={`relative bg-gray-900 dark:bg-gray-950 ${title ? 'rounded-b-lg' : 'rounded-lg'} p-3 sm:p-4 w-full max-w-full`}>
        <pre className="text-gray-100 overflow-x-auto font-mono text-xs sm:text-sm max-w-full">
          <code className="block">{children}</code>
        </pre>
        <div className="absolute top-2 right-2 flex gap-1 sm:gap-2">
          {downloadable && (
            <button
              onClick={handleDownload}
              className="px-2 sm:px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded text-xs sm:text-sm flex items-center gap-1 sm:gap-2 transition-colors"
              title="Download file"
            >
              <Download className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Download</span>
            </button>
          )}
          <button
            onClick={handleCopy}
            className="px-2 sm:px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded text-xs sm:text-sm flex items-center gap-1 sm:gap-2 transition-colors"
            title={copied ? "Copied!" : "Copy code"}
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
        </div>
      </div>
    </div>
  )
}
