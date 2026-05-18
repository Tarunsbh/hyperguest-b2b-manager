'use client'

import React, { useEffect, useRef, useState } from 'react'
import { motion, useInView } from 'framer-motion'
import { TrendingUp, TrendingDown, Minus, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'

type ColorVariant = 'blue' | 'green' | 'orange' | 'red' | 'purple'

const variantConfig: Record<ColorVariant, {
  bg: string
  iconBg: string
  iconColor: string
  trendUp: string
  trendDown: string
}> = {
  blue: {
    bg: 'from-blue-50 to-transparent dark:from-blue-950/20',
    iconBg: 'bg-blue-100 dark:bg-blue-900/40',
    iconColor: 'text-blue-600 dark:text-blue-400',
    trendUp: 'text-emerald-600 dark:text-emerald-400',
    trendDown: 'text-red-500 dark:text-red-400',
  },
  green: {
    bg: 'from-emerald-50 to-transparent dark:from-emerald-950/20',
    iconBg: 'bg-emerald-100 dark:bg-emerald-900/40',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    trendUp: 'text-emerald-600 dark:text-emerald-400',
    trendDown: 'text-red-500 dark:text-red-400',
  },
  orange: {
    bg: 'from-orange-50 to-transparent dark:from-orange-950/20',
    iconBg: 'bg-orange-100 dark:bg-orange-900/40',
    iconColor: 'text-orange-600 dark:text-orange-400',
    trendUp: 'text-emerald-600 dark:text-emerald-400',
    trendDown: 'text-red-500 dark:text-red-400',
  },
  red: {
    bg: 'from-red-50 to-transparent dark:from-red-950/20',
    iconBg: 'bg-red-100 dark:bg-red-900/40',
    iconColor: 'text-red-600 dark:text-red-400',
    trendUp: 'text-emerald-600 dark:text-emerald-400',
    trendDown: 'text-red-500 dark:text-red-400',
  },
  purple: {
    bg: 'from-purple-50 to-transparent dark:from-purple-950/20',
    iconBg: 'bg-purple-100 dark:bg-purple-900/40',
    iconColor: 'text-purple-600 dark:text-purple-400',
    trendUp: 'text-emerald-600 dark:text-emerald-400',
    trendDown: 'text-red-500 dark:text-red-400',
  },
}

function useCountUp(target: number, duration = 1200, enabled = true) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!enabled) {
      setCount(target)
      return
    }
    let start = 0
    const step = target / (duration / 16)
    const timer = setInterval(() => {
      start += step
      if (start >= target) {
        setCount(target)
        clearInterval(timer)
      } else {
        setCount(Math.floor(start))
      }
    }, 16)
    return () => clearInterval(timer)
  }, [target, duration, enabled])

  return count
}

interface StatsCardProps {
  icon: LucideIcon
  label: string
  value: number
  prefix?: string
  suffix?: string
  change?: number
  changeLabel?: string
  variant?: ColorVariant
  loading?: boolean
  index?: number
}

export function StatsCard({
  icon: Icon,
  label,
  value,
  prefix = '',
  suffix = '',
  change,
  changeLabel = 'vs last period',
  variant = 'blue',
  loading = false,
  index = 0,
}: StatsCardProps) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-40px' })
  const displayValue = useCountUp(value, 1000, inView)
  const config = variantConfig[variant]

  const TrendIcon =
    change === undefined || change === 0
      ? Minus
      : change > 0
      ? TrendingUp
      : TrendingDown

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.4, delay: index * 0.08, ease: 'easeOut' }}
    >
      <Card className={cn(
        'relative overflow-hidden bg-gradient-to-br p-5 border-border/60 hover:border-border transition-all duration-200',
        config.bg
      )}>
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2 flex-1 min-w-0">
            <p className="text-sm font-medium text-muted-foreground truncate">{label}</p>

            {loading ? (
              <div className="h-8 w-24 rounded-md bg-muted animate-pulse" />
            ) : (
              <p className="text-2xl font-bold text-foreground tabular-nums">
                {prefix}{displayValue.toLocaleString()}{suffix}
              </p>
            )}

            {change !== undefined && !loading && (
              <div className={cn(
                'flex items-center gap-1 text-xs font-medium',
                change > 0 ? config.trendUp : change < 0 ? config.trendDown : 'text-muted-foreground'
              )}>
                <TrendIcon className="h-3.5 w-3.5 shrink-0" />
                <span>
                  {change > 0 ? '+' : ''}{change}% {changeLabel}
                </span>
              </div>
            )}
          </div>

          <div className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
            config.iconBg
          )}>
            <Icon className={cn('h-5 w-5', config.iconColor)} />
          </div>
        </div>
      </Card>
    </motion.div>
  )
}
