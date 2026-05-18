'use client'

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import axios from 'axios'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import {
  BarChart3,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronRight,
  Download,
  Grid3X3,
  Layers,
  CalendarDays,
  TrendingUp,
} from 'lucide-react'

import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Card, CardContent, CardHeader, CardTitle,
} from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn, formatCurrency, downloadExcel } from '@/lib/utils'
import type { CalendarDay, PropertyDetail } from '@/lib/types'

// ─────────────────────────────── TYPES ───────────────────────────────────────

interface RoomOption   { id: number; code: string; name: string }
interface RpOption     { id: number; code: string; name: string }

interface ComboKey { roomCode: string; rpCode: string }
interface ComboData extends ComboKey {
  roomName: string
  rpName: string
  days: CalendarDay[]
  loading: boolean
  error: string | null
}

// ─────────────────────────────── HELPERS ─────────────────────────────────────

const TODAY = new Date().toISOString().split('T')[0]
const DEFAULT_END = (() => {
  const d = new Date(); d.setDate(d.getDate() + 14); return d.toISOString().split('T')[0]
})()

function addDays(dateStr: string, n: number) {
  const d = new Date(dateStr); d.setDate(d.getDate() + n); return d.toISOString().split('T')[0]
}

function dateRange(start: string, end: string): string[] {
  const dates: string[] = []
  let cur = start
  while (cur <= end) { dates.push(cur); cur = addDays(cur, 1) }
  return dates
}

function dayOfWeek(date: string) {
  return new Date(date).toLocaleDateString('en-US', { weekday: 'short' })
}

// ─────────────────────────────── CELL ────────────────────────────────────────

function AriCell({ day, currency }: { day: CalendarDay | undefined; currency: string }) {
  if (!day) return <td className="border border-border/40 px-2 py-1.5 text-center text-xs text-muted-foreground/40">—</td>

  const price = day.pricePerRoomAfterTax ?? day.baseAmounts?.[0]?.price ?? null
  const bg = !day.isOpen
    ? 'bg-red-50 dark:bg-red-950/20'
    : day.numberOfAvailableRooms === 0
    ? 'bg-orange-50 dark:bg-orange-950/20'
    : 'bg-green-50 dark:bg-green-950/20'

  return (
    <td className={cn('border border-border/40 px-2 py-1.5 text-center align-top min-w-[90px]', bg)}>
      <div className="flex flex-col items-center gap-0.5">
        <div className="flex items-center gap-1">
          {day.isOpen
            ? <CheckCircle2 className="h-3 w-3 text-green-600 shrink-0" />
            : <XCircle className="h-3 w-3 text-red-500 shrink-0" />}
          <span className="text-[11px] font-medium tabular-nums">
            {day.numberOfAvailableRooms ?? '—'}
          </span>
        </div>
        {price != null && (
          <span className="text-[11px] font-semibold tabular-nums text-foreground">
            {formatCurrency(price, currency)}
          </span>
        )}
        {day.minLOS > 1 && (
          <span className="text-[9px] text-amber-600 font-medium">min {day.minLOS}n</span>
        )}
      </div>
    </td>
  )
}

// ─────────────────────────────── DATE VIEW ───────────────────────────────────

function DateView({ combos, dates, currency }: {
  combos: ComboData[]
  dates: string[]
  currency: string
}) {
  const loaded = combos.filter(c => !c.loading && !c.error && c.days.length > 0)
  if (loaded.length === 0) return (
    <div className="text-center py-12 text-muted-foreground text-sm">No data loaded yet.</div>
  )

  // Build map: roomCode+rpCode+date → CalendarDay
  const lookup = new Map<string, CalendarDay>()
  for (const c of loaded) {
    for (const d of c.days) {
      lookup.set(`${c.roomCode}|${c.rpCode}|${d.date}`, d)
    }
  }

  return (
    <div className="overflow-auto rounded-lg border">
      <table className="text-xs border-collapse w-full">
        <thead>
          <tr className="bg-muted/60 sticky top-0 z-10">
            <th className="border border-border/40 px-3 py-2 text-left font-medium whitespace-nowrap sticky left-0 bg-muted/80 z-20">
              Date
            </th>
            <th className="border border-border/40 px-2 py-2 text-center font-medium text-muted-foreground sticky left-[100px] bg-muted/60 z-20">
              Day
            </th>
            {loaded.map(c => (
              <th key={`${c.roomCode}|${c.rpCode}`}
                  className="border border-border/40 px-2 py-1.5 font-medium text-center whitespace-nowrap min-w-[90px]">
                <div className="text-[11px]">
                  <span className="font-mono bg-primary/10 text-primary px-1 rounded">{c.roomCode}</span>
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">{c.rpCode}</div>
              </th>
            ))}
          </tr>
          <tr className="bg-muted/30 sticky top-[37px] z-10">
            <th className="border border-border/40 px-3 py-1.5 text-left sticky left-0 bg-muted/50 z-20">
              <span className="text-[10px] text-muted-foreground">
                <CheckCircle2 className="inline h-3 w-3 text-green-600 mr-0.5"/>Avail &nbsp;
                <span className="font-semibold">Price</span>
              </span>
            </th>
            <th className="border border-border/40 sticky left-[100px] bg-muted/30 z-20"/>
            {loaded.map(c => (
              <th key={`h2-${c.roomCode}|${c.rpCode}`}
                  className="border border-border/40 px-2 py-1 text-[10px] text-muted-foreground font-normal text-center">
                {c.roomName}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dates.map(date => (
            <tr key={date} className="hover:bg-muted/20 transition-colors">
              <td className="border border-border/40 px-3 py-1.5 font-mono text-xs font-medium whitespace-nowrap sticky left-0 bg-background z-10">
                {date}
              </td>
              <td className="border border-border/40 px-2 py-1.5 text-xs text-muted-foreground text-center sticky left-[100px] bg-background z-10">
                {dayOfWeek(date)}
              </td>
              {loaded.map(c => (
                <AriCell
                  key={`${c.roomCode}|${c.rpCode}|${date}`}
                  day={lookup.get(`${c.roomCode}|${c.rpCode}|${date}`)}
                  currency={currency}
                />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─────────────────────────────── ROOM VIEW ───────────────────────────────────

function RoomView({ combos, dates, currency }: {
  combos: ComboData[]; dates: string[]; currency: string
}) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  const byRoom = useMemo(() => {
    const map = new Map<string, ComboData[]>()
    for (const c of combos.filter(c => !c.loading && !c.error)) {
      const arr = map.get(c.roomCode) ?? []
      arr.push(c)
      map.set(c.roomCode, arr)
    }
    return map
  }, [combos])

  if (byRoom.size === 0) return (
    <div className="text-center py-12 text-muted-foreground text-sm">No data loaded yet.</div>
  )

  return (
    <div className="space-y-4">
      {Array.from(byRoom.entries()).map(([roomCode, rps]) => {
        const isCollapsed = collapsed[roomCode]
        const roomName = rps[0]?.roomName ?? roomCode
        return (
          <Card key={roomCode}>
            <CardHeader
              className="py-3 cursor-pointer select-none"
              onClick={() => setCollapsed(p => ({ ...p, [roomCode]: !p[roomCode] }))}
            >
              <div className="flex items-center gap-3">
                {isCollapsed
                  ? <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                <span className="font-mono font-semibold text-sm bg-primary/10 text-primary px-2 py-0.5 rounded">
                  {roomCode}
                </span>
                <span className="text-sm text-muted-foreground">{roomName}</span>
                <Badge variant="outline" className="ml-auto text-xs">{rps.length} rate plan{rps.length > 1 ? 's' : ''}</Badge>
              </div>
            </CardHeader>
            {!isCollapsed && (
              <CardContent className="p-0 pb-2">
                <div className="overflow-auto">
                  <table className="text-xs border-collapse w-full">
                    <thead>
                      <tr className="bg-muted/40">
                        <th className="border border-border/40 px-3 py-2 text-left font-medium whitespace-nowrap sticky left-0 bg-muted/60 z-10">
                          Rate Plan
                        </th>
                        {dates.map(d => (
                          <th key={d} className="border border-border/40 px-2 py-1.5 text-center font-medium whitespace-nowrap min-w-[80px]">
                            <div className="text-[11px]">{d.slice(8) + '/' + d.slice(5,7)}</div>
                            <div className="text-[10px] text-muted-foreground font-normal">{dayOfWeek(d)}</div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rps.map(c => {
                        const lookup = new Map(c.days.map(d => [d.date, d]))
                        return (
                          <tr key={c.rpCode} className="hover:bg-muted/20">
                            <td className="border border-border/40 px-3 py-1.5 font-medium sticky left-0 bg-background z-10 whitespace-nowrap">
                              <span className="font-mono text-xs bg-secondary px-1.5 py-0.5 rounded">{c.rpCode}</span>
                              <span className="ml-2 text-muted-foreground text-xs">{c.rpName !== c.rpCode ? c.rpName : ''}</span>
                            </td>
                            {dates.map(d => (
                              <AriCell key={d} day={lookup.get(d)} currency={currency} />
                            ))}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            )}
          </Card>
        )
      })}
    </div>
  )
}

// ─────────────────────────────── RATE PLAN VIEW ──────────────────────────────

function RatePlanView({ combos, dates, currency }: {
  combos: ComboData[]; dates: string[]; currency: string
}) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  const byRp = useMemo(() => {
    const map = new Map<string, ComboData[]>()
    for (const c of combos.filter(c => !c.loading && !c.error)) {
      const arr = map.get(c.rpCode) ?? []
      arr.push(c)
      map.set(c.rpCode, arr)
    }
    return map
  }, [combos])

  if (byRp.size === 0) return (
    <div className="text-center py-12 text-muted-foreground text-sm">No data loaded yet.</div>
  )

  return (
    <div className="space-y-4">
      {Array.from(byRp.entries()).map(([rpCode, rooms]) => {
        const isCollapsed = collapsed[rpCode]
        const rpName = rooms[0]?.rpName ?? rpCode
        return (
          <Card key={rpCode}>
            <CardHeader
              className="py-3 cursor-pointer select-none"
              onClick={() => setCollapsed(p => ({ ...p, [rpCode]: !p[rpCode] }))}
            >
              <div className="flex items-center gap-3">
                {isCollapsed
                  ? <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                <span className="font-mono font-semibold text-sm bg-secondary px-2 py-0.5 rounded">
                  {rpCode}
                </span>
                <span className="text-sm text-muted-foreground">{rpName !== rpCode ? rpName : ''}</span>
                <Badge variant="outline" className="ml-auto text-xs">{rooms.length} room{rooms.length > 1 ? 's' : ''}</Badge>
              </div>
            </CardHeader>
            {!isCollapsed && (
              <CardContent className="p-0 pb-2">
                <div className="overflow-auto">
                  <table className="text-xs border-collapse w-full">
                    <thead>
                      <tr className="bg-muted/40">
                        <th className="border border-border/40 px-3 py-2 text-left font-medium whitespace-nowrap sticky left-0 bg-muted/60 z-10">
                          Room
                        </th>
                        {dates.map(d => (
                          <th key={d} className="border border-border/40 px-2 py-1.5 text-center font-medium whitespace-nowrap min-w-[80px]">
                            <div className="text-[11px]">{d.slice(8) + '/' + d.slice(5,7)}</div>
                            <div className="text-[10px] text-muted-foreground font-normal">{dayOfWeek(d)}</div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rooms.map(c => {
                        const lookup = new Map(c.days.map(d => [d.date, d]))
                        return (
                          <tr key={c.roomCode} className="hover:bg-muted/20">
                            <td className="border border-border/40 px-3 py-1.5 sticky left-0 bg-background z-10 whitespace-nowrap">
                              <span className="font-mono font-medium text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">{c.roomCode}</span>
                              <span className="ml-2 text-muted-foreground text-xs">{c.roomName}</span>
                            </td>
                            {dates.map(d => (
                              <AriCell key={d} day={lookup.get(d)} currency={currency} />
                            ))}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            )}
          </Card>
        )
      })}
    </div>
  )
}

// ─────────────────────────────── SUMMARY STATS ───────────────────────────────

function SummaryStats({ combos, dates }: { combos: ComboData[]; dates: string[] }) {
  const loaded = combos.filter(c => !c.loading && !c.error && c.days.length > 0)
  if (loaded.length === 0) return null

  const allDays = loaded.flatMap(c => c.days)
  const openDays = allDays.filter(d => d.isOpen).length
  const closedDays = allDays.filter(d => !d.isOpen).length
  const prices = allDays.map(d => d.pricePerRoomAfterTax ?? d.baseAmounts?.[0]?.price ?? 0).filter(p => p > 0)
  const avgPrice = prices.length ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : 0
  const avgAvail = allDays.length
    ? Math.round(allDays.reduce((a, d) => a + (d.numberOfAvailableRooms ?? 0), 0) / allDays.length)
    : 0

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {[
        { label: 'Combinations', value: loaded.length, icon: Grid3X3, color: 'text-blue-600' },
        { label: 'Open Slots', value: openDays, icon: CheckCircle2, color: 'text-green-600' },
        { label: 'Closed Slots', value: closedDays, icon: XCircle, color: 'text-red-500' },
        { label: 'Avg Price', value: avgPrice ? `$${avgPrice}` : '—', icon: TrendingUp, color: 'text-purple-600' },
      ].map(({ label, value, icon: Icon, color }) => (
        <div key={label} className="rounded-lg border bg-card px-4 py-3 flex items-center gap-3">
          <Icon className={cn('h-5 w-5 shrink-0', color)} />
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-lg font-semibold">{value}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────── PAGE ────────────────────────────────────────

export default function ARIManagerPage() {
  const [propertyId, setPropertyId] = useState('')
  const [startDate, setStartDate] = useState(TODAY)
  const [endDate, setEndDate] = useState(DEFAULT_END)
  const [currency, setCurrency] = useState('USD')

  // Property static
  const [rooms, setRooms] = useState<RoomOption[]>([])
  const [ratePlans, setRatePlans] = useState<RpOption[]>([])
  const [fetchingProp, setFetchingProp] = useState(false)
  const [propError, setPropError] = useState<string | null>(null)

  // Selection
  const [selectedRooms, setSelectedRooms] = useState<Set<string>>(new Set())
  const [selectedRps, setSelectedRps] = useState<Set<string>>(new Set())

  // ARI data: keyed by roomCode|rpCode
  const [combos, setCombos] = useState<ComboData[]>([])
  const [hasLoaded, setHasLoaded] = useState(false)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Fetch property static when property ID typed ───────────────────────────
  const fetchProperty = useCallback(async (id: string) => {
    if (!id || isNaN(Number(id)) || Number(id) <= 0) return
    setFetchingProp(true)
    setPropError(null)
    setRooms([])
    setRatePlans([])
    setSelectedRooms(new Set())
    setSelectedRps(new Set())
    setCombos([])
    setHasLoaded(false)
    try {
      const res = await axios.get<{ success: boolean; data: PropertyDetail }>(`/api/properties/${id}`)
      const prop: PropertyDetail = res.data?.data ?? (res.data as unknown as PropertyDetail)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const roomOpts: RoomOption[] = (prop.rooms ?? []).map((r: any) => ({
        id: r.id,
        code: r.code ?? r.pmsCode ?? String(r.id),
        name: r.name ?? r.type ?? `Room ${r.id}`,
      })).filter((r: RoomOption) => r.code)
        .filter((r: RoomOption, i: number, a: RoomOption[]) => a.findIndex(x => x.code === r.code) === i)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rpOpts: RpOption[] = (prop.ratePlans ?? []).map((rp: any) => ({
        id: rp.id,
        code: rp.code ?? rp.pmsCode ?? String(rp.id),
        name: rp.name || rp.pmsCode || `Plan ${rp.id}`,
      })).filter((rp: RpOption) => rp.code)
        .filter((rp: RpOption, i: number, a: RpOption[]) => a.findIndex(x => x.code === rp.code) === i)

      setRooms(roomOpts)
      setRatePlans(rpOpts)
      setSelectedRooms(new Set(roomOpts.map(r => r.code)))
      setSelectedRps(new Set(rpOpts.map(r => r.code)))

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cur = (prop as any).settings?.currency ?? (prop as any).currency
      if (cur) setCurrency(cur)
    } catch {
      setPropError('Could not load property. Check the property ID.')
    } finally {
      setFetchingProp(false)
    }
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!propertyId || isNaN(Number(propertyId)) || Number(propertyId) <= 0) return
    debounceRef.current = setTimeout(() => fetchProperty(propertyId), 700)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [propertyId, fetchProperty])

  // ── Load ARI for all selected combos in parallel ──────────────────────────
  const loadARI = useCallback(async () => {
    if (!propertyId || selectedRooms.size === 0 || selectedRps.size === 0) {
      toast.error('Select at least one room and one rate plan')
      return
    }
    if (!startDate || !endDate || endDate <= startDate) {
      toast.error('Check date range')
      return
    }
    if (endDate > addDays(startDate, 31)) {
      toast.error('Max 31-day range')
      return
    }

    const roomMap = new Map(rooms.map(r => [r.code, r]))
    const rpMap   = new Map(ratePlans.map(r => [r.code, r]))

    const combosToLoad: ComboData[] = []
    for (const rc of selectedRooms) {
      for (const rpc of selectedRps) {
        combosToLoad.push({
          roomCode: rc,
          rpCode: rpc,
          roomName: roomMap.get(rc)?.name ?? rc,
          rpName: rpMap.get(rpc)?.name ?? rpc,
          days: [],
          loading: true,
          error: null,
        })
      }
    }

    setCombos(combosToLoad)
    setHasLoaded(true)

    // Fire all in parallel
    await Promise.all(
      combosToLoad.map(async (combo) => {
        try {
          const res = await axios.post<{ success: boolean; data: CalendarDay[] }>('/api/calendar', {
            propertyId: Number(propertyId),
            roomCode: combo.roomCode,
            rateplanCode: combo.rpCode,
            startDate,
            endDate,
          })
          const days: CalendarDay[] = Array.isArray(res.data?.data)
            ? res.data.data
            : Array.isArray(res.data) ? res.data as unknown as CalendarDay[] : []

          setCombos(prev => prev.map(c =>
            c.roomCode === combo.roomCode && c.rpCode === combo.rpCode
              ? { ...c, days, loading: false }
              : c
          ))
        } catch (err: unknown) {
          const msg = axios.isAxiosError(err)
            ? err.response?.data?.error ?? err.message
            : 'Failed'
          setCombos(prev => prev.map(c =>
            c.roomCode === combo.roomCode && c.rpCode === combo.rpCode
              ? { ...c, loading: false, error: msg }
              : c
          ))
        }
      })
    )
  }, [propertyId, selectedRooms, selectedRps, startDate, endDate, rooms, ratePlans])

  const dates = useMemo(() => dateRange(startDate, endDate), [startDate, endDate])

  const isLoading = combos.some(c => c.loading)
  const loadedCount = combos.filter(c => !c.loading && !c.error).length
  const errorCount  = combos.filter(c => c.error).length

  // ── Export ────────────────────────────────────────────────────────────────
  const handleExport = () => {
    const rows: Record<string, unknown>[] = []
    for (const c of combos.filter(c => !c.loading && !c.error)) {
      for (const d of c.days) {
        rows.push({
          Room: c.roomCode,
          RoomName: c.roomName,
          RatePlan: c.rpCode,
          RatePlanName: c.rpName,
          Date: d.date,
          Day: dayOfWeek(d.date),
          Available: d.numberOfAvailableRooms,
          IsOpen: d.isOpen ? 'Yes' : 'No',
          Price: d.pricePerRoomAfterTax ?? d.baseAmounts?.[0]?.price ?? '',
          MinLOS: d.minLOS,
          MaxLOS: d.maxLOS,
          Release: d.release,
        })
      }
    }
    if (rows.length === 0) { toast.error('No data to export'); return }
    downloadExcel(rows, `ARI_Manager_${propertyId}_${startDate}`)
    toast.success('Excel downloaded')
  }

  // ── Toggle helpers ────────────────────────────────────────────────────────
  const toggleRoom = (code: string) => setSelectedRooms(prev => {
    const next = new Set(prev)
    next.has(code) ? next.delete(code) : next.add(code)
    return next
  })
  const toggleRp = (code: string) => setSelectedRps(prev => {
    const next = new Set(prev)
    next.has(code) ? next.delete(code) : next.add(code)
    return next
  })
  const allRoomsSelected = rooms.length > 0 && selectedRooms.size === rooms.length
  const allRpsSelected   = ratePlans.length > 0 && selectedRps.size === ratePlans.length

  return (
    <div className="space-y-6">
      <PageHeader
        title="ARI Manager"
        subtitle="Availability, Rates & Inventory — room-wise, rate-plan-wise, date-wise"
      />

      {/* ── Query Panel ─────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Query Parameters
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">

          {/* Row 1: Property ID + Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>Property ID *</Label>
              <div className="relative">
                <Input
                  type="number"
                  placeholder="e.g. 61287"
                  value={propertyId}
                  onChange={e => setPropertyId(e.target.value)}
                />
                {fetchingProp && (
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                    <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                )}
              </div>
              {propError && <p className="text-xs text-amber-600">{propError}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Start Date *</Label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>End Date *</Label>
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
              <p className="text-xs text-muted-foreground">Max 31 days</p>
            </div>
          </div>

          {/* Row 2: Room + Rate Plan selectors */}
          {(rooms.length > 0 || ratePlans.length > 0) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Rooms */}
              {rooms.length > 0 && (
                <div className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Rooms ({selectedRooms.size}/{rooms.length})
                    </Label>
                    <button
                      type="button"
                      className="text-xs text-primary hover:underline"
                      onClick={() => setSelectedRooms(allRoomsSelected ? new Set() : new Set(rooms.map(r => r.code)))}
                    >
                      {allRoomsSelected ? 'Deselect all' : 'Select all'}
                    </button>
                  </div>
                  <div className="max-h-40 overflow-y-auto space-y-1.5">
                    {rooms.map(r => (
                      <label key={r.code} className="flex items-center gap-2 cursor-pointer rounded px-1 py-0.5 hover:bg-muted/40">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
                          checked={selectedRooms.has(r.code)}
                          onChange={() => toggleRoom(r.code)}
                        />
                        <span className="font-mono text-xs bg-primary/10 text-primary px-1.5 rounded">{r.code}</span>
                        <span className="text-xs text-muted-foreground truncate">{r.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Rate Plans */}
              {ratePlans.length > 0 && (
                <div className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Rate Plans ({selectedRps.size}/{ratePlans.length})
                    </Label>
                    <button
                      type="button"
                      className="text-xs text-primary hover:underline"
                      onClick={() => setSelectedRps(allRpsSelected ? new Set() : new Set(ratePlans.map(r => r.code)))}
                    >
                      {allRpsSelected ? 'Deselect all' : 'Select all'}
                    </button>
                  </div>
                  <div className="max-h-40 overflow-y-auto space-y-1.5">
                    {ratePlans.map(rp => (
                      <label key={rp.code} className="flex items-center gap-2 cursor-pointer rounded px-1 py-0.5 hover:bg-muted/40">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
                          checked={selectedRps.has(rp.code)}
                          onChange={() => toggleRp(rp.code)}
                        />
                        <span className="font-mono text-xs bg-secondary px-1.5 rounded">{rp.code}</span>
                        <span className="text-xs text-muted-foreground truncate">
                          {rp.name !== rp.code ? rp.name : ''}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Load button */}
          <div className="flex items-center justify-between pt-1">
            <div className="text-xs text-muted-foreground">
              {rooms.length > 0 && (
                <span>
                  {selectedRooms.size} room{selectedRooms.size !== 1 ? 's' : ''} ×{' '}
                  {selectedRps.size} rate plan{selectedRps.size !== 1 ? 's' : ''} ={' '}
                  <strong>{selectedRooms.size * selectedRps.size}</strong> API calls
                </span>
              )}
            </div>
            <div className="flex gap-2">
              {hasLoaded && loadedCount > 0 && (
                <Button variant="outline" size="sm" onClick={handleExport} className="gap-2">
                  <Download className="h-4 w-4" />
                  Export Excel
                </Button>
              )}
              <Button
                onClick={loadARI}
                disabled={isLoading || fetchingProp || rooms.length === 0}
                className="gap-2 min-w-[140px]"
              >
                {isLoading ? (
                  <><RefreshCw className="h-4 w-4 animate-spin" />Loading…</>
                ) : (
                  <><BarChart3 className="h-4 w-4" />Load ARI</>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Status Bar ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {hasLoaded && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-wrap items-center gap-3 text-sm"
          >
            {isLoading && (
              <Badge variant="secondary" className="gap-1.5">
                <RefreshCw className="h-3 w-3 animate-spin" />
                Loading {combos.filter(c => c.loading).length} remaining…
              </Badge>
            )}
            {loadedCount > 0 && (
              <Badge variant="success" className="gap-1.5">
                <CheckCircle2 className="h-3 w-3" />
                {loadedCount} loaded
              </Badge>
            )}
            {errorCount > 0 && (
              <Badge variant="destructive" className="gap-1.5">
                <XCircle className="h-3 w-3" />
                {errorCount} failed
              </Badge>
            )}
            {combos.filter(c => c.error).map(c => (
              <span key={`${c.roomCode}|${c.rpCode}`} className="text-xs text-destructive">
                {c.roomCode}/{c.rpCode}: {c.error}
              </span>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Summary Stats ───────────────────────────────────────────────── */}
      {hasLoaded && !isLoading && <SummaryStats combos={combos} dates={dates} />}

      {/* ── Legend ──────────────────────────────────────────────────────── */}
      {hasLoaded && loadedCount > 0 && (
        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-5 rounded bg-green-200 dark:bg-green-800/50" />
            Open
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-5 rounded bg-red-200 dark:bg-red-800/50" />
            Closed
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-5 rounded bg-orange-200 dark:bg-orange-800/50" />
            Open / 0 rooms
          </div>
          <span>Each cell: <CheckCircle2 className="inline h-3 w-3 text-green-600"/> availability count · price</span>
        </div>
      )}

      {/* ── Skeleton while loading ───────────────────────────────────────── */}
      {isLoading && (
        <Card>
          <CardContent className="p-4 space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </CardContent>
        </Card>
      )}

      {/* ── Data Views ──────────────────────────────────────────────────── */}
      {hasLoaded && !isLoading && loadedCount > 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <Tabs defaultValue="date">
            <TabsList className="mb-4">
              <TabsTrigger value="date" className="gap-2">
                <CalendarDays className="h-4 w-4" />
                Date View
              </TabsTrigger>
              <TabsTrigger value="room" className="gap-2">
                <Layers className="h-4 w-4" />
                Room View
              </TabsTrigger>
              <TabsTrigger value="rateplan" className="gap-2">
                <Grid3X3 className="h-4 w-4" />
                Rate Plan View
              </TabsTrigger>
            </TabsList>

            <TabsContent value="date">
              <DateView combos={combos} dates={dates} currency={currency} />
            </TabsContent>
            <TabsContent value="room">
              <RoomView combos={combos} dates={dates} currency={currency} />
            </TabsContent>
            <TabsContent value="rateplan">
              <RatePlanView combos={combos} dates={dates} currency={currency} />
            </TabsContent>
          </Tabs>
        </motion.div>
      )}

      {/* ── Idle state ──────────────────────────────────────────────────── */}
      {!hasLoaded && !fetchingProp && rooms.length === 0 && (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <BarChart3 className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm font-medium text-muted-foreground">Enter a Property ID to get started</p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Rooms and rate plans will auto-load. Then click Load ARI.
          </p>
        </div>
      )}

      {!hasLoaded && !fetchingProp && rooms.length > 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Ready to load</AlertTitle>
          <AlertDescription>
            {rooms.length} rooms and {ratePlans.length} rate plans found.
            Select the combinations you want and click <strong>Load ARI</strong>.
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
