import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { initGoogleCalendar, getCalendarList, getEvents, signIn, signOut, type GoogleCalendarEvent } from "@/lib/googleCalendar";
import { trpc } from "@/lib/trpc";
import { CalendarSelector } from "./CalendarSelector";

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export default function GoogleCalendarSync() {
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [availableCalendars, setAvailableCalendars] = useState<Array<{ id: string; summary: string; selected: boolean }>>([]);
  const [selectedCalendarIds, setSelectedCalendarIds] = useState<string[]>([]);
  const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0, calendar: "" });

  const syncMutation = trpc.appointments.syncFromGoogle.useMutation();

  useEffect(() => {
    initGoogleCalendar();
  }, []);

  const loadCalendars = async () => {
    try {
      const calendars = await getCalendarList();
      const calendarsWithSelection = calendars.map((c: any) => ({ ...c, selected: true }));
      setAvailableCalendars(calendarsWithSelection);
      // Auto-select all calendars by default
      setSelectedCalendarIds(calendars.map((c: any) => c.id));
    } catch (error) {
      console.error("Error loading calendars:", error);
      toast.error("Failed to load calendars");
    }
  };

  const handleSync = async () => {
    // Filter to only Holidays calendar for testing
    const holidaysCalendar = availableCalendars.find(cal => 
      cal.summary.toLowerCase().includes('holiday')
    );
    
    if (!holidaysCalendar) {
      toast.error("Holidays calendar not found");
      return;
    }
    
    const calendarsToSync = [holidaysCalendar.id];

    setIsSyncing(true);
    setSyncProgress({ current: 0, total: calendarsToSync.length, calendar: "" });
    
    try {
      const eventMap = new Map<string, any>();
      
      // Process only holidays calendar
      for (let i = 0; i < calendarsToSync.length; i++) {
        const calendarId = calendarsToSync[i];
        const calendar = availableCalendars.find(c => c.id === calendarId);
        if (!calendar) continue;

        setSyncProgress({ current: i + 1, total: calendarsToSync.length, calendar: calendar.summary });
        toast.info(`Syncing ${calendar.summary} (${i + 1}/${calendarsToSync.length})...`);

        try {
          // Fetch only 2025 events
          const timeMin = new Date('2025-01-01');
          const timeMax = new Date('2025-12-31T23:59:59');
          
          // Add 1 second delay before API call
          await delay(1000);
          
          const events = await getEvents(calendarId, timeMin, timeMax);
          
          toast.success(`Fetched ${events.length} events from ${calendar.summary}`);
          
          // Process events in batches of 50
          const batchSize = 50;
          for (let j = 0; j < events.length; j += batchSize) {
            const batch = events.slice(j, Math.min(j + batchSize, events.length));
            
            batch.forEach((googleEvent: GoogleCalendarEvent) => {
              const startDateTime = googleEvent.start.dateTime || googleEvent.start.date;
              const endDateTime = googleEvent.end.dateTime || googleEvent.end.date;
              
              if (!startDateTime || !endDateTime) return;

              const startDate = new Date(startDateTime);
              const endDate = new Date(endDateTime);
              
              // Format date as YYYY-MM-DD in local timezone
              const dateStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`;
              
              const startHour = startDate.getHours();
              const startMinute = startDate.getMinutes();
              const endHour = endDate.getHours();
              const endMinute = endDate.getMinutes();

              // Create unique key for deduplication
              const eventKey = `${googleEvent.summary}-${dateStr}-${startHour}:${startMinute}`;
              
              // Only add if not already in map (deduplication)
              if (!eventMap.has(eventKey)) {
                const category = googleEvent.colorId ? 
                  ['work', 'personal', 'meeting', 'other'][parseInt(googleEvent.colorId) % 4] as 'work' | 'personal' | 'meeting' | 'other' : 
                  'other';

                const recurrence = googleEvent.recurrence ? {
                  frequency: 'weekly' as const,
                  interval: 1,
                  endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
                } : undefined;

                eventMap.set(eventKey, {
                  id: googleEvent.id,
                  calendarId: calendarId,
                  title: googleEvent.summary || 'Untitled',
                  date: dateStr,
                  startTime: startDate,
                  endTime: endDate,
                  description: googleEvent.description || '',
                  location: googleEvent.location || '',
                  calendar: calendar.summary,
                  category,
                  recurrence: recurrence ? JSON.stringify(recurrence) : undefined,
                });
              }
            });
            
            // Add 500ms delay between batches
            if (j + batchSize < events.length) {
              await delay(500);
            }
          }
          
        } catch (calendarError) {
          console.error(`Error syncing ${calendar.summary}:`, calendarError);
          toast.error(`Failed to sync ${calendar.summary} - continuing with others`);
        }
        
        // Add 3 second delay between calendars to prevent overload
        if (i < calendarsToSync.length - 1) {
          toast.info("Waiting before next calendar...");
          await delay(3000);
        }
      }

      const uniqueEvents = Array.from(eventMap.values());
      
      // Sync to database with retry logic
      let retries = 3;
      while (retries > 0) {
        try {
          toast.info(`Saving ${uniqueEvents.length} unique events to database...`);
          await syncMutation.mutateAsync({ events: uniqueEvents });
          toast.success(`Successfully synced ${uniqueEvents.length} appointments!`);
          break;
        } catch (dbError) {
          retries--;
          if (retries > 0) {
            toast.warning(`Database save failed, retrying... (${retries} attempts left)`);
            await delay(2000);
          } else {
            throw dbError;
          }
        }
      }
      
    } catch (error) {
      console.error("Sync error:", error);
      toast.error("Failed to complete sync");
    } finally {
      setIsSyncing(false);
      setSyncProgress({ current: 0, total: 0, calendar: "" });
    }
  };

  const handleSignOut = async () => {
    await signOut();
    setIsSignedIn(false);
    setAvailableCalendars([]);
    setSelectedCalendarIds([]);
    toast.success("Signed out successfully");
  };

  if (!isSignedIn) {
    return (
      <div className="p-4 border rounded-lg">
        <h3 className="font-semibold mb-2">Google Calendar Sync</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Sign in to sync your Google Calendar events
        </p>
        <Button onClick={async () => {
          await initGoogleCalendar();
          try {
            await signIn();
            setIsSignedIn(true);
            await loadCalendars();
          } catch (error) {
            console.error('Sign in error:', error);
          }
        }} className="w-full">
          Sign in to Google Calendar
        </Button>
      </div>
    );
  }

  return (
    <div className="p-4 border rounded-lg space-y-4">
      <div>
        <h3 className="font-semibold mb-2">Google Calendar Sync</h3>
        <p className="text-sm text-muted-foreground">
          Connected to Google Calendar
        </p>
      </div>

      {availableCalendars.length > 0 && (
        <CalendarSelector
          calendars={availableCalendars}
          onSelectionChange={setSelectedCalendarIds}
        />
      )}

      {isSyncing && syncProgress.total > 0 && (
        <div className="text-sm space-y-1">
          <div className="flex justify-between">
            <span>Progress:</span>
            <span>{syncProgress.current} / {syncProgress.total}</span>
          </div>
          {syncProgress.calendar && (
            <div className="text-muted-foreground">
              Syncing: {syncProgress.calendar}
            </div>
          )}
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(syncProgress.current / syncProgress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <Button
          onClick={() => handleSync()}
          disabled={isSyncing}
          className="bg-blue-500 hover:bg-blue-600 text-white flex-1"
        >
          {isSyncing ? "Syncing..." : "🔄 Sync Holidays (2025)"}
        </Button>
        <Button
          onClick={handleSignOut}
          variant="outline"
          disabled={isSyncing}
        >
          Sign Out
        </Button>
      </div>
    </div>
  );
}
