import { NextResponse } from "next/server"
import { promises as fs } from "fs"
import path from "path"

interface HistoryEntry {
  date: string
  links: string[]
}

export async function GET() {
  try {
    const outputsDir = path.join(process.cwd(), "outputs")

    // Read latest extract
    let latestLinks: string[] = []
    try {
      const latestContent = await fs.readFile(
        path.join(outputsDir, "latest_extract.txt"),
        "utf-8"
      )
      latestLinks = latestContent
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.startsWith("http"))
    } catch {
      // file may not exist
    }

    // Read history
    let history: HistoryEntry[] = []
    try {
      const historyContent = await fs.readFile(
        path.join(outputsDir, "rss_extract_history.txt"),
        "utf-8"
      )
      let currentDate = ""
      let currentLinks: string[] = []

      for (const line of historyContent.split("\n")) {
        const trimmed = line.trim()
        if (trimmed.startsWith("published date:")) {
          if (currentDate && currentLinks.length > 0) {
            history.push({ date: currentDate, links: [...currentLinks] })
          }
          currentDate = trimmed.replace("published date:", "").trim()
          currentLinks = []
        } else if (trimmed.startsWith("link:")) {
          currentLinks.push(trimmed.replace("link:", "").trim())
        }
      }
      if (currentDate && currentLinks.length > 0) {
        history.push({ date: currentDate, links: [...currentLinks] })
      }
    } catch {
      // file may not exist
    }

    // Read seen posts metadata
    let lastRun = ""
    try {
      const seenContent = await fs.readFile(
        path.join(outputsDir, "seen_posts.json"),
        "utf-8"
      )
      const seenData = JSON.parse(seenContent)
      lastRun = seenData.last_run || ""
    } catch {
      // file may not exist
    }

    const totalHistoryLinks = history.reduce(
      (acc, entry) => acc + entry.links.length,
      0
    )

    return NextResponse.json({
      latestLinks,
      history,
      lastRun,
      stats: {
        latestCount: latestLinks.length,
        historyCount: totalHistoryLinks,
        dateCount: history.length,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to read feed data" },
      { status: 500 }
    )
  }
}
