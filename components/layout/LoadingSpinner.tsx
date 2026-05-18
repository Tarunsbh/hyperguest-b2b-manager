'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { Building2, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

// Full-page loading screen
export function LoadingSpinner() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/95 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="flex flex-col items-center gap-6"
      >
        {/* Logo */}
        <div className="relative">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary shadow-lg">
            <Building2 className="h-8 w-8 text-primary-foreground" />
          </div>
          {/* Spinning ring */}
          <div className="absolute -inset-1.5">
            <div className="h-full w-full rounded-3xl border-2 border-primary/30 border-t-primary animate-spin" />
          </div>
        </div>

        {/* Brand text */}
        <div className="text-center space-y-1">
          <p className="text-lg font-bold text-foreground">HG B2B</p>
          <p className="text-xs text-muted-foreground">Channel Manager</p>
        </div>

        {/* Loading dots */}
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              animate={{ scale: [1, 1.4, 1], opacity: [0.4, 1, 0.4] }}
              transition={{
                duration: 0.8,
                repeat: Infinity,
                delay: i * 0.2,
                ease: 'easeInOut',
              }}
              className="h-1.5 w-1.5 rounded-full bg-primary"
            />
          ))}
        </div>

        <p className="text-sm text-muted-foreground">Loading...</p>
      </motion.div>
    </div>
  )
}

// Inline spinner for small use cases
interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function Spinner({ size = 'md', className }: SpinnerProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6',
  }

  return (
    <Loader2
      className={cn(
        'animate-spin text-muted-foreground',
        sizeClasses[size],
        className
      )}
    />
  )
}
