'use client'

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import {
  Rss,
  Plus,
  Info,
  Play,
  Pause,
  Trash2,
  Copy,
  Check,
  AlertCircle,
  RefreshCw,
  Search,
  Filter,
} from 'lucide-react'

import { PageHeader } from '@/components/layout/PageHeader'
import { EmptyState } from '@/components/layout/EmptyState'
import { StatsCard } from '@/components/layout/StatsCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardHeader,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { cn, formatDate, getStatusBadgeVariant } from '@/lib/utils'
import {
  useSubscriptionList,
  useSubscriptionDetail,
  useSubscribe,
  useUnsubscribe,
  useEnableSubscription,
} from '@/lib/hooks/useSubscriptions'
import type { SubscriptionDetail, PropertyDetail } from '@/lib/types'

// ─────────────────────────────── HELPERS ────────────────────────────────────

function parseLines(raw: string): string[] {
  return raw
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function parseLineNumbers(raw: string): number[] {
  return parseLines(raw)
    .map(Number)
    .filter((n) => !isNaN(n) && n > 0)
}

function parsePropertyIds(raw: string): number[] {
  return raw
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map(Number)
    .filter((n) => !isNaN(n) && n > 0)
}

function statusBadgeClass(status: string): string {
  const s = status.toLowerCase()
  if (s === 'enabled') return 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400'
  if (s === 'disabled') return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400'
  return 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400'
}

// ─────────────────────────────── CREATE DIALOG ───────────────────────────────

interface CreateSubscriptionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function CreateSubscriptionDialog({ open, onOpenChange }: CreateSubscriptionDialogProps) {
  const subscribe = useSubscribe()

  // Auto-fetch state
  const [propertyIdInput, setPropertyIdInput] = useState('')
  const [fetchedProperty, setFetchedProperty] = useState<PropertyDetail | null>(null)
  const [fetchLoading, setFetchLoading] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [selectedRatePlans, setSelectedRatePlans] = useState<string[]>([])
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Config fields
  const [userId, setUserId] = useState('pradeep_s')
  const [email, setEmail] = useState('it@eglobe-solutions.com')
  const [callbackUrl, setCallbackUrl] = useState(
    'https://www.eglobe-solutions.com/webapichannelmanager/hyperguestb2bsubscription/callback/ariupdates'
  )

  // Derived: all unique rate plan codes from the fetched property
  const allRatePlanCodes = useMemo(() => {
    if (!fetchedProperty) return []
    const mapping = fetchedProperty.roomsAndRatePlansMapping ?? {}
    return Array.from(new Set(Object.values(mapping).flat())).sort()
  }, [fetchedProperty])

  // When allRatePlanCodes updates (new property fetched), select them all
  const prevCodesRef = useRef<string[]>([])
  if (
    allRatePlanCodes.length > 0 &&
    JSON.stringify(allRatePlanCodes) !== JSON.stringify(prevCodesRef.current)
  ) {
    prevCodesRef.current = allRatePlanCodes
    setSelectedRatePlans(allRatePlanCodes)
  }

  const toggleRatePlan = (code: string) =>
    setSelectedRatePlans((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    )

  // Fetch property detail when a valid ID is entered (debounced)
  const fetchProperty = useCallback(async (idStr: string) => {
    const id = parseInt(idStr.trim(), 10)
    if (!id || isNaN(id)) {
      setFetchedProperty(null)
      setFetchError(null)
      return
    }
    setFetchLoading(true)
    setFetchError(null)
    try {
      const res = await fetch(`/api/properties/${id}`)
      if (!res.ok) throw new Error(`Property ${id} not found`)
      const json = await res.json()
      const prop: PropertyDetail = json?.data ?? json
      setFetchedProperty(prop)
    } catch (err) {
      setFetchedProperty(null)
      setFetchError(err instanceof Error ? err.message : 'Failed to fetch property')
    } finally {
      setFetchLoading(false)
    }
  }, [])

  const handlePropertyIdChange = (value: string) => {
    setPropertyIdInput(value)
    setFetchedProperty(null)
    setSelectedRatePlans([])
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchProperty(value), 600)
  }

  const handleClose = (state: boolean) => {
    if (!state) {
      setPropertyIdInput('')
      setFetchedProperty(null)
      setFetchError(null)
      setSelectedRatePlans([])
    }
    onOpenChange(state)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const propertyIdsParsed = parsePropertyIds(propertyIdInput)
    if (propertyIdsParsed.length === 0) {
      toast.error('No valid property IDs found')
      return
    }
    const codes = selectedRatePlans
    if (codes.length === 0) {
      toast.error('Select at least one rate plan code')
      return
    }
    const payload = {
      method: 'ARI',
      propertyIds: propertyIdsParsed,
      ratePlans: propertyIdsParsed.map((pid) => ({
        propertyId: pid,
        ratePlanCodes: codes,
      })),
      userId,
      envelope: 'Hyperguest',
      authentication: { bearer: '' },
      envelopeSubUrls: { Callback: callbackUrl },
      email,
      parameters: {},
      version: 1,
    }
    try {
      const result = await subscribe.mutateAsync(payload)
      toast.success('Subscription created!', {
        description: `Subscription ID: ${result.subscriptionId}`,
      })
      handleClose(false)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create subscription'
      toast.error('Create failed', { description: msg })
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New ARI Subscription</DialogTitle>
          <DialogDescription>
            Enter a property ID — rate plans are fetched automatically.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {/* Property ID — single field, auto-fetches property */}
          <div className="space-y-1.5">
            <Label>Property ID *</Label>
            <div className="relative">
              <Input
                placeholder="e.g. 12345"
                value={propertyIdInput}
                onChange={(e) => handlePropertyIdChange(e.target.value)}
                className="font-mono"
              />
              {fetchLoading && (
                <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                  <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              )}
            </div>
            {fetchError && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> {fetchError}
              </p>
            )}
            {fetchedProperty && (
              <p className="text-xs text-emerald-600 flex items-center gap-1">
                <Check className="h-3 w-3" />
                <span className="font-medium">{fetchedProperty.name}</span>
                {fetchedProperty.location?.city?.name && (
                  <span className="text-muted-foreground">· {fetchedProperty.location.city.name}</span>
                )}
              </p>
            )}
          </div>

          {/* Rate Plan Codes — auto-populated as checkboxes */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Rate Plan Codes *</Label>
              {allRatePlanCodes.length > 0 && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="text-[10px] text-primary hover:underline"
                    onClick={() => setSelectedRatePlans(allRatePlanCodes)}
                  >
                    Select all
                  </button>
                  <span className="text-[10px] text-muted-foreground">·</span>
                  <button
                    type="button"
                    className="text-[10px] text-primary hover:underline"
                    onClick={() => setSelectedRatePlans([])}
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>

            {fetchLoading ? (
              <div className="rounded-md border bg-muted/20 p-3 space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-5 bg-muted animate-pulse rounded" />
                ))}
              </div>
            ) : allRatePlanCodes.length > 0 ? (
              <div className="rounded-md border bg-muted/20 p-2 max-h-40 overflow-y-auto space-y-1">
                {allRatePlanCodes.map((code) => (
                  <label
                    key={code}
                    className="flex items-center gap-2 cursor-pointer rounded px-2 py-1 hover:bg-muted/50 transition-colors"
                  >
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5 accent-primary"
                      checked={selectedRatePlans.includes(code)}
                      onChange={() => toggleRatePlan(code)}
                    />
                    <span className="font-mono text-xs">{code}</span>
                  </label>
                ))}
              </div>
            ) : (
              <div className="rounded-md border bg-muted/20 p-3 text-center text-xs text-muted-foreground">
                {propertyIdInput
                  ? fetchError
                    ? 'Could not load rate plans'
                    : 'Enter a valid property ID to auto-load rate plans'
                  : 'Enter a property ID above to auto-load rate plans'}
              </div>
            )}
            {selectedRatePlans.length === 0 && allRatePlanCodes.length > 0 && (
              <p className="text-xs text-amber-600">Select at least one rate plan</p>
            )}
          </div>

          {/* User ID */}
          <div className="space-y-1.5">
            <Label>User ID *</Label>
            <Input
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="pradeep_s"
            />
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <Label>Email *</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          {/* Callback URL */}
          <div className="space-y-1.5">
            <Label>Callback URL *</Label>
            <Input
              value={callbackUrl}
              onChange={(e) => setCallbackUrl(e.target.value)}
              className="text-xs"
            />
          </div>

          {/* Method (fixed ARI) */}
          <div className="space-y-1.5">
            <Label>Method</Label>
            <Input value="ARI" readOnly className="bg-muted/40 font-mono text-sm" />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleClose(false)}
              disabled={subscribe.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={subscribe.isPending || fetchLoading} className="gap-2">
              {subscribe.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Creating…
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Create Subscription
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─────────────────────────────── VIEW DIALOG ─────────────────────────────────

interface ViewSubscriptionDialogProps {
  subscriptionId: string | null
  onOpenChange: (open: boolean) => void
}

function ViewSubscriptionDialog({ subscriptionId, onOpenChange }: ViewSubscriptionDialogProps) {
  const [copied, setCopied] = useState(false)
  const open = !!subscriptionId

  const { data, isLoading, error } = useSubscriptionDetail(subscriptionId ?? '')

  const handleCopy = async () => {
    if (!subscriptionId) return
    await navigator.clipboard.writeText(subscriptionId)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Subscription Details</DialogTitle>
          <DialogDescription>
            Full details from HyperGuest for this subscription.
          </DialogDescription>
        </DialogHeader>

        {isLoading && (
          <div className="space-y-3 py-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-5 w-full" />
            ))}
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error.message}</AlertDescription>
          </Alert>
        )}

        {data && (
          <div className="space-y-4 text-sm">
            {/* ID with copy */}
            <div className="flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2">
              <span className="font-mono text-xs break-all">{data.subscriptionId}</span>
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 shrink-0 ml-2" onClick={handleCopy}>
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
            </div>

            {/* Detail grid */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-2">
              {[
                ['Status', <Badge key="s" className={cn('text-xs border', statusBadgeClass(data.status))}>{data.status}</Badge>],
                ['Method', <Badge key="m" variant="outline" className="text-xs">{data.method}</Badge>],
                ['User ID', data.userId],
                ['Envelope', data.envelope],
                ['Version', data.version],
              ].map(([label, value], i) => (
                <div key={i} className="space-y-0.5">
                  <p className="text-xs text-muted-foreground">{label as string}</p>
                  <div className="font-medium">
                    {typeof value === 'string' || typeof value === 'number' ? String(value) : value}
                  </div>
                </div>
              ))}
            </div>

            <Separator />

            {/* Property IDs */}
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Property IDs
              </p>
              <div className="flex flex-wrap gap-1.5">
                {(data.propertyIds ?? []).map((pid) => (
                  <Badge key={pid} variant="secondary" className="font-mono">
                    {pid}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─────────────────────────────── CONFIRM DIALOG ──────────────────────────────

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmLabel: string
  confirmVariant?: 'default' | 'destructive'
  loading?: boolean
  onConfirm: () => void
}

function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  confirmVariant = 'default',
  loading,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button variant={confirmVariant} onClick={onConfirm} disabled={loading} className="gap-1.5">
            {loading && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─────────────────────────────── SUBSCRIPTION CARD ───────────────────────────

interface SubscriptionCardAction {
  onView: () => void
  onEnable: () => void
  onDisable: () => void
  onDelete: () => void
  enableLoading: boolean
  disableLoading: boolean
  deleteLoading: boolean
}

function SubscriptionCard({
  sub,
  actions,
  index,
  propertyNames,
}: {
  sub: SubscriptionDetail & { createdAt?: string; email?: string; callbackUrl?: string }
  actions: SubscriptionCardAction
  index: number
  propertyNames: Record<string, string>
}) {
  const propertyIds = useMemo(() => {
    const raw = sub.propertyIds
    if (Array.isArray(raw)) return raw
    // fallback: stored as JSON string in older local records
    try {
      const parsed = JSON.parse(raw as unknown as string)
      return Array.isArray(parsed) ? parsed : [raw]
    } catch {
      return String(raw).split(/[\s,]+/).map((s) => s.trim()).filter(Boolean)
    }
  }, [sub.propertyIds])

  const isEnabled = sub.status.toLowerCase() === 'enabled'
  const isDisabled = sub.status.toLowerCase() === 'disabled'

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
    >
      <Card className="border-border/60 hover:border-border transition-colors">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            {/* ID + status */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-sm font-semibold text-foreground break-all">
                {sub.subscriptionId}
              </span>
              <span
                className={cn(
                  'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium',
                  statusBadgeClass(sub.status)
                )}
              >
                {sub.status}
              </span>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-1.5 shrink-0">
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 gap-1 text-xs"
                onClick={actions.onView}
                title="View Details"
              >
                <Info className="h-3.5 w-3.5" />
                Details
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 gap-1 text-xs text-green-600 border-green-200 hover:bg-green-50 dark:hover:bg-green-950/30"
                onClick={actions.onEnable}
                disabled={isEnabled || actions.enableLoading}
                title="Enable"
              >
                {actions.enableLoading ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Play className="h-3.5 w-3.5" />
                )}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 gap-1 text-xs text-yellow-600 border-yellow-200 hover:bg-yellow-50 dark:hover:bg-yellow-950/30"
                onClick={actions.onDisable}
                disabled={isDisabled || actions.disableLoading}
                title="Disable"
              >
                {actions.disableLoading ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Pause className="h-3.5 w-3.5" />
                )}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 text-xs text-destructive border-red-200 hover:bg-red-50 dark:hover:bg-red-950/30"
                onClick={actions.onDelete}
                disabled={actions.deleteLoading}
                title="Delete"
              >
                {actions.deleteLoading ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 text-sm">
            {/* Property IDs + Hotel Names */}
            <div className="col-span-2 sm:col-span-3 lg:col-span-4 space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
                Properties
              </p>
              <div className="flex flex-wrap gap-2">
                {propertyIds.map((pid: string | number, i: number) => {
                  const name = propertyNames[String(pid)]
                  return (
                    <div key={i} className="flex items-center gap-1.5 bg-muted/50 border border-border/60 rounded-md px-2 py-1">
                      <span className="font-mono text-xs font-semibold text-foreground">{pid}</span>
                      {name ? (
                        <>
                          <span className="text-muted-foreground text-xs">·</span>
                          <span className="text-xs text-foreground/80 max-w-[160px] truncate" title={name}>{name}</span>
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground/50 italic">loading…</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            <Separator className="col-span-2 sm:col-span-3 lg:col-span-4" />

            {/* Meta fields */}
            {[
              ['Method', <Badge key="m" variant="outline" className="text-xs font-mono">{sub.method || 'ARI'}</Badge>],
              ['Envelope', sub.envelope || '—'],
              ['User ID', sub.userId || '—'],
              ['Version', sub.version ?? '—'],
              ['Created', sub.createdAt ? formatDate(sub.createdAt) : '—'],
            ].map(([label, value], i) => (
              <div key={i} className="space-y-0.5">
                <p className="text-xs text-muted-foreground">{label as string}</p>
                <div className="text-sm font-medium text-foreground">
                  {typeof value === 'string' ? value : value}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ─────────────────────────────── SKELETON ───────────────────────────────────

function SubscriptionSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <Card key={i} className="p-5 space-y-3">
          <div className="flex justify-between">
            <Skeleton className="h-5 w-52" />
            <div className="flex gap-2">
              {[1, 2, 3, 4].map((j) => (
                <Skeleton key={j} className="h-7 w-8" />
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-5 w-16" />
          </div>
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((j) => (
              <Skeleton key={j} className="h-8 w-full" />
            ))}
          </div>
        </Card>
      ))}
    </div>
  )
}

// ─────────────────────────────── PAGE ───────────────────────────────────────

export default function SubscriptionsPage() {
  const [createOpen, setCreateOpen] = useState(false)
  const [viewId, setViewId] = useState<string | null>(null)

  // Confirm dialogs state
  const [confirmAction, setConfirmAction] = useState<{
    type: 'enable' | 'disable' | 'delete'
    subscriptionId: string
  } | null>(null)
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({})

  // Filter state
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const { data: subscriptions, isLoading, error, refetch } = useSubscriptionList()
  const unsubscribe = useUnsubscribe()
  const enableSub = useEnableSubscription()

  // ── Property name cache (propertyId → hotel name) ──────────────────────────
  const [propertyNames, setPropertyNames] = useState<Record<string, string>>({})
  const fetchingIds = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!subscriptions) return
    // Collect all unique property IDs across all subscriptions
    const allIds = new Set<string>()
    subscriptions.forEach((sub) => {
      const ids = Array.isArray(sub.propertyIds) ? sub.propertyIds : [sub.propertyIds]
      ids.forEach((id) => {
        const key = String(id)
        if (key && !propertyNames[key] && !fetchingIds.current.has(key)) {
          allIds.add(key)
        }
      })
    })
    if (allIds.size === 0) return

    // Mark as in-flight so we don't double-fetch
    allIds.forEach((id) => fetchingIds.current.add(id))

    // Fetch in parallel (batches of 10 to avoid hammering the API)
    const ids = Array.from(allIds)
    const BATCH = 10
    const fetchBatch = async (batch: string[]) => {
      await Promise.all(
        batch.map(async (id) => {
          try {
            const res = await fetch(`/api/properties/${id}`)
            if (!res.ok) return
            const json = await res.json()
            const prop = json?.data ?? json
            const name: string = prop?.name ?? prop?.basicInfo?.name ?? ''
            if (name) {
              setPropertyNames((prev) => ({ ...prev, [id]: name }))
            }
          } catch {
            // silently ignore — just won't show name
          } finally {
            fetchingIds.current.delete(id)
          }
        })
      )
    }

    // Fire batches sequentially
    const runBatches = async () => {
      for (let i = 0; i < ids.length; i += BATCH) {
        await fetchBatch(ids.slice(i, i + BATCH))
      }
    }
    runBatches()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscriptions])

  // Stats
  const stats = useMemo(() => {
    if (!subscriptions) return { total: 0, active: 0, disabled: 0 }
    return {
      total: subscriptions.length,
      active: subscriptions.filter((s) => s.status.toLowerCase() === 'enabled').length,
      disabled: subscriptions.filter((s) => s.status.toLowerCase() === 'disabled').length,
    }
  }, [subscriptions])

  // Filtered list
  const filtered = useMemo(() => {
    if (!subscriptions) return []
    return subscriptions.filter((sub) => {
      const matchesSearch =
        !search ||
        sub.subscriptionId.toLowerCase().includes(search.toLowerCase()) ||
        (Array.isArray(sub.propertyIds)
          ? sub.propertyIds.some((id) => String(id).includes(search))
          : String(sub.propertyIds).includes(search))
      const matchesStatus =
        statusFilter === 'all' || sub.status.toLowerCase() === statusFilter.toLowerCase()
      return matchesSearch && matchesStatus
    })
  }, [subscriptions, search, statusFilter])

  const handleConfirmAction = async () => {
    if (!confirmAction) return
    const { type, subscriptionId } = confirmAction
    setActionLoading((prev) => ({ ...prev, [`${type}-${subscriptionId}`]: true }))

    try {
      if (type === 'delete' || type === 'disable') {
        await unsubscribe.mutateAsync(subscriptionId)
        toast.success(type === 'delete' ? 'Subscription deleted' : 'Subscription disabled', {
          description: `ID: ${subscriptionId}`,
        })
      } else if (type === 'enable') {
        await enableSub.mutateAsync(subscriptionId)
        toast.success('Subscription enabled', { description: `ID: ${subscriptionId}` })
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Action failed'
      toast.error('Action failed', { description: msg })
    } finally {
      setActionLoading((prev) => ({ ...prev, [`${type}-${subscriptionId}`]: false }))
      setConfirmAction(null)
    }
  }

  const getConfirmProps = () => {
    if (!confirmAction) return null
    const { type, subscriptionId } = confirmAction
    const short = subscriptionId.slice(0, 16) + '…'

    if (type === 'enable') {
      return {
        title: 'Enable Subscription',
        description: `Re-enable ARI push for subscription ${short}?`,
        confirmLabel: 'Enable',
        confirmVariant: 'default' as const,
      }
    }
    if (type === 'disable') {
      return {
        title: 'Disable Subscription',
        description: `Pause ARI push for subscription ${short}?`,
        confirmLabel: 'Disable',
        confirmVariant: 'default' as const,
      }
    }
    return {
      title: 'Delete Subscription',
      description: `Permanently delete subscription ${short}? This cannot be undone.`,
      confirmLabel: 'Delete',
      confirmVariant: 'destructive' as const,
    }
  }

  const confirmProps = getConfirmProps()

  return (
    <div className="space-y-6">
      <PageHeader
        title="ARI Subscriptions"
        subtitle="Manage HyperGuest ARI push subscriptions"
      >
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          New Subscription
        </Button>
      </PageHeader>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatsCard
          icon={Rss}
          label="Total Subscriptions"
          value={stats.total}
          variant="blue"
          loading={isLoading}
          index={0}
        />
        <StatsCard
          icon={Rss}
          label="Active"
          value={stats.active}
          variant="green"
          loading={isLoading}
          index={1}
        />
        <StatsCard
          icon={Rss}
          label="Disabled"
          value={stats.disabled}
          variant="red"
          loading={isLoading}
          index={2}
        />
      </div>

      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by subscription ID or property ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-44">
            <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="Filter status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="enabled">Enabled</SelectItem>
            <SelectItem value="disabled">Disabled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {/* Loading */}
        {isLoading && (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <SubscriptionSkeleton />
          </motion.div>
        )}

        {/* Error */}
        {!isLoading && error && (
          <motion.div key="error" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error Loading Subscriptions</AlertTitle>
              <AlertDescription className="flex items-center justify-between gap-4">
                <span>{error.message}</span>
                <Button size="sm" variant="outline" onClick={() => refetch()} className="shrink-0 gap-1.5">
                  <RefreshCw className="h-3.5 w-3.5" />
                  Retry
                </Button>
              </AlertDescription>
            </Alert>
          </motion.div>
        )}

        {/* Subscription cards */}
        {!isLoading && !error && filtered.length > 0 && (
          <motion.div
            key="list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-4"
          >
            {filtered.map((sub, i) => (
              <SubscriptionCard
                key={sub.subscriptionId}
                sub={sub}
                index={i}
                propertyNames={propertyNames}
                actions={{
                  onView: () => setViewId(sub.subscriptionId),
                  onEnable: () =>
                    setConfirmAction({ type: 'enable', subscriptionId: sub.subscriptionId }),
                  onDisable: () =>
                    setConfirmAction({ type: 'disable', subscriptionId: sub.subscriptionId }),
                  onDelete: () =>
                    setConfirmAction({ type: 'delete', subscriptionId: sub.subscriptionId }),
                  enableLoading: !!actionLoading[`enable-${sub.subscriptionId}`],
                  disableLoading: !!actionLoading[`disable-${sub.subscriptionId}`],
                  deleteLoading: !!actionLoading[`delete-${sub.subscriptionId}`],
                }}
              />
            ))}
          </motion.div>
        )}

        {/* Empty — no data at all */}
        {!isLoading && !error && subscriptions && subscriptions.length === 0 && (
          <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <EmptyState
              icon={Rss}
              title="No subscriptions yet"
              description="Create your first ARI subscription to start receiving push updates from HyperGuest."
              action={{
                label: 'New Subscription',
                onClick: () => setCreateOpen(true),
                icon: Plus,
              }}
            />
          </motion.div>
        )}

        {/* Empty — filtered, but data exists */}
        {!isLoading && !error && subscriptions && subscriptions.length > 0 && filtered.length === 0 && (
          <motion.div key="filtered-empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <EmptyState
              icon={Search}
              title="No matching subscriptions"
              description="Try adjusting your search or status filter."
              action={{
                label: 'Clear Filters',
                onClick: () => { setSearch(''); setStatusFilter('all') },
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dialogs */}
      <CreateSubscriptionDialog open={createOpen} onOpenChange={setCreateOpen} />

      <ViewSubscriptionDialog
        subscriptionId={viewId}
        onOpenChange={(open) => { if (!open) setViewId(null) }}
      />

      {confirmProps && (
        <ConfirmDialog
          open={!!confirmAction}
          onOpenChange={(open) => { if (!open) setConfirmAction(null) }}
          title={confirmProps.title}
          description={confirmProps.description}
          confirmLabel={confirmProps.confirmLabel}
          confirmVariant={confirmProps.confirmVariant}
          loading={
            confirmAction
              ? !!actionLoading[`${confirmAction.type}-${confirmAction.subscriptionId}`]
              : false
          }
          onConfirm={handleConfirmAction}
        />
      )}
    </div>
  )
}
