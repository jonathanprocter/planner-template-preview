#!/usr/bin/env python3
"""
Analyze the actual DOM structure to find where grid lines should be positioned.
"""

import re

def analyze_dom_structure():
    """Analyze the WeeklyView DOM structure."""
    
    print("=" * 80)
    print("DOM STRUCTURE ANALYSIS")
    print("=" * 80)
    print()
    
    with open('/home/ubuntu/planner-template-preview/client/src/components/WeeklyView.tsx', 'r') as f:
        content = f.read()
    
    print("1. CONTAINER STRUCTURE")
    print("-" * 80)
    
    # Find the weekly-grid container
    grid_match = re.search(r'id="weekly-grid".*?style={{(.*?)}}', content, re.DOTALL)
    if grid_match:
        style = grid_match.group(1)
        print("Weekly Grid Container:")
        print(f"  Style: {style.strip()}")
        
        # Extract top position
        top_match = re.search(r'top:\s*"(\d+)px"', style)
        if top_match:
            grid_top = int(top_match.group(1))
            print(f"  → Grid starts at Y={grid_top}px from container top")
    
    print()
    print("2. HEADER SECTIONS")
    print("-" * 80)
    
    # Find day names section
    day_names_match = re.search(r'Day names.*?height:\s*"(\d+)px"', content, re.DOTALL | re.IGNORECASE)
    if day_names_match:
        day_names_height = int(day_names_match.group(1))
        print(f"Day Names: {day_names_height}px")
    
    # Find all-day section
    all_day_match = re.search(r'All-Day.*?minHeight:\s*"(\d+)px"', content, re.DOTALL | re.IGNORECASE)
    if all_day_match:
        all_day_height = int(all_day_match.group(1))
        print(f"All-Day Section: min {all_day_height}px (dynamic based on holidays)")
    
    # Find notes section
    notes_match = re.search(r'Notes.*?minHeight:\s*"(\d+)px"', content, re.DOTALL | re.IGNORECASE)
    if notes_match:
        notes_height = int(notes_match.group(1))
        print(f"Notes Section: min {notes_height}px")
    
    print()
    print("3. TIME GRID")
    print("-" * 80)
    
    # Find hour row height
    hour_height_match = re.search(r'height:\s*"(\d+)px".*?// hour row', content, re.DOTALL)
    if not hour_height_match:
        hour_height_match = re.search(r'style={{.*?height:\s*"(\d+)px".*?}}.*?hours\.map', content, re.DOTALL)
    
    if hour_height_match:
        hour_height = int(hour_height_match.group(1))
        print(f"Each hour row: {hour_height}px")
        print(f"Pixels per minute: {hour_height / 60:.4f}")
    
    print()
    print("4. CALCULATED GRID LINE POSITIONS")
    print("-" * 80)
    print("Assuming appointments are positioned relative to #weekly-grid:")
    print()
    
    if day_names_match and all_day_match and notes_match:
        # Calculate where each hour line should be
        header_total = day_names_height + all_day_height + notes_height
        print(f"Header sections total: {header_total}px")
        print(f"Current offset adjustment: -67px")
        print(f"Effective header offset: {header_total - 67}px")
        print()
        
        print("Grid line positions (Y coordinate relative to #weekly-grid):")
        for hour in range(6, 22):
            minutes_from_6 = (hour - 6) * 60
            y_pos = (header_total - 67) + (minutes_from_6 * (100 / 60))
            print(f"  {hour:02d}:00 → Y={y_pos:.1f}px")
    
    print()
    print("5. VERIFICATION STEPS")
    print("-" * 80)
    print("To verify in browser DevTools:")
    print("  1. Inspect an appointment element")
    print("  2. Check its 'top' CSS property value")
    print("  3. Inspect the hour grid line it should align with")
    print("  4. Measure the grid line's Y position")
    print("  5. Compare: appointment.top should equal grid_line.offsetTop")
    print()
    print("=" * 80)

if __name__ == "__main__":
    analyze_dom_structure()
