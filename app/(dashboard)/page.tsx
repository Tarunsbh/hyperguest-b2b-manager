'use client'

import { useQuery } from '@tanstack/react-query'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import {
  Building2, Bell, Send, Activity,
  AlertCircle, CheckCircle2, XCircle,
} from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { StatsCard } from '@/components/layout/StatsCard'
// StatsCard expects: icon (LucideIcon), label, value (number), variant, loading
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { formatDate, formatDateTime, formatCurrency } from '@/lib/utils'
import type { DashboardStats, BookingTrendItem, SubscriptionStatusItem, StoredBooking, StoredCallback } from '@/lib/types'
import type { BookingStats } from '@/lib/hooks/useBookings'
import type { CallbackStats } from '@/lib/hooks/useCallbacks'

// ── fetch helpers ────────────────────────────────────────────────────────────

interface DashboardApiResponse {
  data: {
    stats: DashboardStats
    bookingTrend: BookingTrendItem[]
    subscriptionStatus: SubscriptionStatusItem[]
    recentBookings: StoredBooking[]
    recentCallbacks: StoredCallback[]
    apiEndpoints: { name: string; url: string; status: 'ok' | 'error' | 'unknown' }[]
  }
}

async function fetchDashboard(): Promise<DashboardApiResponse['data']> {
  const res = await fetch('/api/dashboard', { credentials: 'same-origin' })
  if (!res.ok) throw new Error(`Dashboard API error: ${res.status}`)
  const json: DashboardApiResponse = await res.json()
  return json.data
}

async function fetchBookingStats(): Promise<BookingStats> {
  const res = await fetch('/api/bookings/stats', { credentials: 'same-origin' })
  if (!res.ok) throw new Error(`Booking stats error: ${res.status}`)
  const json = await res.json()
  return json.data ?? json
}

async function fetchCallbackStats(): Promise<CallbackStats> {
  const res = await fetch('/api/callbacks/stats', { credentials: 'same-origin' })
  if (!res.ok) throw new Error(`Callback stats error: ${res.status}`)
  const json = await res.json()
  return json.data ?? json
}

// ── pie colours ──────────────────────────────────────────────────────────────

const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']

// ── status badge helper ──────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const s = (status ?? '').toLowerCase()
  if (['success', 'confirmed', 'active', 'enabled', 'committed'].includes(s))
    return <Badge variant="success">{status}</Badge>
  if (['failed', 'error', 'cancelled', 'canceled'].includes(s))
    return <Badge variant="destructive">{status}</Badge>
  if (['pending', 'processing'].includes(s))
    return <Badge variant="warning">{status}</Badge>
  return <Badge variant="secondary">{status}</Badge>
}

// ── skeleton rows ────────────────────────────────────────────────────────────

function TableSkeletonRows({ cols, rows = 5 }: { cols: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <TableRow key={i}>
          {Array.from({ length: cols }).map((_, j) => (
            <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
          ))}
        </TableRow>
      ))}
    </>
  )
}

// ── main page ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const dashboard = useQuery({
    queryKey: ['dashboard'],
    queryFn: fetchDashboard,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 2,
  })

  const bookingStats = useQuery({
    queryKey: ['bookings', 'stats'],
    queryFn: fetchBookingStats,
    staleTime: 60 * 1000,
    retry: 2,
  })

  const callbackStats = useQuery({
    queryKey: ['callbacks', 'stats'],
    queryFn: fetchCallbackStats,
    staleTime: 60 * 1000,
    retry: 2,
  })

  const stats = dashboard.data?.stats
  const trend = dashboard.data?.bookingTrend ?? []
  const subStatus = dashboard.data?.subscriptionStatus ?? []
  const recentBookings = dashboard.data?.recentBookings ?? []
  const recentCallbacks = dashboard.data?.recentCallbacks ?? []
  const endpoints = dashboard.data?.apiEndpoints ?? []

  const isLoading = dashboard.isLoading
  const isError = dashboard.isError

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Dashboard"
        subtitle="HyperGuest B2B Channel Overview"
      />

      {isError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to load dashboard data. {dashboard.error?.message}
          </AlertDescription>
        </Alert>
      )}

      {/* ── Stats row ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatsCard
          icon={Building2}
          label="Total Properties"
          value={stats?.totalProperties ?? 0}
          variant="blue"
          changeLabel="Synced from HyperGuest"
          loading={isLoading}
          index={0}
        />
        <StatsCard
          icon={Bell}
          label="Active Subscriptions"
          value={stats?.activeSubscriptions ?? 0}
          variant="green"
          changeLabel="ARI push channels"
          loading={isLoading}
          index={1}
        />
        <StatsCard
          icon={Send}
          label="Bookings Pushed"
          value={bookingStats.data?.total ?? stats?.totalBookingsPushed ?? 0}
          variant="orange"
          change={bookingStats.data?.successRate ? Math.round(bookingStats.data.successRate) : undefined}
          changeLabel="success rate"
          loading={isLoading || bookingStats.isLoading}
          index={2}
        />
        <StatsCard
          icon={Activity}
          label="ARI Callbacks"
          value={callbackStats.data?.total ?? stats?.totalARICallbacks ?? 0}
          variant="purple"
          changeLabel={`${callbackStats.data?.receivedToday ?? 0} received today`}
          loading={isLoading || callbackStats.isLoading}
          index={3}
        />
      </div>

      {/* ── Charts row ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        {/* Bookings trend line chart */}
        <Card className="xl:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Bookings Trend</CardTitle>
            <CardDescription>Last 30 days</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-52 w-full" />
            ) : trend.length === 0 ? (
              <div className="h-52 flex items-center justify-center text-sm text-muted-foreground">
                No booking trend data available
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={210}>
                <LineChart data={trend} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    tickFormatter={(v: string) => {
                      try { return new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' }) }
                      catch { return v }
                    }}
                    interval="preserveStartEnd"
                  />
                  <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      background: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px',
                      color: 'hsl(var(--popover-foreground))',
                    }}
                    labelFormatter={(v: string) => {
                      try { return new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) }
                      catch { return v }
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="bookings"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 0 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Subscription status pie chart */}
        <Card className="xl:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Subscription Status</CardTitle>
            <CardDescription>Distribution by status</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-52 w-full" />
            ) : subStatus.length === 0 ? (
              <div className="h-52 flex items-center justify-center text-sm text-muted-foreground">
                No subscription data
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={210}>
                <PieChart>
                  <Pie
                    data={subStatus}
                    cx="50%"
                    cy="45%"
                    innerRadius={52}
                    outerRadius={76}
                    dataKey="count"
                    nameKey="status"
                    paddingAngle={3}
                  >
                    {subStatus.map((_entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={PIE_COLORS[index % PIE_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px',
                      color: 'hsl(var(--popover-foreground))',
                    }}
                  />
                  <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: '11px' }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Recent Bookings ─────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Recent Bookings</CardTitle>
          <CardDescription>Last 5 booking pushes</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reservation ID</TableHead>
                <TableHead>Hotel</TableHead>
                <TableHead>Guest</TableHead>
                <TableHead>Check-in</TableHead>
                <TableHead>Check-out</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableSkeletonRows cols={7} />
              ) : recentBookings.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground text-sm">
                    No bookings pushed yet
                  </TableCell>
                </TableRow>
              ) : (
                recentBookings.slice(0, 5).map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-mono text-xs">{b.reservationId}</TableCell>
                    <TableCell className="text-xs">{b.hotelName ?? b.hotelCode}</TableCell>
                    <TableCell className="text-xs">{b.guestName}</TableCell>
                    <TableCell className="text-xs">{formatDate(b.checkIn)}</TableCell>
                    <TableCell className="text-xs">{formatDate(b.checkOut)}</TableCell>
                    <TableCell className="text-xs font-medium">
                      {formatCurrency(b.totalAmount, b.currency)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={b.success ? 'success' : 'failed'} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* ── Recent Callbacks ────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Recent Callbacks</CardTitle>
          <CardDescription>Incoming ARI updates from HyperGuest</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Received At</TableHead>
                <TableHead>Property ID</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Payload Preview</TableHead>
                <TableHead>Processed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableSkeletonRows cols={5} />
              ) : recentCallbacks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground text-sm">
                    No callbacks received yet
                  </TableCell>
                </TableRow>
              ) : (
                recentCallbacks.slice(0, 5).map((cb) => (
                  <TableRow key={cb.id}>
                    <TableCell className="text-xs">{formatDateTime(cb.receivedAt)}</TableCell>
                    <TableCell className="text-xs font-mono">{cb.propertyId ?? '—'}</TableCell>
                    <TableCell>
                      <StatusBadge status={cb.status} />
                    </TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground max-w-xs truncate">
                      {cb.payload ? cb.payload.slice(0, 80) + (cb.payload.length > 80 ? '…' : '') : '—'}
                    </TableCell>
                    <TableCell>
                      {cb.processed ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-amber-500" />
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* ── API Status ──────────────────────────────────────────────────────── */}
      {(endpoints.length > 0 || isLoading) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">API Endpoint Status</CardTitle>
            <CardDescription>HyperGuest service connectivity</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-9 w-full" />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {endpoints.map((ep) => (
                  <div
                    key={ep.name}
                    className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-2.5"
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className={
                          ep.status === 'ok'
                            ? 'status-dot-green'
                            : ep.status === 'error'
                            ? 'status-dot-red'
                            : 'status-dot status-dot-yellow'
                        }
                      />
                      <span className="text-sm font-medium">{ep.name}</span>
                    </div>
                    <span className="text-xs font-mono text-muted-foreground truncate max-w-xs">
                      {ep.url}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
