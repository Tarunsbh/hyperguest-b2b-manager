'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { type LucideIcon, Inbox } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
    icon?: LucideIcon
  }
  className?: string
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={cn(
        'flex flex-col items-center justify-center py-16 px-4 text-center',
        className
      )}
    >
      {/* Icon container */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ duration: 0.4, delay: 0.1, type: 'spring', stiffness: 200 }}
        className="relative mb-6"
      >
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-muted/60 border border-border">
          <Icon className="h-9 w-9 text-muted-foreground/60" />
        </div>
        {/* decorative dots */}
        <div className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-primary/20" />
        <div className="absolute -bottom-1 -left-1 h-2 w-2 rounded-full bg-primary/10" />
      </motion.div>

      {/* Text */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
        className="space-y-2 max-w-sm"
      >
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        {description && (
          <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
        )}
      </motion.div>

      {/* Action */}
      {action && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.3 }}
          className="mt-6"
        >
          <Button onClick={action.onClick} size="sm" className="gap-2">
            {action.icon && <action.icon className="h-4 w-4" />}
            {action.label}
          </Button>
        </motion.div>
      )}
    </motion.div>
  )
}
