'use client'

import { useState, useRef, useEffect } from 'react'
import { Search, X, Loader2, Building2, AlertCircle } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export interface Hotel {
  id: number
  name: string
  city?: string
  countryCode?: string
}

interface HotelSearchProps {
  onSelect: (hotel: Hotel) => void
  onClear?: () => void
  placeholder?: string
  className?: string
  disabled?: boolean
}

export function HotelSearch({
  onSelect,
  onClear,
  placeholder = 'Type hotel name or ID…',
  className,
  disabled,
}: HotelSearchProps) {
  const [query, setQuery] = useState('')
  const [allHotels, setAllHotels] = useState<Hotel[]>([])
  const [filtered, setFiltered] = useState<Hotel[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [selected, setSelected] = useState<Hotel | null>(null)

  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Load full hotel list once
  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setLoadError(false)
      try {
        const res = await fetch('/api/properties/list')
        const json = await res.json()
        if (!cancelled) setAllHotels(json.data ?? [])
      } catch {
        if (!cancelled) setLoadError(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  // Filter client-side as query changes
  useEffect(() => {
    const q = query.trim().toLowerCase()
    if (!q) {
      setFiltered(allHotels.slice(0, 25))
      return
    }
    setFiltered(
      allHotels
        .filter(
          (h) =>
            h.name.toLowerCase().includes(q) ||
            String(h.id).startsWith(q) ||
            (h.city ?? '').toLowerCase().includes(q)
        )
        .slice(0, 20)
    )
  }, [query, allHotels])

  // Close dropdown on outside click
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [])

  function handleSelect(hotel: Hotel) {
    setSelected(hotel)
    setQuery(hotel.name)
    setOpen(false)
    onSelect(hotel)
  }

  function handleClear() {
    setSelected(null)
    setQuery('')
    setOpen(false)
    onClear?.()
    inputRef.current?.focus()
  }

  const showDropdown = open && !selected && !disabled
  const showEmpty = showDropdown && !loading && filtered.length === 0 && query.length > 0

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {/* Input */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setSelected(null)
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => !selected && setOpen(true)}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
          className="pl-8 pr-8"
        />
        {loading && (
          <Loader2 className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
        {!loading && (selected || query) && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            tabIndex={-1}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Resolved ID chip */}
      {selected && (
        <p className="mt-1 text-xs text-muted-foreground">
          Property ID:{' '}
          <span className="font-mono font-medium text-foreground">{selected.id}</span>
          {selected.city && (
            <span className="ml-2 text-muted-foreground">{selected.city}</span>
          )}
        </p>
      )}

      {/* Load error */}
      {loadError && (
        <p className="mt-1 flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
          <AlertCircle className="h-3 w-3" />
          Could not load hotels — visit Properties page to sync first
        </p>
      )}

      {/* Dropdown */}
      {showDropdown && filtered.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full max-h-64 overflow-y-auto rounded-md border border-border bg-popover shadow-lg py-1">
          {filtered.map((hotel) => (
            <li
              key={hotel.id}
              onMouseDown={() => handleSelect(hotel)}
              className="flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-sm hover:bg-accent"
            >
              <div className="flex min-w-0 items-center gap-2">
                <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate font-medium">{hotel.name}</span>
                {hotel.city && (
                  <span className="hidden truncate text-xs text-muted-foreground sm:inline">
                    {hotel.city}
                    {hotel.countryCode ? `, ${hotel.countryCode}` : ''}
                  </span>
                )}
              </div>
              <span className="shrink-0 font-mono text-xs text-muted-foreground">{hotel.id}</span>
            </li>
          ))}
        </ul>
      )}

      {/* No results */}
      {showEmpty && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-lg p-3 text-center text-sm text-muted-foreground">
          No hotels found
          {allHotels.length === 0 && (
            <span className="block text-xs mt-0.5">
              Visit the Properties page to sync the hotel list first
            </span>
          )}
        </div>
      )}
    </div>
  )
}
