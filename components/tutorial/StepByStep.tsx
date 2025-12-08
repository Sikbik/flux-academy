'use client'

import { useState } from 'react'
import { CheckCircle2 } from 'lucide-react'

interface StepByStepProps {
  number: number
  title: string
  children: React.ReactNode
  completed?: boolean
  onComplete?: () => void
}

export function StepByStep({
  number,
  title,
  children,
  completed: initialCompleted = false,
  onComplete
}: StepByStepProps) {
  const [completed, setCompleted] = useState(initialCompleted)

  const handleComplete = () => {
    setCompleted(true)
    onComplete?.()
  }

  return (
    <div className="border-l-4 border-blue-600 pl-4 sm:pl-6 py-3 sm:py-4 my-6 sm:my-8 relative">
      <div className="flex items-center gap-3 sm:gap-4 mb-3 sm:mb-4">
        <div className={`
          w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center text-white font-bold text-lg sm:text-xl flex-shrink-0
          ${completed ? 'bg-green-500' : 'bg-blue-600'}
          transition-colors duration-300
        `}>
          {completed ? <CheckCircle2 className="h-5 w-5 sm:h-6 sm:w-6" /> : number}
        </div>
        <h3 className="text-xl sm:text-2xl font-bold">{title}</h3>
      </div>
      <div className="ml-0 sm:ml-16">
        {children}
      </div>
      {!completed && onComplete && (
        <button
          onClick={handleComplete}
          className="mt-3 sm:mt-4 ml-0 sm:ml-16 px-3 sm:px-4 py-1.5 sm:py-2 text-sm sm:text-base bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Mark as Complete
        </button>
      )}
    </div>
  )
}
