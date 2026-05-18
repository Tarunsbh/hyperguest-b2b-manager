'use client'

import React, { useState, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Download,
  Inbox,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'

export interface ColumnDef<T = Record<string, unknown>> {
  key: keyof T | string
  header: string
  render?: (value: unknown, row: T, index: number) => React.ReactNode
  sortable?: boolean
  width?: string
  align?: 'left' | 'center' | 'right'
}

type SortDir = 'asc' | 'desc' | null

interface DataTableProps<T extends Record<string, unknown>> {
  columns: ColumnDef<T>[]
  data: T[]
  loading?: boolean
  rowKey?: keyof T | ((row: T) => string)
  onRowClick?: (row: T) => void
  emptyMessage?: string
  emptyTitle?: string
  enableExport?: boolean
  exportFilename?: string
  selectable?: boolean
  onSelectionChange?: (selected: T[]) => void
  className?: string
  skeletonRows?: number
}

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100]

function getNestedValue(obj: Record<string, unknown>, key: string): unknown {
  return key.split('.').reduce<unknown>((acc, part) => {
    if (acc && typeof acc === 'object' && part in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[part]
    }
    return undefined
  }, obj)
}

function downloadCSV(data: Record<string, unknown>[], columns: ColumnDef[], filename: string) {
  const headers = columns.map((c) => c.header).join(',')
  const rows = data.map((row) =>
    columns
      .map((c) => {
        const val = getNestedValue(row, c.key as string)
        const str = val === null || val === undefined ? '' : String(val)
        return `"${str.replace(/"/g, '""')}"`
      })
      .join(',')
  )
  const csv = [headers, ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filename}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  loading = false,
  rowKey,
  onRowClick,
  emptyMessage = 'No data available for the current filters.',
  emptyTitle = 'No results found',
  enableExport = true,
  exportFilename = 'export',
  selectable = false,
  onSelectionChange,
  className,
  skeletonRows = 8,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const getRowId = useCallback(
    (row: T, index: number): string => {
      if (!rowKey) return String(index)
      if (typeof rowKey === 'function') return rowKey(row)
      return String(row[rowKey] ?? index)
    },
    [rowKey]
  )

  // Sort
  const sorted = useMemo(() => {
    if (!sortKey || !sortDir) return data
    return [...data].sort((a, b) => {
      const av = getNestedValue(a as Record<string, unknown>, sortKey)
      const bv = getNestedValue(b as Record<string, unknown>, sortKey)
      const cmp =
        av === bv ? 0 : av === null || av === undefined ? 1 : bv === null || bv === undefined ? -1 :
        typeof av === 'number' && typeof bv === 'number'
          ? av - bv
          : String(av).localeCompare(String(bv))
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [data, sortKey, sortDir])

  // Paginate
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const paginated = useMemo(
    () => sorted.slice((page - 1) * pageSize, page * pageSize),
    [sorted, page, pageSize]
  )

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : d === 'desc' ? null : 'asc'))
      if (sortDir === 'desc') setSortKey(null)
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
    setPage(1)
  }

  const handlePageSize = (val: string) => {
    setPageSize(Number(val))
    setPage(1)
  }

  // Selection
  const allPageIds = paginated.map((r, i) => getRowId(r, i))
  const allSelected = allPageIds.length > 0 && allPageIds.every((id) => selected.has(id))
  const someSelected = allPageIds.some((id) => selected.has(id)) && !allSelected

  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (allSelected) {
        allPageIds.forEach((id) => next.delete(id))
      } else {
        allPageIds.forEach((id) => next.add(id))
      }
      return next
    })
  }

  const toggleRow = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      onSelectionChange?.(data.filter((r, i) => next.has(getRowId(r, i))))
      return next
    })
  }

  const SortIcon = ({ colKey }: { colKey: string }) => {
    if (sortKey !== colKey) return <ChevronsUpDown className="h-3.5 w-3.5 opacity-30" />
    if (sortDir === 'asc') return <ChevronUp className="h-3.5 w-3.5 text-primary" />
    if (sortDir === 'desc') return <ChevronDown className="h-3.5 w-3.5 text-primary" />
    return <ChevronsUpDown className="h-3.5 w-3.5 opacity-30" />
  }

  return (
    <div className={cn('space-y-3', className)}>
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm text-muted-foreground">
          {!loading && (
            <span>
              {sorted.length === 0
                ? 'No results'
                : `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, sorted.length)} of ${sorted.length} results`}
            </span>
          )}
        </div>
        {enableExport && data.length > 0 && !loading && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadCSV(data as Record<string, unknown>[], columns as ColumnDef[], exportFilename)}
            className="gap-1.5"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent bg-muted/30">
              {selectable && (
                <TableHead className="w-10">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someSelected
                    }}
                    onChange={toggleAll}
                    className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
                  />
                </TableHead>
              )}
              {columns.map((col) => (
                <TableHead
                  key={String(col.key)}
                  style={{ width: col.width }}
                  className={cn(
                    col.align === 'center' && 'text-center',
                    col.align === 'right' && 'text-right',
                    col.sortable && 'cursor-pointer select-none hover:text-foreground transition-colors'
                  )}
                  onClick={col.sortable ? () => handleSort(String(col.key)) : undefined}
                >
                  <div className={cn(
                    'flex items-center gap-1.5',
                    col.align === 'center' && 'justify-center',
                    col.align === 'right' && 'justify-end',
                  )}>
                    {col.header}
                    {col.sortable && <SortIcon colKey={String(col.key)} />}
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>

          <TableBody>
            {loading ? (
              Array.from({ length: skeletonRows }).map((_, i) => (
                <TableRow key={i} className="hover:bg-transparent">
                  {selectable && (
                    <TableCell><Skeleton className="h-4 w-4 rounded" /></TableCell>
                  )}
                  {columns.map((col) => (
                    <TableCell key={String(col.key)}>
                      <Skeleton className="h-4 rounded" style={{ width: `${60 + Math.random() * 40}%` }} />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : paginated.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={columns.length + (selectable ? 1 : 0)} className="py-16">
                  <div className="flex flex-col items-center gap-3 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
                      <Inbox className="h-6 w-6 text-muted-foreground/50" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-foreground">{emptyTitle}</p>
                      <p className="text-xs text-muted-foreground max-w-xs">{emptyMessage}</p>
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              <AnimatePresence mode="popLayout">
                {paginated.map((row, i) => {
                  const id = getRowId(row, (page - 1) * pageSize + i)
                  const isSelected = selected.has(id)
                  return (
                    <motion.tr
                      key={id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15, delay: i * 0.02 }}
                      onClick={() => onRowClick?.(row)}
                      data-state={isSelected ? 'selected' : undefined}
                      className={cn(
                        'border-b border-border transition-colors',
                        onRowClick && 'cursor-pointer hover:bg-muted/50',
                        isSelected && 'bg-primary/5 hover:bg-primary/8'
                      )}
                    >
                      {selectable && (
                        <TableCell onClick={(e) => { e.stopPropagation(); toggleRow(id) }}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleRow(id)}
                            className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
                          />
                        </TableCell>
                      )}
                      {columns.map((col) => {
                        const rawVal = getNestedValue(row as Record<string, unknown>, String(col.key))
                        return (
                          <TableCell
                            key={String(col.key)}
                            className={cn(
                              col.align === 'center' && 'text-center',
                              col.align === 'right' && 'text-right'
                            )}
                          >
                            {col.render
                              ? col.render(rawVal, row, i)
                              : rawVal === null || rawVal === undefined
                              ? <span className="text-muted-foreground/50">—</span>
                              : String(rawVal)}
                          </TableCell>
                        )
                      })}
                    </motion.tr>
                  )
                })}
              </AnimatePresence>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {!loading && sorted.length > 0 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Page size */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Rows per page</span>
            <Select value={String(pageSize)} onValueChange={handlePageSize}>
              <SelectTrigger className="h-8 w-16 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <SelectItem key={n} value={String(n)} className="text-xs">
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Page controls */}
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setPage(1)}
              disabled={page === 1}
            >
              <ChevronsLeft className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>

            {/* Page numbers */}
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number
                if (totalPages <= 5) {
                  pageNum = i + 1
                } else if (page <= 3) {
                  pageNum = i + 1
                } else if (page >= totalPages - 2) {
                  pageNum = totalPages - 4 + i
                } else {
                  pageNum = page - 2 + i
                }
                return (
                  <Button
                    key={pageNum}
                    variant={page === pageNum ? 'default' : 'outline'}
                    size="icon"
                    className="h-8 w-8 text-xs"
                    onClick={() => setPage(pageNum)}
                  >
                    {pageNum}
                  </Button>
                )
              })}
            </div>

            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setPage(totalPages)}
              disabled={page === totalPages}
            >
              <ChevronsRight className="h-3.5 w-3.5" />
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            Page {page} of {totalPages}
          </p>
        </div>
      )}
    </div>
  )
}
