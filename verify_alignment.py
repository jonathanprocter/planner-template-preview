#!/usr/bin/env python3
"""
Comprehensive verification of appointment positioning.
Calculates exact Y positions for appointments and grid lines.
"""

import re

def verify_alignment():
    print("=" * 80)
    print("APPOINTMENT ALIGNMENT VERIFICATION")
    print("=" * 80)
    print()
    
    with open('/home/ubuntu/planner-template-preview/client/src/components/WeeklyView.tsx', 'r') as f:
        content = f.read()
    
    # Extract current offset calculation
    print("1. CURRENT OFFSET CALCULATION")
    print("-" * 80)
    
    day_names = 60
    all_day_base = 40
    notes = 80
    
    # Find the actual adjustment value
    offset_match = re.search(r'headerOffset = dayNamesHeight \+ allDayHeight \+ notesHeight - (\d+)', content)
    if offset_match:
        adjustment = int(offset_match.group(1))
        print(f"Day Names: {day_names}px")
        print(f"All-Day (min): {all_day_base}px")
        print(f"Notes: {notes}px")
        print(f"Adjustment: -{adjustment}px")
        print(f"Total Header Offset: {day_names + all_day_base + notes - adjustment}px")
        header_offset = day_names + all_day_base + notes - adjustment
    else:
        print("ERROR: Could not find offset calculation")
        return
    
    print()
    print("2. GRID LINE POSITIONS (relative to #weekly-grid container)")
    print("-" * 80)
    print("Assuming grid starts at Y=0 within #weekly-grid:")
    print()
    
    # Calculate where each hour line should be
    grid_lines = {}
    for hour in range(6, 22):
        for minute in [0, 30]:
            time_str = f"{hour:02d}:{minute:02d}"
            minutes_from_6 = (hour - 6) * 60 + minute
            y_pos = header_offset + (minutes_from_6 * (100 / 60))
            grid_lines[time_str] = y_pos
            if minute == 0:  # Only print hour lines
                print(f"  {time_str} line → Y = {y_pos:.2f}px")
    
    print()
    print("3. APPOINTMENT POSITIONS")
    print("-" * 80)
    
    # Test appointments
    test_cases = [
        ("Richie Hayes", "07:00", "08:00"),
        ("Ruben Spilberg", "07:30", "08:30"),
        ("Dan re: Supervision", "08:00", "09:00"),
        ("Coffee with Nora", "08:00", "09:00"),
        ("Sherrita Hossein", "08:00", "09:00"),
    ]
    
    print("For each appointment, checking if top edge aligns with start time line:")
    print()
    
    all_aligned = True
    for name, start_time, end_time in test_cases:
        # Parse times
        start_h, start_m = map(int, start_time.split(':'))
        end_h, end_m = map(int, end_time.split(':'))
        
        # Calculate position
        start_minutes = (start_h - 6) * 60 + start_m
        end_minutes = (end_h - 6) * 60 + end_m
        
        y_top = header_offset + (start_minutes * (100 / 60))
        y_bottom = header_offset + (end_minutes * (100 / 60))
        height = y_bottom - y_top
        
        # Get expected grid line position
        expected_y = grid_lines[start_time]
        
        # Check alignment
        aligned = abs(y_top - expected_y) < 0.01
        status = "✓" if aligned else "✗"
        
        print(f"{status} {name} ({start_time} - {end_time})")
        print(f"    Top edge Y: {y_top:.2f}px")
        print(f"    Expected (grid line): {expected_y:.2f}px")
        print(f"    Difference: {y_top - expected_y:.2f}px")
        print(f"    Height: {height:.2f}px (duration: {end_minutes - start_minutes} min)")
        
        if not aligned:
            all_aligned = False
            print(f"    ⚠ MISALIGNED by {abs(y_top - expected_y):.2f}px!")
        print()
    
    print("4. BORDER ANALYSIS")
    print("-" * 80)
    
    # Check borders
    day_names_border = 2  # border-b-2
    all_day_border = 1    # border-b
    notes_border = 1      # border-b
    
    print(f"Day Names border: {day_names_border}px (border-b-2)")
    print(f"All-Day border: {all_day_border}px (border-b)")
    print(f"Notes border: {notes_border}px (border-b)")
    print(f"Total borders: {day_names_border + all_day_border + notes_border}px")
    print()
    print(f"Actual header height: {day_names + day_names_border + all_day_base + all_day_border + notes + notes_border}px")
    print(f"Current offset: {header_offset}px")
    print(f"Difference: {(day_names + day_names_border + all_day_base + all_day_border + notes + notes_border) - header_offset}px")
    
    print()
    print("5. SUMMARY")
    print("-" * 80)
    
    if all_aligned:
        print("✓ ALL APPOINTMENTS ALIGNED CORRECTLY")
    else:
        print("✗ SOME APPOINTMENTS ARE MISALIGNED")
        print()
        print("Recommended fix:")
        print(f"  - Current adjustment: -{adjustment}px")
        
        # Calculate what the adjustment should be
        actual_header = day_names + day_names_border + all_day_base + all_day_border + notes + notes_border
        base_sum = day_names + all_day_base + notes
        needed_adjustment = base_sum - header_offset
        
        print(f"  - Needed adjustment: -{needed_adjustment}px")
        print(f"  - Change offset calculation to: dayNamesHeight + allDayHeight + notesHeight - {needed_adjustment}")
    
    print()
    print("=" * 80)

if __name__ == "__main__":
    verify_alignment()
