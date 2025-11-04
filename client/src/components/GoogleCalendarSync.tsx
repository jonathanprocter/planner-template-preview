import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  initGoogleCalendar,
  signIn,
  signOut,
  isUserSignedIn,
  getAllCalendarEvents,
  getColorForEvent,
  type GoogleCalendarEvent,
} from "@/lib/googleCalendar";
import { eventStore, type Event } from "@/lib/eventStore";
import { toast } from "sonner";

export function GoogleCalendarSync() {
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

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

  const handleSignIn = async () => {
    try {
      await signIn();
      setIsSignedIn(true);
      toast.success('Successfully signed in to Google Calendar');
    } catch (error) {
      console.error('Sign in failed:', error);
      toast.error('Failed to sign in to Google Calendar');
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      setIsSignedIn(false);
      toast.success('Successfully signed out from Google Calendar');
    } catch (error) {
      console.error('Sign out failed:', error);
      toast.error('Failed to sign out');
    }
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

  const handleSync = async () => {
    if (!isSignedIn) {
      toast.error('Please sign in to Google Calendar first');
      return;
    }

    setIsSyncing(true);

    try {
      // Get events for the next 30 days
      const timeMin = new Date();
      timeMin.setHours(0, 0, 0, 0);
      const timeMax = new Date();
      timeMax.setDate(timeMax.getDate() + 30);

      const allCalendarData = await getAllCalendarEvents(timeMin, timeMax);

      const googleEvents: Event[] = [];
      let totalEvents = 0;

      allCalendarData.forEach(({ calendarName, events, backgroundColor }: any) => {
        events.forEach((googleEvent: GoogleCalendarEvent) => {
          const localEvent = convertGoogleEventToLocal(
            googleEvent,
            calendarName,
            backgroundColor
          );
          if (localEvent) {
            googleEvents.push(localEvent);
            totalEvents++;
          }
        });
      });

      // Remove old Google Calendar events and add new ones
      const localEvents = eventStore.getEvents().filter(e => e.source !== 'google');
      eventStore.setEvents([...localEvents, ...googleEvents]);

      toast.success(`Successfully synced ${totalEvents} events from ${allCalendarData.length} calendars`);
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
      <Button onClick={handleSignIn} className="bg-blue-500 hover:bg-blue-600 text-white">
        🔐 Sign in to Google Calendar
      </Button>
    );
  }

  return (
    <div className="flex gap-2">
      <Button
        onClick={handleSync}
        disabled={isSyncing}
        className="bg-blue-500 hover:bg-blue-600 text-white"
      >
        {isSyncing ? "Syncing..." : "🔄 Sync Google Calendar"}
      </Button>
      <Button
        onClick={handleSignOut}
        variant="outline"
        className="text-sm"
      >
        Sign Out
      </Button>
    </div>
  );
}
