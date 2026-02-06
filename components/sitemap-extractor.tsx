"use client"

import { useState, useCallback, useMemo } from "react"
import {
  Search,
  ExternalLink,
  Loader2,
  AlertCircle,
  Copy,
  Check,
  Globe,
  ChevronDown,
  ChevronRight,
  Download,
  FileText,
  MapPin,
  ArrowLeft,
  ArrowRight,
  FolderTree,
  Link2,
  Tag,
} from "lucide-react"

interface SitemapUrl {
  loc: string
  lastmod: string
  changefreq: string
  priority: string
}

interface SitemapResult {
  sitemapUrl: string | null
  discoveredSitemaps: string[]
  urls: SitemapUrl[]
  totalUrls: number
  categories: [string, number][]
  message?: string
  error?: string
}

const ITEMS_PER_PAGE = 30

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

function getPathDepth(url: string): string {
  try {
    return new URL(url).pathname
  } catch {
    return url
  }
}

// Segments to skip — these are structural, not content keywords
const SKIP_SEGMENTS = new Set([
  "page", "index", "default", "category", "categories", "tag", "tags",
  "archive", "archives", "wp-content", "wp-includes", "wp-admin",
  "uploads", "feed", "rss", "atom", "sitemap", "search", "login",
  "register", "author", "admin", "api", "static", "assets", "images",
  "img", "css", "js", "fonts", "media", "files", "docs", "blog",
  "post", "posts", "amp", "embed", "attachment",
])

/** Small prepositions & articles to keep lowercase in title case */
const LOWERCASE_WORDS = new Set([
  "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for",
  "of", "with", "by", "from", "as", "is", "nor", "so", "yet", "via",
])

/**
 * Converts a URL slug segment into a Title Case phrase.
 * e.g. "best-in-wall-radiant-heater" -> "Best in-Wall Radiant Heater"
 */
function slugToTitle(slug: string): string {
  const cleaned = slug
    .replace(/\.[^.]+$/, "") // remove file extension
    .replace(/[-_]+/g, " ")  // replace hyphens/underscores with spaces
    .trim()

  if (!cleaned) return ""

  return cleaned
    .split(/\s+/)
    .map((word, i) => {
      const lower = word.toLowerCase()
      if (i === 0) {
        // Always capitalize first word
        return lower.charAt(0).toUpperCase() + lower.slice(1)
      }
      if (LOWERCASE_WORDS.has(lower)) {
        return lower
      }
      return lower.charAt(0).toUpperCase() + lower.slice(1)
    })
    .join(" ")
}

/**
 * Extracts content keyword phrases from a URL.
 * Returns the last meaningful slug segment as a title-cased phrase,
 * which represents the page topic / main keyword.
 */
function extractKeywordPhrase(url: string): string | null {
  try {
    const pathname = new URL(url).pathname
    const segments = pathname.split("/").filter(Boolean)

    // Walk backwards to find the last meaningful (content) segment
    for (let i = segments.length - 1; i >= 0; i--) {
      const raw = segments[i].replace(/\.[^.]+$/, "") // strip extension
      // Skip purely numeric segments (pagination like /page/2)
      if (/^\d+$/.test(raw)) continue
      // Skip structural segments
      if (SKIP_SEGMENTS.has(raw.toLowerCase())) continue
      // Must have at least 2 words separated by hyphens/underscores to be a keyword phrase
      const wordCount = raw.split(/[-_]+/).filter((w) => w.length > 0).length
      if (wordCount < 2) continue

      return slugToTitle(raw)
    }
    return null
  } catch {
    return null
  }
}

export function SitemapExtractor() {
  const [url, setUrl] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<SitemapResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)
  const [copiedAll, setCopiedAll] = useState(false)
  const [showSitemaps, setShowSitemaps] = useState(false)
  const [page, setPage] = useState(0)
  const [filterText, setFilterText] = useState("")
  const [activeCategory, setActiveCategory] = useState<string | null>(null)

  const handleExtract = useCallback(async () => {
    const trimmed = url.trim()
    if (!trimmed) return

    setIsLoading(true)
    setError(null)
    setResult(null)
    setPage(0)
    setFilterText("")
    setActiveCategory(null)

    try {
      const response = await fetch("/api/sitemap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || "Failed to extract sitemap")
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
    let items = result.urls
    if (activeCategory) {
      items = items.filter((item) => {
        try {
          const pathname = new URL(item.loc).pathname
          return pathname.startsWith(activeCategory)
        } catch {
          return false
        }
      })
    }
    if (filterText) {
      const lower = filterText.toLowerCase()
      items = items.filter((item) => item.loc.toLowerCase().includes(lower))
    }
    return items
  }, [result, filterText, activeCategory])

  // Keywords: full title-cased phrases from URL slugs
  const keywordData = useMemo(() => {
    if (!result) return { sorted: [] as [string, number][] }
    const map = new Map<string, number>()
    for (const item of result.urls) {
      const phrase = extractKeywordPhrase(item.loc)
      if (phrase) {
        map.set(phrase, (map.get(phrase) || 0) + 1)
      }
    }
    const sorted = Array.from(map.entries()).sort((a, b) => b[1] - a[1])
    return { sorted }
  }, [result])

  const [showAllKeywords, setShowAllKeywords] = useState(false)

  // Pagination
  const totalPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE)
  const pagedItems = filteredItems.slice(
    page * ITEMS_PER_PAGE,
    (page + 1) * ITEMS_PER_PAGE
  )

  const copyLink = async (link: string, index: number) => {
    await navigator.clipboard.writeText(link)
    setCopiedIndex(index)
    setTimeout(() => setCopiedIndex(null), 2000)
  }

  const copyAllLinks = async () => {
    if (!result) return
    const allLinks = filteredItems.map((item) => item.loc).join("\n")
    await navigator.clipboard.writeText(allLinks)
    setCopiedAll(true)
    setTimeout(() => setCopiedAll(false), 2000)
  }

  // Download all URLs as text
  const downloadUrls = () => {
    if (!result) return
    const items = activeCategory
      ? filteredItems
      : result.urls
    const lines = items.map(
      (item, i) =>
        `${i + 1}. ${item.loc}${item.lastmod ? `  (Last modified: ${formatDate(item.lastmod)})` : ""}`
    )
    const header = [
      `XML Sitemap URLs Extracted from: ${result.sitemapUrl || url}`,
      `Extracted on: ${new Date().toLocaleString()}`,
      `Total URLs: ${items.length}`,
      activeCategory ? `Filtered by: ${activeCategory}` : "",
      "=".repeat(60),
      "",
    ]
      .filter(Boolean)
      .join("\n")
    triggerDownload(`${header}\n${lines.join("\n")}`, `sitemap-urls-${slugify(url)}.txt`)
  }

  // Download just the plain URLs (one per line)
  const downloadPlainUrls = () => {
    if (!result) return
    const items = activeCategory ? filteredItems : result.urls
    const content = items.map((item) => item.loc).join("\n")
    triggerDownload(content, `sitemap-plain-${slugify(url)}.txt`)
  }

  // Download path segments / categories
  const downloadCategories = () => {
    if (!result || !result.categories.length) return
    const lines = result.categories.map(
      ([path, count]) => `${path}  (${count} URLs)`
    )
    const header = [
      `Sitemap URL Categories for: ${result.sitemapUrl || url}`,
      `Extracted on: ${new Date().toLocaleString()}`,
      `Total Categories: ${result.categories.length}`,
      "=".repeat(60),
      "",
    ].join("\n")
    triggerDownload(`${header}\n${lines.join("\n")}`, `sitemap-categories-${slugify(url)}.txt`)
  }

  // Download keywords list (full phrases)
  const downloadKeywords = () => {
    if (!keywordData.sorted.length) return
    const content = [
      `Website Main Keywords`,
      `Source: ${result?.sitemapUrl || url}`,
      `Extracted on: ${new Date().toLocaleString()}`,
      `Total Keywords: ${keywordData.sorted.length}`,
      `Source URLs Analyzed: ${result?.totalUrls || 0}`,
      "=".repeat(60),
      "",
      ...keywordData.sorted.map(([phrase]) => phrase),
    ].join("\n")
    triggerDownload(content, `keywords-${slugify(url)}.txt`)
  }

  // Download keywords with counts
  const downloadKeywordsDetailed = () => {
    if (!keywordData.sorted.length) return
    const maxLen = Math.max(...keywordData.sorted.slice(0, 50).map(([p]) => p.length))
    const content = [
      `Website Main Keywords (Detailed)`,
      `Source: ${result?.sitemapUrl || url}`,
      `Extracted on: ${new Date().toLocaleString()}`,
      `Total Keywords: ${keywordData.sorted.length}`,
      `Source URLs Analyzed: ${result?.totalUrls || 0}`,
      "=".repeat(60),
      "",
      `${"Keyword".padEnd(maxLen + 4)}Count`,
      `${"-".repeat(maxLen + 4)}-----`,
      ...keywordData.sorted.map(
        ([phrase, count]) => `${phrase.padEnd(maxLen + 4)}${count}`
      ),
    ].join("\n")
    triggerDownload(content, `keywords-detailed-${slugify(url)}.txt`)
  }

  return (
    <div className="flex flex-col gap-6">
      {/* URL Input */}
      <div className="rounded-lg border border-border bg-card p-5">
        <label
          htmlFor="sitemap-url-input"
          className="mb-3 block text-sm font-medium text-foreground"
        >
          Enter a website URL to discover and extract its XML sitemap URLs
        </label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              id="sitemap-url-input"
              type="text"
              placeholder="https://example.com or https://example.com/sitemap.xml"
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
                <span>Crawling...</span>
              </>
            ) : (
              <>
                <Search className="h-4 w-4" />
                <span>Extract Sitemap</span>
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

      {/* Message (no URLs found but not an error) */}
      {result && result.totalUrls === 0 && result.message && (
        <div className="flex items-start gap-3 rounded-lg border border-border bg-card p-4">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{result.message}</p>
        </div>
      )}

      {/* Results */}
      {result && result.totalUrls > 0 && (
        <div className="flex flex-col gap-5">
          {/* Quick Stats Row */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="flex flex-col gap-1 rounded-lg border border-border bg-card p-4">
              <span className="text-xs font-medium text-muted-foreground">
                Total URLs
              </span>
              <span className="text-2xl font-semibold text-foreground">
                {result.totalUrls.toLocaleString()}
              </span>
            </div>
            <div className="flex flex-col gap-1 rounded-lg border border-border bg-card p-4">
              <span className="text-xs font-medium text-muted-foreground">
                Sitemaps Found
              </span>
              <span className="text-2xl font-semibold text-foreground">
                {result.discoveredSitemaps.length}
              </span>
            </div>
            <div className="flex flex-col gap-1 rounded-lg border border-border bg-card p-4">
              <span className="text-xs font-medium text-muted-foreground">
                Categories
              </span>
              <span className="text-2xl font-semibold text-foreground">
                {result.categories.length}
              </span>
            </div>
            <div className="flex flex-col gap-1 rounded-lg border border-border bg-card p-4">
              <span className="text-xs font-medium text-muted-foreground">
                Keywords
              </span>
              <span className="text-2xl font-semibold text-foreground">
                {keywordData.sorted.length.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Export Bar */}
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-4">
            <span className="mr-auto text-sm font-medium text-foreground">
              Export
            </span>
            <button
              onClick={downloadUrls}
              className="inline-flex items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
            >
              <Download className="h-3.5 w-3.5" />
              Detailed (.txt)
            </button>
            <button
              onClick={downloadPlainUrls}
              className="inline-flex items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
            >
              <FileText className="h-3.5 w-3.5" />
              Plain URLs (.txt)
            </button>
            <button
              onClick={downloadCategories}
              disabled={result.categories.length === 0}
              className="inline-flex items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
            >
              <FolderTree className="h-3.5 w-3.5" />
              Categories (.txt)
            </button>
            <button
              onClick={downloadKeywords}
              disabled={keywordData.sorted.length === 0}
              className="inline-flex items-center gap-1.5 rounded-md border border-primary/50 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10 disabled:pointer-events-none disabled:opacity-50"
            >
              <Tag className="h-3.5 w-3.5" />
              Keywords (.txt)
            </button>
            <button
              onClick={downloadKeywordsDetailed}
              disabled={keywordData.sorted.length === 0}
              className="inline-flex items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
            >
              <Tag className="h-3.5 w-3.5" />
              Keywords + Counts (.txt)
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
                  Copy All URLs
                </>
              )}
            </button>
          </div>

          {/* URL Categories */}
          {result.categories.length > 0 && (
            <div className="rounded-lg border border-border bg-card">
              <div className="border-b border-border px-5 py-3">
                <h3 className="text-sm font-semibold text-foreground">
                  URL Categories
                </h3>
                <p className="text-xs text-muted-foreground">
                  Top-level path segments across {result.totalUrls.toLocaleString()} URLs.
                  Click to filter.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 p-5">
                {activeCategory && (
                  <button
                    onClick={() => {
                      setActiveCategory(null)
                      setPage(0)
                    }}
                    className="inline-flex items-center gap-1.5 rounded-full border border-primary bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
                  >
                    Clear filter
                  </button>
                )}
                {result.categories.map(([path, count]) => (
                  <button
                    key={path}
                    onClick={() => {
                      setActiveCategory(activeCategory === path ? null : path)
                      setPage(0)
                    }}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors ${
                      activeCategory === path
                        ? "border-primary bg-primary/10 font-semibold text-primary"
                        : "border-border bg-secondary text-secondary-foreground hover:bg-accent"
                    }`}
                  >
                    {path}
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none ${
                        activeCategory === path
                          ? "bg-primary/20 text-primary"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Website Main Keywords */}
          {keywordData.sorted.length > 0 && (
            <div className="rounded-lg border border-border bg-card">
              <div className="flex flex-col gap-3 border-b border-border px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    Website Main Keywords
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {keywordData.sorted.length.toLocaleString()} keyword phrases extracted from URL slugs
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={downloadKeywords}
                    className="inline-flex items-center gap-1.5 rounded-md border border-primary/50 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Keywords Only
                  </button>
                  <button
                    onClick={downloadKeywordsDetailed}
                    className="inline-flex items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    With Counts
                  </button>
                </div>
              </div>
              <div className="flex flex-col">
                {keywordData.sorted
                  .slice(0, showAllKeywords ? 200 : 30)
                  .map(([phrase, count], i) => (
                    <div
                      key={phrase}
                      className="flex items-center gap-3 border-b border-border/40 px-5 py-2 last:border-0"
                    >
                      <span className="w-8 shrink-0 text-right font-mono text-xs text-muted-foreground">
                        {i + 1}
                      </span>
                      <span className="flex-1 text-sm text-foreground">
                        {phrase}
                      </span>
                      {count > 1 && (
                        <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                          {count}x
                        </span>
                      )}
                    </div>
                  ))}
              </div>
              {keywordData.sorted.length > 30 && (
                <div className="border-t border-border px-5 py-3">
                  <button
                    onClick={() => setShowAllKeywords(!showAllKeywords)}
                    className="text-xs font-medium text-primary transition-colors hover:text-primary/80"
                  >
                    {showAllKeywords
                      ? "Show less"
                      : `Show all ${keywordData.sorted.length.toLocaleString()} keywords`}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Discovered Sitemaps */}
          {result.discoveredSitemaps.length > 0 && (
            <div className="rounded-lg border border-border bg-card">
              <button
                onClick={() => setShowSitemaps(!showSitemaps)}
                className="flex w-full items-center gap-2 px-5 py-3 text-left transition-colors hover:bg-accent/50"
              >
                {showSitemaps ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
                <Globe className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-foreground">
                  Discovered Sitemap Files
                </span>
                <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
                  {result.discoveredSitemaps.length}
                </span>
              </button>
              {showSitemaps && (
                <div className="flex flex-col gap-1 border-t border-border px-5 py-3">
                  {result.discoveredSitemaps.map((sitemapUrl, i) => (
                    <a
                      key={i}
                      href={sitemapUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-center gap-2 rounded-md px-3 py-1.5 text-xs transition-colors hover:bg-accent"
                    >
                      <Link2 className="h-3 w-3 shrink-0 text-primary" />
                      <span className="min-w-0 flex-1 truncate font-mono text-foreground">
                        {sitemapUrl}
                      </span>
                      <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* URL List */}
          <div className="rounded-lg border border-border bg-card">
            <div className="flex flex-col gap-3 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="text-sm font-semibold text-foreground">
                Sitemap URLs
                {activeCategory && (
                  <span className="ml-2 font-normal text-muted-foreground">
                    filtered by {activeCategory}
                  </span>
                )}
              </h3>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Filter URLs..."
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
                  {filterText
                    ? "No URLs match your filter."
                    : "No URLs found."}
                </p>
              ) : (
                <>
                  {/* Table Header */}
                  <div className="flex items-center gap-3 border-b border-border bg-muted/50 px-5 py-2">
                    <span className="w-10 shrink-0 text-right text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      #
                    </span>
                    <span className="flex-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      URL / Path
                    </span>
                    <span className="hidden w-24 shrink-0 text-right text-[11px] font-medium uppercase tracking-wider text-muted-foreground md:block">
                      Modified
                    </span>
                    <span className="hidden w-16 shrink-0 text-center text-[11px] font-medium uppercase tracking-wider text-muted-foreground lg:block">
                      Priority
                    </span>
                    <span className="w-16 shrink-0" />
                  </div>

                  {pagedItems.map((item, i) => {
                    const globalIndex = page * ITEMS_PER_PAGE + i
                    const pathname = getPathDepth(item.loc)
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
                            href={item.loc}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="truncate text-sm font-medium text-foreground hover:text-primary"
                          >
                            {pathname}
                          </a>
                          <span className="truncate font-mono text-[11px] text-muted-foreground">
                            {item.loc}
                          </span>
                        </div>
                        {item.lastmod && (
                          <span className="hidden w-24 shrink-0 text-right text-xs text-muted-foreground md:block">
                            {formatDate(item.lastmod)}
                          </span>
                        )}
                        <span className="hidden w-16 shrink-0 text-center text-xs text-muted-foreground lg:block">
                          {item.priority || "-"}
                        </span>
                        <div className="flex w-16 shrink-0 items-center justify-end gap-1">
                          <button
                            onClick={() => copyLink(item.loc, globalIndex)}
                            className="rounded p-1 text-muted-foreground opacity-0 transition-all hover:bg-accent hover:text-foreground group-hover:opacity-100"
                            aria-label={`Copy URL ${pathname}`}
                          >
                            {copiedIndex === globalIndex ? (
                              <Check className="h-3.5 w-3.5 text-green-500" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>
                          <a
                            href={item.loc}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded p-1 text-muted-foreground opacity-0 transition-all hover:bg-accent hover:text-foreground group-hover:opacity-100"
                            aria-label={`Open ${pathname} in new tab`}
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
                  Showing {page * ITEMS_PER_PAGE + 1}-
                  {Math.min(
                    (page + 1) * ITEMS_PER_PAGE,
                    filteredItems.length
                  )}{" "}
                  of {filteredItems.length.toLocaleString()} URLs
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
                  {Array.from(
                    { length: Math.min(totalPages, 5) },
                    (_, i) => {
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
                    }
                  )}
                  <button
                    onClick={() =>
                      setPage((p) => Math.min(totalPages - 1, p + 1))
                    }
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
    return new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace(
      /\./g,
      "-"
    )
  } catch {
    return "sitemap"
  }
}
