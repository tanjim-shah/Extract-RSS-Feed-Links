"use client"

import { useState } from "react"
import useSWR from "swr"
import { StatsCards } from "./stats-cards"
import { LinkTable } from "./link-table"
import { UrlExtractor } from "./url-extractor"
import { Rss } from "lucide-react"

const fetcher = (url: string) => fetch(url).then((res) => res.json())

type View = "extract" | "history"

export function Dashboard() {
  const [view, setView] = useState<View>("extract")
  const { data, error, isLoading } = useSWR("/api/feeds", fetcher)

  return (
    <div className="min-h-screen">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
              <Rss className="h-4 w-4 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-foreground">
                RSS Feed Extractor
              </h1>
              <p className="text-xs text-muted-foreground">
                Extract RSS feed links from any URL
              </p>
            </div>
          </div>

          <nav className="flex gap-1 rounded-lg border border-border bg-muted p-1">
            <button
              onClick={() => setView("extract")}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                view === "extract"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Extract
            </button>
            <button
              onClick={() => setView("history")}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                view === "history"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              History
            </button>
          </nav>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
        {view === "extract" && <UrlExtractor />}

        {view === "history" && (
          <>
            {isLoading && (
              <div className="flex items-center justify-center py-16">
                <div className="flex flex-col items-center gap-3">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground border-t-primary" />
                  <p className="text-sm text-muted-foreground">
                    Loading feed data...
                  </p>
                </div>
              </div>
            )}

            {error && (
              <p className="py-8 text-center text-sm text-destructive">
                Failed to load feed data.
              </p>
            )}

            {data && (
              <>
                <StatsCards
                  latestCount={data.stats.latestCount}
                  historyCount={data.stats.historyCount}
                  dateCount={data.stats.dateCount}
                  lastRun={data.lastRun}
                />
                <LinkTable
                  history={data.history}
                  latestLinks={data.latestLinks}
                />
              </>
            )}
          </>
        )}
      </main>
    </div>
  )
}
