'use client'

import React, { useState, useCallback, useEffect } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@/lib/utils/zodResolver'
import { z } from 'zod'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import {
  Plus, Send, Eye, Copy, Download, Search, ChevronLeft, ChevronRight,
  X, RefreshCw, CheckCircle2, XCircle, Loader2, FileText,
  CalendarDays, Hotel, User, DollarSign, Hash, TrendingUp
} from 'lucide-react'

import { PageHeader } from '@/components/layout/PageHeader'
import { StatsCard } from '@/components/layout/StatsCard'
import { EmptyState } from '@/components/layout/EmptyState'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
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

import { useBookings, useBookingStats, usePushBooking } from '@/lib/hooks/useBookings'
import { buildOtaXml } from '@/lib/api/bookings'
import {
  cn, formatCurrency, formatDate, formatDateTime,
  getStatusBadgeVariant, downloadExcel, generateEchoToken
} from '@/lib/utils'
import type { StoredBooking, BookingPushRequest } from '@/lib/types'

// ─── Zod Schema ────────────────────────────────────────────────────────────────

const roomSchema = z.object({
  roomTypeCode: z.string().min(1, 'Room type code is required'),
  ratePlanCode: z.string().min(1, 'Rate plan code is required'),
  numberOfUnits: z.coerce.number().int().min(1).max(10),
  adults: z.coerce.number().int().min(1).max(4),
  children: z.coerce.number().int().min(0).max(3),
  infants: z.coerce.number().int().min(0).max(2),
  checkIn: z.string().min(1, 'Check-in date is required'),
  checkOut: z.string().min(1, 'Check-out date is required'),
  amountBeforeTax: z.coerce.number().min(0),
  amountAfterTax: z.coerce.number().min(0),
})

const bookingFormSchema = z.object({
  reservationId: z.string().min(1, 'Reservation ID is required'),
  hotelCode: z.string().min(1, 'Hotel code is required'),
  resStatus: z.enum(['Commit', 'Cancel', 'Modify']),
  currency: z.enum(['USD', 'EUR', 'GBP', 'INR', 'AED', 'SGD']),
  timestamp: z.string().min(1),
  rooms: z.array(roomSchema).min(1).max(3),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Valid email required'),
  phone: z.string().min(1, 'Phone is required'),
  countryCode: z.string().default('IN'),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  addressLine: z.string().optional(),
})

type BookingFormValues = z.infer<typeof bookingFormSchema>

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateReservationId(): string {
  return `EGS-${Date.now().toString(36).toUpperCase()}`
}

function toLocalDatetimeString(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function colorizeXml(xml: string): React.ReactNode {
  // Split into lines and apply basic syntax highlighting
  const lines = xml.split('\n')
  return lines.map((line, idx) => {
    const colored = line
      // Tags
      .replace(/(&lt;\/?)([a-zA-Z:_][\w:.-]*)([^&]*?)(\/?&gt;)/g,
        '<span class="text-blue-400">$1$2</span><span class="text-green-400">$3</span><span class="text-blue-400">$4</span>')
      // Attribute values
      .replace(/="([^"]*)"/g, '=<span class="text-amber-300">"$1"</span>')
    return (
      <span key={idx} dangerouslySetInnerHTML={{ __html: colored + '\n' }} />
    )
  })
}

const PAGE_SIZE = 25

// ─── BookingForm Dialog ────────────────────────────────────────────────────────

interface BookingFormDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  onSuccess: () => void
}

function BookingFormDialog({ open, onOpenChange, onSuccess }: BookingFormDialogProps) {
  const [showXmlPreview, setShowXmlPreview] = useState(false)
  const [xmlPreview, setXmlPreview] = useState('')
  const pushBooking = usePushBooking()

  const form = useForm<BookingFormValues>({
    resolver: zodResolver(bookingFormSchema),
    defaultValues: {
      reservationId: generateReservationId(),
      hotelCode: '',
      resStatus: 'Commit',
      currency: 'USD',
      timestamp: toLocalDatetimeString(new Date()),
      rooms: [{
        roomTypeCode: '', ratePlanCode: '', numberOfUnits: 1,
        adults: 2, children: 0, infants: 0,
        checkIn: '', checkOut: '',
        amountBeforeTax: 0, amountAfterTax: 0,
      }],
      firstName: '', lastName: '', email: '', phone: '',
      countryCode: 'IN', city: '', state: '', postalCode: '', addressLine: '',
    },
  })

  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'rooms' })
  const watchedValues = form.watch()

  const totalBeforeTax = watchedValues.rooms?.reduce((s, r) => s + (Number(r.amountBeforeTax) || 0), 0) ?? 0
  const totalAfterTax = watchedValues.rooms?.reduce((s, r) => s + (Number(r.amountAfterTax) || 0), 0) ?? 0

  const handlePreviewXml = () => {
    const v = form.getValues()
    const req: BookingPushRequest = {
      reservationId: v.reservationId,
      hotelCode: v.hotelCode || 'XXXXX',
      resStatus: v.resStatus,
      echoToken: generateEchoToken(),
      rooms: v.rooms.map(r => ({ ...r, currency: v.currency })),
      guest: {
        firstName: v.firstName, lastName: v.lastName,
        email: v.email, phone: v.phone,
        countryCode: v.countryCode, city: v.city,
        state: v.state, postalCode: v.postalCode, addressLine: v.addressLine,
      },
      totalAmountBeforeTax: totalBeforeTax,
      totalAmountAfterTax: totalAfterTax,
      currency: v.currency,
      timestamp: v.timestamp || new Date().toISOString(),
    }
    setXmlPreview(buildOtaXml(req))
    setShowXmlPreview(true)
  }

  const onSubmit = async (values: BookingFormValues) => {
    const req: BookingPushRequest = {
      reservationId: values.reservationId,
      hotelCode: values.hotelCode,
      resStatus: values.resStatus,
      echoToken: generateEchoToken(),
      rooms: values.rooms.map(r => ({ ...r, currency: values.currency })),
      guest: {
        firstName: values.firstName, lastName: values.lastName,
        email: values.email, phone: values.phone,
        countryCode: values.countryCode, city: values.city,
        state: values.state, postalCode: values.postalCode, addressLine: values.addressLine,
      },
      totalAmountBeforeTax: totalBeforeTax,
      totalAmountAfterTax: totalAfterTax,
      currency: values.currency,
      timestamp: values.timestamp || new Date().toISOString(),
    }

    try {
      await pushBooking.mutateAsync(req)
      toast.success('Booking pushed successfully', {
        description: `Reservation ${values.reservationId} committed to HyperGuest`,
      })
      onSuccess()
      onOpenChange(false)
      form.reset({
        reservationId: generateReservationId(),
        hotelCode: '', resStatus: 'Commit', currency: 'USD',
        timestamp: toLocalDatetimeString(new Date()),
        rooms: [{
          roomTypeCode: '', ratePlanCode: '', numberOfUnits: 1,
          adults: 2, children: 0, infants: 0, checkIn: '', checkOut: '',
          amountBeforeTax: 0, amountAfterTax: 0,
        }],
        firstName: '', lastName: '', email: '', phone: '',
        countryCode: 'IN', city: '', state: '', postalCode: '', addressLine: '',
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Push failed'
      toast.error('Booking push failed', { description: msg })
    }
  }

  const errors = form.formState.errors

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5 text-primary" />
            Push New Reservation
          </DialogTitle>
          <DialogDescription>
            Fill in the reservation details to push an OTA booking to HyperGuest B2B.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Section 1 — Reservation Info */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Reservation Info
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="reservationId">Reservation ID</Label>
                <Input id="reservationId" {...form.register('reservationId')} className="font-mono text-sm" />
                {errors.reservationId && <p className="text-xs text-destructive">{errors.reservationId.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="hotelCode">Hotel Code</Label>
                <Input id="hotelCode" placeholder="e.g. 19912" {...form.register('hotelCode')} />
                {errors.hotelCode && <p className="text-xs text-destructive">{errors.hotelCode.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Reservation Status</Label>
                <Select value={form.watch('resStatus')} onValueChange={v => form.setValue('resStatus', v as 'Commit' | 'Cancel' | 'Modify')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Commit">Commit</SelectItem>
                    <SelectItem value="Cancel">Cancel</SelectItem>
                    <SelectItem value="Modify">Modify</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Currency</Label>
                <Select value={form.watch('currency')} onValueChange={v => form.setValue('currency', v as BookingFormValues['currency'])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['USD', 'EUR', 'GBP', 'INR', 'AED', 'SGD'].map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="timestamp">Timestamp</Label>
                <Input id="timestamp" type="datetime-local" {...form.register('timestamp')} />
              </div>
            </div>
          </div>

          <Separator />

          {/* Section 2 — Room Details */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Room Details ({fields.length}/3)
              </h3>
              {fields.length < 3 && (
                <Button
                  type="button" variant="outline" size="sm"
                  onClick={() => append({
                    roomTypeCode: '', ratePlanCode: '', numberOfUnits: 1,
                    adults: 2, children: 0, infants: 0, checkIn: '', checkOut: '',
                    amountBeforeTax: 0, amountAfterTax: 0,
                  })}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add Room
                </Button>
              )}
            </div>

            {fields.map((field, idx) => (
              <Card key={field.id} className="border-border/60">
                <CardHeader className="pb-3 pt-4 px-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium">Room {idx + 1}</CardTitle>
                    {fields.length > 1 && (
                      <Button
                        type="button" variant="ghost" size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => remove(idx)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Room Type Code</Label>
                      <Input placeholder="e.g. DBL" className="text-sm" {...form.register(`rooms.${idx}.roomTypeCode`)} />
                      {errors.rooms?.[idx]?.roomTypeCode && (
                        <p className="text-xs text-destructive">{errors.rooms[idx]?.roomTypeCode?.message}</p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Rate Plan Code</Label>
                      <Input placeholder="e.g. BB" className="text-sm" {...form.register(`rooms.${idx}.ratePlanCode`)} />
                      {errors.rooms?.[idx]?.ratePlanCode && (
                        <p className="text-xs text-destructive">{errors.rooms[idx]?.ratePlanCode?.message}</p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Check-In</Label>
                      <Input type="date" className="text-sm" {...form.register(`rooms.${idx}.checkIn`)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Check-Out</Label>
                      <Input type="date" className="text-sm" {...form.register(`rooms.${idx}.checkOut`)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Units</Label>
                      <Input type="number" min={1} max={10} className="text-sm" {...form.register(`rooms.${idx}.numberOfUnits`)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Adults</Label>
                      <Input type="number" min={1} max={4} className="text-sm" {...form.register(`rooms.${idx}.adults`)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Children</Label>
                      <Input type="number" min={0} max={3} className="text-sm" {...form.register(`rooms.${idx}.children`)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Infants</Label>
                      <Input type="number" min={0} max={2} className="text-sm" {...form.register(`rooms.${idx}.infants`)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Amount Before Tax</Label>
                      <Input type="number" step="0.01" min={0} className="text-sm" {...form.register(`rooms.${idx}.amountBeforeTax`)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Amount After Tax</Label>
                      <Input type="number" step="0.01" min={0} className="text-sm" {...form.register(`rooms.${idx}.amountAfterTax`)} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {/* Total summary */}
            <div className="flex items-center justify-end gap-6 text-sm pt-1">
              <span className="text-muted-foreground">
                Total Before Tax: <span className="font-semibold text-foreground">{formatCurrency(totalBeforeTax, watchedValues.currency || 'USD')}</span>
              </span>
              <span className="text-muted-foreground">
                Total After Tax: <span className="font-semibold text-foreground">{formatCurrency(totalAfterTax, watchedValues.currency || 'USD')}</span>
              </span>
            </div>
          </div>

          <Separator />

          {/* Section 3 — Guest Details */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Guest Details
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="firstName">First Name</Label>
                <Input id="firstName" {...form.register('firstName')} />
                {errors.firstName && <p className="text-xs text-destructive">{errors.firstName.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lastName">Last Name</Label>
                <Input id="lastName" {...form.register('lastName')} />
                {errors.lastName && <p className="text-xs text-destructive">{errors.lastName.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" {...form.register('email')} />
                {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" {...form.register('phone')} />
                {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Country Code</Label>
                <Select value={form.watch('countryCode')} onValueChange={v => form.setValue('countryCode', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[
                      ['IN', 'India'], ['US', 'United States'], ['GB', 'United Kingdom'],
                      ['AE', 'UAE'], ['SG', 'Singapore'], ['AU', 'Australia'],
                      ['DE', 'Germany'], ['FR', 'France'], ['CA', 'Canada'], ['JP', 'Japan'],
                    ].map(([code, name]) => (
                      <SelectItem key={code} value={code}>{code} — {name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="city">City</Label>
                <Input id="city" {...form.register('city')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="state">State</Label>
                <Input id="state" {...form.register('state')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="postalCode">Postal Code</Label>
                <Input id="postalCode" {...form.register('postalCode')} />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="addressLine">Address</Label>
                <Input id="addressLine" {...form.register('addressLine')} />
              </div>
            </div>
          </div>

          <Separator />

          {/* Section 4 — XML Preview */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={handlePreviewXml}
              className="flex items-center gap-2 text-sm font-medium text-primary hover:underline"
            >
              <FileText className="h-4 w-4" />
              {showXmlPreview ? 'Hide' : 'Preview'} SOAP XML
            </button>
            <AnimatePresence>
              {showXmlPreview && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="overflow-hidden"
                >
                  <pre className="bg-slate-950 text-slate-100 text-xs rounded-lg p-4 overflow-x-auto max-h-64 overflow-y-auto font-mono leading-relaxed">
                    {colorizeXml(xmlPreview.replace(/</g, '&lt;').replace(/>/g, '&gt;'))}
                  </pre>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pushBooking.isPending} className="gap-2">
              {pushBooking.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Pushing...</>
              ) : (
                <><Send className="h-4 w-4" /> Push Booking</>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─── View Booking Dialog ───────────────────────────────────────────────────────

interface ViewBookingDialogProps {
  booking: StoredBooking | null
  open: boolean
  onOpenChange: (v: boolean) => void
}

function ViewBookingDialog({ booking, open, onOpenChange }: ViewBookingDialogProps) {
  if (!booking) return null

  const handleCopyXml = async () => {
    try {
      await navigator.clipboard.writeText(booking.xmlPayload || '')
      toast.success('XML copied to clipboard')
    } catch {
      toast.error('Failed to copy')
    }
  }

  const xmlDisplay = (booking.xmlPayload || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-primary" />
            Booking Details
          </DialogTitle>
          <DialogDescription>Reservation {booking.reservationId}</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Main details grid */}
          <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
            {[
              ['Reservation ID', <span key="rid" className="font-mono text-xs">{booking.reservationId}</span>],
              ['Hotel Code', booking.hotelCode],
              ['Status', <Badge key="s" variant={booking.success ? 'default' : 'destructive'}>{booking.success ? 'Success' : 'Failed'}</Badge>],
              ['Res Status', booking.resStatus],
              ['Guest Name', booking.guestName],
              ['Guest Email', booking.guestEmail],
              ['Check-In', booking.checkIn ? formatDate(booking.checkIn) : '—'],
              ['Check-Out', booking.checkOut ? formatDate(booking.checkOut) : '—'],
              ['Rooms', String(booking.rooms)],
              ['Total Amount', formatCurrency(booking.totalAmount || 0, booking.currency || 'USD')],
              ['Currency', booking.currency],
              ['Created At', formatDateTime(booking.createdAt)],
            ].map(([label, value], i) => (
              <div key={i}>
                <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
                <div className="font-medium">{value}</div>
              </div>
            ))}
          </div>

          <Separator />

          {/* XML Payload */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold">SOAP XML Payload</h4>
              <Button variant="outline" size="sm" onClick={handleCopyXml} className="gap-1.5">
                <Copy className="h-3.5 w-3.5" /> Copy XML
              </Button>
            </div>
            <pre className="bg-slate-950 text-slate-100 text-xs rounded-lg p-4 overflow-x-auto max-h-48 overflow-y-auto font-mono leading-relaxed">
              {colorizeXml(xmlDisplay)}
            </pre>
          </div>

          {/* API Response */}
          {booking.response && (
            <>
              <Separator />
              <div className="space-y-2">
                <h4 className="text-sm font-semibold">API Response</h4>
                <pre className="bg-muted text-xs rounded-lg p-4 overflow-x-auto max-h-32 overflow-y-auto font-mono">
                  {booking.response}
                </pre>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Skeleton Table Row ────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <TableRow>
      {Array.from({ length: 11 }).map((_, i) => (
        <TableCell key={i}><Skeleton className="h-4 w-full" /></TableCell>
      ))}
    </TableRow>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function BookingsPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [resStatusFilter, setResStatusFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [viewBooking, setViewBooking] = useState<StoredBooking | null>(null)
  const [viewOpen, setViewOpen] = useState(false)

  // Build filters for the query
  const filters = {
    search: search || undefined,
    status: statusFilter !== 'all' ? statusFilter : undefined,
    resStatus: resStatusFilter !== 'all' ? resStatusFilter : undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  }

  const { data: statsData, isLoading: statsLoading } = useBookingStats()
  const {
    data: bookingsData,
    isLoading: bookingsLoading,
    refetch,
  } = useBookings(filters, page, PAGE_SIZE)

  // Server-side pagination — items already scoped to current page
  const pagedBookings: StoredBooking[] = bookingsData?.items ?? []
  const total = bookingsData?.total ?? 0
  const totalPages = bookingsData?.totalPages ?? Math.ceil(total / PAGE_SIZE)

  const handleExport = useCallback(() => {
    if (!pagedBookings.length) {
      toast.info('No bookings to export')
      return
    }
    const rows = pagedBookings.map(b => ({
      'Reservation ID': b.reservationId,
      'Hotel Code': b.hotelCode,
      'Guest Name': b.guestName,
      'Guest Email': b.guestEmail,
      'Check-In': b.checkIn,
      'Check-Out': b.checkOut,
      'Rooms': b.rooms,
      'Total Amount': b.totalAmount,
      'Currency': b.currency,
      'Status': b.success ? 'Success' : 'Failed',
      'Res Status': b.resStatus,
      'Created At': b.createdAt,
    }))
    downloadExcel(rows, `bookings-${new Date().toISOString().split('T')[0]}.xlsx`)
    toast.success('Export started')
  }, [pagedBookings])

  const handleView = (booking: StoredBooking) => {
    setViewBooking(booking)
    setViewOpen(true)
  }

  const handleCopyId = async (id: string) => {
    try {
      await navigator.clipboard.writeText(id)
      toast.success('Copied to clipboard')
    } catch {
      toast.error('Copy failed')
    }
  }

  // Reset page on filter change
  useEffect(() => { setPage(1) }, [search, statusFilter, resStatusFilter, dateFrom, dateTo])

  const stats = statsData

  return (
    <TooltipProvider>
      <div className="space-y-6 p-6">
        {/* Header */}
        <PageHeader
          title="Booking Push"
          subtitle="Push OTA reservations to HyperGuest B2B"
        >
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
          <Button onClick={() => setFormOpen(true)} className="gap-1.5">
            <Plus className="h-4 w-4" /> New Booking Push
          </Button>
        </PageHeader>

        {/* Stats row */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <StatsCard
            icon={Send}
            label="Total Pushed"
            value={statsLoading ? 0 : (stats?.total ?? 0)}
            variant="blue"
            loading={statsLoading}
            index={0}
          />
          <StatsCard
            icon={CheckCircle2}
            label="Successful"
            value={statsLoading ? 0 : (stats?.successful ?? 0)}
            variant="green"
            loading={statsLoading}
            index={1}
          />
          <StatsCard
            icon={XCircle}
            label="Failed"
            value={statsLoading ? 0 : (stats?.failed ?? 0)}
            variant="red"
            loading={statsLoading}
            index={2}
          />
          <StatsCard
            icon={CalendarDays}
            label="Today"
            value={statsLoading ? 0 : (stats?.today ?? 0)}
            variant="amber"
            loading={statsLoading}
            index={3}
          />
          <StatsCard
            icon={TrendingUp}
            label="Success Rate"
            value={statsLoading ? 0 : Math.round(stats?.successRate ?? 0)}
            suffix="%"
            variant="purple"
            loading={statsLoading}
            index={4}
          />
        </div>

        {/* Filter bar */}
        <Card className="border-border/60">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search reservation ID or guest..."
                  className="pl-9"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="Push Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
              <Select value={resStatusFilter} onValueChange={setResStatusFilter}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="Res Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="Commit">Commit</SelectItem>
                  <SelectItem value="Cancel">Cancel</SelectItem>
                  <SelectItem value="Modify">Modify</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  placeholder="From"
                  className="w-36 text-sm"
                  value={dateFrom}
                  onChange={e => setDateFrom(e.target.value)}
                />
                <span className="text-muted-foreground text-sm">to</span>
                <Input
                  type="date"
                  placeholder="To"
                  className="w-36 text-sm"
                  value={dateTo}
                  onChange={e => setDateTo(e.target.value)}
                />
              </div>
              <Button variant="outline" size="sm" onClick={handleExport} className="gap-1.5 ml-auto">
                <Download className="h-3.5 w-3.5" /> Export Excel
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card className="border-border/60">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-44">Reservation ID</TableHead>
                <TableHead>Hotel Code</TableHead>
                <TableHead>Guest Name</TableHead>
                <TableHead>Check-In</TableHead>
                <TableHead>Check-Out</TableHead>
                <TableHead className="text-center">Rooms</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Push Status</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Created At</TableHead>
                <TableHead className="w-16 text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bookingsLoading ? (
                Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
              ) : pagedBookings.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="p-0">
                    <EmptyState
                      icon={Send}
                      title="No bookings found"
                      description={
                        search || statusFilter !== 'all' || dateFrom || dateTo
                          ? 'No bookings match the current filters'
                          : 'Push your first OTA reservation using the button above'
                      }
                      action={
                        !search && statusFilter === 'all' && !dateFrom && !dateTo
                          ? { label: 'New Booking Push', onClick: () => setFormOpen(true), icon: Plus }
                          : undefined
                      }
                    />
                  </TableCell>
                </TableRow>
              ) : (
                pagedBookings.map(booking => (
                  <motion.tr
                    key={booking.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="border-b transition-colors hover:bg-muted/40"
                  >
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs text-foreground truncate max-w-[110px]">
                          {booking.reservationId}
                        </span>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => handleCopyId(booking.reservationId)}
                              className="text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <Copy className="h-3 w-3" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>Copy ID</TooltipContent>
                        </Tooltip>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1.5">
                        <Hotel className="h-3.5 w-3.5 text-muted-foreground" />
                        {booking.hotelCode}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 text-muted-foreground" />
                        {booking.guestName}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1.5 text-sm">
                        <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                        {booking.checkIn ? formatDate(booking.checkIn) : '—'}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">
                      {booking.checkOut ? formatDate(booking.checkOut) : '—'}
                    </TableCell>
                    <TableCell className="text-center text-sm">
                      {booking.rooms}
                    </TableCell>
                    <TableCell className="text-right font-medium text-sm">
                      <span className="flex items-center justify-end gap-1">
                        <DollarSign className="h-3 w-3 text-muted-foreground" />
                        {formatCurrency(booking.totalAmount || 0, booking.currency || 'USD')}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={booking.success ? 'default' : 'destructive'}
                        className={cn(
                          'text-xs',
                          booking.success
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                            : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800'
                        )}
                      >
                        {booking.success ? 'Success' : 'Failed'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-xs font-medium',
                          booking.resStatus === 'Cancel'
                            ? 'border-red-300 text-red-600 dark:border-red-700 dark:text-red-400'
                            : booking.resStatus === 'Modify'
                            ? 'border-amber-300 text-amber-600 dark:border-amber-700 dark:text-amber-400'
                            : 'border-blue-300 text-blue-600 dark:border-blue-700 dark:text-blue-400'
                        )}
                      >
                        {booking.resStatus || 'Commit'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDateTime(booking.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost" size="icon"
                            className="h-8 w-8"
                            onClick={() => handleView(booking)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>View details</TooltipContent>
                      </Tooltip>
                    </TableCell>
                  </motion.tr>
                ))
              )}
            </TableBody>
          </Table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border/60">
              <p className="text-sm text-muted-foreground">
                Showing {Math.min((page - 1) * PAGE_SIZE + 1, total)}–{Math.min(page * PAGE_SIZE, total)} of {total}
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline" size="icon"
                  className="h-8 w-8"
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
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setPage(pageNum)}
                    >
                      {pageNum}
                    </Button>
                  )
                })}
                <Button
                  variant="outline" size="icon"
                  className="h-8 w-8"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </Card>

        {/* Dialogs */}
        <BookingFormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          onSuccess={() => refetch()}
        />
        <ViewBookingDialog
          booking={viewBooking}
          open={viewOpen}
          onOpenChange={setViewOpen}
        />
      </div>
    </TooltipProvider>
  )
}
