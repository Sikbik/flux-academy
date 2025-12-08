'use client'

import { CheckCircle2, Circle } from 'lucide-react'

interface ChecklistItemProps {
  checked?: boolean
  children: React.ReactNode
}

export function ChecklistItem({ checked = false, children }: ChecklistItemProps) {
  return (
    <div className="flex items-start gap-3 py-2">
      {checked ? (
        <CheckCircle2 className="h-5 w-5 text-green-500 dark:text-green-400 flex-shrink-0 mt-0.5" />
      ) : (
        <Circle className="h-5 w-5 text-gray-300 dark:text-gray-600 flex-shrink-0 mt-0.5" />
      )}
      <span className={checked ? 'text-gray-700 dark:text-gray-300' : 'text-gray-600 dark:text-gray-400'}>{children}</span>
    </div>
  )
}
