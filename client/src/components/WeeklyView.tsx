import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { eventStore, type Event } from "@/lib/eventStore";
import { AppointmentDialog } from "./AppointmentDialog";
import { SearchBar } from "./SearchBar";
import { GoogleCalendarSync } from "./GoogleCalendarSync";
import { CategoryFilter } from "./CategoryFilter";
import { EventTooltip } from "./EventTooltip";

export default function WeeklyView() {
  const [, setLocation] = useLocation();
  const [events, setEvents] = useState<Event[]>(eventStore.getEvents());
  const [draggingEvent, setDraggingEvent] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isSyncing, setIsSyncing] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogData, setDialogData] = useState<{ startTime: string; endTime: string; date: string } | undefined>();
  const [filteredCategories, setFilteredCategories] = useState<string[]>([]);

  useEffect(() => {
    const unsubscribe = eventStore.subscribe(() => {
      setEvents(eventStore.getEvents());
    });

    return () => unsubscribe();
  }, []);

  const getWeekDates = () => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1));
    
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      dates.push(date);
    }
    return dates;
  };

  const weekDates = getWeekDates();
  const weekLabel = `Week of ${weekDates[0].toLocaleDateString("en-US", { month: "long", day: "numeric" })} - ${weekDates[6].toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`;

  const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const hours = Array.from({ length: 18 }, (_, i) => i + 6); // 6am to 11pm

  const formatDateISO = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getEventDayIndex = (event: Event) => {
    if (!event.date) return 0;
    const eventDate = new Date(event.date);
    const dayOfWeek = eventDate.getDay();
    return dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  };

  const handleDayHeaderClick = (date: Date) => {
    // Navigate to daily view with the selected date
    setLocation(`/?date=${formatDateISO(date)}`);
  };

  const handleTimeSlotClick = (dayIdx: number, hour: number) => {
    const date = weekDates[dayIdx];
    const startTime = `${hour.toString().padStart(2, "0")}:00`;
    const endTime = `${(hour + 1).toString().padStart(2, "0")}:00`;
    
    setDialogData({
      startTime,
      endTime,
      date: formatDateISO(date),
    });
    setDialogOpen(true);
  };

  const handleSaveAppointment = (eventData: Omit<Event, "id">) => {
    const newEvent: Event = {
      ...eventData,
      id: Date.now().toString(),
    };
    eventStore.addEvent(newEvent);
  };

  const handleDragStart = (e: React.MouseEvent, eventId: string) => {
    const event = events.find(ev => ev.id === eventId);
    if (!event) return;
    
    setDraggingEvent(eventId);
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  const handleDragMove = (e: React.MouseEvent) => {
    if (!draggingEvent) return;
    e.preventDefault();
  };

  const handleDragEnd = (e: React.MouseEvent) => {
    if (!draggingEvent) return;
    
    const gridContainer = document.getElementById('weekly-grid');
    if (!gridContainer) return;
    
    const rect = gridContainer.getBoundingClientRect();
    const relativeX = e.clientX - rect.left - 100;
    const relativeY = e.clientY - rect.top - 60;
    
    const columnWidth = (rect.width - 100) / 7;
    const dayIndex = Math.floor(relativeX / columnWidth);
    const hourIndex = Math.floor(relativeY / 100);
    
    if (dayIndex >= 0 && dayIndex < 7 && hourIndex >= 0 && hourIndex < 18) {
      const newDate = weekDates[dayIndex];
      const newHour = hourIndex + 6;
      
      const event = events.find(ev => ev.id === draggingEvent);
      if (event) {
        const [startH, startM] = event.startTime.split(":").map(Number);
        const [endH, endM] = event.endTime.split(":").map(Number);
        const duration = (endH * 60 + endM) - (startH * 60 + startM);
        
        const newStartTime = `${newHour.toString().padStart(2, "0")}:00`;
        const newEndMinutes = newHour * 60 + duration;
        const newEndH = Math.floor(newEndMinutes / 60);
        const newEndM = newEndMinutes % 60;
        const newEndTime = `${newEndH.toString().padStart(2, "0")}:${newEndM.toString().padStart(2, "0")}`;
        
        eventStore.updateEvent(draggingEvent, {
          startTime: newStartTime,
          endTime: newEndTime,
          date: formatDateISO(newDate),
        });
      }
    }
    
    setDraggingEvent(null);
  };

  const syncGoogleCalendar = async () => {
    setIsSyncing(true);
    
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const googleEvents: Event[] = [
      {
        id: "gcal-1",
        title: "Morning Standup",
        startTime: "08:00",
        endTime: "08:30",
        color: "#4285f4",
        source: "google",
        date: formatDateISO(weekDates[0]),
        category: "Meeting",
      },
      {
        id: "gcal-2",
        title: "Lunch with Team",
        startTime: "12:00",
        endTime: "13:00",
        color: "#4285f4",
        source: "google",
        date: formatDateISO(weekDates[2]),
        category: "Social",
      },
      {
        id: "gcal-3",
        title: "Project Planning",
        startTime: "15:00",
        endTime: "16:30",
        color: "#4285f4",
        source: "google",
        date: formatDateISO(weekDates[4]),
        category: "Work",
      },
    ];
    
    const localEvents = events.filter(e => e.source !== "google");
    eventStore.setEvents([...localEvents, ...googleEvents]);
    setIsSyncing(false);
  };

  const handleSearchResultClick = (event: Event) => {
    if (event.date) {
      setLocation(`/?date=${event.date}`);
    }
  };

  return (
    <div 
      className="w-full h-full bg-white overflow-auto"
      onMouseMove={handleDragMove}
      onMouseUp={handleDragEnd}
    >
      <div className="relative mx-auto" style={{ width: "1620px", minHeight: "2160px", padding: "20px" }}>
        
        {/* Weekly Overview Button - Top */}
        <div
          className="absolute flex items-center justify-start bg-white border-2 border-gray-300 rounded-xl cursor-pointer hover:bg-gray-50 shadow-sm"
          style={{
            left: "20px",
            top: "20px",
            width: "300px",
            height: "70px",
            padding: "12px 20px",
          }}
          onClick={() => setLocation("/")}
        >
          <div className="flex items-center gap-4">
            <div 
              className="flex flex-col items-center justify-center bg-white border border-gray-400 rounded-md shadow-sm" 
              style={{ width: "48px", height: "48px" }}
            >
              <div className="text-[10px] text-gray-600 font-medium leading-none">NOV</div>
              <div className="text-red-600 font-bold text-2xl leading-none mt-0.5">17</div>
            </div>
            <span className="text-xl font-normal text-gray-800">Weekly Overview</span>
          </div>
        </div>

        {/* Search Bar */}
        <div className="absolute" style={{ left: "350px", top: "30px" }}>
          <SearchBar onResultClick={handleSearchResultClick} />
        </div>

        {/* Category Filter */}
        <div className="absolute" style={{ right: "220px", top: "30px" }}>
          <CategoryFilter onFilterChange={setFilteredCategories} />
        </div>

        {/* Google Calendar Sync Button */}
        <div className="absolute" style={{ right: "20px", top: "30px" }}>
          <GoogleCalendarSync />
        </div>

        {/* Title */}
        <div
          className="absolute font-bold text-center"
          style={{
            left: "50%",
            top: "100px",
            fontSize: "28px",
            transform: "translateX(-50%)",
          }}
        >
          {weekLabel}
        </div>

        {/* Grid Container */}
        <div 
          id="weekly-grid"
          className="absolute" 
          style={{ top: "150px", left: "20px", right: "20px" }}
        >
          
          {/* Time Column + Day Headers */}
          <div className="flex border-b-2 border-gray-300" style={{ height: "60px" }}>
            <div style={{ width: "100px" }} className="flex-shrink-0"></div>
            {dayNames.map((day, idx) => (
              <div 
                key={day}
                className="flex-1 text-center font-semibold border-l border-gray-300 flex flex-col justify-center cursor-pointer hover:bg-blue-50 transition-colors"
                onClick={() => handleDayHeaderClick(weekDates[idx])}
              >
                <div className="text-base">{day}</div>
                <div className="text-sm text-gray-600">{weekDates[idx].getDate()}</div>
              </div>
            ))}
          </div>

          {/* Time Grid */}
          <div className="relative">
            {hours.map((hour, idx) => {
              const time = `${hour.toString().padStart(2, "0")}:00`;
              
              return (
                <div key={hour} className="flex border-b border-gray-200" style={{ height: "100px" }}>
                  {/* Time Label */}
                  <div 
                    style={{ width: "100px" }} 
                    className="flex-shrink-0 pr-3 pt-1 text-right font-semibold text-gray-700"
                  >
                    {time}
                  </div>
                  
                  {/* Day Columns */}
                  {dayNames.map((day, dayIdx) => (
                    <div 
                      key={`${hour}-${dayIdx}`}
                      className="flex-1 border-l border-gray-300 relative hover:bg-blue-50 transition-colors cursor-pointer"
                      onClick={() => handleTimeSlotClick(dayIdx, hour)}
                    >
                      {/* Half-hour line */}
                      <div className="absolute top-1/2 left-0 right-0 border-t border-gray-100"></div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>

          {/* Events Overlay */}
          {events
            .filter(event => {
              // Filter by category if categories are selected
              if (filteredCategories.length > 0 && event.category) {
                return filteredCategories.includes(event.category);
              }
              // Show events without category if no filter is active
              return filteredCategories.length === 0 || !event.category;
            })
            .map((event) => {
            const [startH, startM] = event.startTime.split(":").map(Number);
            const [endH, endM] = event.endTime.split(":").map(Number);
            
            if (startH < 6 || startH >= 24) return null;
            
            const startMinutes = (startH - 6) * 60 + startM;
            const endMinutes = (endH - 6) * 60 + endM;
            const pixelsPerMinute = 100 / 60;
            
            const y = 60 + startMinutes * pixelsPerMinute;
            const height = (endMinutes - startMinutes) * pixelsPerMinute;
            
            const dayIdx = getEventDayIndex(event);
            const columnWidth = (1620 - 40 - 100) / 7;
            const x = 100 + dayIdx * columnWidth;
            
            return (
              <EventTooltip key={event.id} event={event}>
                <div
                  className="absolute rounded-md px-2 py-1 text-white text-xs overflow-hidden z-10 cursor-move group shadow-sm border border-white/20"
                  style={{
                    left: `${x + 2}px`,
                    top: `${y}px`,
                    width: `${columnWidth - 4}px`,
                    height: `${height}px`,
                    backgroundColor: event.color,
                    opacity: draggingEvent === event.id ? 0.7 : 1,
                  }}
                  onMouseDown={(e) => handleDragStart(e, event.id)}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="font-semibold truncate">{event.title}</div>
                  <div className="text-xs opacity-90">
                    {event.startTime} - {event.endTime}
                  </div>
                  {event.category && height > 50 && (
                    <div className="text-xs opacity-75 mt-0.5 truncate">📁 {event.category}</div>
                  )}
                  {event.source === "google" && height > 70 && (
                    <div className="text-xs opacity-75">📅 Google</div>
                  )}
                  {event.recurring && height > 90 && (
                    <div className="text-xs opacity-75">🔄 {event.recurring.frequency}</div>
                  )}
                </div>
              </EventTooltip>
            );
          })}
        </div>

        {/* Weekly Overview Button - Bottom */}
        <div
          className="absolute flex items-center justify-start bg-white border-2 border-gray-300 rounded-xl cursor-pointer hover:bg-gray-50 shadow-sm"
          style={{
            left: "50%",
            bottom: "40px",
            transform: "translateX(-50%)",
            width: "300px",
            height: "70px",
            padding: "12px 20px",
          }}
          onClick={() => setLocation("/")}
        >
          <div className="flex items-center gap-4">
            <div 
              className="flex flex-col items-center justify-center bg-white border border-gray-400 rounded-md shadow-sm" 
              style={{ width: "48px", height: "48px" }}
            >
              <div className="text-[10px] text-gray-600 font-medium leading-none">NOV</div>
              <div className="text-red-600 font-bold text-2xl leading-none mt-0.5">17</div>
            </div>
            <span className="text-xl font-normal text-gray-800">Weekly Overview</span>
          </div>
        </div>
      </div>

      <AppointmentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSave={handleSaveAppointment}
        initialData={dialogData}
      />
    </div>
  );
}
