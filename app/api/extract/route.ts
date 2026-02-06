import { NextResponse } from "next/server"

interface FeedItem {
  title: string
  link: string
  pubDate: string
}

function extractRssUrls(html: string, baseUrl: string): string[] {
  const rssUrls: string[] = []

  // Find <link> tags pointing to RSS/Atom feeds
  const linkRegex =
    /<link[^>]+type=["'](application\/rss\+xml|application\/atom\+xml|application\/xml|text\/xml)["'][^>]*>/gi
  let match: RegExpExecArray | null
  while ((match = linkRegex.exec(html)) !== null) {
    const hrefMatch = match[0].match(/href=["']([^"']+)["']/)
    if (hrefMatch) {
      try {
        const feedUrl = new URL(hrefMatch[1], baseUrl).href
        rssUrls.push(feedUrl)
      } catch {
        // invalid URL, skip
      }
    }
  }

  // Common RSS feed paths to try
  const commonPaths = [
    "/feed",
    "/feed/",
    "/rss",
    "/rss.xml",
    "/atom.xml",
    "/feed.xml",
    "/index.xml",
    "/rss/feed",
    "/blog/feed",
    "/blog/rss",
  ]

  try {
    const base = new URL(baseUrl)
    for (const p of commonPaths) {
      rssUrls.push(new URL(p, base.origin).href)
    }
  } catch {
    // invalid base URL
  }

  // Deduplicate
  return [...new Set(rssUrls)]
}

function parseRssFeed(xml: string): FeedItem[] {
  const items: FeedItem[] = []

  // Match RSS <item> elements
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi
  let itemMatch: RegExpExecArray | null
  while ((itemMatch = itemRegex.exec(xml)) !== null) {
    const content = itemMatch[1]
    const titleMatch = content.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/)
    const linkMatch =
      content.match(/<link>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/) ||
      content.match(/<link[^>]+href=["']([^"']+)["']/)
    const pubDateMatch = content.match(
      /<pubDate>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/pubDate>/
    )

    const link = linkMatch ? linkMatch[1].trim() : ""
    if (link) {
      items.push({
        title: titleMatch ? titleMatch[1].trim() : link,
        link,
        pubDate: pubDateMatch ? pubDateMatch[1].trim() : "",
      })
    }
  }

  // Match Atom <entry> elements
  if (items.length === 0) {
    const entryRegex = /<entry>([\s\S]*?)<\/entry>/gi
    let entryMatch: RegExpExecArray | null
    while ((entryMatch = entryRegex.exec(xml)) !== null) {
      const content = entryMatch[1]
      const titleMatch = content.match(
        /<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/
      )
      const linkMatch = content.match(/<link[^>]+href=["']([^"']+)["']/)
      const updatedMatch = content.match(
        /<updated>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/updated>/
      )
      const publishedMatch = content.match(
        /<published>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/published>/
      )

      const link = linkMatch ? linkMatch[1].trim() : ""
      if (link) {
        items.push({
          title: titleMatch ? titleMatch[1].trim() : link,
          link,
          pubDate: publishedMatch
            ? publishedMatch[1].trim()
            : updatedMatch
              ? updatedMatch[1].trim()
              : "",
        })
      }
    }
  }

  return items
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

    // Validate URL
    let parsedUrl: URL
    try {
      parsedUrl = new URL(url.startsWith("http") ? url : `https://${url}`)
    } catch {
      return NextResponse.json(
        { error: "Invalid URL format" },
        { status: 400 }
      )
    }

    // Fetch the page
    let pageHtml: string
    try {
      const pageResponse = await fetch(parsedUrl.href, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; RSSExtractor/1.0; +https://rss-extractor.vercel.app)",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
        signal: AbortSignal.timeout(15000),
      })
      if (!pageResponse.ok) {
        return NextResponse.json(
          { error: `Failed to fetch URL (HTTP ${pageResponse.status})` },
          { status: 422 }
        )
      }
      pageHtml = await pageResponse.text()
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error"
      return NextResponse.json(
        { error: `Could not reach the URL: ${message}` },
        { status: 422 }
      )
    }

    // Check if the URL itself is an RSS feed
    const isXml =
      pageHtml.trimStart().startsWith("<?xml") ||
      pageHtml.trimStart().startsWith("<rss") ||
      pageHtml.trimStart().startsWith("<feed")

    if (isXml) {
      const items = parseRssFeed(pageHtml)
      return NextResponse.json({
        feedUrl: parsedUrl.href,
        feedsFound: [parsedUrl.href],
        items,
        totalItems: items.length,
        source: "direct",
      })
    }

    // Discover RSS feed URLs from the HTML page
    const candidateUrls = extractRssUrls(pageHtml, parsedUrl.href)

    // Try each candidate to find a working feed
    let feedItems: FeedItem[] = []
    let workingFeedUrl = ""
    const validFeeds: string[] = []

    for (const feedUrl of candidateUrls) {
      try {
        const feedResponse = await fetch(feedUrl, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (compatible; RSSExtractor/1.0; +https://rss-extractor.vercel.app)",
            Accept: "application/rss+xml,application/atom+xml,application/xml,text/xml,*/*;q=0.1",
          },
          signal: AbortSignal.timeout(10000),
        })
        if (!feedResponse.ok) continue

        const feedXml = await feedResponse.text()
        const isValidFeed =
          feedXml.includes("<rss") ||
          feedXml.includes("<feed") ||
          feedXml.includes("<channel")

        if (!isValidFeed) continue

        validFeeds.push(feedUrl)
        const items = parseRssFeed(feedXml)

        if (items.length > feedItems.length) {
          feedItems = items
          workingFeedUrl = feedUrl
        }
      } catch {
        // feed URL not reachable, skip
      }
    }

    if (feedItems.length === 0) {
      return NextResponse.json({
        feedUrl: null,
        feedsFound: validFeeds,
        items: [],
        totalItems: 0,
        source: "discovery",
        message:
          validFeeds.length > 0
            ? "Found feed URLs but could not extract items from them."
            : "No RSS/Atom feeds found on this page.",
      })
    }

    return NextResponse.json({
      feedUrl: workingFeedUrl,
      feedsFound: validFeeds,
      items: feedItems,
      totalItems: feedItems.length,
      source: "discovery",
    })
  } catch (error) {
    return NextResponse.json(
      { error: "An unexpected error occurred while extracting feeds" },
      { status: 500 }
    )
  }
}
