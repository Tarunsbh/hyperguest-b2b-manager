'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { usePropertyList } from '@/lib/hooks/useProperties'
import { useQueryClient } from '@tanstack/react-query'
import { PROPERTY_KEYS } from '@/lib/hooks/useProperties'
import { PageHeader } from '@/components/layout/PageHeader'
import { EmptyState } from '@/components/layout/EmptyState'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Building2, Search, LayoutGrid, List, Download,
  Star, MapPin, AlertCircle, ChevronLeft, ChevronRight,
  RefreshCw, Database,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { downloadExcel } from '@/lib/utils'
import type { PropertyListItem } from '@/lib/types'
import Link from 'next/link'

const PAGE_SIZE = 25

// ── Sub-components ────────────────────────────────────────────────────────────

function StarRating({ rating }: { rating?: number }) {
  const stars = Math.round(rating ?? 0)
  return (
    <span className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className={`h-3 w-3 ${i < stars ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'}`} />
      ))}
    </span>
  )
}

function StatusBadge({ status }: { status?: string }) {
  const s = (status ?? '').toLowerCase()
  if (['approved', 'active', 'enabled'].includes(s))   return <Badge variant="success">{status}</Badge>
  if (['pending', 'review'].includes(s))                return <Badge variant="warning">{status}</Badge>
  if (['rejected', 'disabled', 'inactive'].includes(s)) return <Badge variant="destructive">{status}</Badge>
  return <Badge variant="outline">{status ?? 'Unknown'}</Badge>
}

function PropertyCard({ property }: { property: PropertyListItem }) {
  return (
    <Card className="overflow-hidden hover:shadow-md transition-all duration-200 group">
      <CardContent className="p-5">
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-foreground leading-tight line-clamp-2">
                {property.name}
              </p>
              <div className="flex items-center gap-1.5 mt-1">
                <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                <p className="text-xs text-muted-foreground truncate">
                  {[property.city, property.countryCode].filter(Boolean).join(', ') || 'Location unknown'}
                </p>
              </div>
            </div>
            <StatusBadge status={property.status} />
          </div>

          <StarRating rating={property.rating} />

          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {property.currency && (
              <span className="truncate">
                <span className="font-medium text-foreground">Currency: </span>{property.currency}
              </span>
            )}
            {property.checkIn && (
              <span className="truncate">
                <span className="font-medium text-foreground">CI: </span>{property.checkIn}
              </span>
            )}
            {property.checkOut && (
              <span className="truncate">
                <span className="font-medium text-foreground">CO: </span>{property.checkOut}
              </span>
            )}
            <span className="truncate font-mono">
              <span className="font-medium text-foreground not-italic">ID: </span>{property.id}
            </span>
          </div>

          <Link href={`/properties/${property.id}`}>
            <Button size="sm" variant="outline" className="w-full mt-1 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
              View Details
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}

function PropertyCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-5 space-y-3">
        <div className="flex justify-between">
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <Skeleton className="h-3 w-24" />
        <div className="grid grid-cols-2 gap-2">
          {[1,2,3,4].map((i) => <Skeleton key={i} className="h-3 w-full" />)}
        </div>
        <Skeleton className="h-8 w-full" />
      </CardContent>
    </Card>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PropertiesPage() {
  const router = useRouter()
  const queryClient = useQueryClient()

  // Filter state
  const [searchInput, setSearchInput] = useState('')  // raw input (debounced)
  const [search, setSearch]           = useState('')  // debounced value sent to API
  const [statusFilter, setStatusFilter] = useState('all')
  const [countryFilter, setCountryFilter] = useState('all')
  const [sortBy, setSortBy]           = useState('name')
  const [viewMode, setViewMode]       = useState<'grid' | 'table'>('grid')
  const [page, setPage]               = useState(1)
  const [exporting, setExporting]     = useState(false)
  const [refreshing, setRefreshing]   = useState(false)

  // Debounce search input — wait 400ms after user stops typing
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setSearch(searchInput)
      setPage(1)
    }, 400)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [searchInput])

  // Reset to page 1 when filters change
  const handleStatusChange  = (v: string) => { setStatusFilter(v);  setPage(1) }
  const handleCountryChange = (v: string) => { setCountryFilter(v); setPage(1) }
  const handleSortChange    = (v: string) => { setSortBy(v);        setPage(1) }

  // Fetch — only 25 records returned (server-side pagination)
  const { data: result, isLoading, isFetching, error } = usePropertyList({
    page, pageSize: PAGE_SIZE, search, status: statusFilter, country: countryFilter, sort: sortBy,
  })

  const properties = result?.data ?? []
  const meta       = result?.meta

  // Countries come from the API (always the full list regardless of filter)
  const countries = meta?.countries ?? []

  // Manual refresh — force HyperGuest sync
  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await queryClient.invalidateQueries({ queryKey: PROPERTY_KEYS.all })
      // Force a refresh fetch
      const p = { page, pageSize: PAGE_SIZE, search, status: statusFilter, country: countryFilter, sort: sortBy, refresh: true }
      await queryClient.fetchQuery({ queryKey: PROPERTY_KEYS.list(p), queryFn: () => fetch(`/api/properties?refresh=1`).then(r => r.json()) })
      await queryClient.invalidateQueries({ queryKey: PROPERTY_KEYS.all })
    } finally {
      setRefreshing(false)
    }
  }, [queryClient, page, search, statusFilter, countryFilter, sortBy])

  // Export — fetch all filtered records in one shot (up to 500)
  const handleExport = useCallback(async () => {
    setExporting(true)
    try {
      const qs = new URLSearchParams({ pageSize: '500', search, sort: sortBy })
      if (statusFilter !== 'all') qs.set('status', statusFilter)
      if (countryFilter !== 'all') qs.set('country', countryFilter)
      const res = await fetch(`/api/properties?${qs}`)
      const json = await res.json() as { data?: PropertyListItem[] }
      const all = Array.isArray(json.data) ? json.data : []
      downloadExcel(
        all.map((p) => ({
          ID: p.id, Name: p.name, Rating: p.rating, Status: p.status,
          Country: p.countryCode, City: p.city, Currency: p.currency,
          CheckIn: p.checkIn, CheckOut: p.checkOut,
        })),
        'hyperguest-properties'
      )
    } finally {
      setExporting(false)
    }
  }, [search, statusFilter, countryFilter, sortBy])

  const clearFilters = () => {
    setSearchInput(''); setSearch('')
    setStatusFilter('all'); setCountryFilter('all')
    setSortBy('name'); setPage(1)
  }

  const total      = meta?.total ?? 0
  const totalPages = meta?.totalPages ?? 1

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Properties" subtitle="Browse all HyperGuest properties">
        {/* Cache indicator */}
        {meta?.fromCache && (
          <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-md px-2.5 py-1.5">
            <Database className="h-3 w-3" />
            <span>Served from cache</span>
          </div>
        )}
        <Button variant="outline" size="sm" onClick={handleExport} disabled={total === 0 || exporting} className="gap-1.5">
          {exporting ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
          Export
        </Button>
        <Button size="sm" onClick={handleRefresh} disabled={refreshing} className="gap-1.5">
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </PageHeader>

      {/* Error */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between gap-4">
            Failed to load properties: {error.message}
            <Button variant="link" size="sm" className="h-auto p-0" onClick={handleRefresh}>Retry</Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Filters bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 items-center">
            {/* Search — debounced, no API call until user stops typing */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search by name, city, country or ID…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-8 h-9"
              />
              {isFetching && !isLoading && (
                <RefreshCw className="absolute right-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground animate-spin" />
              )}
            </div>

            <Select value={statusFilter} onValueChange={handleStatusChange}>
              <SelectTrigger className="w-36 h-9"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="disabled">Disabled</SelectItem>
              </SelectContent>
            </Select>

            <Select value={countryFilter} onValueChange={handleCountryChange}>
              <SelectTrigger className="w-36 h-9"><SelectValue placeholder="Country" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Countries</SelectItem>
                {countries.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={handleSortChange}>
              <SelectTrigger className="w-36 h-9"><SelectValue placeholder="Sort by" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Sort: Name</SelectItem>
                <SelectItem value="rating">Sort: Rating</SelectItem>
                <SelectItem value="status">Sort: Status</SelectItem>
              </SelectContent>
            </Select>

            {/* View toggle */}
            <div className="flex border border-border rounded-md overflow-hidden">
              <Button variant={viewMode === 'grid' ? 'default' : 'ghost'} size="icon"
                className="rounded-none h-9 w-9" onClick={() => setViewMode('grid')} title="Grid view">
                <LayoutGrid className="h-3.5 w-3.5" />
              </Button>
              <Button variant={viewMode === 'table' ? 'default' : 'ghost'} size="icon"
                className="rounded-none h-9 w-9 border-l border-border" onClick={() => setViewMode('table')} title="Table view">
                <List className="h-3.5 w-3.5" />
              </Button>
            </div>

            <span className="text-xs text-muted-foreground ml-auto">
              {isLoading ? 'Loading…' : `${total.toLocaleString()} properties`}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Grid view */}
      {viewMode === 'grid' && (
        isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 12 }).map((_, i) => <PropertyCardSkeleton key={i} />)}
          </div>
        ) : properties.length === 0 ? (
          <EmptyState icon={Building2} title="No properties found"
            description="Try adjusting your search or filter criteria."
            action={{ label: 'Clear filters', onClick: clearFilters }} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {properties.map((p) => <PropertyCard key={p.id} property={p} />)}
          </div>
        )
      )}

      {/* Table view */}
      {viewMode === 'table' && (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead>Currency</TableHead>
                <TableHead>Check-in / Out</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 8 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : properties.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12">
                    <EmptyState icon={Building2} title="No properties found"
                      description="Try adjusting your search or filter criteria."
                      action={{ label: 'Clear filters', onClick: clearFilters }} />
                  </TableCell>
                </TableRow>
              ) : (
                properties.map((p) => (
                  <TableRow key={p.id} className="cursor-pointer" onClick={() => router.push(`/properties/${p.id}`)}>
                    <TableCell className="font-mono text-xs">{p.id}</TableCell>
                    <TableCell className="font-medium text-sm max-w-[200px] truncate">{p.name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {[p.city, p.countryCode].filter(Boolean).join(', ') || '—'}
                    </TableCell>
                    <TableCell><StarRating rating={p.rating} /></TableCell>
                    <TableCell className="text-xs">{p.currency ?? '—'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {p.checkIn && p.checkOut ? `${p.checkIn} / ${p.checkOut}` : '—'}
                    </TableCell>
                    <TableCell><StatusBadge status={p.status} /></TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" asChild onClick={(e) => e.stopPropagation()}>
                        <Link href={`/properties/${p.id}`}>View</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Pagination */}
      {!isLoading && total > PAGE_SIZE && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Showing {((page - 1) * PAGE_SIZE + 1).toLocaleString()}–{Math.min(page * PAGE_SIZE, total).toLocaleString()} of {total.toLocaleString()}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="h-8 w-8"
              disabled={page === 1 || isFetching} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="text-xs font-medium px-2">Page {page} of {totalPages}</span>
            <Button variant="outline" size="icon" className="h-8 w-8"
              disabled={page >= totalPages || isFetching} onClick={() => setPage((p) => p + 1)}>
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
