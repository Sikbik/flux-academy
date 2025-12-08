'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

interface ProgressContextType {
  completedTutorials: string[]
  markComplete: (tutorialId: string) => void
  markIncomplete: (tutorialId: string) => void
  isComplete: (tutorialId: string) => boolean
  getProgress: () => { completed: number; total: number }
}

const ProgressContext = createContext<ProgressContextType | undefined>(undefined)

const TUTORIAL_IDS = [
  'basic-deployment',
  'minecraft-server',
  'app-management',
  'multi-component',
  'custom-domain',
  'shared-db'
]

export function ProgressProvider({ children }: { children: ReactNode }) {
  const [completedTutorials, setCompletedTutorials] = useState<string[]>([])
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // Load from localStorage on mount
    const stored = localStorage.getItem('flux-academy-progress')
    if (stored) {
      try {
        setCompletedTutorials(JSON.parse(stored))
      } catch (e) {
        console.error('Failed to load progress:', e)
      }
    }
    setMounted(true)
  }, [])

  useEffect(() => {
    // Save to localStorage whenever it changes
    if (mounted) {
      localStorage.setItem('flux-academy-progress', JSON.stringify(completedTutorials))
    }
  }, [completedTutorials, mounted])

  const markComplete = (tutorialId: string) => {
    setCompletedTutorials(prev => {
      if (prev.includes(tutorialId)) return prev
      return [...prev, tutorialId]
    })
  }

  const markIncomplete = (tutorialId: string) => {
    setCompletedTutorials(prev => prev.filter(id => id !== tutorialId))
  }

  const isComplete = (tutorialId: string) => {
    return completedTutorials.includes(tutorialId)
  }

  const getProgress = () => {
    return {
      completed: completedTutorials.length,
      total: TUTORIAL_IDS.length
    }
  }

  return (
    <ProgressContext.Provider value={{ completedTutorials, markComplete, markIncomplete, isComplete, getProgress }}>
      {children}
    </ProgressContext.Provider>
  )
}

export function useProgress() {
  const context = useContext(ProgressContext)
  if (context === undefined) {
    throw new Error('useProgress must be used within a ProgressProvider')
  }
  return context
}
