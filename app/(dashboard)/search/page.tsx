'use client'

import React, { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@/lib/utils/zodResolver'
import { z } from 'zod'
import axios from 'axios'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import {
  Search,
  BookOpen,
  Copy,
  Check,
  AlertCircle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  BedDouble,
} from 'lucide-react'

import { PageHeader } from '@/components/layout/PageHeader'
import { EmptyState } from '@/components/layout/EmptyState'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Separator } from '@/components/ui/separator'
import { cn, formatCurrency, formatDate } from '@/lib/utils'
import { HotelSearch } from '@/components/ui/hotel-search'
import type { SearchResult, SearchRoomResult, RoomRate } from '@/lib/types'

// ─────────────────────────────── SCHEMAS ────────────────────────────────────

const searchSchema = z.object({
  checkIn: z.string().min(1, 'Check-in date is required'),
  nights: z.coerce.number().int().min(1).max(30),
  guests: z.coerce.number().int().min(1).max(10),
  hotelIds: z.string().min(1, 'At least one Hotel ID is required'),
  customerNationality: z.string().min(1, 'Nationality is required'),
})

type SearchFormValues = z.infer<typeof searchSchema>

const bookingSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email'),
  phone: z.string().min(5, 'Phone is required'),
  countryCode: z.string().min(1, 'Country is required'),
  city: z.string().min(1, 'City is required'),
  state: z.string().optional(),
  postalCode: z.string().optional(),
})

type BookingFormValues = z.infer<typeof bookingSchema>

// ─────────────────────────────── CONSTANTS ──────────────────────────────────

const COUNTRIES = [
  { code: 'IN', label: 'India' },
  { code: 'US', label: 'United States' },
  { code: 'GB', label: 'United Kingdom' },
  { code: 'AE', label: 'UAE' },
  { code: 'SG', label: 'Singapore' },
  { code: 'AU', label: 'Australia' },
  { code: 'CA', label: 'Canada' },
  { code: 'DE', label: 'Germany' },
  { code: 'FR', label: 'France' },
  { code: 'JP', label: 'Japan' },
  { code: 'CN', label: 'China' },
  { code: 'ZA', label: 'South Africa' },
]

const TODAY = new Date().toISOString().split('T')[0]

// ─────────────────────────────── BOOKING DIALOG ──────────────────────────────

interface SelectedRoom {
  hotelId: number
  hotelName?: string
  currency?: string
  room: SearchRoomResult
  rate: RoomRate
  checkIn: string
  nights: number
  guests: number
}

interface BookingDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selected: SelectedRoom | null
}

function BookingDialog({ open, onOpenChange, selected }: BookingDialogProps) {
  const [submitting, setSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<BookingFormValues>({
    resolver: zodResolver(bookingSchema),
  })

  const onSubmit = async (values: BookingFormValues) => {
    if (!selected) return
    setSubmitting(true)

    const checkInDate = selected.checkIn
    const checkOutDate = (() => {
      const d = new Date(checkInDate)
      d.setDate(d.getDate() + selected.nights)
      return d.toISOString().split('T')[0]
    })()

    const reservationId = `RES-${Date.now()}`

    const payload = {
      reservationId,
      hotelCode: String(selected.hotelId),
      resStatus: 'Commit',
      echoToken: `ECHO-${Date.now()}`,
      rooms: [
        {
          roomTypeCode: selected.room.roomTypeCode,
          ratePlanCode: selected.rate.ratePlanCode,
          numberOfUnits: 1,
          adults: selected.guests,
          children: 0,
          infants: 0,
          checkIn: checkInDate,
          checkOut: checkOutDate,
          amountBeforeTax: selected.rate.amountBeforeTax ?? selected.rate.amountAfterTax ?? 0,
          amountAfterTax: selected.rate.amountAfterTax ?? 0,
          currency: selected.rate.currency,
        },
      ],
      guest: {
        firstName: values.firstName,
        lastName: values.lastName,
        phone: values.phone,
        email: values.email,
        countryCode: values.countryCode,
        city: values.city,
        state: values.state ?? '',
        postalCode: values.postalCode ?? '',
      },
      totalAmountBeforeTax: selected.rate.amountBeforeTax ?? selected.rate.amountAfterTax ?? 0,
      totalAmountAfterTax: selected.rate.amountAfterTax ?? 0,
      currency: selected.rate.currency,
      timestamp: new Date().toISOString(),
    }

    try {
      await axios.post('/api/bookings', payload)
      toast.success('Booking confirmed!', {
        description: `Reservation ID: ${reservationId}`,
      })
      reset()
      onOpenChange(false)
    } catch (err: unknown) {
      const msg =
        axios.isAxiosError(err) ? err.response?.data?.error ?? err.message : 'Booking failed'
      toast.error('Booking failed', { description: msg })
    } finally {
      setSubmitting(false)
    }
  }

  if (!selected) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Confirm Booking</DialogTitle>
          <DialogDescription>
            {selected.room.roomName} &mdash; {selected.rate.ratePlanCode} &mdash;{' '}
            {formatCurrency(selected.rate.amountAfterTax ?? 0, selected.rate.currency)}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md bg-muted/40 border p-3 text-sm space-y-1">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Hotel</span>
            <span className="font-medium">{selected.hotelName ?? selected.hotelId}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Room</span>
            <span className="font-medium">{selected.room.roomName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Check-in</span>
            <span className="font-medium">{formatDate(selected.checkIn)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Nights</span>
            <span className="font-medium">{selected.nights}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Guests</span>
            <span className="font-medium">{selected.guests}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Rate Plan</span>
            <span className="font-medium">{selected.rate.ratePlanCode}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total</span>
            <span className="font-semibold text-primary">
              {formatCurrency(selected.rate.amountAfterTax ?? 0, selected.rate.currency)}
            </span>
          </div>
        </div>

        <Separator />

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>First Name *</Label>
              <Input {...register('firstName')} placeholder="John" />
              {errors.firstName && (
                <p className="text-xs text-destructive">{errors.firstName.message}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label>Last Name *</Label>
              <Input {...register('lastName')} placeholder="Doe" />
              {errors.lastName && (
                <p className="text-xs text-destructive">{errors.lastName.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Email *</Label>
              <Input {...register('email')} type="email" placeholder="john@example.com" />
              {errors.email && (
                <p className="text-xs text-destructive">{errors.email.message}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label>Phone *</Label>
              <Input {...register('phone')} placeholder="+91 9999999999" />
              {errors.phone && (
                <p className="text-xs text-destructive">{errors.phone.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Country *</Label>
              <Input {...register('countryCode')} placeholder="IN" />
              {errors.countryCode && (
                <p className="text-xs text-destructive">{errors.countryCode.message}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label>City *</Label>
              <Input {...register('city')} placeholder="Mumbai" />
              {errors.city && (
                <p className="text-xs text-destructive">{errors.city.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>State</Label>
              <Input {...register('state')} placeholder="Maharashtra" />
            </div>
            <div className="space-y-1">
              <Label>Postal Code</Label>
              <Input {...register('postalCode')} placeholder="400001" />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Confirming…' : 'Confirm Booking'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─────────────────────────────── ROOM CARD ──────────────────────────────────

interface RoomCardProps {
  room: SearchRoomResult
  hotelId: number
  hotelName?: string
  currency?: string
  checkIn: string
  nights: number
  guests: number
  onBook: (selected: SelectedRoom) => void
  index: number
}

function RoomCard({
  room,
  hotelId,
  hotelName,
  currency,
  checkIn,
  nights,
  guests,
  onBook,
  index,
}: RoomCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.06 }}
    >
      <Card className="border-border/60 hover:border-border transition-colors">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="text-base">{room.roomName}</CardTitle>
              <CardDescription className="mt-0.5">Room ID: {room.roomId}</CardDescription>
            </div>
            <Badge variant="outline" className="font-mono text-xs shrink-0">
              {room.roomTypeCode}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {room.rates && room.rates.length > 0 ? (
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="text-xs">Rate Plan</TableHead>
                    <TableHead className="text-xs">Amount</TableHead>
                    <TableHead className="text-xs">Taxes</TableHead>
                    <TableHead className="text-xs">Meal Plan</TableHead>
                    <TableHead className="text-xs w-24"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {room.rates.map((rate, i) => (
                    <TableRow key={i} className="text-sm">
                      <TableCell className="font-mono text-xs font-medium">
                        {rate.ratePlanCode}
                      </TableCell>
                      <TableCell className="font-semibold tabular-nums">
                        {formatCurrency(rate.amountAfterTax ?? rate.pricePerRoom ?? 0, rate.currency || currency || 'USD')}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={rate.taxesIncluded ? 'default' : 'secondary'}
                          className="text-xs"
                        >
                          {rate.taxesIncluded ? 'Incl.' : 'Excl.'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {rate.mealPlan ?? '—'}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          className="h-7 text-xs px-2"
                          onClick={() =>
                            onBook({ hotelId, hotelName, currency, room, rate, checkIn, nights, guests })
                          }
                        >
                          Book
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No rates available for this room.</p>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ─────────────────────────────── RAW RESULT ─────────────────────────────────

function RawResultBlock({ data }: { data: unknown }) {
  const [copied, setCopied] = useState(false)
  const json = JSON.stringify(data, null, 2)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(json)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Card>
      <CardHeader className="pb-2 flex-row items-center justify-between">
        <CardTitle className="text-sm">Raw API Response</CardTitle>
        <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={handleCopy}>
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </CardHeader>
      <CardContent className="pt-0">
        <pre className="rounded-md bg-muted p-4 text-xs overflow-auto max-h-[60vh] whitespace-pre-wrap break-words">
          {json}
        </pre>
      </CardContent>
    </Card>
  )
}

// ─────────────────────────────── SKELETON ───────────────────────────────────

function SearchSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <Card key={i} className="p-5 space-y-3">
          <div className="flex justify-between">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-5 w-16" />
          </div>
          <Skeleton className="h-4 w-24" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        </Card>
      ))}
    </div>
  )
}

// ─────────────────────────────── PAGE ───────────────────────────────────────

export default function SearchPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<SearchResult | null>(null)
  const [searchSummary, setSearchSummary] = useState<SearchFormValues | null>(null)
  const [bookingTarget, setBookingTarget] = useState<SelectedRoom | null>(null)
  const [bookingOpen, setBookingOpen] = useState(false)
  const [selectedHotelName, setSelectedHotelName] = useState<string>('')

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<SearchFormValues>({
    resolver: zodResolver(searchSchema),
    defaultValues: {
      checkIn: TODAY,
      nights: 1,
      guests: 1,
      hotelIds: '',
      customerNationality: 'IN',
    },
  })

  const nationalityValue = watch('customerNationality')

  const onSubmit = async (values: SearchFormValues) => {
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const params = new URLSearchParams({
        checkIn: values.checkIn,
        nights: String(values.nights),
        guests: String(values.guests),
        hotelIds: values.hotelIds,
        customerNationality: values.customerNationality,
      })
      const res = await axios.get<SearchResult>(`/api/search?${params.toString()}`)
      setResult(res.data)
      setSearchSummary(values)
    } catch (err: unknown) {
      const msg =
        axios.isAxiosError(err)
          ? err.response?.data?.error ?? err.message
          : 'Search failed. Please try again.'
      setError(msg)
      toast.error('Search failed', { description: msg })
    } finally {
      setLoading(false)
    }
  }

  const handleBook = (selected: SelectedRoom) => {
    setBookingTarget(selected)
    setBookingOpen(true)
  }

  const hasRooms = result?.rooms && result.rooms.length > 0

  return (
    <div className="space-y-6">
      <PageHeader
        title="Availability Search"
        subtitle="Search real-time hotel room availability from HyperGuest"
      />

      {/* Search Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Search Parameters</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Check-in */}
              <div className="space-y-1.5">
                <Label htmlFor="checkIn">Check-in Date *</Label>
                <Input
                  id="checkIn"
                  type="date"
                  min={TODAY}
                  {...register('checkIn')}
                />
                {errors.checkIn && (
                  <p className="text-xs text-destructive">{errors.checkIn.message}</p>
                )}
              </div>

              {/* Nights */}
              <div className="space-y-1.5">
                <Label htmlFor="nights">Nights (1–30) *</Label>
                <Input
                  id="nights"
                  type="number"
                  min={1}
                  max={30}
                  {...register('nights')}
                />
                {errors.nights && (
                  <p className="text-xs text-destructive">{errors.nights.message}</p>
                )}
              </div>

              {/* Guests */}
              <div className="space-y-1.5">
                <Label htmlFor="guests">Guests (1–10) *</Label>
                <Input
                  id="guests"
                  type="number"
                  min={1}
                  max={10}
                  {...register('guests')}
                />
                {errors.guests && (
                  <p className="text-xs text-destructive">{errors.guests.message}</p>
                )}
              </div>

              {/* Hotel Search */}
              <div className="space-y-1.5">
                <Label>Hotel *</Label>
                <input type="hidden" {...register('hotelIds')} />
                <HotelSearch
                  onSelect={(hotel) => {
                    setValue('hotelIds', String(hotel.id))
                    setSelectedHotelName(hotel.name)
                  }}
                  onClear={() => {
                    setValue('hotelIds', '')
                    setSelectedHotelName('')
                  }}
                  placeholder="Type hotel name…"
                />
                {errors.hotelIds && (
                  <p className="text-xs text-destructive">{errors.hotelIds.message}</p>
                )}
              </div>

              {/* Nationality */}
              <div className="space-y-1.5 lg:col-span-2">
                <Label>Customer Nationality *</Label>
                <Select
                  value={nationalityValue}
                  onValueChange={(val) => setValue('customerNationality', val)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select nationality" />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.label} ({c.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.customerNationality && (
                  <p className="text-xs text-destructive">{errors.customerNationality.message}</p>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <Button type="submit" disabled={loading} className="gap-2 min-w-[160px]">
                {loading ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Searching…
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4" />
                    Search Availability
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
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <SearchSkeleton />
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
              <AlertTitle>Search Error</AlertTitle>
              <AlertDescription className="flex items-center justify-between gap-4">
                <span>{error}</span>
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0"
                  onClick={() => handleSubmit(onSubmit)()}
                >
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                  Retry
                </Button>
              </AlertDescription>
            </Alert>
          </motion.div>
        )}

        {/* Results */}
        {!loading && !error && result && searchSummary && (
          <motion.div
            key="results"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-4"
          >
            {/* Summary bar */}
            <div className="rounded-lg border bg-muted/40 px-4 py-2.5 text-sm text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 items-center">
              <span>
                <span className="font-medium text-foreground">Hotel:</span>{' '}
                {selectedHotelName || searchSummary.hotelIds}
                <span className="ml-1 font-mono text-xs text-muted-foreground">
                  ({searchSummary.hotelIds})
                </span>
              </span>
              <span className="text-border">|</span>
              <span>
                <span className="font-medium text-foreground">Check-in:</span>{' '}
                {formatDate(searchSummary.checkIn)}
              </span>
              <span className="text-border">|</span>
              <span>
                <span className="font-medium text-foreground">Nights:</span>{' '}
                {searchSummary.nights}
              </span>
              <span className="text-border">|</span>
              <span>
                <span className="font-medium text-foreground">Guests:</span>{' '}
                {searchSummary.guests}
              </span>
            </div>

            {/* Room cards */}
            {hasRooms ? (
              <div className="space-y-4">
                {result.rooms!.map((room, i) => (
                  <RoomCard
                    key={room.roomId}
                    room={room}
                    hotelId={result.hotelId}
                    hotelName={result.hotelName}
                    currency={result.currency}
                    checkIn={searchSummary.checkIn}
                    nights={searchSummary.nights}
                    guests={searchSummary.guests}
                    onBook={handleBook}
                    index={i}
                  />
                ))}
              </div>
            ) : (
              /* If no rooms array, show raw JSON */
              <RawResultBlock data={result} />
            )}
          </motion.div>
        )}

        {/* Empty — never searched */}
        {!loading && !error && !result && (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <EmptyState
              icon={BedDouble}
              title="No search yet"
              description="Fill in the search parameters above and click Search Availability to see results."
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Booking Dialog */}
      <BookingDialog
        open={bookingOpen}
        onOpenChange={setBookingOpen}
        selected={bookingTarget}
      />
    </div>
  )
}
