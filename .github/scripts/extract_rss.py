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
import sys
import traceback
import time

# URL of the RSS feed
RSS_URL = "https://www.beacleaner.com/rss.xml"
# Maximum number of retry attempts
MAX_RETRIES = 3
# Delay between retries (in seconds)
RETRY_DELAY = 5

def fetch_rss(url, retries=MAX_RETRIES):
    """
    Fetch RSS feed with retry logic
    """
    for attempt in range(retries):
        try:
            response = requests.get(url, timeout=30)
            response.raise_for_status()
            return response.content
        except requests.exceptions.RequestException as e:
            if attempt < retries - 1:
                print(f"Attempt {attempt + 1} failed: {e}. Retrying in {RETRY_DELAY} seconds...")
                time.sleep(RETRY_DELAY)
            else:
                raise Exception(f"Failed to fetch RSS feed after {retries} attempts: {e}")

def parse_rss(content):
    """
    Parse RSS content and extract posts
    """
    # Try multiple parsing methods to handle different XML formats
    for parser in ["xml", "lxml-xml", "html.parser"]:
        try:
            soup = BeautifulSoup(content, parser)
            items = soup.find_all("item")
            if items:
                break
        except Exception as e:
            print(f"Parser {parser} failed: {e}")
    
    if not items:
        raise ValueError("No items found in the RSS feed. Check the format.")
    
    print(f"Successfully found {len(items)} items in the RSS feed using {parser} parser.")
    
    # Group by published date
    posts_by_date = defaultdict(list)
    
    for item in items:
        try:
            # Extract link and publication date
            link_tag = item.find("link")
            if not link_tag or not link_tag.text.strip():
                print("Warning: Item missing link tag or empty link")
                continue
                
            link = link_tag.text.strip()
            
            # Extract publication date
            pub_date_tag = item.find("pubDate")
            if not pub_date_tag or not pub_date_tag.text.strip():
                print(f"Warning: Item with link '{link}' is missing pubDate tag or empty date")
                continue
            
            pub_date_str = pub_date_tag.text.strip()
            # Parse the date
            pub_date = dateutil.parser.parse(pub_date_str)
            date_key = pub_date.strftime("%Y-%m-%d")
            
            # Store the link under its date
            posts_by_date[date_key].append(link)
        except Exception as e:
            title = item.find("title").text if item.find("title") else "Unknown"
            print(f"Warning: Error processing item '{title}': {e}")
    
    return posts_by_date

def format_output(posts_by_date):
    """
    Format posts by date into the required output format
    """
    # Sort dates in descending order
    sorted_dates = sorted(posts_by_date.keys(), reverse=True)
    
    # Format output
    output_lines = []
    for date in sorted_dates:
        output_lines.append(f"published date: {date}  ")
        for link in posts_by_date[date]:
            output_lines.append(f"{link}")
        output_lines.append("")  # Add blank line between date groups
    
    return output_lines

def main():
    try:
        print(f"Starting RSS feed extraction from {RSS_URL}")
        
        # Fetch the RSS feed
        content = fetch_rss(RSS_URL)
        
        # Parse the XML
        posts_by_date = parse_rss(content)
        
        # Format the output
        output_lines = format_output(posts_by_date)
        
        # Save to file
        with open("rss_extract_results.txt", "w") as f:
            f.write("\n".join(output_lines))
        
        total_posts = sum(len(links) for links in posts_by_date.values())
        print(f"Successfully extracted {total_posts} posts from RSS feed.")
        print(f"Results saved to rss_extract_results.txt")
        
    except Exception as e:
        print(f"Error extracting RSS feed: {str(e)}")
        traceback.print_exc()  # Print full stack trace for debugging
        with open("rss_extract_results.txt", "w") as f:
            f.write(f"Error occurred during extraction: {str(e)}\n")
            f.write(f"Timestamp: {datetime.now().isoformat()}")
        return 1
    
    return 0

if __name__ == "__main__":
    sys.exit(main())