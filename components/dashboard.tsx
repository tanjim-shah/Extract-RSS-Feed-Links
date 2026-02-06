"use client"

import useSWR from "swr"
import { StatsCards } from "./stats-cards"
import { LinkTable } from "./link-table"
import { Rss } from "lucide-react"

const fetcher = (url: string) => fetch(url).then((res) => res.json())

export function Dashboard() {
  const { data, error, isLoading } = useSWR("/api/feeds", fetcher)

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground border-t-primary" />
          <p className="text-sm text-muted-foreground">Loading feed data...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-destructive">Failed to load feed data.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-6 py-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
            <Rss className="h-4 w-4 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">
              RSS Feed Extractor
            </h1>
            <p className="text-xs text-muted-foreground">
              beacleaner.com link extraction dashboard
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
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
      </main>
    </div>
  )
}
