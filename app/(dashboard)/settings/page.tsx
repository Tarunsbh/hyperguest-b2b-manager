'use client'

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import {
  Eye, EyeOff, CheckCircle2, XCircle, Loader2, Copy,
  Database, Key, Settings2, BookOpen, Save, RotateCcw,
  Wifi, WifiOff, Info
} from 'lucide-react'
import axios from 'axios'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

import { useSettingsStore } from '@/lib/store'
import { PageHeader } from '@/components/layout/PageHeader'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

type TestStatus = 'idle' | 'testing' | 'success' | 'error'

interface TokenCardProps {
  title: string
  description: string
  tokenKey: 'staticToken' | 'operationsToken' | 'callbackToken'
  infoText: string
  onTest: () => Promise<void>
}

// ─── Masked token ─────────────────────────────────────────────────────────────

function maskToken(token: string): string {
  if (!token) return '(not set)'
  return token.slice(0, 8) + '••••••••••••••••••••••••'
}

// ─── Token Card ───────────────────────────────────────────────────────────────

function TokenCard({ title, description, tokenKey, infoText, onTest }: TokenCardProps) {
  const { [tokenKey]: currentValue, update } = useSettingsStore()
  const [localValue, setLocalValue] = useState(currentValue)
  const [showToken, setShowToken] = useState(false)
  const [testStatus, setTestStatus] = useState<TestStatus>('idle')
  const [testMessage, setTestMessage] = useState('')

  const handleSave = () => {
    update({ [tokenKey]: localValue })
    toast.success(`${title} saved`, {
      description: 'Token updated in local storage',
    })
  }

  const handleTest = async () => {
    setTestStatus('testing')
    setTestMessage('')
    try {
      await onTest()
      setTestStatus('success')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Connection failed'
      setTestStatus('error')
      setTestMessage(msg)
    }
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(localValue)
      toast.success('Token copied')
    } catch {
      toast.error('Copy failed')
    }
  }

  const isDirty = localValue !== currentValue

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Key className="h-4 w-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold">{title}</CardTitle>
              <CardDescription className="text-xs mt-0.5">{description}</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {testStatus === 'success' && (
              <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-xs gap-1">
                <CheckCircle2 className="h-3 w-3" /> Connected
              </Badge>
            )}
            {testStatus === 'error' && (
              <Badge variant="destructive" className="text-xs gap-1">
                <XCircle className="h-3 w-3" /> Failed
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Token input */}
        <div className="space-y-1.5">
          <Label className="text-xs">Token</Label>
          <div className="relative">
            <Input
              type={showToken ? 'text' : 'password'}
              value={localValue}
              onChange={e => setLocalValue(e.target.value)}
              className="pr-20 font-mono text-xs"
              placeholder="Enter token..."
            />
            <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
              <button
                type="button"
                onClick={handleCopy}
                className="p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setShowToken(v => !v)}
                className="p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded"
              >
                {showToken ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Info text */}
        <p className="text-xs text-muted-foreground">{infoText}</p>

        {/* Error message */}
        {testStatus === 'error' && testMessage && (
          <p className="text-xs text-destructive">{testMessage}</p>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1">
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!isDirty}
            className="gap-1.5"
          >
            <Save className="h-3.5 w-3.5" /> Save
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleTest}
            disabled={testStatus === 'testing'}
            className="gap-1.5"
          >
            {testStatus === 'testing' ? (
              <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Testing...</>
            ) : (
              <><Wifi className="h-3.5 w-3.5" /> Test Connection</>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── API Config Tab ────────────────────────────────────────────────────────────

function ApiConfigTab() {
  const settings = useSettingsStore()

  const testStatic = async () => {
    const res = await fetch('/api/properties')
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    const count = data?.data?.items?.length ?? data?.data?.length ?? 0
    toast.success(`Connected — ${count} properties found`)
  }

  const testOperations = async () => {
    const res = await fetch('/api/facilities')
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    const count = Array.isArray(data?.data) ? data.data.length : 0
    toast.success(`Connected — ${count} facilities found`)
  }

  const testCallback = async () => {
    const res = await axios.post('/api/callbacks', { Test: 'yes' }, {
      headers: {
        Authorization: `Bearer ${settings.callbackToken}`,
        'Content-Type': 'application/json',
      },
      validateStatus: () => true,
    })
    if (res.status === 401) throw new Error('Unauthorized — check callback token')
    if (res.status >= 400) throw new Error(`HTTP ${res.status}`)
    toast.success('Callback endpoint reachable')
  }

  return (
    <div className="space-y-4">
      <Alert className="border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/20">
        <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        <AlertDescription className="text-xs text-blue-700 dark:text-blue-300">
          Tokens are stored in your browser&apos;s local storage and used for all API calls.
          They are never sent to any external service other than HyperGuest.
        </AlertDescription>
      </Alert>

      <TokenCard
        title="Static API Token"
        description="Property List & Enable Subscription"
        tokenKey="staticToken"
        infoText="Used for: GET /hotels.json, Enable Subscription"
        onTest={testStatic}
      />
      <TokenCard
        title="Operations API Token"
        description="Most API operations"
        tokenKey="operationsToken"
        infoText="Used for: Property Details, Facilities, Search, Calendar, Booking Push"
        onTest={testOperations}
      />
      <TokenCard
        title="Callback Auth Token"
        description="Eglobe callback endpoint"
        tokenKey="callbackToken"
        infoText="Used for: Incoming ARI update callbacks authentication"
        onTest={testCallback}
      />
    </div>
  )
}

// ─── Subscription Defaults Tab ────────────────────────────────────────────────

function SubscriptionDefaultsTab() {
  const settings = useSettingsStore()

  const [userId, setUserId] = useState(settings.userId)
  const [email, setEmail] = useState(settings.email)
  const [callbackUrl, setCallbackUrl] = useState(settings.callbackUrl)
  const [envelope, setEnvelope] = useState('Hyperguest')
  const [version, setVersion] = useState('1')
  const [method, setMethod] = useState('ARI')

  const isDirty =
    userId !== settings.userId ||
    email !== settings.email ||
    callbackUrl !== settings.callbackUrl

  const handleSaveAll = () => {
    settings.update({ userId, email, callbackUrl })
    toast.success('Subscription defaults saved')
  }

  const handleReset = () => {
    setUserId(settings.userId)
    setEmail(settings.email)
    setCallbackUrl(settings.callbackUrl)
    setEnvelope('Hyperguest')
    setVersion('1')
    setMethod('ARI')
    toast.info('Reset to saved values')
  }

  return (
    <Card className="border-border/60">
      <CardHeader>
        <CardTitle className="text-sm">Subscription Defaults</CardTitle>
        <CardDescription className="text-xs">
          Default values used when creating new HyperGuest subscriptions.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="userId" className="text-xs">Default User ID</Label>
            <Input
              id="userId"
              value={userId}
              onChange={e => setUserId(e.target.value)}
              placeholder="pradeep_s"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sub-email" className="text-xs">Default Email</Label>
            <Input
              id="sub-email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="it@eglobe-solutions.com"
            />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="callbackUrl" className="text-xs">Callback URL</Label>
            <Input
              id="callbackUrl"
              type="url"
              value={callbackUrl}
              onChange={e => setCallbackUrl(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="envelope" className="text-xs">Envelope</Label>
            <Input
              id="envelope"
              value={envelope}
              onChange={e => setEnvelope(e.target.value)}
              placeholder="Hyperguest"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="version" className="text-xs">Version</Label>
            <Input
              id="version"
              type="number"
              min={1}
              value={version}
              onChange={e => setVersion(e.target.value)}
            />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label className="text-xs">Method</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ARI">ARI</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Only ARI method is currently supported.</p>
          </div>
        </div>

        <Separator />

        <div className="flex items-center gap-2">
          <Button
            onClick={handleSaveAll}
            disabled={!isDirty}
            className="gap-1.5"
          >
            <Save className="h-4 w-4" /> Save All
          </Button>
          <Button variant="ghost" size="sm" onClick={handleReset} className="gap-1.5 text-muted-foreground">
            <RotateCcw className="h-3.5 w-3.5" /> Reset
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Database Tab ─────────────────────────────────────────────────────────────

type DbStatus = 'idle' | 'checking' | 'connected' | 'disconnected'

function DatabaseTab() {
  const [dbStatus, setDbStatus] = useState<DbStatus>('idle')
  const [dbError, setDbError] = useState('')

  const testDbConnection = async () => {
    setDbStatus('checking')
    setDbError('')
    try {
      const res = await fetch('/api/dashboard')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setDbStatus('connected')
      toast.success('Database connected successfully')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Connection failed'
      setDbStatus('disconnected')
      setDbError(msg)
      toast.error('Database connection failed', { description: msg })
    }
  }

  const statusBadge = () => {
    switch (dbStatus) {
      case 'checking':
        return <Badge variant="secondary" className="gap-1 text-xs"><Loader2 className="h-3 w-3 animate-spin" /> Checking...</Badge>
      case 'connected':
        return <Badge className="gap-1 text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"><CheckCircle2 className="h-3 w-3" /> Connected</Badge>
      case 'disconnected':
        return <Badge variant="destructive" className="gap-1 text-xs"><WifiOff className="h-3 w-3" /> Disconnected</Badge>
      default:
        return <Badge variant="outline" className="text-xs">Not tested</Badge>
    }
  }

  return (
    <div className="space-y-4">
      <Card className="border-border/60">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Database className="h-4 w-4 text-primary" />
              </div>
              <div>
                <CardTitle className="text-sm">MSSQL Database</CardTitle>
                <CardDescription className="text-xs">Connection status and configuration</CardDescription>
              </div>
            </div>
            {statusBadge()}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
            {[
              ['DB Server', process.env.NEXT_PUBLIC_DB_SERVER || 'Configured via .env.local'],
              ['DB Port', '1433 (default)'],
              ['DB Name', process.env.NEXT_PUBLIC_DB_NAME || 'Configured via .env.local'],
              ['Driver', 'mssql (node-mssql)'],
            ].map(([label, value]) => (
              <div key={label}>
                <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
                <p className="font-medium text-sm font-mono">{value}</p>
              </div>
            ))}
          </div>

          {dbError && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">{dbError}</AlertDescription>
            </Alert>
          )}

          <Alert className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/20">
            <Info className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <AlertDescription className="text-xs text-amber-700 dark:text-amber-300">
              Database connection is configured via environment variables in <code className="font-mono">.env.local</code>.
              Sensitive credentials (DB_SERVER, DB_USER, DB_PASSWORD, DB_NAME) are never exposed client-side.
            </AlertDescription>
          </Alert>

          <Button
            onClick={testDbConnection}
            disabled={dbStatus === 'checking'}
            variant="outline"
            className="gap-1.5"
          >
            {dbStatus === 'checking' ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Testing...</>
            ) : (
              <><Database className="h-4 w-4" /> Test DB Connection</>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

// ─── About & API Reference Tab ────────────────────────────────────────────────

const API_ENDPOINTS = [
  { endpoint: '/hotels.json', method: 'GET', description: 'Property List', auth: 'Static' },
  { endpoint: '/{id}/property-static.json', method: 'GET', description: 'Property Details', auth: 'Operations' },
  { endpoint: '/facilities.json', method: 'GET', description: 'Facilities', auth: 'Operations' },
  { endpoint: '/2.0 (search)', method: 'GET', description: 'Availability Search', auth: 'Operations' },
  { endpoint: '/calendar', method: 'POST', description: 'ARI Calendar', auth: 'Operations' },
  { endpoint: '/subscriptions/subscribe', method: 'POST', description: 'Subscribe', auth: '—' },
  { endpoint: '/subscriptions/{id}/getSubscriptionDetails', method: 'GET', description: 'Get Sub Details', auth: '—' },
  { endpoint: '/subscriptions/{id}/unsubscribe', method: 'GET', description: 'Unsubscribe', auth: '—' },
  { endpoint: '/subscriptions/{id}/enableSubscription', method: 'GET', description: 'Enable Sub', auth: 'Static' },
  { endpoint: '/envelope/booking/OTA/reservation', method: 'POST', description: 'Push Booking', auth: 'Operations' },
  { endpoint: '/callback/ariupdates', method: 'POST', description: 'ARI Callback', auth: 'Callback' },
]

const AUTH_BADGE_COLORS: Record<string, string> = {
  Static: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  Operations: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  Callback: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  '—': 'bg-gray-100 text-gray-600 dark:bg-gray-900/30 dark:text-gray-400',
}

const METHOD_COLORS: Record<string, string> = {
  GET: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  POST: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
}

function AboutTab() {
  const settings = useSettingsStore()

  const tokenStatus = [
    { label: 'Static Token', value: settings.staticToken, key: 'staticToken' },
    { label: 'Operations Token', value: settings.operationsToken, key: 'operationsToken' },
    { label: 'Callback Token', value: settings.callbackToken, key: 'callbackToken' },
  ]

  return (
    <div className="space-y-6">
      {/* App info */}
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-sm">About HyperGuest B2B Channel Manager</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            {[
              ['Version', '1.0.0'],
              ['Built By', 'Eglobe Solutions'],
              ['Contact Email', 'it@eglobe-solutions.com'],
              ['Framework', 'Next.js 14 App Router'],
              ['Database', 'Microsoft SQL Server (MSSQL)'],
              ['API Standard', 'OTA / SOAP (HyperGuest B2B)'],
            ].map(([label, value]) => (
              <div key={label}>
                <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
                <p className="font-medium">{value}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Token status */}
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-sm">Token Status</CardTitle>
          <CardDescription className="text-xs">Current token configuration overview</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {tokenStatus.map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={cn(
                  'h-2 w-2 rounded-full',
                  value ? 'bg-emerald-500' : 'bg-muted-foreground/40'
                )} />
                <span className="text-sm font-medium">{label}</span>
              </div>
              <span className="font-mono text-xs text-muted-foreground">
                {value ? value.slice(0, 8) + '...' : 'Not set'}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* API Reference table */}
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-sm">API Endpoints Reference</CardTitle>
          <CardDescription className="text-xs">All HyperGuest B2B API endpoints used by this application</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-xs">Endpoint</TableHead>
                <TableHead className="text-xs w-16">Method</TableHead>
                <TableHead className="text-xs">Description</TableHead>
                <TableHead className="text-xs w-28">Auth Token</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {API_ENDPOINTS.map((row, idx) => (
                <TableRow key={idx} className="hover:bg-muted/40">
                  <TableCell>
                    <code className="text-xs font-mono text-foreground">{row.endpoint}</code>
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={cn('text-xs font-mono font-semibold border-0', METHOD_COLORS[row.method])}
                    >
                      {row.method}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{row.description}</TableCell>
                  <TableCell>
                    <Badge className={cn('text-xs border-0', AUTH_BADGE_COLORS[row.auth])}>
                      {row.auth}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  return (
    <TooltipProvider>
      <div className="space-y-6 p-6">
        <PageHeader
          title="Settings"
          subtitle="Configure API tokens, subscription defaults, and view system information"
        />

        <Tabs defaultValue="api" className="space-y-6">
          <TabsList className="grid grid-cols-4 w-full max-w-xl">
            <TabsTrigger value="api" className="gap-1.5 text-xs">
              <Key className="h-3.5 w-3.5" />
              API Config
            </TabsTrigger>
            <TabsTrigger value="subscription" className="gap-1.5 text-xs">
              <Settings2 className="h-3.5 w-3.5" />
              Subscription
            </TabsTrigger>
            <TabsTrigger value="database" className="gap-1.5 text-xs">
              <Database className="h-3.5 w-3.5" />
              Database
            </TabsTrigger>
            <TabsTrigger value="about" className="gap-1.5 text-xs">
              <BookOpen className="h-3.5 w-3.5" />
              About
            </TabsTrigger>
          </TabsList>

          <motion.div
            key="tabs-content"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            <TabsContent value="api" className="mt-0">
              <ApiConfigTab />
            </TabsContent>

            <TabsContent value="subscription" className="mt-0">
              <SubscriptionDefaultsTab />
            </TabsContent>

            <TabsContent value="database" className="mt-0">
              <DatabaseTab />
            </TabsContent>

            <TabsContent value="about" className="mt-0">
              <AboutTab />
            </TabsContent>
          </motion.div>
        </Tabs>
      </div>
    </TooltipProvider>
  )
}
