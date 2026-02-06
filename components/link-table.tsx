"use client"

import { useState, useMemo } from "react"
import { Search, ExternalLink, ChevronDown, ChevronRight } from "lucide-react"

interface HistoryEntry {
  date: string
  links: string[]
}

interface LinkTableProps {
  history: HistoryEntry[]
  latestLinks: string[]
}

type Tab = "latest" | "history"

function extractTitle(url: string): string {
  try {
    const pathname = new URL(url).pathname
    const slug = pathname.split("/").filter(Boolean).pop() || ""
    return slug
      .replace(/-/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase())
  } catch {
    return url
  }
}

export function LinkTable({ history, latestLinks }: LinkTableProps) {
  const [search, setSearch] = useState("")
  const [activeTab, setActiveTab] = useState<Tab>("history")
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set())

  const filteredLatest = useMemo(() => {
    if (!search) return latestLinks
    const lower = search.toLowerCase()
    return latestLinks.filter((link) => link.toLowerCase().includes(lower))
  }, [latestLinks, search])

  const filteredHistory = useMemo(() => {
    if (!search) return history
    const lower = search.toLowerCase()
    return history
      .map((entry) => ({
        ...entry,
        links: entry.links.filter((link) =>
          link.toLowerCase().includes(lower)
        ),
      }))
      .filter((entry) => entry.links.length > 0)
  }, [history, search])

  const toggleDate = (date: string) => {
    setExpandedDates((prev) => {
      const next = new Set(prev)
      if (next.has(date)) {
        next.delete(date)
      } else {
        next.add(date)
      }
      return next
    })
  }

  const expandAll = () => {
    setExpandedDates(new Set(filteredHistory.map((e) => e.date)))
  }

  const collapseAll = () => {
    setExpandedDates(new Set())
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-card">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1">
          <button
            onClick={() => setActiveTab("history")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              activeTab === "history"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            History ({filteredHistory.reduce((a, e) => a + e.links.length, 0)})
          </button>
          <button
            onClick={() => setActiveTab("latest")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              activeTab === "latest"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Latest ({filteredLatest.length})
          </button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search links..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring sm:w-72"
          />
        </div>
      </div>

      {/* Content */}
      <div className="px-5 pb-5">
        {activeTab === "latest" && (
          <div className="flex flex-col gap-1">
            {filteredLatest.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No links found
              </p>
            ) : (
              filteredLatest.map((link, i) => (
                <a
                  key={i}
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent"
                >
                  <span className="w-8 shrink-0 text-right font-mono text-xs text-muted-foreground">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-foreground group-hover:text-accent-foreground">
                    {extractTitle(link)}
                  </span>
                  <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </a>
              ))
            )}
          </div>
        )}

        {activeTab === "history" && (
          <div className="flex flex-col gap-2">
            {filteredHistory.length > 0 && (
              <div className="flex justify-end gap-2 pb-2">
                <button
                  onClick={expandAll}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Expand all
                </button>
                <span className="text-xs text-muted-foreground">/</span>
                <button
                  onClick={collapseAll}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Collapse all
                </button>
              </div>
            )}

            {filteredHistory.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No links found
              </p>
            ) : (
              filteredHistory.map((entry) => (
                <div key={entry.date} className="rounded-md border border-border">
                  <button
                    onClick={() => toggleDate(entry.date)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/50"
                  >
                    {expandedDates.has(entry.date) ? (
                      <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <span className="font-mono text-sm font-medium text-foreground">
                      {entry.date}
                    </span>
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
                      {entry.links.length} {entry.links.length === 1 ? "link" : "links"}
                    </span>
                  </button>

                  {expandedDates.has(entry.date) && (
                    <div className="flex flex-col gap-0.5 border-t border-border px-4 py-2">
                      {entry.links.map((link, i) => (
                        <a
                          key={i}
                          href={link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group flex items-center gap-3 rounded-md px-3 py-1.5 text-sm transition-colors hover:bg-accent"
                        >
                          <span className="min-w-0 flex-1 truncate text-foreground group-hover:text-accent-foreground">
                            {extractTitle(link)}
                          </span>
                          <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
