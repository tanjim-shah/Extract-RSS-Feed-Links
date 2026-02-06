"use client"

import { Rss, Link2, Calendar, Clock } from "lucide-react"

interface StatsCardsProps {
  latestCount: number
  historyCount: number
  dateCount: number
  lastRun: string
}

export function StatsCards({
  latestCount,
  historyCount,
  dateCount,
  lastRun,
}: StatsCardsProps) {
  const formattedDate = lastRun
    ? new Date(lastRun).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "N/A"

  const cards = [
    {
      label: "Latest Extract",
      value: latestCount.toLocaleString(),
      icon: Rss,
      description: "Links in latest batch",
    },
    {
      label: "History Links",
      value: historyCount.toLocaleString(),
      icon: Link2,
      description: "Total links extracted",
    },
    {
      label: "Date Groups",
      value: dateCount.toLocaleString(),
      icon: Calendar,
      description: "Unique publish dates",
    },
    {
      label: "Last Run",
      value: formattedDate,
      icon: Clock,
      description: "Most recent extraction",
      isSmallText: true,
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="flex flex-col gap-3 rounded-lg border border-border bg-card p-5"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">
              {card.label}
            </span>
            <card.icon className="h-4 w-4 text-muted-foreground" />
          </div>
          <p
            className={`font-semibold ${card.isSmallText ? "text-sm" : "text-2xl"} text-foreground`}
          >
            {card.value}
          </p>
          <p className="text-xs text-muted-foreground">{card.description}</p>
        </div>
      ))}
    </div>
  )
}
