'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import {
  Activity, Copy, Eye, Download, Search, ChevronLeft, ChevronRight,
  Radio, RefreshCw, CheckCircle2, Clock, Loader2, ExternalLink, Calendar,
  CheckCheck
} from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer
} from 'recharts'

import { PageHeader } from '@/components/layout/PageHeader'
import { StatsCard } from '@/components/layout/StatsCard'
import { EmptyState } from '@/components/layout/EmptyState'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table'
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger
} from '@/components/ui/tooltip'
import { Alert, AlertDescription } from '@/components/ui/alert'

import { useCallbacks, useCallbackStats } from '@/lib/hooks/useCallbacks'
import { cn, formatDateTime, formatDate } from '@/lib/utils'
import type { StoredCallback } from '@/lib/types'

// ─── Constants ────────────────────────────────────────────────────────────────

const CALLBACK_URL =
  'https://www.eglobe-solutions.com/webapichannelmanager/hyperguestb2bsubscription/callback/ariupdates'
const PAGE_SIZE = 25
const AUTO_REFRESH_INTERVAL = 30_000

// ─── Helpers ──────────────────────────────────────────────────────────────────

function truncatePayload(payload: string, maxLen = 80): string {
  try {
    const parsed = JSON.parse(payload)
    const compact = JSON.stringify(parsed)
    return compact.length > maxLen ? compact.slice(0, maxLen) + '...' : compact
  } catch {
    return payload.length > maxLen ? payload.slice(0, maxLen) + '...' : payload
  }
}

function formatJsonPretty(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2)
  } catch {
    return raw
  }
}

// ─── Skeleton Row ─────────────────────────────────────────────────────────────

function SkeletonRow({ cols }: { cols: number }) {
  return (
    <TableRow>
      {Array.from({ length: cols }).map((_, i) => (
        <TableCell key={i}><Skeleton className="h-4 w-full" /></TableCell>
      ))}
    </TableRow>
  )
}

// ─── View Payload Dialog ───────────────────────────────────────────────────────

interface ViewPayloadDialogProps {
  callback: StoredCallback | null
  open: boolean
  onOpenChange: (v: boolean) => void
  onMarkProcessed: (id: number) => void
}

function ViewPayloadDialog({ callback, open, onOpenChange, onMarkProcessed }: ViewPayloadDialogProps) {
  const [marking, setMarking] = useState(false)

  if (!callback) return null

  const prettyJson = formatJsonPretty(callback.payload || '')

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(prettyJson)
      toast.success('Payload copied to clipboard')
    } catch {
      toast.error('Failed to copy')
    }
  }

  const handleDownload = () => {
    const blob = new Blob([prettyJson], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `callback-${callback.id}-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success('Download started')
  }

  const handleMarkProcessed = async () => {
    if (!callback.id) return
    setMarking(true)
    try {
      const res = await fetch(`/api/callbacks/${callback.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ processed: true, status: 'processed' }),
      })
      if (!res.ok) throw new Error('Request failed')
      onMarkProcessed(callback.id)
      toast.success('Marked as processed')
      onOpenChange(false)
    } catch {
      toast.error('Failed to mark as processed')
    } finally {
      setMarking(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Callback Payload
          </DialogTitle>
          <DialogDescription>
            Received {formatDateTime(callback.receivedAt)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Meta */}
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Received At</p>
              <p className="font-medium">{formatDateTime(callback.receivedAt)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Property ID</p>
              <p className="font-medium">
                {callback.propertyId ? (
                  <Badge variant="outline">{callback.propertyId}</Badge>
                ) : (
                  <span className="text-muted-foreground">Unknown</span>
                )}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Status</p>
              <Badge
                variant={callback.status === 'processed' ? 'default' : 'secondary'}
                className={cn(
                  'text-xs',
                  callback.status === 'processed'
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                    : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                )}
              >
                {callback.status}
              </Badge>
            </div>
          </div>

          <Separator />

          {/* Payload */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold">Full JSON Payload</h4>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1.5">
                  <Copy className="h-3.5 w-3.5" /> Copy
                </Button>
                <Button variant="outline" size="sm" onClick={handleDownload} className="gap-1.5">
                  <Download className="h-3.5 w-3.5" /> Download
                </Button>
              </div>
            </div>
            <pre className="bg-muted/60 text-foreground text-xs rounded-lg p-4 overflow-x-auto max-h-64 overflow-y-auto font-mono leading-relaxed border border-border/60">
              {prettyJson}
            </pre>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          {callback.status !== 'processed' && (
            <Button
              onClick={handleMarkProcessed}
              disabled={marking}
              className="gap-1.5"
            >
              {marking ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Processing...</>
              ) : (
                <><CheckCheck className="h-4 w-4" /> Mark as Processed</>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Callbacks Chart ───────────────────────────────────────────────────────────

interface ChartDataPoint {
  date: string
  count: number
}

interface CallbacksChartProps {
  data: ChartDataPoint[]
  loading: boolean
}

function CallbacksChart({ data, loading }: CallbacksChartProps) {
  return (
    <Card className="border-border/60">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          Callbacks Received — Last 14 Days
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-48 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : data.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">
            No data available
          </div>
        ) : (
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  tickFormatter={v => {
                    try { return formatDate(v, 'dd/MM') } catch { return v }
                  }}
                />
                <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} allowDecimals={false} />
                <RechartsTooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: 'hsl(var(--foreground))',
                  }}
                  labelFormatter={v => {
                    try { return formatDate(String(v), 'dd/MM/yyyy') } catch { return String(v) }
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  name="Callbacks"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ r: 3, fill: 'hsl(var(--primary))' }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function CallbacksPage() {
  const [page, setPage] = useState(1)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [propertySearch, setPropertySearch] = useState('')
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)
  const [selectedCallback, setSelectedCallback] = useState<StoredCallback | null>(null)
  const [viewOpen, setViewOpen] = useState(false)
  const [localProcessed, setLocalProcessed] = useState<Set<number>>(new Set())

  const { data: statsData, isLoading: statsLoading, refetch: refetchStats } = useCallbackStats()
  const {
    data: callbacksData,
    isLoading: callbacksLoading,
    refetch: refetchCallbacks,
  } = useCallbacks(page, PAGE_SIZE)

  // Build chart data from stats byDate field
  const chartData: ChartDataPoint[] = (statsData?.byDate ?? []).map(d => ({
    date: d.callbackDate,
    count: d.count,
  }))

  const refetchAll = useCallback(async () => {
    await Promise.all([refetchCallbacks(), refetchStats()])
    setLastRefreshed(new Date())
  }, [refetchCallbacks, refetchStats])

  // Auto-refresh
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(() => {
        refetchAll()
      }, AUTO_REFRESH_INTERVAL)
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [autoRefresh, refetchAll])

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(CALLBACK_URL)
      toast.success('Callback URL copied to clipboard')
    } catch {
      toast.error('Copy failed')
    }
  }

  const handleView = (cb: StoredCallback) => {
    setSelectedCallback(cb)
    setViewOpen(true)
  }

  const handleMarkProcessed = (id: number) => {
    setLocalProcessed(prev => new Set(prev).add(id))
    refetchAll()
  }

  // Filter client-side (property search and status)
  const allCallbacks: StoredCallback[] = callbacksData?.items ?? []
  const filteredCallbacks = allCallbacks.filter(cb => {
    if (propertySearch && cb.propertyId !== undefined) {
      if (!String(cb.propertyId).includes(propertySearch)) return false
    }
    if (statusFilter !== 'all') {
      const effectiveStatus = localProcessed.has(cb.id) ? 'processed' : cb.status
      if (effectiveStatus !== statusFilter) return false
    }
    return true
  })

  const total = callbacksData?.total ?? 0
  const totalPages = callbacksData?.totalPages ?? 1

  useEffect(() => { setPage(1) }, [statusFilter, dateFrom, dateTo, propertySearch])

  const stats = statsData

  return (
    <TooltipProvider>
      <div className="space-y-6 p-6">
        {/* Header */}
        <PageHeader
          title="Callback Logs"
          subtitle="Incoming ARI update webhooks from HyperGuest"
        >
          <Button
            variant="outline" size="sm"
            onClick={() => refetchAll()}
            className="gap-1.5"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
        </PageHeader>

        {/* Webhook URL card */}
        <Alert className="border-primary/20 bg-primary/5">
          <ExternalLink className="h-4 w-4 text-primary" />
          <AlertDescription>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="space-y-0.5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Your ARI Callback Endpoint
                </p>
                <p className="font-mono text-sm text-foreground break-all">{CALLBACK_URL}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Configure this URL in your HyperGuest subscription to receive ARI updates.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={handleCopyUrl} className="gap-1.5 shrink-0">
                <Copy className="h-3.5 w-3.5" /> Copy URL
              </Button>
            </div>
          </AlertDescription>
        </Alert>

        {/* Stats row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard
            icon={Activity}
            label="Total Received"
            value={statsLoading ? 0 : (stats?.total ?? 0)}
            variant="blue"
            loading={statsLoading}
            index={0}
          />
          <StatsCard
            icon={CheckCircle2}
            label="Processed"
            value={statsLoading ? 0 : ((stats?.total ?? 0) - (stats?.unprocessed ?? 0))}
            variant="green"
            loading={statsLoading}
            index={1}
          />
          <StatsCard
            icon={Clock}
            label="Unprocessed"
            value={statsLoading ? 0 : (stats?.unprocessed ?? 0)}
            variant="orange"
            loading={statsLoading}
            index={2}
          />
          <StatsCard
            icon={Calendar}
            label="Received Today"
            value={statsLoading ? 0 : (stats?.receivedToday ?? 0)}
            variant="purple"
            loading={statsLoading}
            index={3}
          />
        </div>

        {/* Auto-refresh + last refreshed */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Switch
              id="auto-refresh"
              checked={autoRefresh}
              onCheckedChange={v => {
                setAutoRefresh(v)
                if (v) toast.info('Auto-refresh enabled (every 30s)')
                else toast.info('Auto-refresh disabled')
              }}
            />
            <Label htmlFor="auto-refresh" className="text-sm cursor-pointer select-none">
              Auto-refresh (30s)
            </Label>
            {autoRefresh && (
              <motion.span
                animate={{ opacity: [1, 0.4, 1] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400"
              >
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Live
              </motion.span>
            )}
          </div>
          {lastRefreshed && (
            <p className="text-xs text-muted-foreground">
              Last refreshed: {formatDateTime(lastRefreshed.toISOString())}
            </p>
          )}
        </div>

        {/* Filter bar */}
        <Card className="border-border/60">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[160px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search property ID..."
                  className="pl-9"
                  value={propertySearch}
                  onChange={e => setPropertySearch(e.target.value)}
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="processed">Processed</SelectItem>
                  <SelectItem value="unprocessed">Unprocessed</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  className="w-36 text-sm"
                  value={dateFrom}
                  onChange={e => setDateFrom(e.target.value)}
                />
                <span className="text-muted-foreground text-sm">to</span>
                <Input
                  type="date"
                  className="w-36 text-sm"
                  value={dateTo}
                  onChange={e => setDateTo(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Callbacks Table */}
        <Card className="border-border/60">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-12">#</TableHead>
                <TableHead>Received At</TableHead>
                <TableHead>Property ID</TableHead>
                <TableHead>Payload Preview</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-16 text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {callbacksLoading ? (
                Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} cols={6} />)
              ) : filteredCallbacks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="p-0">
                    <EmptyState
                      icon={Radio}
                      title="No callbacks received"
                      description={
                        statusFilter !== 'all' || propertySearch
                          ? 'No callbacks match the current filters'
                          : 'Configure the callback URL in HyperGuest to start receiving ARI updates'
                      }
                    />
                  </TableCell>
                </TableRow>
              ) : (
                filteredCallbacks.map((cb, rowIdx) => {
                  const effectiveStatus = localProcessed.has(cb.id) ? 'processed' : cb.status
                  const isProcessed = effectiveStatus === 'processed'
                  return (
                    <motion.tr
                      key={cb.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="border-b transition-colors hover:bg-muted/40"
                    >
                      <TableCell className="text-muted-foreground text-sm">
                        {(page - 1) * PAGE_SIZE + rowIdx + 1}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {formatDateTime(cb.receivedAt)}
                      </TableCell>
                      <TableCell>
                        {cb.propertyId ? (
                          <Badge variant="outline" className="font-mono text-xs">
                            {cb.propertyId}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">Unknown</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-xs text-muted-foreground line-clamp-1 max-w-xs">
                          {truncatePayload(cb.payload || '')}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={isProcessed ? 'default' : 'secondary'}
                          className={cn(
                            'text-xs',
                            isProcessed
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                              : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                          )}
                        >
                          {effectiveStatus}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost" size="icon"
                              className="h-8 w-8"
                              onClick={() => handleView({ ...cb, status: effectiveStatus })}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>View full payload</TooltipContent>
                        </Tooltip>
                      </TableCell>
                    </motion.tr>
                  )
                })
              )}
            </TableBody>
          </Table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border/60">
              <p className="text-sm text-muted-foreground">
                Page {page} of {totalPages} — {total} total
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline" size="icon" className="h-8 w-8"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  const pageNum = totalPages <= 5 ? i + 1 : Math.max(1, page - 2) + i
                  if (pageNum > totalPages) return null
                  return (
                    <Button
                      key={pageNum}
                      variant={page === pageNum ? 'default' : 'outline'}
                      size="icon" className="h-8 w-8"
                      onClick={() => setPage(pageNum)}
                    >
                      {pageNum}
                    </Button>
                  )
                })}
                <Button
                  variant="outline" size="icon" className="h-8 w-8"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </Card>

        {/* Line chart */}
        <CallbacksChart data={chartData} loading={statsLoading} />

        {/* View dialog */}
        <ViewPayloadDialog
          callback={selectedCallback}
          open={viewOpen}
          onOpenChange={setViewOpen}
          onMarkProcessed={handleMarkProcessed}
        />
      </div>
    </TooltipProvider>
  )
}
