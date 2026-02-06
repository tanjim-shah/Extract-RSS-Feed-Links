"use client"

import { useState, useCallback, useMemo } from "react"
import {
  Search,
  ExternalLink,
  Loader2,
  Rss,
  AlertCircle,
  Copy,
  Check,
  Globe,
  ChevronDown,
  ChevronRight,
  Download,
  FileText,
  Link2,
  ArrowLeft,
  ArrowRight,
} from "lucide-react"

interface FeedItem {
  title: string
  link: string
  pubDate: string
}

interface ExtractResult {
  feedUrl: string | null
  feedsFound: string[]
  items: FeedItem[]
  totalItems: number
  source: string
  message?: string
  error?: string
}

const ITEMS_PER_PAGE = 25

function formatDate(dateStr: string): string {
  if (!dateStr) return ""
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  } catch {
    return dateStr
  }
}

function extractKeywords(title: string): string[] {
  const stopWords = new Set([
    "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for",
    "of", "with", "by", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "can", "shall", "it", "its", "this", "that",
    "these", "those", "i", "me", "my", "we", "our", "you", "your", "he",
    "she", "him", "her", "they", "them", "their", "what", "which", "who",
    "how", "from", "up", "about", "into", "through", "during", "before",
    "after", "above", "below", "between", "out", "off", "over", "under",
    "again", "further", "then", "once", "here", "there", "when", "where",
    "why", "all", "each", "every", "both", "few", "more", "most", "other",
    "some", "such", "no", "not", "only", "own", "same", "so", "than", "too",
    "very", "just", "because", "as", "if", "while", "also", "new", "one",
  ])
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.has(w))
}

export function UrlExtractor() {
  const [url, setUrl] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<ExtractResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)
  const [copiedAll, setCopiedAll] = useState(false)
  const [showFeeds, setShowFeeds] = useState(false)
  const [page, setPage] = useState(0)
  const [filterText, setFilterText] = useState("")

  const handleExtract = useCallback(async () => {
    const trimmed = url.trim()
    if (!trimmed) return

    setIsLoading(true)
    setError(null)
    setResult(null)
    setPage(0)
    setFilterText("")

    try {
      const response = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || "Failed to extract feeds")
        return
      }

      setResult(data)
    } catch {
      setError("Network error. Please check your connection and try again.")
    } finally {
      setIsLoading(false)
    }
  }, [url])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !isLoading) {
      handleExtract()
    }
  }

  // Filtered items
  const filteredItems = useMemo(() => {
    if (!result) return []
    if (!filterText) return result.items
    const lower = filterText.toLowerCase()
    return result.items.filter(
      (item) =>
        item.title.toLowerCase().includes(lower) ||
        item.link.toLowerCase().includes(lower)
    )
  }, [result, filterText])

  // Pagination
  const totalPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE)
  const pagedItems = filteredItems.slice(
    page * ITEMS_PER_PAGE,
    (page + 1) * ITEMS_PER_PAGE
  )

  // Keywords aggregation
  const keywordData = useMemo(() => {
    if (!result) return { keywords: new Map<string, number>(), sorted: [] as [string, number][] }
    const map = new Map<string, number>()
    for (const item of result.items) {
      const words = extractKeywords(item.title)
      for (const w of words) {
        map.set(w, (map.get(w) || 0) + 1)
      }
    }
    const sorted = [...map.entries()].sort((a, b) => b[1] - a[1])
    return { keywords: map, sorted }
  }, [result])

  const copyLink = async (link: string, index: number) => {
    await navigator.clipboard.writeText(link)
    setCopiedIndex(index)
    setTimeout(() => setCopiedIndex(null), 2000)
  }

  const copyAllLinks = async () => {
    if (!result) return
    const allLinks = result.items.map((item) => item.link).join("\n")
    await navigator.clipboard.writeText(allLinks)
    setCopiedAll(true)
    setTimeout(() => setCopiedAll(false), 2000)
  }

  // Download functions
  const downloadLinks = () => {
    if (!result) return
    const lines = result.items.map(
      (item, i) => `${i + 1}. ${item.title}\n   ${item.link}${item.pubDate ? `\n   Published: ${formatDate(item.pubDate)}` : ""}`
    )
    const content = `RSS Feed Links Extracted from: ${result.feedUrl || url}\nExtracted on: ${new Date().toLocaleString()}\nTotal Links: ${result.totalItems}\n${"=".repeat(60)}\n\n${lines.join("\n\n")}`
    triggerDownload(content, `rss-links-${slugify(url)}.txt`)
  }

  const downloadKeywords = () => {
    if (!keywordData.sorted.length) return
    const lines = keywordData.sorted.map(
      ([word, count]) => `${word} (${count})`
    )
    const content = `Keywords Extracted from RSS Feed: ${result?.feedUrl || url}\nExtracted on: ${new Date().toLocaleString()}\nTotal Unique Keywords: ${keywordData.sorted.length}\n${"=".repeat(60)}\n\n${lines.join("\n")}`
    triggerDownload(content, `rss-keywords-${slugify(url)}.txt`)
  }

  const downloadTitles = () => {
    if (!result) return
    const content = result.items.map((item) => item.title).join("\n")
    triggerDownload(content, `rss-titles-${slugify(url)}.txt`)
  }

  return (
    <div className="flex flex-col gap-6">
      {/* URL Input */}
      <div className="rounded-lg border border-border bg-card p-5">
        <label
          htmlFor="url-input"
          className="mb-3 block text-sm font-medium text-foreground"
        >
          Enter a website URL to discover and extract its RSS feed links
        </label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Globe className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              id="url-input"
              type="text"
              placeholder="https://example.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            />
          </div>
          <button
            onClick={handleExtract}
            disabled={isLoading || !url.trim()}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Extracting...</span>
              </>
            ) : (
              <>
                <Search className="h-4 w-4" />
                <span>Extract Feeds</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="flex flex-col gap-5">
          {/* Quick Stats Row */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="flex flex-col gap-1 rounded-lg border border-border bg-card p-4">
              <span className="text-xs font-medium text-muted-foreground">Total Links</span>
              <span className="text-2xl font-semibold text-foreground">{result.totalItems}</span>
            </div>
            <div className="flex flex-col gap-1 rounded-lg border border-border bg-card p-4">
              <span className="text-xs font-medium text-muted-foreground">Feeds Found</span>
              <span className="text-2xl font-semibold text-foreground">{result.feedsFound.length}</span>
            </div>
            <div className="flex flex-col gap-1 rounded-lg border border-border bg-card p-4">
              <span className="text-xs font-medium text-muted-foreground">Unique Keywords</span>
              <span className="text-2xl font-semibold text-foreground">{keywordData.sorted.length}</span>
            </div>
            <div className="flex flex-col gap-1 rounded-lg border border-border bg-card p-4">
              <span className="text-xs font-medium text-muted-foreground">Source</span>
              <span className="truncate text-sm font-semibold text-foreground">{result.source === "direct" ? "Direct Feed" : "Auto-discovered"}</span>
            </div>
          </div>

          {/* Download + Actions Bar */}
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-4">
            <span className="mr-auto text-sm font-medium text-foreground">Export</span>
            <button
              onClick={downloadLinks}
              className="inline-flex items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
            >
              <Download className="h-3.5 w-3.5" />
              Links (.txt)
            </button>
            <button
              onClick={downloadKeywords}
              disabled={keywordData.sorted.length === 0}
              className="inline-flex items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
            >
              <FileText className="h-3.5 w-3.5" />
              Keywords (.txt)
            </button>
            <button
              onClick={downloadTitles}
              className="inline-flex items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
            >
              <FileText className="h-3.5 w-3.5" />
              Titles (.txt)
            </button>
            <div className="h-5 w-px bg-border" />
            <button
              onClick={copyAllLinks}
              className="inline-flex items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
            >
              {copiedAll ? (
                <>
                  <Check className="h-3.5 w-3.5 text-green-500" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  Copy All Links
                </>
              )}
            </button>
          </div>

          {/* Top Keywords */}
          {keywordData.sorted.length > 0 && (
            <div className="rounded-lg border border-border bg-card">
              <div className="border-b border-border px-5 py-3">
                <h3 className="text-sm font-semibold text-foreground">Top Keywords</h3>
                <p className="text-xs text-muted-foreground">
                  Most frequent terms extracted from {result.totalItems} article titles
                </p>
              </div>
              <div className="flex flex-wrap gap-2 p-5">
                {keywordData.sorted.slice(0, 40).map(([word, count]) => (
                  <span
                    key={word}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary px-2.5 py-1 text-xs text-secondary-foreground"
                  >
                    {word}
                    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold leading-none text-muted-foreground">
                      {count}
                    </span>
                  </span>
                ))}
                {keywordData.sorted.length > 40 && (
                  <span className="inline-flex items-center px-2 text-xs text-muted-foreground">
                    +{keywordData.sorted.length - 40} more
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Feed URLs */}
          {result.feedsFound.length > 0 && (
            <div className="rounded-lg border border-border bg-card">
              <button
                onClick={() => setShowFeeds(!showFeeds)}
                className="flex w-full items-center gap-2 px-5 py-3 text-left transition-colors hover:bg-accent/50"
              >
                {showFeeds ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
                <Rss className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-foreground">
                  Discovered Feed URLs
                </span>
                <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
                  {result.feedsFound.length}
                </span>
              </button>
              {showFeeds && (
                <div className="flex flex-col gap-1 border-t border-border px-5 py-3">
                  {result.feedsFound.map((feed, i) => (
                    <a
                      key={i}
                      href={feed}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-center gap-2 rounded-md px-3 py-1.5 text-xs transition-colors hover:bg-accent"
                    >
                      <Link2 className="h-3 w-3 shrink-0 text-primary" />
                      <span className="min-w-0 flex-1 truncate font-mono text-foreground">
                        {feed}
                      </span>
                      <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Links List */}
          <div className="rounded-lg border border-border bg-card">
            <div className="flex flex-col gap-3 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="text-sm font-semibold text-foreground">
                Extracted Links
              </h3>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Filter links..."
                  value={filterText}
                  onChange={(e) => {
                    setFilterText(e.target.value)
                    setPage(0)
                  }}
                  className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring sm:w-64"
                />
              </div>
            </div>

            <div className="flex flex-col">
              {pagedItems.length === 0 ? (
                <p className="py-12 text-center text-sm text-muted-foreground">
                  {filterText ? "No links match your filter." : "No feed items found."}
                </p>
              ) : (
                <>
                  {/* Table Header */}
                  <div className="flex items-center gap-3 border-b border-border bg-muted/50 px-5 py-2">
                    <span className="w-10 shrink-0 text-right text-[11px] font-medium uppercase tracking-wider text-muted-foreground">#</span>
                    <span className="flex-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Title / URL</span>
                    <span className="hidden w-24 shrink-0 text-right text-[11px] font-medium uppercase tracking-wider text-muted-foreground sm:block">Date</span>
                    <span className="w-16 shrink-0" />
                  </div>

                  {pagedItems.map((item, i) => {
                    const globalIndex = page * ITEMS_PER_PAGE + i
                    return (
                      <div
                        key={globalIndex}
                        className="group flex items-center gap-3 border-b border-border/50 px-5 py-2.5 transition-colors last:border-0 hover:bg-accent/50"
                      >
                        <span className="w-10 shrink-0 text-right font-mono text-xs text-muted-foreground">
                          {globalIndex + 1}
                        </span>
                        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <a
                            href={item.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="truncate text-sm font-medium text-foreground hover:text-primary"
                          >
                            {item.title}
                          </a>
                          <span className="truncate font-mono text-[11px] text-muted-foreground">
                            {item.link}
                          </span>
                        </div>
                        {item.pubDate && (
                          <span className="hidden w-24 shrink-0 text-right text-xs text-muted-foreground sm:block">
                            {formatDate(item.pubDate)}
                          </span>
                        )}
                        <div className="flex w-16 shrink-0 items-center justify-end gap-1">
                          <button
                            onClick={() => copyLink(item.link, globalIndex)}
                            className="rounded p-1 text-muted-foreground opacity-0 transition-all hover:bg-accent hover:text-foreground group-hover:opacity-100"
                            aria-label={`Copy link for ${item.title}`}
                          >
                            {copiedIndex === globalIndex ? (
                              <Check className="h-3.5 w-3.5 text-green-500" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>
                          <a
                            href={item.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded p-1 text-muted-foreground opacity-0 transition-all hover:bg-accent hover:text-foreground group-hover:opacity-100"
                            aria-label={`Open ${item.title} in new tab`}
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </div>
                      </div>
                    )
                  })}
                </>
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-border px-5 py-3">
                <span className="text-xs text-muted-foreground">
                  Showing {page * ITEMS_PER_PAGE + 1}-{Math.min((page + 1) * ITEMS_PER_PAGE, filteredItems.length)} of {filteredItems.length} links
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-input text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
                    aria-label="Previous page"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                  </button>
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    let pageNum: number
                    if (totalPages <= 5) {
                      pageNum = i
                    } else if (page < 3) {
                      pageNum = i
                    } else if (page > totalPages - 4) {
                      pageNum = totalPages - 5 + i
                    } else {
                      pageNum = page - 2 + i
                    }
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setPage(pageNum)}
                        className={`inline-flex h-8 w-8 items-center justify-center rounded-md text-xs font-medium transition-colors ${
                          page === pageNum
                            ? "bg-primary text-primary-foreground"
                            : "border border-input text-muted-foreground hover:bg-accent hover:text-foreground"
                        }`}
                      >
                        {pageNum + 1}
                      </button>
                    )
                  })}
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                    disabled={page === totalPages - 1}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-input text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
                    aria-label="Next page"
                  >
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function triggerDownload(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function slugify(url: string): string {
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace(/\./g, "-")
  } catch {
    return "feed"
  }
}
