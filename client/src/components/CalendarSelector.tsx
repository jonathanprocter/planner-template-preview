import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Settings } from "lucide-react";

export interface CalendarInfo {
  id: string;
  summary: string;
  backgroundColor?: string;
  selected: boolean;
}

interface CalendarSelectorProps {
  calendars: CalendarInfo[];
  onSelectionChange: (selectedCalendarIds: string[]) => void;
}

export function CalendarSelector({ calendars, onSelectionChange }: CalendarSelectorProps) {
  const [localCalendars, setLocalCalendars] = useState<CalendarInfo[]>(calendars);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setLocalCalendars(calendars);
  }, [calendars]);

  const handleToggle = (calendarId: string) => {
    const updated = localCalendars.map(cal =>
      cal.id === calendarId ? { ...cal, selected: !cal.selected } : cal
    );
    setLocalCalendars(updated);
  };

  const handleApply = () => {
    const selectedIds = localCalendars.filter(cal => cal.selected).map(cal => cal.id);
    onSelectionChange(selectedIds);
    setOpen(false);
  };

  const handleSelectAll = () => {
    const updated = localCalendars.map(cal => ({ ...cal, selected: true }));
    setLocalCalendars(updated);
  };

  const handleDeselectAll = () => {
    const updated = localCalendars.map(cal => ({ ...cal, selected: false }));
    setLocalCalendars(updated);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Settings className="h-4 w-4" />
          Select Calendars
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Choose Calendars to Display</DialogTitle>
          <DialogDescription>
            Select which calendars you want to see in your planner.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleSelectAll}>
              Select All
            </Button>
            <Button variant="outline" size="sm" onClick={handleDeselectAll}>
              Deselect All
            </Button>
          </div>

          <div className="max-h-96 overflow-y-auto space-y-3">
            {localCalendars.map((calendar) => (
              <div
                key={calendar.id}
                className="flex items-center space-x-3 p-2 rounded hover:bg-gray-50"
              >
                <Checkbox
                  id={calendar.id}
                  checked={calendar.selected}
                  onCheckedChange={() => handleToggle(calendar.id)}
                />
                <label
                  htmlFor={calendar.id}
                  className="flex items-center gap-2 flex-1 cursor-pointer"
                >
                  {calendar.backgroundColor && (
                    <div
                      className="w-4 h-4 rounded"
                      style={{ backgroundColor: calendar.backgroundColor }}
                    />
                  )}
                  <span className="text-sm font-medium">{calendar.summary}</span>
                </label>
              </div>
            ))}
          </div>

          {localCalendars.length === 0 && (
            <div className="text-center text-gray-500 py-8">
              No calendars available. Sign in to Google Calendar first.
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleApply}>
              Apply
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
