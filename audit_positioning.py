#!/usr/bin/env python3
"""
Audit script for WeeklyView appointment positioning logic.
Analyzes the offset calculations and verifies alignment math.
"""

import re
import json

def analyze_weekly_view():
    """Analyze WeeklyView.tsx for positioning logic."""
    
    print("=" * 80)
    print("WEEKLY PLANNER APPOINTMENT POSITIONING AUDIT")
    print("=" * 80)
    print()
    
    # Read the WeeklyView component
    with open('/home/ubuntu/planner-template-preview/client/src/components/WeeklyView.tsx', 'r') as f:
        content = f.read()
    
    # Extract positioning calculation
    offset_match = re.search(r'const headerOffset = (.+?);', content, re.DOTALL)
    y_calc_match = re.search(r'const y = (.+?);', content)
    
    print("1. HEADER OFFSET CALCULATION")
    print("-" * 80)
    if offset_match:
        offset_calc = offset_match.group(1).strip()
        print(f"Found: {offset_calc}")
        
        # Parse the calculation
        day_names_match = re.search(r'dayNamesHeight = (\d+)', content)
        all_day_match = re.search(r'allDayHeight = .+? \? (\d+) \+ .+? : (\d+)', content)
        notes_match = re.search(r'notesHeight = (\d+)', content)
        
        if day_names_match:
            day_names = int(day_names_match.group(1))
            print(f"  - Day Names Height: {day_names}px")
        
        if all_day_match:
            all_day_base = int(all_day_match.group(1))
            all_day_min = int(all_day_match.group(2))
            print(f"  - All-Day Height: {all_day_base}px base (or {all_day_min}px min)")
        
        if notes_match:
            notes = int(notes_match.group(1))
            print(f"  - Notes Height: {notes}px")
        
        # Check for adjustments
        if '-' in offset_calc:
            adjustment_match = re.search(r'- (\d+)', offset_calc)
            if adjustment_match:
                adjustment = int(adjustment_match.group(1))
                print(f"  - Adjustment: -{adjustment}px")
                print(f"\n  Total (no holidays): {day_names} + {all_day_min} + {notes} - {adjustment} = {day_names + all_day_min + notes - adjustment}px")
        elif '+' in offset_calc and offset_calc.count('+') > 2:
            adjustment_match = re.search(r'\+ (\d+)(?!.*\+)', offset_calc)
            if adjustment_match:
                adjustment = int(adjustment_match.group(1))
                print(f"  - Adjustment: +{adjustment}px")
                print(f"\n  Total (no holidays): {day_names} + {all_day_min} + {notes} + {adjustment} = {day_names + all_day_min + notes + adjustment}px")
        else:
            print(f"\n  Total (no holidays): {day_names} + {all_day_min} + {notes} = {day_names + all_day_min + notes}px")
    
    print()
    print("2. Y POSITION CALCULATION")
    print("-" * 80)
    if y_calc_match:
        y_calc = y_calc_match.group(1).strip()
        print(f"Found: {y_calc}")
    
    # Calculate expected positions for test appointments
    print()
    print("3. EXPECTED POSITIONS FOR TEST APPOINTMENTS")
    print("-" * 80)
    print("Assumptions:")
    print("  - Grid starts at 06:00")
    print("  - Each hour = 100px")
    print("  - Pixels per minute = 100/60 = 1.6667")
    print()
    
    # Test cases
    test_appointments = [
        ("Richie Hayes", "07:00", 7, 0),
        ("Ruben Spilberg", "07:30", 7, 30),
        ("Dan re: Supervision", "08:00", 8, 0),
        ("John Best", "08:00", 8, 0),
    ]
    
    # Calculate with current offset
    if day_names_match and all_day_match and notes_match:
        base_offset = day_names + all_day_min + notes
        if '-' in offset_calc and adjustment_match:
            final_offset = base_offset - adjustment
        elif '+' in offset_calc and offset_calc.count('+') > 2 and adjustment_match:
            final_offset = base_offset + adjustment
        else:
            final_offset = base_offset
        
        print(f"Header Offset: {final_offset}px")
        print()
        
        for name, time_str, hour, minute in test_appointments:
            start_minutes = (hour - 6) * 60 + minute
            pixels_from_6am = start_minutes * (100 / 60)
            y_position = final_offset + pixels_from_6am
            
            print(f"{name} ({time_str}):")
            print(f"  - Minutes from 06:00: {start_minutes}")
            print(f"  - Pixels from 06:00: {pixels_from_6am:.2f}px")
            print(f"  - Y position: {y_position:.2f}px")
            print()
    
    # Check for potential issues
    print("4. POTENTIAL ISSUES")
    print("-" * 80)
    
    issues = []
    
    # Check if appointments are positioned relative to correct container
    if 'position: absolute' in content or 'position: "absolute"' in content:
        print("✓ Appointments use absolute positioning")
    else:
        issues.append("⚠ Appointments may not be using absolute positioning")
    
    # Check for timezone handling
    if 'America/New_York' in content or 'timeZone' in content:
        print("✓ Timezone conversion found")
    else:
        issues.append("⚠ No timezone conversion found")
    
    # Check for dynamic height calculation
    if 'maxHolidaysInAnyDay' in content:
        print("✓ Dynamic all-day section height calculation found")
    else:
        issues.append("⚠ All-day section height may not be dynamic")
    
    if issues:
        print()
        for issue in issues:
            print(issue)
    
    print()
    print("5. RECOMMENDATIONS")
    print("-" * 80)
    print("To verify alignment:")
    print("  1. Check that 08:00 appointment Y position matches the 08:00 grid line")
    print("  2. Measure the actual rendered header height in browser DevTools")
    print("  3. Compare calculated offset with actual header height")
    print("  4. Adjust the offset value if there's a discrepancy")
    print()
    print("=" * 80)

if __name__ == "__main__":
    analyze_weekly_view()
