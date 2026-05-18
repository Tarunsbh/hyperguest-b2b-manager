'use client'

import React, { useState, useCallback } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import {
  Menu,
  Search,
  RefreshCw,
  Sun,
  Moon,
  Bell,
  LogOut,
  User,
  ChevronDown,
  Command,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const PAGE_TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/properties': 'Properties',
  '/search': 'Availability Search',
  '/calendar': 'ARI Calendar',
  '/subscriptions': 'Subscriptions',
  '/bookings': 'Booking Push',
  '/callbacks': 'Callback Logs',
  '/settings': 'Settings',
}

interface HeaderProps {
  onMenuClick?: () => void
  isLoading?: boolean
  onRefresh?: () => void
  unreadNotifications?: number
}

export function Header({
  onMenuClick,
  isLoading = false,
  onRefresh,
  unreadNotifications = 3,
}: HeaderProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const [isRefreshing, setIsRefreshing] = useState(false)

  const getPageTitle = () => {
    // Exact match first
    if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname]
    // Prefix match for nested routes
    for (const [path, title] of Object.entries(PAGE_TITLES)) {
      if (path !== '/' && pathname.startsWith(path)) return title
    }
    return 'HG B2B Manager'
  }

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true)
    onRefresh?.()
    await new Promise((r) => setTimeout(r, 1000))
    setIsRefreshing(false)
    toast.success('Data refreshed successfully')
  }, [onRefresh])

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    toast.success('Logged out successfully')
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-background/95 backdrop-blur-sm px-4 lg:px-6">
      {/* Mobile menu button */}
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={onMenuClick}
      >
        <Menu className="h-5 w-5" />
        <span className="sr-only">Toggle menu</span>
      </Button>

      {/* Page title */}
      <AnimatePresence mode="wait">
        <motion.h1
          key={pathname}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.15 }}
          className="text-base font-semibold text-foreground hidden sm:block"
        >
          {getPageTitle()}
        </motion.h1>
      </AnimatePresence>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Global search hint */}
      <button
        onClick={() => toast.info('Search coming soon', { description: 'Press Cmd+K to search' })}
        className="hidden md:flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted transition-colors"
      >
        <Search className="h-3.5 w-3.5" />
        <span>Search...</span>
        <div className="flex items-center gap-0.5 rounded border border-border bg-background px-1.5 py-0.5">
          <Command className="h-2.5 w-2.5" />
          <span className="text-[10px] font-mono">K</span>
        </div>
      </button>

      {/* Refresh button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={handleRefresh}
        disabled={isRefreshing || isLoading}
        className="relative"
      >
        <motion.div
          animate={{ rotate: isRefreshing ? 360 : 0 }}
          transition={isRefreshing ? { duration: 1, repeat: Infinity, ease: 'linear' } : { duration: 0 }}
        >
          <RefreshCw className="h-4 w-4" />
        </motion.div>
        <span className="sr-only">Refresh</span>
      </Button>

      {/* Theme toggle */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      >
        <AnimatePresence mode="wait" initial={false}>
          {theme === 'dark' ? (
            <motion.div
              key="moon"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <Moon className="h-4 w-4" />
            </motion.div>
          ) : (
            <motion.div
              key="sun"
              initial={{ rotate: 90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -90, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <Sun className="h-4 w-4" />
            </motion.div>
          )}
        </AnimatePresence>
        <span className="sr-only">Toggle theme</span>
      </Button>

      {/* Notifications */}
      <Button
        variant="ghost"
        size="icon"
        className="relative"
        onClick={() => toast.info(`You have ${unreadNotifications} unread notifications`)}
      >
        <Bell className="h-4 w-4" />
        {unreadNotifications > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
            {unreadNotifications > 9 ? '9+' : unreadNotifications}
          </span>
        )}
        <span className="sr-only">Notifications</span>
      </Button>

      {/* User menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-accent transition-colors focus:outline-none focus:ring-2 focus:ring-ring">
            <Avatar className="h-7 w-7">
              <AvatarFallback className="text-[10px]">EA</AvatarFallback>
            </Avatar>
            <div className="hidden md:block text-left">
              <p className="text-xs font-semibold text-foreground leading-none">Eglobe Admin</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">it@eglobe-solutions.com</p>
            </div>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground hidden md:block" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            <p className="text-sm font-semibold">Eglobe Admin</p>
            <p className="text-xs text-muted-foreground font-normal mt-0.5">it@eglobe-solutions.com</p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem>
            <User className="h-4 w-4" />
            Profile Settings
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={handleLogout}
            className="text-destructive focus:text-destructive focus:bg-destructive/10"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
