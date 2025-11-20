# Bug Fixes Summary - Drag-and-Drop, Duplicates, and Notes Display

## Issues Fixed

### 1. Drag-and-Drop Not Working
**Root Cause:** The drag move handler was updating the `eventStore` which conflicted with database-loaded events, causing the UI to not reflect changes properly.

**Fix:**
- Changed `handleDragMove` to update the `events` state directly using `setEvents`
- Only update `eventStore` for local events (non-database events)
- This prevents conflicts between local and database event sources

**Code Changes:**
- `client/src/components/DailyView.tsx` lines 302-320

### 2. Appointment Duplication
**Root Cause:** The `eventStore.subscribe()` callback was setting all events from eventStore, which conflicted with the database query that also sets events, causing duplicates.

**Fix:**
- Modified the subscription to only update `tasks`, not `events`
- Events are now exclusively managed by the database query in the `useEffect` on line 114
- This ensures a single source of truth for events

**Code Changes:**
- `client/src/components/DailyView.tsx` lines 105-111

### 3. Notes Not Displaying on Appointment Blocks
**Root Cause:** The notes WERE being loaded and the display logic was correct. The issue was that the modal was auto-closing before the database query could invalidate and refetch, making it appear that notes weren't being saved.

**Fix:**
- Removed the `setTimeout(() => onClose(), 500)` that was auto-closing the modal
- Users now manually close the modal after seeing the success toast
- This gives the database query time to invalidate and refetch with the new notes

**Code Changes:**
- `client/src/components/AppointmentDetailsModal.tsx` line 270

## How the System Works Now

### Event Flow:
1. **Database Events** (from Google Calendar):
   - Loaded via `trpc.appointments.getByDateRange.useQuery()`
   - Merged with local events in `useEffect` (line 114)
   - Set to `events` state

2. **Local Events** (created in the app):
   - Stored in `eventStore`
   - Merged with database events
   - Set to `events` state

3. **Drag-and-Drop**:
   - Updates `events` state directly during drag
   - On drag end, saves to database if it's a Google Calendar event
   - Database query invalidates and refetches
   - UI updates with new positions

4. **Notes and Status**:
   - Saved via `updateAppointmentDetails` mutation
   - Database query invalidates
   - UI refetches and displays updated notes/status

## Testing Checklist

- [ ] **Drag-and-Drop**: Try dragging an appointment to a different time - it should move smoothly and stay in the new position after releasing
- [ ] **No Duplicates**: After dragging, check that the appointment doesn't appear in both the old and new positions
- [ ] **Notes Display**: Add notes to an appointment, save, close the modal, and verify the notes appear in the appointment block (in the right column if the appointment is tall enough)
- [ ] **Status Colors**: Change an appointment status to "Completed" and verify the background color changes to light green
- [ ] **Reminders Display**: Add reminders to an appointment and verify they appear in the middle column of the appointment block

## Known Limitations

1. **Height Requirement**: Notes and reminders only display if the appointment block is taller than 60px (1 hour or more)
2. **Manual Modal Close**: Users must manually close the appointment details modal after saving changes
3. **Local vs Database Events**: Local events (created in the app) and database events (from Google Calendar) are handled differently during drag operations
