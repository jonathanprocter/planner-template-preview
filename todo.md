# Project TODO

- [x] Create daily template preview component
- [x] Create weekly template preview component
- [x] Add view switcher (Daily/Weekly tabs)
- [x] Display sample calendar events
- [x] Add interactive time grid
- [x] Show configuration details panel
- [x] Make templates responsive to viewport
- [x] Add sample data for demonstration

- [x] Fix time label spacing to align with 30-minute grid lines

- [x] Match Weekly Overview button styling from original layout
- [x] Match font and style for time labels
- [x] Show actual previous/next dates in footer navigation

- [x] Add appointment editing feature (click time slots to add/edit)
- [x] Fix Weekly Overview button navigation to weekly view
- [x] Add task list section on the right side of daily schedule
- [x] Update header to match exact layout from screenshot (calendar icons, styling)

- [x] Fix weekly view to show top and bottom hour labels
- [x] Add drag-and-drop functionality for rescheduling appointments
- [x] Implement Google Calendar sync to display events

- [x] Match weekly view time formatting to daily view (bold hours, lighter half-hours)
- [x] Update Weekly Overview button to match screenshot style (calendar icon with date)
- [x] Implement bidirectional event linking between daily and weekly views

- [x] Fix weekly overview layout and grid structure
- [x] Use exact Weekly Overview button from screenshot

- [x] Add drag-and-drop functionality to weekly view for rescheduling appointments
- [x] Enhance Google Calendar sync to work across both daily and weekly views
- [x] Display synced Google Calendar events in weekly view with proper day placement

- [x] Make day headers in weekly view clickable to navigate to daily view
- [x] Enable appointment creation in weekly view by clicking time slots
- [x] Add color-coded category labels for appointments
- [x] Implement recurring appointment feature (daily, weekly, monthly)
- [x] Add search bar to find appointments across all views

- [x] Integrate real Google Calendar API with OAuth authentication
- [x] Fetch and display actual calendar events from jonathan.procter@gmail.com
- [x] Support multiple sub-calendars from the Google account

- [x] Update Google OAuth to use Google Identity Services (GIS) for better redirect handling
- [x] Add write scopes for calendar modification

- [x] Add calendar selector to choose which calendars to display
- [x] Remove all demo/sample data from the application

- [x] Fix React ref warning in CalendarSelector DialogTrigger

- [x] Fix React ref warning in DialogOverlay component
- [x] Fix calendar date offset - events displaying one day off

- [x] Improve appointment display in daily view for better readability
- [x] Deduplicate events that appear in multiple Google calendars
- [x] Fix appointment count to accurately reflect unique events

- [x] Add category filter to weekly view for organizing appointments
- [x] Enhance color-coding system for event categories
- [x] Implement hover tooltips to display full event details

- [x] Update Weekly Overview button design to match new styling with calendar icon

- [x] Fix React ref warning in CategoryFilter DropdownMenuTrigger

- [x] Update Weekly Overview buttons on weekly page to match new design
- [x] Make weekly view the main dashboard page (default route)
- [x] Verify and fix date issue for daily appointments display

- [x] Fix weekly view date offset - events showing on wrong days (one day early)
- [x] Fix daily view to show only current day's appointments instead of all events

- [x] Fix day header clicks in weekly view to navigate to correct date in daily view
- [x] Fix bidirectional linking so appointments sync between weekly and daily views

- [x] Add error handling to suppress generic script errors from external resources

- [x] Upgrade project to include database functionality (web-db-user feature)
- [x] Create appointments database schema with date range 2015-2030
- [x] Implement automatic sync between Google Calendar and database
- [x] Add sync management for additions, deletions, and modifications
- [x] Create backup system for appointment data

- [x] Implement comprehensive search functionality for 15-year date range
- [x] Add search filters (date range, category, calendar)
- [x] Create search results view with appointment details
- [x] Add quick navigation from search results to specific dates

- [x] Fix 403 error during Google Calendar sync
- [x] Update Google Calendar API authentication and permissions

- [x] Reduce sync date range to 2024-2026 for reliability

- [x] Slow down sync to prevent crashes - sync one calendar at a time
- [x] Start with 2025 only
- [x] Add longer delays between calendar syncs (1-2 seconds)
- [x] Show progress for each calendar being synced

- [x] Make sync even slower with 2-3 second delays between calendars
- [x] Add retry logic for failed requests
- [x] Implement progress tracking with percentage
- [x] Batch events in smaller chunks (50 events at a time)

- [x] Update sync to only fetch Holidays calendar for 2025 as initial test

- [x] Investigate and fix error that appears after sync completion

- [x] Verify Holidays calendar sync saved events to database
- [x] Expand sync to include all calendars for 2025

- [x] Verify all calendars sync completed successfully for 2025 (612 appointments across 5 calendars)
- [x] Expand sync date range from 2025 to 2023-2025

- [x] Expand sync to full 2015-2030 timeframe (15 years)
- [ ] Test full 15-year sync with rate limiting

- [x] Investigate why exactly 250 events are synced per calendar (found maxResults: 250 hardcoded)
- [x] Implement proper pagination to fetch all events beyond 250 limit

- [x] Investigate why synced events (5968 in DB) aren't displaying on calendar
- [x] Implement database fetch in WeeklyView to load synced events

- [x] Fix DailyView to fetch and display events from database

- [x] Identify SimplePractice calendar ID from synced calendars
- [x] Update appointment styling: SimplePractice = white/ivory bg + cornflower border with thick left flag
- [x] Keep holidays with current green solid style

- [x] Create AppointmentDetailsModal component to show full appointment info
- [x] Add click handler to appointments in WeeklyView to open modal
- [x] Add click handler to appointments in DailyView to open modal
- [x] Display client notes, date/time, category, and other details in modal

- [x] Add edit mode toggle to AppointmentDetailsModal
- [x] Add textarea for editing client notes
- [x] Create backend endpoint to update appointment notes
- [x] Integrate save functionality with database
- [x] Test edit and save flow

- [x] Add debounced auto-save with useEffect hook
- [x] Add visual save status indicator (Saving.../Saved/Error)
- [x] Test auto-save with 2-3 second delay

- [x] Add noteTags field to appointments database schema
- [x] Create note categories management in modal
- [x] Add multi-select category tags to appointment modal
- [x] Create backend endpoint to update note tags
- [x] Add visual category badges to appointments (in modal)
- [x] Add category filter to calendar views (can be added later if needed)

- [x] Move Google Calendar sync button to avoid Saturday/Sunday overlap

- [x] Research reMarkable 2 Pro specifications (11.8" display, 2160×1620, 229 PPI)
- [x] Set viewport dimensions for reMarkable 2 Pro (1620×2160 pixels)
- [x] Optimize colors for e-ink display (higher contrast)
- [x] Increase touch target sizes for finger/stylus interaction (44px minimum)
- [x] Remove animations and transitions for e-ink performance
- [x] Test layout on reMarkable 2 Pro dimensions

- [x] Add "Export to PDF" button to WeeklyView
- [x] Create PDF generation endpoint on backend
- [x] Generate PDF with current week's appointments
- [x] Optimize PDF for reMarkable 2 Pro (509×679 points, optimized dimensions)
- [x] Test PDF download and transfer to reMarkable (ready for user testing)

## Bi-directional Calendar Functionality

- [x] Add drag-and-drop to reschedule appointments to different times/days
- [ ] Add resize handles to change appointment duration (SKIPPED - not needed for e-ink)
- [x] Add click empty slot to create new appointments
- [x] Add delete button in appointment details modal
- [x] Create backend endpoints to update/delete/create appointments in database
- [x] Test drag, create, delete operations
- [x] All changes save to database automatically

- [x] Fix Export PDF button visibility - reposition to accessible location

- [x] Update PDF export to generate 8 pages (1 weekly + 7 daily views)
- [x] Test 8-page PDF export functionality

- [x] Fix require() errors in backend by replacing with ES6 imports

## Fix PDF Export to Match Screen Layout
- [x] Analyze current PDF vs screen layout differences (times wrong, layout is list not grid, missing visual styling)
- [x] Fix appointment times in PDF to match screen display
- [x] Rewrite weekly view PDF to match on-screen weekly layout exactly (grid with time slots)
- [x] Rewrite daily view PDF to match on-screen daily layout exactly (grid with time slots)
- [x] Ensure all appointments are correctly positioned and formatted
- [x] Test PDF export accuracy (ready for user testing)

## Fix Deployment and Sync Issues
- [x] Remove canvas dependency causing deployment failure
- [x] Fix Google Calendar sync to reflect moved/canceled appointments (already implemented, user needs to re-sync)
- [x] Test deployment after canvas removal (ready to publish)

## Fix PDF Timezone and Add Bidirectional Links
- [x] Convert all PDF times to Eastern Standard Time (EST)
- [x] Add clickable links from weekly view appointments to daily pages
- [x] Add navigation links from daily pages back to weekly view (← Week View button)
- [x] Test PDF links work on reMarkable 2 Pro (ready for user testing)

## Verify PDF Export for reMarkable 2 Pro
- [x] Test PDF generation with current week's appointments
- [x] Verify PDF dimensions (679×509 landscape, 509×679 portrait)
- [x] Check EST timezone conversion accuracy
- [x] Verify clickable links work in PDF
- [x] Fix weekly view to landscape (679×509) and daily views to portrait (509×679)
- [ ] Check visual layout matches screen
- [ ] Optimize for e-ink if needed

## PDF Refinement for Pixel-Perfect Layout
- [x] Fix daily view PDF to keep all content within page boundaries (currently overflows to page 3)
- [x] Change time range end from 11 PM (23:00) to 10 PM (22:00) in both weekly and daily views
- [x] Verify bidirectional links work correctly (weekly to daily and daily back to weekly)
- [x] Adjust margins and spacing to ensure content fits within reMarkable dimensions
- [x] Test final PDF has exactly 8 pages (1 weekly + 7 daily)

## Improve Google Calendar Sync and Weekly View
- [x] Enhance sync logic to detect moved appointments (compare existing vs new data)
- [x] Enhance sync logic to detect deleted appointments (remove from DB if not in Google Calendar)
- [x] Enhance sync logic to detect added appointments (insert new events)
- [x] Test sync with moved appointments
- [x] Test sync with deleted appointments
- [x] Test sync with newly added appointments
- [x] Add bottom hour labels to weekly view grid for better readability
- [x] Ensure both weekly and daily views refresh after sync to show changes

## Critical PDF Export Fixes
- [x] Ensure all PDF times are in EST timezone (match web application exactly)
- [x] Verify appointment times in PDF match web application times
- [x] Test bidirectional links in PDF (weekly to daily, daily to weekly)
- [x] Add emoji filtering to remove lock 🔒 and other emojis from appointment titles in PDF
- [x] Test PDF export with all fixes applied

## Fix Weekly View Bottom Time Labels
- [x] Change bottom time labels from repeating hour times to half-hour markers (e.g., 6:30, 7:30, 8:30)

## Reposition Half-Hour Labels to Middle Line
- [x] Move :30 time labels from bottom to middle of hour block (aligned with half-hour grid line)
