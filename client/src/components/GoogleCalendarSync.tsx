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
  const [syncStatus, setSyncStatus] = useState<Record<string, { status: 'pending' | 'syncing' | 'success' | 'error', error?: string, eventCount?: number }>>({});
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  const syncMutation = trpc.appointments.syncFromGoogle.useMutation();

  useEffect(() => {
    initGoogleCalendar();
  }, []);
  
  // Automatic background sync every 15 minutes
  useEffect(() => {
    if (!isSignedIn || availableCalendars.length === 0) return;
    
    const syncInterval = setInterval(() => {
      console.log('Auto-syncing calendars...');
      handleSync();
    }, 15 * 60 * 1000); // 15 minutes in milliseconds
    
    return () => clearInterval(syncInterval);
  }, [isSignedIn, availableCalendars, selectedCalendarIds]);

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
    // Sync all selected calendars
    const calendarsToSync = selectedCalendarIds.length > 0 
      ? selectedCalendarIds 
      : availableCalendars.map(c => c.id);
    
    if (calendarsToSync.length === 0) {
      toast.error("No calendars selected");
      return;
    }

    setIsSyncing(true);
    setSyncProgress({ current: 0, total: calendarsToSync.length, calendar: "" });
    
    // Initialize sync status for all calendars
    const initialStatus: Record<string, { status: 'pending' | 'syncing' | 'success' | 'error', error?: string, eventCount?: number }> = {};
    calendarsToSync.forEach(id => {
      initialStatus[id] = { status: 'pending' };
    });
    setSyncStatus(initialStatus);
    
    try {
      const eventMap = new Map<string, any>();
      
      // Process only holidays calendar
      for (let i = 0; i < calendarsToSync.length; i++) {
        const calendarId = calendarsToSync[i];
        const calendar = availableCalendars.find(c => c.id === calendarId);
        if (!calendar) continue;

        setSyncProgress({ current: i + 1, total: calendarsToSync.length, calendar: calendar.summary });
        toast.info(`Syncing ${calendar.summary} (${i + 1}/${calendarsToSync.length})...`);
        
        // Update status to syncing
        setSyncStatus(prev => ({ ...prev, [calendarId]: { status: 'syncing' } }));

        try {
          // Fetch 2015-2030 events (full 15-year range)
          const timeMin = new Date('2015-01-01');
          const timeMax = new Date('2030-12-31T23:59:59');
          
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

              // For all-day events (date-only strings), parse in local timezone
              // to avoid UTC midnight being converted to previous day in EST
              let startDate: Date;
              let endDate: Date;
              let dateStr: string;
              
              if (googleEvent.start.date && !googleEvent.start.dateTime) {
                // All-day event: use date string directly
                dateStr = googleEvent.start.date;
                startDate = new Date(dateStr + 'T00:00:00');
                endDate = new Date((googleEvent.end.date || dateStr) + 'T00:00:00');
              } else {
                // Timed event: parse normally
                startDate = new Date(startDateTime);
                endDate = new Date(endDateTime);
                dateStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`;
              }
              
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
          
          // Update status to success
          setSyncStatus(prev => ({ ...prev, [calendarId]: { status: 'success', eventCount: events.length } }));
          
        } catch (calendarError: any) {
          console.error(`Error syncing ${calendar.summary}:`, calendarError);
          const errorMsg = calendarError?.message || 'Unknown error';
          toast.error(`Failed to sync ${calendar.summary} - continuing with others`);
          
          // Update status to error
          setSyncStatus(prev => ({ ...prev, [calendarId]: { status: 'error', error: errorMsg } }));
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
          setLastSyncTime(new Date());
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
            // Small delay to ensure token is fully set
            await new Promise(resolve => setTimeout(resolve, 500));
            await loadCalendars();
            toast.success("Successfully signed in to Google Calendar");
          } catch (error: any) {
            console.error('Sign in error:', error);
            
            // Show detailed error message
            const errorMsg = error?.message || "Failed to sign in to Google Calendar";
            
            // For access_denied errors, show a more helpful message
            if (errorMsg.includes('access_denied') || errorMsg.includes('OAuth Error')) {
              toast.error(errorMsg, {
                duration: 15000, // Show for 15 seconds
                style: { whiteSpace: 'pre-line', maxWidth: '500px' } // Preserve line breaks
              });
            } else {
              toast.error(errorMsg);
            }
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
        {lastSyncTime && (
          <p className="text-xs text-muted-foreground mt-1">
            Last synced: {lastSyncTime.toLocaleString()}
          </p>
        )}
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
      
      {/* Sync Status Indicators */}
      {Object.keys(syncStatus).length > 0 && (
        <div className="text-sm space-y-2">
          <div className="font-semibold">Sync Status:</div>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {availableCalendars
              .filter(cal => syncStatus[cal.id])
              .map(cal => {
                const status = syncStatus[cal.id];
                return (
                  <div key={cal.id} className="flex items-center justify-between text-xs p-2 rounded bg-muted/50">
                    <span className="truncate flex-1">{cal.summary}</span>
                    <div className="flex items-center gap-2 ml-2">
                      {status.status === 'pending' && (
                        <span className="text-gray-500">⏳ Pending</span>
                      )}
                      {status.status === 'syncing' && (
                        <span className="text-blue-500">🔄 Syncing...</span>
                      )}
                      {status.status === 'success' && (
                        <span className="text-green-600">✓ {status.eventCount} events</span>
                      )}
                      {status.status === 'error' && (
                        <span className="text-red-600" title={status.error}>✗ Failed</span>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <Button
          onClick={() => handleSync()}
          disabled={isSyncing}
          className="bg-blue-500 hover:bg-blue-600 text-white flex-1"
        >
          {isSyncing ? "Syncing..." : "🔄 Sync All Calendars (2015-2030)"}
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
