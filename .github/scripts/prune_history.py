#!/usr/bin/env python3
"""
RSS History Pruner
This script manages the size of the RSS extraction history file by:
1. Keeping only unique posts
2. Limiting the number of historical entries
3. Ensuring proper formatting
"""

import sys
import os
import re
from datetime import datetime
from collections import defaultdict, OrderedDict

# Maximum number of entries to keep in history (by date)
MAX_HISTORY_DATES = 30

def prune_history_file(file_path):
    """
    Prune the history file to keep it at a manageable size
    """
    if not os.path.exists(file_path):
        print(f"History file {file_path} does not exist.")
        return False
    
    try:
        # Read the file
        with open(file_path, 'r') as f:
            content = f.read()
        
        # Parse the content into date groups
        date_pattern = r'published date: (\d{4}-\d{2}-\d{2})\s+'
        date_blocks = re.split(date_pattern, content)
        
        # Skip the first element if it's empty (which it should be if content starts with a date)
        if date_blocks and not date_blocks[0].strip():
            date_blocks = date_blocks[1:]
        
        # Group dates and their links
        date_links = OrderedDict()
        for i in range(0, len(date_blocks), 2):
            if i+1 < len(date_blocks):
                date = date_blocks[i]
                links_text = date_blocks[i+1]
                
                # Extract links
                links = re.findall(r'link: (https?://[^\s]+)', links_text)
                
                # Store in dictionary
                date_links[date] = links
        
        # Keep only the most recent MAX_HISTORY_DATES dates
        pruned_dates = list(date_links.keys())
        if len(pruned_dates) > MAX_HISTORY_DATES:
            # Sort dates in descending order
            pruned_dates.sort(reverse=True)
            # Keep only the most recent dates
            pruned_dates = pruned_dates[:MAX_HISTORY_DATES]
        
        # Generate new content with pruned dates
        new_content = []
        for date in pruned_dates:
            links = date_links[date]
            new_content.append(f"published date: {date}  ")
            for link in links:
                new_content.append(f"link: {link}")
            new_content.append("")  # Add blank line between date groups
        
        # Write back to file
        with open(file_path, 'w') as f:
            f.write("\n".join(new_content))
        
        print(f"Pruned history file to {len(pruned_dates)} dates and {sum(len(date_links[date]) for date in pruned_dates)} links.")
        return True
        
    except Exception as e:
        print(f"Error pruning history file: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    history_file = "outputs/rss_extract_history.txt"
    
    # Create output directory if it doesn't exist
    os.makedirs(os.path.dirname(history_file), exist_ok=True)
    
    # Create empty history file if it doesn't exist
    if not os.path.exists(history_file):
        with open(history_file, 'w') as f:
            f.write("")
        print(f"Created empty history file: {history_file}")
        return 0
    
    # Prune existing history file
    if prune_history_file(history_file):
        print(f"Successfully pruned history file: {history_file}")
        return 0
    else:
        print(f"Failed to prune history file: {history_file}")
        return 1

if __name__ == "__main__":
    sys.exit(main())