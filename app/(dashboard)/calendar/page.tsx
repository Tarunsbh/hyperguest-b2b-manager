'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@/lib/utils/zodResolver'
import { z } from 'zod'
import axios from 'axios'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import {
  CalendarDays,
  RefreshCw,
  AlertCircle,
  Download,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  XCircle,
  Clock,
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
  CardTitle,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn, formatCurrency, formatDate, downloadExcel } from '@/lib/utils'
import { HotelSearch } from '@/components/ui/hotel-search'
import type { CalendarDay, BaseAmount, PropertyDetail } from '@/lib/types'

// ─────────────────────────────── HELPERS ────────────────────────────────────

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000)
}

const TODAY = new Date().toISOString().split('T')[0]
const DEFAULT_END = addDays(TODAY, 7)

// ─────────────────────────────── SCHEMA ─────────────────────────────────────

const calendarSchema = z
  .object({
    propertyId: z.coerce.number().int().min(1, 'Property ID is required'),
    roomCode: z.string().min(1, 'Room code is required'),
    rateplanCode: z.string().min(1, 'Rate plan code is required'),
    startDate: z.string().min(1, 'Start date is required'),
    endDate: z.string().min(1, 'End date is required'),
  })
  .superRefine((data, ctx) => {
    if (data.startDate && data.endDate) {
      if (data.endDate <= data.startDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'End date must be after start date',
          path: ['endDate'],
        })
      }
      if (daysBetween(data.startDate, data.endDate) > 31) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Date range cannot exceed 31 days',
          path: ['endDate'],
        })
      }
    }
  })

type CalendarFormValues = z.infer<typeof calendarSchema>

// ─────────────────────────────── BASE AMOUNTS DETAIL ────────────────────────

function BaseAmountsTable({ amounts, currency }: { amounts: BaseAmount[]; currency?: string }) {
  if (!amounts || amounts.length === 0) {
    return <p className="text-xs text-muted-foreground italic py-1">No base amount data</p>
  }

  return (
    <div className="overflow-x-auto">
      <Table className="text-xs">
        <TableHeader>
          <TableRow className="bg-muted/30">
            <TableHead className="py-1.5 text-xs">Adults</TableHead>
            <TableHead className="py-1.5 text-xs">Children</TableHead>
            <TableHead className="py-1.5 text-xs">Infants</TableHead>
            <TableHead className="py-1.5 text-xs">Price</TableHead>
            <TableHead className="py-1.5 text-xs">Taxes Incl.</TableHead>
            <TableHead className="py-1.5 text-xs">Comm. Incl.</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {amounts.map((a, i) => (
            <TableRow key={i}>
              <TableCell className="py-1.5">{a.numberOfGuests?.adults ?? '—'}</TableCell>
              <TableCell className="py-1.5">{a.numberOfGuests?.children ?? '—'}</TableCell>
              <TableCell className="py-1.5">{a.numberOfGuests?.infants ?? '—'}</TableCell>
              <TableCell className="py-1.5 font-medium">
                {formatCurrency(a.price, currency ?? 'USD')}
              </TableCell>
              <TableCell className="py-1.5">
                <Badge variant={a.taxesIncluded ? 'default' : 'secondary'} className="text-[10px] h-4">
                  {a.taxesIncluded ? 'Yes' : 'No'}
                </Badge>
              </TableCell>
              <TableCell className="py-1.5">
                <Badge variant={a.commissionIncluded ? 'default' : 'secondary'} className="text-[10px] h-4">
                  {a.commissionIncluded ? 'Yes' : 'No'}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

// ─────────────────────────────── CALENDAR ROW ───────────────────────────────

function CalendarRow({ day, currency }: { day: CalendarDay; currency?: string }) {
  const [expanded, setExpanded] = useState(false)

  const rowBg = !day.isOpen
    ? 'bg-red-50 dark:bg-red-950/20 hover:bg-red-100/60 dark:hover:bg-red-950/30'
    : day.minLOS > 1
    ? 'bg-yellow-50 dark:bg-yellow-950/20 hover:bg-yellow-100/60 dark:hover:bg-yellow-950/30'
    : 'bg-green-50 dark:bg-green-950/20 hover:bg-green-100/60 dark:hover:bg-green-950/30'

  const weekday = new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' })

  return (
    <>
      <TableRow
        className={cn('cursor-pointer transition-colors', rowBg)}
        onClick={() => setExpanded((p) => !p)}
      >
        <TableCell className="font-mono text-xs font-medium whitespace-nowrap">
          {formatDate(day.date, 'dd/MM/yy')}
        </TableCell>
        <TableCell className="text-xs text-muted-foreground">{weekday}</TableCell>
        <TableCell className="text-center font-semibold">{day.numberOfAvailableRooms}</TableCell>
        <TableCell className="text-center">
          {day.isOpen ? (
            <CheckCircle2 className="h-4 w-4 text-green-600 mx-auto" />
          ) : (
            <XCircle className="h-4 w-4 text-red-500 mx-auto" />
          )}
        </TableCell>
        <TableCell className="text-center">
          {day.isOpenOnArrival ? (
            <CheckCircle2 className="h-4 w-4 text-green-600 mx-auto" />
          ) : (
            <XCircle className="h-4 w-4 text-red-400 mx-auto" />
          )}
        </TableCell>
        <TableCell className="text-center">
          {day.isOpenOnDeparture ? (
            <CheckCircle2 className="h-4 w-4 text-green-600 mx-auto" />
          ) : (
            <XCircle className="h-4 w-4 text-red-400 mx-auto" />
          )}
        </TableCell>
        <TableCell className="text-center text-sm">{day.minLOS || '—'}</TableCell>
        <TableCell className="text-center text-sm">{day.maxLOS || '—'}</TableCell>
        <TableCell className="text-center text-sm">{day.release || '—'}</TableCell>
        <TableCell className="text-right font-medium tabular-nums text-sm">
          {day.pricePerRoomAfterTax != null
            ? formatCurrency(day.pricePerRoomAfterTax, currency ?? 'USD')
            : '—'}
        </TableCell>
        <TableCell className="text-right tabular-nums text-sm">
          {day.pricePerPersonAfterTax != null
            ? formatCurrency(day.pricePerPersonAfterTax, currency ?? 'USD')
            : '—'}
        </TableCell>
        <TableCell className="text-center">
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </TableCell>
      </TableRow>
      {expanded && (
        <TableRow className={cn('border-b', rowBg)}>
          <TableCell colSpan={12} className="py-3 px-6">
            <div className="rounded-md border bg-background/60 p-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Base Amounts
              </p>
              <BaseAmountsTable amounts={day.baseAmounts} currency={currency} />
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  )
}

// ─────────────────────────────── SKELETON ───────────────────────────────────

function CalendarSkeleton() {
  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {Array.from({ length: 12 }).map((_, i) => (
                  <TableHead key={i}>
                    <Skeleton className="h-4 w-14" />
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 12 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-12" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}

// ─────────────────────────────── TYPES ──────────────────────────────────────

interface RoomOption { code: string; name: string; id: number }
interface RatePlanOption { code: string; name: string; id: number }

// ─────────────────────────────── PAGE ───────────────────────────────────────

export default function CalendarPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [calendarData, setCalendarData] = useState<CalendarDay[] | null>(null)
  const [queryParams, setQueryParams] = useState<CalendarFormValues | null>(null)
  const [currency, setCurrency] = useState<string>('USD')
  const [selectedHotelName, setSelectedHotelName] = useState<string>('')

  // Property static data
  const [rooms, setRooms] = useState<RoomOption[]>([])
  const [ratePlans, setRatePlans] = useState<RatePlanOption[]>([])
  const [fetchingProperty, setFetchingProperty] = useState(false)
  const [propertyFetchError, setPropertyFetchError] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CalendarFormValues>({
    resolver: zodResolver(calendarSchema),
    defaultValues: {
      startDate: TODAY,
      endDate: DEFAULT_END,
    },
  })

  const propertyIdValue = watch('propertyId')

  // ── Auto-fetch property static data when Property ID changes ──────────────
  const fetchPropertyStatic = useCallback(async (id: number) => {
    if (!id || id <= 0) return
    setFetchingProperty(true)
    setPropertyFetchError(null)
    setRooms([])
    setRatePlans([])
    setValue('roomCode', '')
    setValue('rateplanCode', '')
    try {
      const res = await axios.get<{ success: boolean; data: PropertyDetail }>(`/api/properties/${id}`)
      const prop = res.data?.data ?? (res.data as unknown as PropertyDetail)

      // Extract unique rooms with a pmsCode / code
      const roomOpts: RoomOption[] = (prop.rooms ?? [])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((r: any) => ({
          id: r.id,
          code: r.code ?? r.pmsCode ?? String(r.id),
          name: r.name ?? r.type ?? `Room ${r.id}`,
        }))
        .filter((r: RoomOption) => r.code)
        // deduplicate by code
        .filter((r: RoomOption, i: number, arr: RoomOption[]) => arr.findIndex((x) => x.code === r.code) === i)

      // Extract unique rate plans
      const rpOpts: RatePlanOption[] = (prop.ratePlans ?? [])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((rp: any) => ({
          id: rp.id,
          code: rp.code ?? rp.pmsCode ?? String(rp.id),
          name: rp.name || rp.pmsCode || `Plan ${rp.id}`,
        }))
        .filter((rp: RatePlanOption) => rp.code)
        .filter((rp: RatePlanOption, i: number, arr: RatePlanOption[]) => arr.findIndex((x) => x.code === rp.code) === i)

      setRooms(roomOpts)
      setRatePlans(rpOpts)

      // Auto-select first option
      if (roomOpts.length > 0) setValue('roomCode', roomOpts[0].code)
      if (rpOpts.length > 0) setValue('rateplanCode', rpOpts[0].code)

      // Set currency from property
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cur = (prop as any).settings?.currency ?? (prop as any).currency
      if (cur) setCurrency(cur)
    } catch {
      setPropertyFetchError('Could not load rooms/rate plans for this property')
    } finally {
      setFetchingProperty(false)
    }
  }, [setValue])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const id = Number(propertyIdValue)
    if (!id || id <= 0) return
    debounceRef.current = setTimeout(() => fetchPropertyStatic(id), 600)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [propertyIdValue, fetchPropertyStatic])

  const onSubmit = async (values: CalendarFormValues) => {
    setLoading(true)
    setError(null)
    setCalendarData(null)

    try {
      const res = await axios.post<{ success: boolean; data: CalendarDay[] } | CalendarDay[]>('/api/calendar', {
        propertyId: values.propertyId,
        roomCode: values.roomCode,
        rateplanCode: values.rateplanCode,
        startDate: values.startDate,
        endDate: values.endDate,
      })
      // Unwrap {success, data} envelope if present, otherwise treat as raw array
      const raw = res.data
      const days: CalendarDay[] = Array.isArray(raw)
        ? raw
        : Array.isArray((raw as { data: CalendarDay[] }).data)
        ? (raw as { data: CalendarDay[] }).data
        : []
      setCalendarData(days)
      setQueryParams(values)
    } catch (err: unknown) {
      const msg =
        axios.isAxiosError(err)
          ? err.response?.data?.error ?? err.message
          : 'Failed to load calendar data'
      setError(msg)
      toast.error('Calendar load failed', { description: msg })
    } finally {
      setLoading(false)
    }
  }

  // Stats derived from calendar data
  const stats = React.useMemo(() => {
    if (!calendarData || calendarData.length === 0)
      return { total: 0, open: 0, closed: 0, avg: 0, min: 0, max: 0 }

    const prices = calendarData
      .map((d) => d.pricePerRoomAfterTax)
      .filter((p): p is number => p != null && p > 0)

    return {
      total: calendarData.length,
      open: calendarData.filter((d) => d.isOpen).length,
      closed: calendarData.filter((d) => !d.isOpen).length,
      avg: prices.length ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : 0,
      min: prices.length ? Math.min(...prices) : 0,
      max: prices.length ? Math.max(...prices) : 0,
    }
  }, [calendarData])

  const handleExport = () => {
    if (!calendarData || !queryParams) return
    const rows = calendarData.map((d) => ({
      Date: d.date,
      Day: new Date(d.date).toLocaleDateString('en-US', { weekday: 'short' }),
      AvailableRooms: d.numberOfAvailableRooms,
      IsOpen: d.isOpen ? 'Yes' : 'No',
      ArrivalOK: d.isOpenOnArrival ? 'Yes' : 'No',
      DepartureOK: d.isOpenOnDeparture ? 'Yes' : 'No',
      MinLOS: d.minLOS,
      MaxLOS: d.maxLOS,
      Release: d.release,
      PricePerRoom: d.pricePerRoomAfterTax,
      PricePerPerson: d.pricePerPersonAfterTax,
    }))
    downloadExcel(
      rows,
      `ARI_Calendar_${queryParams.propertyId}_${queryParams.roomCode}_${queryParams.startDate}`
    )
    toast.success('Excel downloaded')
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="ARI Calendar"
        subtitle="View Availability, Rates & Inventory per room and rate plan"
      />

      {/* Query Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Query Parameters</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Hotel Search */}
              <div className="space-y-1.5">
                <Label>Property *</Label>
                <input type="hidden" {...register('propertyId')} />
                <HotelSearch
                  onSelect={(hotel) => {
                    setValue('propertyId', hotel.id)
                    setSelectedHotelName(hotel.name)
                  }}
                  onClear={() => {
                    setValue('propertyId', 0 as unknown as number)
                    setSelectedHotelName('')
                    setRooms([])
                    setRatePlans([])
                  }}
                  disabled={fetchingProperty}
                  placeholder="Type hotel name…"
                />
                {fetchingProperty && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <RefreshCw className="h-3 w-3 animate-spin" />
                    Loading rooms & rate plans…
                  </p>
                )}
                {errors.propertyId && (
                  <p className="text-xs text-destructive">{errors.propertyId.message}</p>
                )}
                {propertyFetchError && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">{propertyFetchError}</p>
                )}
              </div>

              {/* Room Code — dropdown when rooms loaded, text input fallback */}
              <div className="space-y-1.5">
                <Label htmlFor="roomCode">
                  Room Code *
                  {rooms.length > 0 && (
                    <span className="ml-1.5 text-xs text-muted-foreground font-normal">
                      ({rooms.length} available)
                    </span>
                  )}
                </Label>
                {rooms.length > 0 ? (
                  <Controller
                    name="roomCode"
                    control={control}
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select room…" />
                        </SelectTrigger>
                        <SelectContent>
                          {rooms.map((r) => (
                            <SelectItem key={r.code} value={r.code}>
                              <span className="font-mono mr-2 text-xs bg-muted px-1.5 py-0.5 rounded">
                                {r.code}
                              </span>
                              {r.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                ) : (
                  <Input
                    id="roomCode"
                    placeholder={fetchingProperty ? 'Loading…' : 'e.g. SGL, DBL'}
                    disabled={fetchingProperty}
                    {...register('roomCode')}
                  />
                )}
                {errors.roomCode && (
                  <p className="text-xs text-destructive">{errors.roomCode.message}</p>
                )}
              </div>

              {/* Rate Plan Code — dropdown when rate plans loaded, text input fallback */}
              <div className="space-y-1.5">
                <Label htmlFor="rateplanCode">
                  Rate Plan Code *
                  {ratePlans.length > 0 && (
                    <span className="ml-1.5 text-xs text-muted-foreground font-normal">
                      ({ratePlans.length} available)
                    </span>
                  )}
                </Label>
                {ratePlans.length > 0 ? (
                  <Controller
                    name="rateplanCode"
                    control={control}
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select rate plan…" />
                        </SelectTrigger>
                        <SelectContent>
                          {ratePlans.map((rp) => (
                            <SelectItem key={rp.code} value={rp.code}>
                              <span className="font-mono mr-2 text-xs bg-muted px-1.5 py-0.5 rounded">
                                {rp.code}
                              </span>
                              {rp.name !== rp.code ? rp.name : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                ) : (
                  <Input
                    id="rateplanCode"
                    placeholder={fetchingProperty ? 'Loading…' : 'e.g. BAR, NON'}
                    disabled={fetchingProperty}
                    {...register('rateplanCode')}
                  />
                )}
                {errors.rateplanCode && (
                  <p className="text-xs text-destructive">{errors.rateplanCode.message}</p>
                )}
              </div>

              {/* Start Date */}
              <div className="space-y-1.5">
                <Label htmlFor="startDate">Start Date *</Label>
                <Input
                  id="startDate"
                  type="date"
                  {...register('startDate')}
                />
                {errors.startDate && (
                  <p className="text-xs text-destructive">{errors.startDate.message}</p>
                )}
              </div>

              {/* End Date */}
              <div className="space-y-1.5">
                <Label htmlFor="endDate">End Date *</Label>
                <Input
                  id="endDate"
                  type="date"
                  {...register('endDate')}
                />
                {errors.endDate && (
                  <p className="text-xs text-destructive">{errors.endDate.message}</p>
                )}
                <p className="text-xs text-muted-foreground">Max 31-day range</p>
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <Button type="submit" disabled={loading || fetchingProperty} className="gap-2 min-w-[160px]">
                {loading ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Loading…
                  </>
                ) : (
                  <>
                    <CalendarDays className="h-4 w-4" />
                    Load Calendar
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Results */}
      <AnimatePresence mode="wait">
        {/* Loading */}
        {loading && (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <CalendarSkeleton />
          </motion.div>
        )}

        {/* Error */}
        {!loading && error && (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error Loading Calendar</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </motion.div>
        )}

        {/* Data */}
        {!loading && !error && calendarData && queryParams && (
          <motion.div
            key="data"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-4"
          >
            {/* Summary bar */}
            <div className="rounded-lg border bg-muted/40 px-4 py-2.5 text-sm flex flex-wrap gap-x-4 gap-y-1 items-center justify-between">
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
                <span>
                  <span className="font-medium text-foreground">Property</span>{' '}
                  {selectedHotelName || queryParams.propertyId}
                  <span className="ml-1 font-mono text-xs text-muted-foreground">
                    ({queryParams.propertyId})
                  </span>
                </span>
                <span className="text-border">|</span>
                <span>
                  <span className="font-medium text-foreground">Room</span>{' '}
                  {queryParams.roomCode}
                </span>
                <span className="text-border">|</span>
                <span>
                  <span className="font-medium text-foreground">Rate Plan</span>{' '}
                  {queryParams.rateplanCode}
                </span>
                <span className="text-border">|</span>
                <span>
                  {formatDate(queryParams.startDate)} → {formatDate(queryParams.endDate)}
                </span>
              </div>
              <Button size="sm" variant="outline" className="gap-2 h-8" onClick={handleExport}>
                <Download className="h-3.5 w-3.5" />
                Export Excel
              </Button>
            </div>

            {/* Stats row */}
            {calendarData.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <StatsCard
                  icon={CalendarDays}
                  label="Total Days"
                  value={stats.total}
                  variant="blue"
                  index={0}
                />
                <StatsCard
                  icon={CheckCircle2}
                  label="Open Days"
                  value={stats.open}
                  variant="green"
                  index={1}
                />
                <StatsCard
                  icon={XCircle}
                  label="Closed Days"
                  value={stats.closed}
                  variant="red"
                  index={2}
                />
                <StatsCard
                  icon={Clock}
                  label="Avg Price"
                  value={stats.avg}
                  prefix="$"
                  variant="purple"
                  index={3}
                />
                <StatsCard
                  icon={Clock}
                  label="Min Price"
                  value={stats.min}
                  prefix="$"
                  variant="orange"
                  index={4}
                />
                <StatsCard
                  icon={Clock}
                  label="Max Price"
                  value={stats.max}
                  prefix="$"
                  variant="blue"
                  index={5}
                />
              </div>
            )}

            {/* Legend */}
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-5 rounded bg-green-200 dark:bg-green-800/50" />
                Open
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-5 rounded bg-red-200 dark:bg-red-800/50" />
                Closed
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-5 rounded bg-yellow-200 dark:bg-yellow-800/50" />
                Open w/ Min LOS
              </div>
              <span>Click any row to view base amounts.</span>
            </div>

            {/* Calendar table */}
            {calendarData.length > 0 ? (
              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/60">
                          <TableHead className="whitespace-nowrap text-xs">Date</TableHead>
                          <TableHead className="text-xs">Day</TableHead>
                          <TableHead className="text-center text-xs whitespace-nowrap">Avail. Rooms</TableHead>
                          <TableHead className="text-center text-xs">Open</TableHead>
                          <TableHead className="text-center text-xs whitespace-nowrap">Arrival OK</TableHead>
                          <TableHead className="text-center text-xs whitespace-nowrap">Depart. OK</TableHead>
                          <TableHead className="text-center text-xs whitespace-nowrap">Min LOS</TableHead>
                          <TableHead className="text-center text-xs whitespace-nowrap">Max LOS</TableHead>
                          <TableHead className="text-center text-xs">Release</TableHead>
                          <TableHead className="text-right text-xs whitespace-nowrap">Price/Room</TableHead>
                          <TableHead className="text-right text-xs whitespace-nowrap">Price/Person</TableHead>
                          <TableHead className="w-8" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {calendarData.map((day) => (
                          <CalendarRow key={day.date} day={day} currency={currency} />
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <EmptyState
                icon={CalendarDays}
                title="No calendar data returned"
                description="The API returned no entries for the specified property, room, and date range."
              />
            )}
          </motion.div>
        )}

        {/* Empty — not searched yet */}
        {!loading && !error && !calendarData && (
          <motion.div
            key="idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <EmptyState
              icon={CalendarDays}
              title="No calendar loaded"
              description="Enter a property ID, room code, rate plan, and date range, then click Load Calendar."
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
