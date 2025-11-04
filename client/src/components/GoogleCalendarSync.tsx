import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  initGoogleCalendar,
  signIn,
  signOut,
  isUserSignedIn,
  getAllCalendarEvents,
  getCalendarList,
  getEvents,
  getColorForEvent,
  type GoogleCalendarEvent,
} from "@/lib/googleCalendar";
import { eventStore, type Event } from "@/lib/eventStore";
import { CalendarSelector, type CalendarInfo } from "./CalendarSelector";
import { toast } from "sonner";

export function GoogleCalendarSync() {
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [availableCalendars, setAvailableCalendars] = useState<CalendarInfo[]>([]);
  const [selectedCalendarIds, setSelectedCalendarIds] = useState<string[]>([]);

  useEffect(() => {
    const initialize = async () => {
      try {
        await initGoogleCalendar();
        setIsSignedIn(isUserSignedIn());
        setIsInitialized(true);
      } catch (error) {
        console.error('Failed to initialize Google Calendar:', error);
        toast.error('Failed to initialize Google Calendar');
      }
    };

    initialize();
  }, []);

  const loadCalendars = async () => {
    try {
      const calendars = await getCalendarList();
      const calendarInfos: CalendarInfo[] = calendars.map((cal: any) => ({
        id: cal.id,
        summary: cal.summary,
        backgroundColor: cal.backgroundColor,
        selected: true, // Select all by default
      }));
      setAvailableCalendars(calendarInfos);
      setSelectedCalendarIds(calendarInfos.map(c => c.id));
      return calendarInfos;
    } catch (error) {
      console.error('Failed to load calendars:', error);
      toast.error('Failed to load calendar list');
      return [];
    }
  };

  const handleSignIn = async () => {
    try {
      await signIn();
      setIsSignedIn(true);
      toast.success('Successfully signed in to Google Calendar');
      
      // Load available calendars after sign in
      await loadCalendars();
    } catch (error) {
      console.error('Sign in failed:', error);
      toast.error('Failed to sign in to Google Calendar');
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      setIsSignedIn(false);
      setAvailableCalendars([]);
      setSelectedCalendarIds([]);
      
      // Remove all Google Calendar events
      const localEvents = eventStore.getEvents().filter(e => e.source !== 'google');
      eventStore.setEvents(localEvents);
      
      toast.success('Successfully signed out from Google Calendar');
    } catch (error) {
      console.error('Sign out failed:', error);
      toast.error('Failed to sign out');
    }
  };

  const handleCalendarSelectionChange = (selectedIds: string[]) => {
    setSelectedCalendarIds(selectedIds);
    // Auto-sync when selection changes
    handleSync(selectedIds);
  };

  const convertGoogleEventToLocal = (
    googleEvent: GoogleCalendarEvent,
    calendarName: string,
    backgroundColor?: string
  ): Event | null => {
    const startDateTime = googleEvent.start.dateTime || googleEvent.start.date;
    const endDateTime = googleEvent.end.dateTime || googleEvent.end.date;

    if (!startDateTime || !endDateTime) return null;

    const startDate = new Date(startDateTime);
    const endDate = new Date(endDateTime);

    const startTime = startDate.toTimeString().slice(0, 5);
    const endTime = endDate.toTimeString().slice(0, 5);
    const date = startDate.toISOString().split('T')[0];

    const color = backgroundColor || getColorForEvent(googleEvent.colorId);

    const event: Event = {
      id: `gcal-${googleEvent.id}`,
      title: googleEvent.summary || 'Untitled Event',
      startTime,
      endTime,
      color,
      source: 'google',
      date,
      category: calendarName,
    };

    // Handle recurring events
    if (googleEvent.recurrence && googleEvent.recurrence.length > 0) {
      const rrule = googleEvent.recurrence[0];
      if (rrule.includes('FREQ=DAILY')) {
        event.recurring = { frequency: 'daily' };
      } else if (rrule.includes('FREQ=WEEKLY')) {
        event.recurring = { frequency: 'weekly' };
      } else if (rrule.includes('FREQ=MONTHLY')) {
        event.recurring = { frequency: 'monthly' };
      }
    }

    return event;
  };

  const handleSync = async (calendarIds?: string[]) => {
    if (!isSignedIn) {
      toast.error('Please sign in to Google Calendar first');
      return;
    }

    setIsSyncing(true);

    try {
      const idsToSync = calendarIds || selectedCalendarIds;
      
      if (idsToSync.length === 0) {
        toast.info('No calendars selected');
        setIsSyncing(false);
        return;
      }

      // Get events for the next 30 days
      const timeMin = new Date();
      timeMin.setHours(0, 0, 0, 0);
      const timeMax = new Date();
      timeMax.setDate(timeMax.getDate() + 30);

      const googleEvents: Event[] = [];
      let totalEvents = 0;

      // Fetch events only from selected calendars
      for (const calendarId of idsToSync) {
        const calendar = availableCalendars.find(c => c.id === calendarId);
        if (!calendar) continue;

        const events = await getEvents(calendarId, timeMin, timeMax);
        
        events.forEach((googleEvent: GoogleCalendarEvent) => {
          const localEvent = convertGoogleEventToLocal(
            googleEvent,
            calendar.summary,
            calendar.backgroundColor
          );
          if (localEvent) {
            googleEvents.push(localEvent);
            totalEvents++;
          }
        });
      }

      // Remove old Google Calendar events and add new ones
      const localEvents = eventStore.getEvents().filter(e => e.source !== 'google');
      eventStore.setEvents([...localEvents, ...googleEvents]);

      toast.success(`Successfully synced ${totalEvents} events from ${idsToSync.length} calendar(s)`);
    } catch (error) {
      console.error('Sync failed:', error);
      toast.error('Failed to sync Google Calendar events');
    } finally {
      setIsSyncing(false);
    }
  };

  if (!isInitialized) {
    return (
      <Button disabled className="bg-gray-400">
        Initializing...
      </Button>
    );
  }

  if (!isSignedIn) {
    return (
      <Button onClick={handleSignIn} className="bg-blue-500 hover:bg-blue-600 text-white w-full">
        🔐 Sign in to Google Calendar
      </Button>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Button
          onClick={() => handleSync()}
          disabled={isSyncing}
          className="bg-blue-500 hover:bg-blue-600 text-white flex-1"
        >
          {isSyncing ? "Syncing..." : "🔄 Sync"}
        </Button>
        <Button
          onClick={handleSignOut}
          variant="outline"
          size="sm"
        >
          Sign Out
        </Button>
      </div>
      
      <CalendarSelector
        calendars={availableCalendars}
        onSelectionChange={handleCalendarSelectionChange}
      />
    </div>
  );
}
