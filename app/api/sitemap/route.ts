import { NextResponse } from "next/server"

interface SitemapUrl {
  loc: string
  lastmod: string
  changefreq: string
  priority: string
}

function parseSitemapXml(xml: string): {
  urls: SitemapUrl[]
  sitemapIndexUrls: string[]
} {
  const urls: SitemapUrl[] = []
  const sitemapIndexUrls: string[] = []

  // Check if this is a sitemap index (contains <sitemapindex> and <sitemap> tags)
  const isSitemapIndex =
    xml.includes("<sitemapindex") || xml.includes("<sitemap>")

  if (isSitemapIndex) {
    const sitemapRegex = /<sitemap>([\s\S]*?)<\/sitemap>/gi
    let match: RegExpExecArray | null
    while ((match = sitemapRegex.exec(xml)) !== null) {
      const content = match[1]
      const locMatch = content.match(
        /<loc>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/loc>/
      )
      if (locMatch) {
        sitemapIndexUrls.push(locMatch[1].trim())
      }
    }
  }

  // Parse <url> entries
  const urlRegex = /<url>([\s\S]*?)<\/url>/gi
  let urlMatch: RegExpExecArray | null
  while ((urlMatch = urlRegex.exec(xml)) !== null) {
    const content = urlMatch[1]
    const locMatch = content.match(
      /<loc>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/loc>/
    )
    const lastmodMatch = content.match(
      /<lastmod>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/lastmod>/
    )
    const changefreqMatch = content.match(
      /<changefreq>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/changefreq>/
    )
    const priorityMatch = content.match(
      /<priority>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/priority>/
    )

    if (locMatch) {
      urls.push({
        loc: locMatch[1].trim(),
        lastmod: lastmodMatch ? lastmodMatch[1].trim() : "",
        changefreq: changefreqMatch ? changefreqMatch[1].trim() : "",
        priority: priorityMatch ? priorityMatch[1].trim() : "",
      })
    }
  }

  return { urls, sitemapIndexUrls }
}

const MAX_CHILD_SITEMAPS = 20
const MAX_URLS = 5000

async function fetchXml(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; SitemapExtractor/1.0; +https://rss-extractor.vercel.app)",
        Accept: "application/xml,text/xml,*/*;q=0.1",
      },
      signal: AbortSignal.timeout(15000),
    })
    if (!response.ok) return null
    const text = await response.text()
    // Basic check that it looks like XML
    const trimmed = text.trimStart()
    if (
      trimmed.startsWith("<?xml") ||
      trimmed.startsWith("<urlset") ||
      trimmed.startsWith("<sitemapindex")
    ) {
      return text
    }
    return null
  } catch {
    return null
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { url } = body

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { error: "Please provide a valid URL" },
        { status: 400 }
      )
    }

    let parsedUrl: URL
    try {
      parsedUrl = new URL(url.startsWith("http") ? url : `https://${url}`)
    } catch {
      return NextResponse.json(
        { error: "Invalid URL format" },
        { status: 400 }
      )
    }

    // Build candidate sitemap URLs to try
    const candidates: string[] = []

    // If the user provided a direct path to a sitemap, try that first
    if (
      parsedUrl.pathname.endsWith(".xml") ||
      parsedUrl.pathname.includes("sitemap")
    ) {
      candidates.push(parsedUrl.href)
    }

    // Standard sitemap locations
    const origin = parsedUrl.origin
    candidates.push(
      `${origin}/sitemap.xml`,
      `${origin}/sitemap_index.xml`,
      `${origin}/sitemap-index.xml`,
      `${origin}/sitemaps.xml`,
      `${origin}/sitemap1.xml`,
      `${origin}/wp-sitemap.xml`,
      `${origin}/post-sitemap.xml`,
      `${origin}/page-sitemap.xml`
    )

    // Try robots.txt to find sitemap references
    try {
      const robotsResponse = await fetch(`${origin}/robots.txt`, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; SitemapExtractor/1.0)",
        },
        signal: AbortSignal.timeout(8000),
      })
      if (robotsResponse.ok) {
        const robotsTxt = await robotsResponse.text()
        const sitemapRegex = /^sitemap:\s*(.+)$/gim
        let match: RegExpExecArray | null
        while ((match = sitemapRegex.exec(robotsTxt)) !== null) {
          const sitemapUrl = match[1].trim()
          if (sitemapUrl) {
            candidates.unshift(sitemapUrl) // prioritize robots.txt sitemaps
          }
        }
      }
    } catch {
      // robots.txt not reachable
    }

    // Deduplicate candidates
    const uniqueCandidates = [...new Set(candidates)]

    // Try each candidate
    let allUrls: SitemapUrl[] = []
    const discoveredSitemaps: string[] = []
    let primarySitemapUrl = ""

    for (const candidate of uniqueCandidates) {
      if (allUrls.length >= MAX_URLS) break

      const xml = await fetchXml(candidate)
      if (!xml) continue

      discoveredSitemaps.push(candidate)
      if (!primarySitemapUrl) primarySitemapUrl = candidate

      const { urls, sitemapIndexUrls } = parseSitemapXml(xml)
      allUrls.push(...urls)

      // If it's a sitemap index, fetch child sitemaps
      if (sitemapIndexUrls.length > 0) {
        const childSitemaps = sitemapIndexUrls.slice(0, MAX_CHILD_SITEMAPS)
        const childResults = await Promise.allSettled(
          childSitemaps.map(async (childUrl) => {
            const childXml = await fetchXml(childUrl)
            if (childXml) {
              discoveredSitemaps.push(childUrl)
              return parseSitemapXml(childXml).urls
            }
            return []
          })
        )
        for (const result of childResults) {
          if (result.status === "fulfilled") {
            allUrls.push(...result.value)
          }
          if (allUrls.length >= MAX_URLS) break
        }
      }

      // If we got URLs from the first successful candidate, no need to try more
      if (allUrls.length > 0) break
    }

    // Deduplicate URLs by loc
    const seen = new Set<string>()
    allUrls = allUrls.filter((u) => {
      if (seen.has(u.loc)) return false
      seen.add(u.loc)
      return true
    })

    // Trim to max
    if (allUrls.length > MAX_URLS) {
      allUrls = allUrls.slice(0, MAX_URLS)
    }

    // Extract path segments for categorization
    const pathSegments = new Map<string, number>()
    for (const u of allUrls) {
      try {
        const pathname = new URL(u.loc).pathname
        const segments = pathname.split("/").filter(Boolean)
        if (segments.length > 0) {
          const topLevel = `/${segments[0]}`
          pathSegments.set(topLevel, (pathSegments.get(topLevel) || 0) + 1)
        }
      } catch {
        // skip
      }
    }

    const categories = [...pathSegments.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30)

    if (allUrls.length === 0) {
      return NextResponse.json({
        sitemapUrl: null,
        discoveredSitemaps,
        urls: [],
        totalUrls: 0,
        categories: [],
        message:
          discoveredSitemaps.length > 0
            ? "Found sitemap files but they contain no URL entries."
            : "No XML sitemaps found for this domain. Try providing the direct sitemap URL.",
      })
    }

    return NextResponse.json({
      sitemapUrl: primarySitemapUrl,
      discoveredSitemaps,
      urls: allUrls,
      totalUrls: allUrls.length,
      categories,
    })
  } catch {
    return NextResponse.json(
      { error: "An unexpected error occurred while extracting the sitemap" },
      { status: 500 }
    )
  }
}
