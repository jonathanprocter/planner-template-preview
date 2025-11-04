import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  initGoogleCalendar,
  signIn,
  signOut,
  isUserSignedIn,
  getCalendarList,
  getEvents,
  getColorForEvent,
  type GoogleCalendarEvent,
} from "@/lib/googleCalendar";
import { trpc } from "@/lib/trpc";
import { CalendarSelector, type CalendarInfo } from "./CalendarSelector";
import { toast } from "sonner";

export function GoogleCalendarSync() {
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [availableCalendars, setAvailableCalendars] = useState<CalendarInfo[]>([]);
  const [selectedCalendarIds, setSelectedCalendarIds] = useState<string[]>([]);

  const syncMutation = trpc.appointments.syncFromGoogle.useMutation({
    onSuccess: (result) => {
      toast.success(`Synced ${result.synced} events, deleted ${result.deleted} old events`);
      // Reload to refresh from database
      window.location.reload();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to sync calendar");
      setIsSyncing(false);
    },
  });

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
        selected: true,
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
      toast.success('Successfully signed out from Google Calendar');
      window.location.reload();
    } catch (error) {
      console.error('Sign out failed:', error);
      toast.error('Failed to sign out');
    }
  };

  const handleCalendarSelectionChange = (selectedIds: string[]) => {
    setSelectedCalendarIds(selectedIds);
    handleSync(selectedIds);
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

      // Fetch events from 2015-2030 (15 year range)
      const timeMin = new Date("2015-01-01");
      const timeMax = new Date("2030-12-31");

      const allEvents: Array<{
        id: string;
        calendarId: string;
        title: string;
        description?: string;
        startTime: Date;
        endTime: Date;
        date: string;
        category?: string;
        recurrence?: string;
      }> = [];

      const eventMap = new Map<string, any>();

      // Fetch events from selected calendars
      for (const calendarId of idsToSync) {
        const calendar = availableCalendars.find(c => c.id === calendarId);
        if (!calendar) continue;

        const events = await getEvents(calendarId, timeMin, timeMax);
        
        events.forEach((googleEvent: GoogleCalendarEvent) => {
          const startDateTime = googleEvent.start.dateTime || googleEvent.start.date;
          const endDateTime = googleEvent.end.dateTime || googleEvent.end.date;

          if (!startDateTime || !endDateTime) return;

          const startDate = new Date(startDateTime);
          const endDate = new Date(endDateTime);
          const date = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`;

          // Create unique key for deduplication
          const eventKey = `${googleEvent.summary}|${date}|${startDate.toISOString()}|${endDate.toISOString()}`;
          
          if (!eventMap.has(eventKey)) {
            let recurrence = undefined;
            if (googleEvent.recurrence && googleEvent.recurrence.length > 0) {
              const rrule = googleEvent.recurrence[0];
              if (rrule.includes('FREQ=DAILY')) {
                recurrence = JSON.stringify({ frequency: 'daily' });
              } else if (rrule.includes('FREQ=WEEKLY')) {
                recurrence = JSON.stringify({ frequency: 'weekly' });
              } else if (rrule.includes('FREQ=MONTHLY')) {
                recurrence = JSON.stringify({ frequency: 'monthly' });
              }
            }

            eventMap.set(eventKey, {
              id: googleEvent.id,
              calendarId: calendarId,
              title: googleEvent.summary || 'Untitled Event',
              description: googleEvent.description,
              startTime: startDate,
              endTime: endDate,
              date,
              category: calendar.summary,
              recurrence,
            });
          }
        });
      }

      const uniqueEvents = Array.from(eventMap.values());
      
      // Sync to database
      await syncMutation.mutateAsync({ events: uniqueEvents });
    } catch (error) {
      console.error('Sync failed:', error);
      toast.error('Failed to sync Google Calendar events');
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
          {isSyncing ? "Syncing..." : "🔄 Sync Calendar (2015-2030)"}
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
