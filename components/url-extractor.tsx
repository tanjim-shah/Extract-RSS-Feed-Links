"use client"

import { useState, useCallback } from "react"
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

export function UrlExtractor() {
  const [url, setUrl] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<ExtractResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)
  const [copiedAll, setCopiedAll] = useState(false)
  const [showFeeds, setShowFeeds] = useState(false)

  const handleExtract = useCallback(async () => {
    const trimmed = url.trim()
    if (!trimmed) return

    setIsLoading(true)
    setError(null)
    setResult(null)

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
        <div className="flex flex-col gap-4 rounded-lg border border-border bg-card">
          {/* Result Header */}
          <div className="flex flex-col gap-4 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <Rss className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold text-foreground">
                  Extraction Results
                </h2>
              </div>
              {result.feedUrl && (
                <p className="text-xs text-muted-foreground">
                  Feed source:{" "}
                  <a
                    href={result.feedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    {result.feedUrl}
                  </a>
                </p>
              )}
              {result.message && !result.feedUrl && (
                <p className="text-xs text-muted-foreground">
                  {result.message}
                </p>
              )}
            </div>

            <div className="flex items-center gap-3">
              {/* Feed URLs toggle */}
              {result.feedsFound.length > 0 && (
                <button
                  onClick={() => setShowFeeds(!showFeeds)}
                  className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  {showFeeds ? (
                    <ChevronDown className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5" />
                  )}
                  {result.feedsFound.length} feed{result.feedsFound.length !== 1 ? "s" : ""} found
                </button>
              )}

              {/* Stats badge */}
              <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">
                {result.totalItems} {result.totalItems === 1 ? "link" : "links"}
              </span>

              {/* Copy All */}
              {result.items.length > 0 && (
                <button
                  onClick={copyAllLinks}
                  className="inline-flex items-center gap-1.5 rounded-md border border-input px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
                >
                  {copiedAll ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-green-500" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      <span>Copy All</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Feed URLs list */}
          {showFeeds && result.feedsFound.length > 0 && (
            <div className="mx-5 flex flex-col gap-1 rounded-md border border-border bg-muted p-3">
              <p className="mb-1 text-xs font-medium text-muted-foreground">
                Discovered Feed URLs
              </p>
              {result.feedsFound.map((feed, i) => (
                <a
                  key={i}
                  href={feed}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center gap-2 rounded px-2 py-1 text-xs transition-colors hover:bg-accent"
                >
                  <Rss className="h-3 w-3 shrink-0 text-primary" />
                  <span className="min-w-0 flex-1 truncate font-mono text-foreground">
                    {feed}
                  </span>
                  <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </a>
              ))}
            </div>
          )}

          {/* Item List */}
          <div className="flex flex-col gap-0.5 px-5 pb-5">
            {result.items.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No feed items found.{" "}
                {result.message || "The feed may be empty or in an unsupported format."}
              </p>
            ) : (
              result.items.map((item, i) => (
                <div
                  key={i}
                  className="group flex items-center gap-3 rounded-md px-3 py-2 transition-colors hover:bg-accent"
                >
                  <span className="w-8 shrink-0 text-right font-mono text-xs text-muted-foreground">
                    {i + 1}
                  </span>
                  <a
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex min-w-0 flex-1 flex-col gap-0.5"
                  >
                    <span className="truncate text-sm text-foreground group-hover:text-accent-foreground">
                      {item.title}
                    </span>
                    <span className="truncate font-mono text-xs text-muted-foreground">
                      {item.link}
                    </span>
                  </a>
                  {item.pubDate && (
                    <span className="hidden shrink-0 text-xs text-muted-foreground sm:block">
                      {formatDate(item.pubDate)}
                    </span>
                  )}
                  <button
                    onClick={(e) => {
                      e.preventDefault()
                      copyLink(item.link, i)
                    }}
                    className="shrink-0 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
                    aria-label={`Copy link for ${item.title}`}
                  >
                    {copiedIndex === i ? (
                      <Check className="h-3.5 w-3.5 text-green-500" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </button>
                  <a
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
                    aria-label={`Open ${item.title} in new tab`}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
