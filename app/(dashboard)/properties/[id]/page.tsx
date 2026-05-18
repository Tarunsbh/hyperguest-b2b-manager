'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams } from 'next/navigation'
import { usePropertyDetail } from '@/lib/hooks/useProperties'
import { useSearch } from '@/lib/hooks/useSearch'
import { useCalendar } from '@/lib/hooks/useSearch'
import { useSubscribe } from '@/lib/hooks/useSubscriptions'
import { usePushBooking } from '@/lib/hooks/useBookings'
import { useSettingsStore } from '@/lib/store'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  MapPin, Phone, Mail, Globe, Star, Bell, Send, AlertCircle,
  ExternalLink, ChevronLeft, Calendar, BarChart3, RefreshCw,
  CheckCircle2, XCircle, ChevronDown, ChevronRight, Download,
} from 'lucide-react'
import Link from 'next/link'
import axios from 'axios'
import { toast } from 'sonner'
import { formatDate, formatCurrency, generateEchoToken, downloadExcel, cn } from '@/lib/utils'
import type { SearchParams, CalendarParams, CalendarDay } from '@/lib/types'

// ── ARI types ─────────────────────────────────────────────────────────────────
interface AriCombo {
  roomCode: string; roomName: string
  rpCode: string;   rpName: string
  days: CalendarDay[]; loading: boolean; error: string | null
}

const TODAY_STR = new Date().toISOString().split('T')[0]
const PLUS14 = (() => { const d = new Date(); d.setDate(d.getDate() + 14); return d.toISOString().split('T')[0] })()

function addDaysStr(dateStr: string, n: number) {
  const d = new Date(dateStr); d.setDate(d.getDate() + n); return d.toISOString().split('T')[0]
}
function buildDateRange(start: string, end: string) {
  const dates: string[] = []
  let cur = start
  while (cur <= end) { dates.push(cur); cur = addDaysStr(cur, 1) }
  return dates
}
function dow(date: string) { return new Date(date).toLocaleDateString('en-US', { weekday: 'short' }) }

function AriGridCell({ day, currency }: { day: CalendarDay | undefined; currency: string }) {
  if (!day) return <td className="border border-border/30 px-1.5 py-1 text-center text-[10px] text-muted-foreground/30">—</td>
  const price = day.pricePerRoomAfterTax ?? day.baseAmounts?.[0]?.price ?? null
  const bg = !day.isOpen
    ? 'bg-red-50 dark:bg-red-950/20'
    : day.numberOfAvailableRooms === 0
    ? 'bg-orange-50 dark:bg-orange-950/20'
    : 'bg-green-50 dark:bg-green-950/20'
  return (
    <td className={cn('border border-border/30 px-1.5 py-1 text-center align-middle min-w-[80px]', bg)}>
      <div className="flex flex-col items-center gap-0.5">
        <div className="flex items-center gap-0.5">
          {day.isOpen
            ? <CheckCircle2 className="h-2.5 w-2.5 text-green-600 shrink-0"/>
            : <XCircle className="h-2.5 w-2.5 text-red-500 shrink-0"/>}
          <span className="text-[10px] font-medium tabular-nums">{day.numberOfAvailableRooms ?? '—'}</span>
        </div>
        {price != null && (
          <span className="text-[10px] font-semibold tabular-nums">{formatCurrency(price, currency)}</span>
        )}
        {day.minLOS > 1 && <span className="text-[9px] text-amber-600">min {day.minLOS}n</span>}
      </div>
    </td>
  )
}

// ── helpers ──────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status?: string }) {
  const s = (status ?? '').toLowerCase()
  if (['approved', 'active', 'enabled', 'committed'].includes(s)) return <Badge variant="success">{status}</Badge>
  if (['pending'].includes(s)) return <Badge variant="warning">{status}</Badge>
  if (['rejected', 'disabled', 'inactive'].includes(s)) return <Badge variant="destructive">{status}</Badge>
  return <Badge variant="outline">{status ?? 'Unknown'}</Badge>
}

function StarRating({ rating }: { rating?: number }) {
  const stars = Math.round(rating ?? 0)
  return (
    <span className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className={`h-4 w-4 ${i < stars ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'}`} />
      ))}
      <span className="ml-1 text-sm font-medium">{rating ?? 0}</span>
    </span>
  )
}

function InfoRow({ label, value }: { label: string; value?: string | number | null }) {
  if (!value && value !== 0) return null
  return (
    <div className="flex items-start gap-3 py-2 border-b border-border last:border-0">
      <span className="text-xs font-medium text-muted-foreground w-36 shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-foreground">{value}</span>
    </div>
  )
}

// ── main page ────────────────────────────────────────────────────────────────

export default function PropertyDetailPage() {
  const params = useParams()
  const propertyId = Number(params.id)
  const validId = !isNaN(propertyId) && propertyId > 0

  const { data: property, isLoading, error } = usePropertyDetail(validId ? propertyId : 0)

  const settings = useSettingsStore()
  const subscribeMutation = useSubscribe()
  const pushBookingMutation = usePushBooking()

  // Search state
  const [searchParams, setSearchParams] = useState<SearchParams | null>(null)
  const [searchForm, setSearchForm] = useState({
    checkIn: new Date().toISOString().split('T')[0],
    nights: '2',
    guests: '2',
    customerNationality: 'AE',
  })

  // Calendar state
  const [calendarParams, setCalendarParams] = useState<CalendarParams | null>(null)
  const [calForm, setCalForm] = useState({
    roomCode: '',
    rateplanCode: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
  })

  // Dialogs
  const [subDialogOpen, setSubDialogOpen] = useState(false)
  const [bookDialogOpen, setBookDialogOpen] = useState(false)
  const [subForm, setSubForm] = useState({
    ratePlanCodes: '',
    userId: settings.userId,
    email: settings.email,
    callbackUrl: settings.callbackUrl,
  })
  const [bookForm, setBookForm] = useState({
    reservationId: `RES-${Date.now()}`,
    checkIn: new Date().toISOString().split('T')[0],
    checkOut: new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0],
    roomTypeCode: '',
    ratePlanCode: '',
    adults: '2',
    children: '0',
    infants: '0',
    amountBeforeTax: '',
    amountAfterTax: '',
    currency: property?.settings?.currency ?? 'USD',
    guestFirstName: '',
    guestLastName: '',
    guestEmail: '',
    guestPhone: '',
    guestCountryCode: 'AE',
  })

  const { data: searchResults, isLoading: searchLoading, error: searchError } = useSearch(searchParams)
  const { data: calendarData, isLoading: calLoading, error: calError } = useCalendar(calendarParams)

  // ARI Manager state
  const [ariStartDate, setAriStartDate] = useState(TODAY_STR)
  const [ariEndDate, setAriEndDate] = useState(PLUS14)
  const [ariCombos, setAriCombos] = useState<AriCombo[]>([])
  const [ariHasLoaded, setAriHasLoaded] = useState(false)
  const [ariCollapsed, setAriCollapsed] = useState<Record<string, boolean>>({})

  // Selected rate plans for the subscribe dialog — initialized once property loads
  const [selectedRatePlans, setSelectedRatePlans] = useState<string[]>([])

  useEffect(() => {
    if (!property) return
    const mapping = property.roomsAndRatePlansMapping ?? {}
    const codes = Array.from(new Set(Object.values(mapping).flat())).sort() as string[]
    if (codes.length > 0) setSelectedRatePlans(codes)
  }, [property])

  const toggleRatePlan = (code: string) => {
    setSelectedRatePlans((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    )
  }

  const hotelCode = String(propertyId)

  // ── ARI Manager hooks — MUST be before any early returns ─────────────────
  const _rooms = property?.rooms ?? []
  const _mapping = property?.roomsAndRatePlansMapping ?? {}
  const _allRpCodes = Array.from(new Set(Object.values(_mapping).flat())).sort() as string[]
  const _currency = property?.settings?.currency ?? 'USD'

  const loadPropertyARI = useCallback(async () => {
    if (!ariStartDate || !ariEndDate || ariEndDate <= ariStartDate) {
      toast.error('Check date range'); return
    }
    if (ariEndDate > addDaysStr(ariStartDate, 31)) {
      toast.error('Max 31-day range'); return
    }
    const combosToLoad: AriCombo[] = []
    for (const room of _rooms) {
      if (!room.code) continue
      const rps: string[] = _mapping[room.code] ?? _allRpCodes
      for (const rpCode of rps) {
        combosToLoad.push({
          roomCode: room.code, roomName: room.name ?? room.code,
          rpCode, rpName: rpCode,
          days: [], loading: true, error: null,
        })
      }
    }
    if (combosToLoad.length === 0) { toast.error('No rooms with rate plans found'); return }
    setAriCombos(combosToLoad)
    setAriHasLoaded(true)
    setAriCollapsed({})
    await Promise.all(
      combosToLoad.map(async (combo) => {
        try {
          const res = await axios.post<{ success: boolean; data: CalendarDay[] }>('/api/calendar', {
            propertyId,
            roomCode: combo.roomCode,
            rateplanCode: combo.rpCode,
            startDate: ariStartDate,
            endDate: ariEndDate,
          })
          const days: CalendarDay[] = Array.isArray(res.data?.data)
            ? res.data.data
            : Array.isArray(res.data) ? res.data as unknown as CalendarDay[] : []
          setAriCombos(prev => prev.map(c =>
            c.roomCode === combo.roomCode && c.rpCode === combo.rpCode
              ? { ...c, days, loading: false } : c
          ))
        } catch (err: unknown) {
          const msg = axios.isAxiosError(err) ? (err.response?.data?.error ?? err.message) : 'Failed'
          setAriCombos(prev => prev.map(c =>
            c.roomCode === combo.roomCode && c.rpCode === combo.rpCode
              ? { ...c, loading: false, error: msg } : c
          ))
        }
      })
    )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ariStartDate, ariEndDate, propertyId, _rooms, _mapping, _allRpCodes])

  const ariDates = useMemo(() => buildDateRange(ariStartDate, ariEndDate), [ariStartDate, ariEndDate])
  const ariIsLoading = ariCombos.some(c => c.loading)
  const ariLoaded = useMemo(() => ariCombos.filter(c => !c.loading && !c.error && c.days.length > 0), [ariCombos])

  const ariByRoom = useMemo(() => {
    const map = new Map<string, AriCombo[]>()
    for (const c of ariLoaded) {
      const arr = map.get(c.roomCode) ?? []; arr.push(c); map.set(c.roomCode, arr)
    }
    return map
  }, [ariLoaded])

  const handleAriExport = useCallback(() => {
    const rows: Record<string, unknown>[] = []
    for (const c of ariLoaded) {
      for (const d of c.days) {
        rows.push({
          Room: c.roomCode, RoomName: c.roomName, RatePlan: c.rpCode,
          Date: d.date, Day: dow(d.date),
          Available: d.numberOfAvailableRooms,
          IsOpen: d.isOpen ? 'Yes' : 'No',
          Price: d.pricePerRoomAfterTax ?? d.baseAmounts?.[0]?.price ?? '',
          MinLOS: d.minLOS, MaxLOS: d.maxLOS,
        })
      }
    }
    if (rows.length === 0) { toast.error('No data to export'); return }
    downloadExcel(rows, `ARI_${propertyId}_${ariStartDate}`)
    toast.success('Excel downloaded')
  }, [ariLoaded, propertyId, ariStartDate])
  // ── end ARI Manager hooks ─────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-7 w-48" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Skeleton className="h-64 lg:col-span-2" />
          <Skeleton className="h-64" />
        </div>
      </div>
    )
  }

  if (!validId || error || !property) {
    return (
      <div className="space-y-4">
        <Link href="/properties">
          <Button variant="ghost" size="sm"><ChevronLeft className="h-4 w-4" />Back to Properties</Button>
        </Link>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {!validId
              ? 'Invalid property ID. Please go back and select a property.'
              : error?.message ?? `Property ${propertyId} not found.`}
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  const handleSubscribe = async () => {
    const codes = selectedRatePlans.length > 0
      ? selectedRatePlans
      : subForm.ratePlanCodes.split(',').map((s) => s.trim()).filter(Boolean)
    if (codes.length === 0) {
      toast.error('Select at least one rate plan code')
      return
    }
    try {
      await subscribeMutation.mutateAsync({
        method: 'ARI',
        propertyIds: [propertyId],
        ratePlans: [{ propertyId, ratePlanCodes: codes }],
        userId: subForm.userId,
        envelope: 'Hyperguest',
        authentication: { bearer: settings.callbackToken },
        envelopeSubUrls: { Callback: subForm.callbackUrl },
        email: subForm.email,
        parameters: {},
        version: 1,
      })
      toast.success('Subscribed successfully')
      setSubDialogOpen(false)
    } catch (e) {
      toast.error('Subscription failed', { description: (e as Error).message })
    }
  }

  const handlePushBooking = async () => {
    try {
      await pushBookingMutation.mutateAsync({
        reservationId: bookForm.reservationId,
        hotelCode,
        resStatus: 'Commit',
        echoToken: generateEchoToken(),
        rooms: [{
          roomTypeCode: bookForm.roomTypeCode,
          ratePlanCode: bookForm.ratePlanCode,
          numberOfUnits: 1,
          adults: Number(bookForm.adults),
          children: Number(bookForm.children),
          infants: Number(bookForm.infants),
          checkIn: bookForm.checkIn,
          checkOut: bookForm.checkOut,
          amountBeforeTax: Number(bookForm.amountBeforeTax),
          amountAfterTax: Number(bookForm.amountAfterTax),
          currency: bookForm.currency,
        }],
        guest: {
          firstName: bookForm.guestFirstName,
          lastName: bookForm.guestLastName,
          email: bookForm.guestEmail,
          phone: bookForm.guestPhone,
          countryCode: bookForm.guestCountryCode,
        },
        totalAmountBeforeTax: Number(bookForm.amountBeforeTax),
        totalAmountAfterTax: Number(bookForm.amountAfterTax),
        currency: bookForm.currency,
        timestamp: new Date().toISOString(),
      })
      toast.success('Booking pushed successfully')
      setBookDialogOpen(false)
    } catch (e) {
      toast.error('Booking push failed', { description: (e as Error).message })
    }
  }

  const rooms = property.rooms ?? []
  const mapping = property.roomsAndRatePlansMapping ?? {}

  // Derive all unique rate plan codes from the property mapping
  const allRatePlanCodes = Array.from(
    new Set(Object.values(mapping).flat())
  ).sort() as string[]

  // use the pre-computed hook values for the render
  const currency = _currency

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Back + header */}
      <div>
        <Link href="/properties">
          <Button variant="ghost" size="sm" className="mb-3 -ml-1">
            <ChevronLeft className="h-4 w-4" />
            Back to Properties
          </Button>
        </Link>
        <PageHeader
          title={property.name}
          subtitle={`Property ID: ${property.id}`}
          breadcrumbs={[
            { label: 'Properties', href: '/properties' },
            { label: property.name },
          ]}
        >
          <Button variant="outline" size="sm" onClick={() => setSubDialogOpen(true)}>
            <Bell className="h-4 w-4" />
            Subscribe to ARI
          </Button>
          <Button size="sm" onClick={() => setBookDialogOpen(true)}>
            <Send className="h-4 w-4" />
            Push Test Booking
          </Button>
        </PageHeader>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList className="mb-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="rooms">Rooms & Rate Plans</TabsTrigger>
          <TabsTrigger value="ari">ARI Manager</TabsTrigger>
          <TabsTrigger value="availability">Availability</TabsTrigger>
          <TabsTrigger value="calendar">ARI Calendar</TabsTrigger>
        </TabsList>

        {/* ── Overview ──────────────────────────────────────────────────────── */}
        <TabsContent value="overview">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Main info */}
            <Card className="lg:col-span-2">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <StarRating rating={property.rating} />
                  </div>
                  <StatusBadge status={property.status} />
                </div>
              </CardHeader>
              <CardContent className="space-y-0">
                <InfoRow label="Property ID" value={property.id} />
                <InfoRow label="Group" value={property.group} />
                <InfoRow label="Hotel Type" value={property.settings?.hotelType?.name} />
                <InfoRow label="Timezone" value={property.settings?.timezone} />
                <InfoRow label="Check-in" value={property.settings?.checkIn} />
                <InfoRow label="Check-out" value={property.settings?.checkOut} />
                <InfoRow label="Cut-off" value={property.settings?.cutOff} />
                <InfoRow label="Currency" value={property.settings?.currency} />
                <InfoRow label="Max Infant Age" value={property.settings?.maxInfantAge} />
                <InfoRow label="Max Child Age" value={property.settings?.maxChildAge} />
                <InfoRow label="Number of Rooms" value={property.settings?.numberOfRooms} />
                <InfoRow label="Number of Floors" value={property.settings?.numberOfFloors} />
                <InfoRow label="Chain" value={property.settings?.chain} />
                <InfoRow label="Is Test Property" value={property.isTest ? 'Yes' : 'No'} />
              </CardContent>
            </Card>

            {/* Side cards */}
            <div className="space-y-4">
              {/* Location */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-primary" />
                    Location
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-1.5">
                  {property.location?.address && <p>{property.location.address}</p>}
                  {property.location?.city?.name && <p>{property.location.city.name}</p>}
                  {property.location?.postcode && <p>Postcode: {property.location.postcode}</p>}
                  {property.location?.region && <p>{property.location.region}</p>}
                  {property.location?.countryCode && (
                    <p className="font-medium">{property.location.countryCode}</p>
                  )}
                  {property.coordinates && (
                    <a
                      href={`https://maps.google.com/?q=${property.coordinates.latitude},${property.coordinates.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-primary hover:underline mt-2"
                    >
                      <ExternalLink className="h-3 w-3" />
                      View on Google Maps
                    </a>
                  )}
                </CardContent>
              </Card>

              {/* Contact */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Contact</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {property.contact?.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>{property.contact.phone}</span>
                    </div>
                  )}
                  {property.contact?.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="truncate">{property.contact.email}</span>
                    </div>
                  )}
                  {property.contact?.website && (
                    <div className="flex items-center gap-2">
                      <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                      <a
                        href={property.contact.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline truncate"
                      >
                        {property.contact.website}
                      </a>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Commission */}
              {property.commission && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Commission</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-0 text-sm">
                    <InfoRow label="Value" value={`${property.commission.value}%`} />
                    <InfoRow label="Charge Type" value={property.commission.chargeType} />
                    <InfoRow label="Calculation" value={property.commission.calculation} />
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ── Rooms & Rate Plans ────────────────────────────────────────────── */}
        <TabsContent value="rooms">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">{rooms.length} Rooms</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {rooms.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No room data available.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Rate Plans</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rooms.map((room) => {
                      const ratePlans = room.code ? (mapping[room.code] ?? []) : []
                      return (
                        <TableRow key={room.id}>
                          <TableCell className="font-mono text-xs">{room.id}</TableCell>
                          <TableCell className="text-sm font-medium">{room.name}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{room.type}</TableCell>
                          <TableCell className="font-mono text-xs">{room.code ?? '—'}</TableCell>
                          <TableCell><StatusBadge status={room.status} /></TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {ratePlans.length > 0
                                ? ratePlans.map((rp) => (
                                    <Badge key={rp} variant="outline" className="text-[10px] font-mono">{rp}</Badge>
                                  ))
                                : <span className="text-xs text-muted-foreground">None mapped</span>
                              }
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── ARI Manager ───────────────────────────────────────────────────── */}
        <TabsContent value="ari">
          <div className="space-y-4">
            {/* Controls */}
            <Card>
              <CardContent className="pt-5 pb-4">
                <div className="flex flex-col sm:flex-row sm:items-end gap-4">
                  {/* Date inputs */}
                  <div className="grid grid-cols-2 gap-3 flex-1 max-w-sm">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Start Date</Label>
                      <Input type="date" value={ariStartDate}
                        onChange={e => setAriStartDate(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">End Date</Label>
                      <Input type="date" value={ariEndDate}
                        onChange={e => setAriEndDate(e.target.value)} />
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <Button onClick={loadPropertyARI} disabled={ariIsLoading} className="gap-2">
                      {ariIsLoading
                        ? <><RefreshCw className="h-4 w-4 animate-spin"/>Loading…</>
                        : <><BarChart3 className="h-4 w-4"/>Load ARI</>}
                    </Button>
                    {ariHasLoaded && ariLoaded.length > 0 && (
                      <Button variant="outline" onClick={handleAriExport} className="gap-2">
                        <Download className="h-4 w-4"/>Export Excel
                      </Button>
                    )}
                  </div>

                  {/* Status badges */}
                  {ariHasLoaded && (
                    <div className="flex items-center gap-2 flex-wrap">
                      {ariIsLoading && (
                        <Badge variant="secondary" className="gap-1">
                          <RefreshCw className="h-3 w-3 animate-spin"/>
                          {ariCombos.filter(c => c.loading).length} loading
                        </Badge>
                      )}
                      {ariLoaded.length > 0 && (
                        <Badge variant="success">{ariLoaded.length} loaded</Badge>
                      )}
                      {ariCombos.filter(c => c.error).length > 0 && (
                        <Badge variant="destructive">
                          {ariCombos.filter(c => c.error).length} failed
                        </Badge>
                      )}
                    </div>
                  )}
                </div>

                <p className="text-xs text-muted-foreground mt-2">
                  Max 31-day range · {_rooms.length} rooms · {_allRpCodes.length} rate plans ·{' '}
                  <span className="font-medium">{_rooms.filter(r => r.code).length * _allRpCodes.length} combinations</span>
                </p>
              </CardContent>
            </Card>

            {/* Legend */}
            {ariHasLoaded && ariLoaded.length > 0 && (
              <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Legend:</span>
                <div className="flex items-center gap-1.5"><div className="h-3 w-5 rounded bg-green-200 dark:bg-green-800/50"/>Open</div>
                <div className="flex items-center gap-1.5"><div className="h-3 w-5 rounded bg-red-200 dark:bg-red-800/50"/>Closed</div>
                <div className="flex items-center gap-1.5"><div className="h-3 w-5 rounded bg-orange-200 dark:bg-orange-800/50"/>0 rooms</div>
                <span>· Each cell: <CheckCircle2 className="inline h-3 w-3 text-green-600"/> availability count · price</span>
              </div>
            )}

            {/* Skeleton */}
            {ariIsLoading && (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-12 rounded-lg bg-muted animate-pulse"/>)}
              </div>
            )}

            {/* Room-wise grid — one collapsible card per room */}
            {!ariIsLoading && ariHasLoaded && ariByRoom.size === 0 && (
              <Alert>
                <AlertCircle className="h-4 w-4"/>
                <AlertDescription>No ARI data returned. Check the date range or room/rate plan configuration.</AlertDescription>
              </Alert>
            )}

            {!ariIsLoading && ariByRoom.size > 0 && (
              <div className="space-y-3">
                {Array.from(ariByRoom.entries()).map(([roomCode, rps]) => {
                  const isCollapsed = ariCollapsed[roomCode]
                  const roomName = rps[0]?.roomName ?? roomCode
                  return (
                    <Card key={roomCode}>
                      <CardHeader
                        className="py-3 cursor-pointer select-none"
                        onClick={() => setAriCollapsed(p => ({ ...p, [roomCode]: !p[roomCode] }))}
                      >
                        <div className="flex items-center gap-3">
                          {isCollapsed
                            ? <ChevronRight className="h-4 w-4 text-muted-foreground"/>
                            : <ChevronDown className="h-4 w-4 text-muted-foreground"/>}
                          <span className="font-mono text-sm font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded">
                            {roomCode}
                          </span>
                          <span className="text-sm text-muted-foreground">{roomName}</span>
                          <Badge variant="outline" className="ml-auto text-xs">
                            {rps.length} rate plan{rps.length !== 1 ? 's' : ''}
                          </Badge>
                        </div>
                      </CardHeader>
                      {!isCollapsed && (
                        <CardContent className="p-0 pb-2">
                          <div className="overflow-auto">
                            <table className="text-xs border-collapse w-full">
                              <thead>
                                <tr className="bg-muted/40">
                                  <th className="border border-border/30 px-3 py-2 text-left font-medium whitespace-nowrap sticky left-0 bg-muted/60 z-10 min-w-[110px]">
                                    Rate Plan
                                  </th>
                                  {ariDates.map(d => (
                                    <th key={d} className="border border-border/30 px-1.5 py-1.5 text-center font-medium whitespace-nowrap min-w-[80px]">
                                      <div className="text-[11px]">{d.slice(8) + '/' + d.slice(5,7)}</div>
                                      <div className="text-[10px] text-muted-foreground font-normal">{dow(d)}</div>
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {rps.map(c => {
                                  const lookup = new Map(c.days.map(d => [d.date, d]))
                                  return (
                                    <tr key={c.rpCode} className="hover:bg-muted/10">
                                      <td className="border border-border/30 px-3 py-1.5 sticky left-0 bg-background z-10 whitespace-nowrap">
                                        <span className="font-mono text-xs bg-secondary px-1.5 py-0.5 rounded font-medium">
                                          {c.rpCode}
                                        </span>
                                      </td>
                                      {ariDates.map(d => (
                                        <AriGridCell key={d} day={lookup.get(d)} currency={currency} />
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
            )}

            {/* Idle */}
            {!ariHasLoaded && (
              <div className="rounded-lg border border-dashed p-12 text-center">
                <BarChart3 className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3"/>
                <p className="text-sm font-medium text-muted-foreground mb-1">
                  Ready to load ARI data
                </p>
                <p className="text-xs text-muted-foreground/60">
                  {_rooms.filter(r => r.code).length} rooms × {_allRpCodes.length} rate plans found.
                  Pick a date range above and click <strong>Load ARI</strong>.
                </p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ── Availability ──────────────────────────────────────────────────── */}
        <TabsContent value="availability">
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Search Availability</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Check-in Date</Label>
                    <Input
                      type="date"
                      value={searchForm.checkIn}
                      onChange={(e) => setSearchForm((f) => ({ ...f, checkIn: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Nights</Label>
                    <Input
                      type="number"
                      min={1}
                      max={30}
                      value={searchForm.nights}
                      onChange={(e) => setSearchForm((f) => ({ ...f, nights: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Guests</Label>
                    <Input
                      type="number"
                      min={1}
                      max={10}
                      value={searchForm.guests}
                      onChange={(e) => setSearchForm((f) => ({ ...f, guests: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Nationality</Label>
                    <Input
                      value={searchForm.customerNationality}
                      maxLength={2}
                      placeholder="AE"
                      onChange={(e) => setSearchForm((f) => ({ ...f, customerNationality: e.target.value.toUpperCase() }))}
                    />
                  </div>
                </div>
                <Button
                  className="mt-4"
                  onClick={() =>
                    setSearchParams({
                      checkIn: searchForm.checkIn,
                      nights: Number(searchForm.nights),
                      guests: Number(searchForm.guests),
                      hotelIds: propertyId,
                      customerNationality: searchForm.customerNationality,
                    })
                  }
                  disabled={searchLoading}
                >
                  {searchLoading ? 'Searching…' : 'Search'}
                </Button>
              </CardContent>
            </Card>

            {searchError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{searchError.message}</AlertDescription>
              </Alert>
            )}

            {searchResults && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Search Results</CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="code-block text-xs overflow-auto max-h-96">
                    {JSON.stringify(searchResults, null, 2)}
                  </pre>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* ── ARI Calendar ──────────────────────────────────────────────────── */}
        <TabsContent value="calendar">
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  ARI Calendar Query
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Room Code — auto-populated from property rooms */}
                  <div className="space-y-1.5">
                    <Label className="text-xs">Room Code</Label>
                    {rooms.filter((r) => r.code).length > 0 ? (
                      <Select
                        value={calForm.roomCode}
                        onValueChange={(value) =>
                          setCalForm((f) => ({ ...f, roomCode: value, rateplanCode: '' }))
                        }
                      >
                        <SelectTrigger className="h-9 text-sm">
                          <SelectValue placeholder="Select room…" />
                        </SelectTrigger>
                        <SelectContent>
                          {rooms.filter((r) => r.code).map((room) => (
                            <SelectItem key={room.code} value={room.code!}>
                              <span className="font-mono text-xs mr-1">{room.code}</span>
                              <span className="text-muted-foreground">— {room.name}</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        placeholder="e.g. STD"
                        value={calForm.roomCode}
                        onChange={(e) => setCalForm((f) => ({ ...f, roomCode: e.target.value, rateplanCode: '' }))}
                      />
                    )}
                  </div>

                  {/* Rate Plan Code — auto-filtered by selected room */}
                  <div className="space-y-1.5">
                    <Label className="text-xs">Rate Plan Code</Label>
                    {rooms.filter((r) => r.code).length > 0 ? (
                      <Select
                        value={calForm.rateplanCode}
                        onValueChange={(value) =>
                          setCalForm((f) => ({ ...f, rateplanCode: value }))
                        }
                        disabled={!calForm.roomCode}
                      >
                        <SelectTrigger className="h-9 text-sm">
                          <SelectValue
                            placeholder={
                              calForm.roomCode
                                ? (mapping[calForm.roomCode]?.length ?? 0) > 0
                                  ? 'Select rate plan…'
                                  : 'No rate plans mapped'
                                : 'Select room first'
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {(mapping[calForm.roomCode] ?? []).map((rpCode) => (
                            <SelectItem key={rpCode} value={rpCode}>
                              <span className="font-mono text-xs">{rpCode}</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        placeholder="e.g. BAR"
                        value={calForm.rateplanCode}
                        onChange={(e) => setCalForm((f) => ({ ...f, rateplanCode: e.target.value }))}
                      />
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Start Date</Label>
                    <Input
                      type="date"
                      value={calForm.startDate}
                      onChange={(e) => setCalForm((f) => ({ ...f, startDate: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">End Date</Label>
                    <Input
                      type="date"
                      value={calForm.endDate}
                      onChange={(e) => setCalForm((f) => ({ ...f, endDate: e.target.value }))}
                    />
                  </div>
                </div>
                <Button
                  className="mt-4"
                  onClick={() =>
                    setCalendarParams({
                      propertyId,
                      roomCode: calForm.roomCode,
                      rateplanCode: calForm.rateplanCode,
                      startDate: calForm.startDate,
                      endDate: calForm.endDate,
                    })
                  }
                  disabled={calLoading || !calForm.roomCode || !calForm.rateplanCode}
                >
                  {calLoading ? 'Loading…' : 'Fetch Calendar'}
                </Button>
              </CardContent>
            </Card>

            {calError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{calError.message}</AlertDescription>
              </Alert>
            )}

            {calendarData && Array.isArray(calendarData) && calendarData.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">{calendarData.length} Calendar Days</CardTitle>
                </CardHeader>
                <CardContent className="p-0 overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Available</TableHead>
                        <TableHead>Open</TableHead>
                        <TableHead>Min LOS</TableHead>
                        <TableHead>Max LOS</TableHead>
                        <TableHead>Price/Room</TableHead>
                        <TableHead>Price/Person</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {calendarData.map((day) => (
                        <TableRow key={day.date} className={!day.isOpen ? 'opacity-50' : ''}>
                          <TableCell className="font-mono text-xs">{formatDate(day.date)}</TableCell>
                          <TableCell>
                            <span className={`text-xs font-medium ${day.numberOfAvailableRooms > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                              {day.numberOfAvailableRooms}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className={`inline-flex h-2 w-2 rounded-full ${day.isOpen ? 'bg-emerald-500' : 'bg-red-500'}`} />
                          </TableCell>
                          <TableCell className="text-xs">{day.minLOS}</TableCell>
                          <TableCell className="text-xs">{day.maxLOS}</TableCell>
                          <TableCell className="text-xs font-medium">{day.pricePerRoomAfterTax?.toFixed(2)}</TableCell>
                          <TableCell className="text-xs">{day.pricePerPersonAfterTax?.toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* ── Subscribe Dialog ─────────────────────────────────────────────────── */}
      <Dialog open={subDialogOpen} onOpenChange={setSubDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Subscribe to ARI Updates</DialogTitle>
            <DialogDescription>
              Subscribe property {propertyId} to receive ARI push notifications.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {/* Rate Plan Codes — auto-populated from property, shown as checkboxes */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Rate Plan Codes</Label>
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

              {allRatePlanCodes.length > 0 ? (
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
                <Input
                  placeholder="BAR, OTA, etc."
                  value={subForm.ratePlanCodes}
                  onChange={(e) => setSubForm((f) => ({ ...f, ratePlanCodes: e.target.value }))}
                />
              )}
              {selectedRatePlans.length === 0 && allRatePlanCodes.length > 0 && (
                <p className="text-xs text-amber-600">Select at least one rate plan</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">User ID</Label>
              <Input
                value={subForm.userId}
                onChange={(e) => setSubForm((f) => ({ ...f, userId: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Email</Label>
              <Input
                type="email"
                value={subForm.email}
                onChange={(e) => setSubForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Callback URL</Label>
              <Input
                value={subForm.callbackUrl}
                onChange={(e) => setSubForm((f) => ({ ...f, callbackUrl: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubscribe} disabled={subscribeMutation.isPending}>
              {subscribeMutation.isPending ? 'Subscribing…' : 'Subscribe'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Push Test Booking Dialog ─────────────────────────────────────────── */}
      <Dialog open={bookDialogOpen} onOpenChange={setBookDialogOpen}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Push Test Booking</DialogTitle>
            <DialogDescription>Push a test booking to property {propertyId}.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            {/* Reservation ID */}
            <div className="space-y-1">
              <Label className="text-xs">Reservation ID</Label>
              <Input
                value={bookForm.reservationId}
                onChange={(e) => setBookForm((f) => ({ ...f, reservationId: e.target.value }))}
              />
            </div>

            {/* Room Type Code — auto-populated dropdown */}
            <div className="space-y-1">
              <Label className="text-xs">Room Type Code</Label>
              {rooms.filter((r) => r.code).length > 0 ? (
                <Select
                  value={bookForm.roomTypeCode}
                  onValueChange={(value) =>
                    setBookForm((f) => ({ ...f, roomTypeCode: value, ratePlanCode: '' }))
                  }
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Select room…" />
                  </SelectTrigger>
                  <SelectContent>
                    {rooms.filter((r) => r.code).map((room) => (
                      <SelectItem key={room.code} value={room.code!}>
                        <span className="font-mono text-xs mr-1">{room.code}</span>
                        <span className="text-muted-foreground text-xs">— {room.name}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  placeholder="STD"
                  value={bookForm.roomTypeCode}
                  onChange={(e) => setBookForm((f) => ({ ...f, roomTypeCode: e.target.value, ratePlanCode: '' }))}
                />
              )}
            </div>

            {/* Rate Plan Code — auto-filtered by selected room */}
            <div className="space-y-1">
              <Label className="text-xs">Rate Plan Code</Label>
              {rooms.filter((r) => r.code).length > 0 ? (
                <Select
                  value={bookForm.ratePlanCode}
                  onValueChange={(value) =>
                    setBookForm((f) => ({ ...f, ratePlanCode: value }))
                  }
                  disabled={!bookForm.roomTypeCode}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue
                      placeholder={
                        bookForm.roomTypeCode
                          ? (mapping[bookForm.roomTypeCode]?.length ?? 0) > 0
                            ? 'Select rate plan…'
                            : 'No rate plans mapped'
                          : 'Select room first'
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {(mapping[bookForm.roomTypeCode] ?? []).map((rpCode) => (
                      <SelectItem key={rpCode} value={rpCode}>
                        <span className="font-mono text-xs">{rpCode}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  placeholder="BAR"
                  value={bookForm.ratePlanCode}
                  onChange={(e) => setBookForm((f) => ({ ...f, ratePlanCode: e.target.value }))}
                />
              )}
            </div>

            {/* Rest of the booking fields */}
            {[
              { label: 'Check-in', key: 'checkIn', type: 'date' },
              { label: 'Check-out', key: 'checkOut', type: 'date' },
              { label: 'Adults', key: 'adults', type: 'number' },
              { label: 'Children', key: 'children', type: 'number' },
              { label: 'Infants', key: 'infants', type: 'number' },
              { label: 'Amount Before Tax', key: 'amountBeforeTax', type: 'number' },
              { label: 'Amount After Tax', key: 'amountAfterTax', type: 'number' },
              { label: 'Currency', key: 'currency', placeholder: 'USD' },
              { label: 'Guest First Name', key: 'guestFirstName' },
              { label: 'Guest Last Name', key: 'guestLastName' },
              { label: 'Guest Email', key: 'guestEmail', type: 'email' },
              { label: 'Guest Phone', key: 'guestPhone' },
              { label: 'Nationality', key: 'guestCountryCode', placeholder: 'AE' },
            ].map(({ label, key, type, placeholder }) => (
              <div key={key} className="space-y-1">
                <Label className="text-xs">{label}</Label>
                <Input
                  type={type ?? 'text'}
                  placeholder={placeholder}
                  value={(bookForm as Record<string, string>)[key] ?? ''}
                  onChange={(e) =>
                    setBookForm((f) => ({ ...f, [key]: e.target.value }))
                  }
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBookDialogOpen(false)}>Cancel</Button>
            <Button onClick={handlePushBooking} disabled={pushBookingMutation.isPending}>
              {pushBookingMutation.isPending ? 'Pushing…' : 'Push Booking'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
