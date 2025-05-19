#!/usr/bin/env python3
"""
RSS Feed Extractor for BeACleaner Blog
This script fetches the RSS feed from beacleaner.com, extracts blog post links
and their published dates, and outputs them in the requested format.
"""

import requests
from bs4 import BeautifulSoup
from datetime import datetime
import dateutil.parser
from collections import defaultdict

# URL of the RSS feed
RSS_URL = "https://www.beacleaner.com/rss.xml"

def main():
    try:
        # Fetch the RSS feed
        response = requests.get(RSS_URL)
        response.raise_for_status()  # Raise exception for HTTP errors
        
        # Parse the XML
        soup = BeautifulSoup(response.content, features="xml")
        
        # Find all items
        items = soup.find_all("item")
        
        # Group by published date
        posts_by_date = defaultdict(list)
        
        for item in items:
            # Extract link and publication date
            link = item.find("link").text
            pub_date_str = item.find("pubDate").text
            
            # Parse the date
            pub_date = dateutil.parser.parse(pub_date_str)
            date_key = pub_date.strftime("%Y-%m-%d")
            
            # Store the link under its date
            posts_by_date[date_key].append(link)
        
        # Sort dates in descending order
        sorted_dates = sorted(posts_by_date.keys(), reverse=True)
        
        # Format output
        output_lines = []
        for date in sorted_dates:
            output_lines.append(f"published date: {date}  ")
            for link in posts_by_date[date]:
                output_lines.append(f"link: {link}")
            output_lines.append("")  # Add blank line between date groups
        
        # Save to file
        with open("rss_extract_results.txt", "w") as f:
            f.write("\n".join(output_lines))
            
        print(f"Successfully extracted {len(items)} posts from RSS feed.")
        
    except Exception as e:
        print(f"Error extracting RSS feed: {e}")
        with open("rss_extract_results.txt", "w") as f:
            f.write(f"Error occurred during extraction: {e}\n")
            f.write(f"Timestamp: {datetime.now().isoformat()}")

if __name__ == "__main__":
    main()