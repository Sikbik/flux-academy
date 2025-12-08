'use client'

import { useProgress } from '@/contexts/ProgressContext'
import { CheckCircle2, Circle } from 'lucide-react'

export function TutorialProgress({ tutorialId }: { tutorialId: string }) {
  const { isComplete, markComplete, markIncomplete } = useProgress()
  const completed = isComplete(tutorialId)

  const handleToggle = () => {
    if (completed) {
      markIncomplete(tutorialId)
    } else {
      markComplete(tutorialId)
    }
  }

  return (
    <button
      onClick={handleToggle}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all ${
        completed
          ? 'bg-green-50 border-green-300 text-green-700 hover:bg-green-100'
          : 'bg-gray-50 border-gray-300 text-gray-700 hover:bg-gray-100'
      }`}
    >
      {completed ? (
        <CheckCircle2 className="h-5 w-5" />
      ) : (
        <Circle className="h-5 w-5" />
      )}
      <span className="text-sm font-medium">
        {completed ? 'Completed' : 'Mark as Complete'}
      </span>
    </button>
  )
}

export function ProgressBadge() {
  const { getProgress } = useProgress()
  const { completed, total } = getProgress()
  const percentage = Math.round((completed / total) * 100)

  return (
    <div className="flex items-center gap-2 text-sm">
      <div className="flex items-center gap-2">
        <div className="w-32 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500"
            style={{ width: `${percentage}%` }}
          />
        </div>
        <span className="text-gray-600 font-medium">
          {completed}/{total}
        </span>
      </div>
    </div>
  )
}
