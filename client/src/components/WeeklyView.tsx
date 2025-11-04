import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { eventStore, type Event } from "@/lib/eventStore";

export default function WeeklyView() {
  const [, setLocation] = useLocation();
  const [events, setEvents] = useState<Event[]>(eventStore.getEvents());
  const [draggingEvent, setDraggingEvent] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isSyncing, setIsSyncing] = useState(false);

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
    return date.toISOString().split('T')[0];
  };

  const getEventDayIndex = (event: Event) => {
    if (!event.date) return 0; // Default to Monday if no date
    const eventDate = new Date(event.date);
    const dayOfWeek = eventDate.getDay();
    return dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Convert Sunday=0 to index 6
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
    const relativeX = e.clientX - rect.left - 100; // Subtract time column width
    const relativeY = e.clientY - rect.top - 60; // Subtract header height
    
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
        date: formatDateISO(weekDates[0]), // Monday
      },
      {
        id: "gcal-2",
        title: "Lunch with Team",
        startTime: "12:00",
        endTime: "13:00",
        color: "#4285f4",
        source: "google",
        date: formatDateISO(weekDates[2]), // Wednesday
      },
      {
        id: "gcal-3",
        title: "Project Planning",
        startTime: "15:00",
        endTime: "16:30",
        color: "#4285f4",
        source: "google",
        date: formatDateISO(weekDates[4]), // Friday
      },
    ];
    
    const localEvents = events.filter(e => e.source !== "google");
    eventStore.setEvents([...localEvents, ...googleEvents]);
    setIsSyncing(false);
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

        {/* Google Calendar Sync Button */}
        <div className="absolute" style={{ right: "20px", top: "30px" }}>
          <Button
            onClick={syncGoogleCalendar}
            disabled={isSyncing}
            className="bg-blue-500 hover:bg-blue-600 text-white"
          >
            {isSyncing ? "Syncing..." : "🔄 Sync Google Calendar"}
          </Button>
        </div>

        {/* Title */}
        <div
          className="absolute font-bold text-center"
          style={{
            left: "50%",
            top: "45px",
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
          style={{ top: "120px", left: "20px", right: "20px" }}
        >
          
          {/* Time Column + Day Headers */}
          <div className="flex border-b-2 border-gray-300" style={{ height: "60px" }}>
            <div style={{ width: "100px" }} className="flex-shrink-0"></div>
            {dayNames.map((day, idx) => (
              <div 
                key={day}
                className="flex-1 text-center font-semibold border-l border-gray-300 flex flex-col justify-center"
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
                      className="flex-1 border-l border-gray-300 relative hover:bg-blue-50 transition-colors"
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
          {events.map((event) => {
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
              <div
                key={event.id}
                className="absolute rounded px-2 py-1 text-white text-xs overflow-hidden z-10 cursor-move group"
                style={{
                  left: `${x + 2}px`,
                  top: `${y}px`,
                  width: `${columnWidth - 4}px`,
                  height: `${height}px`,
                  backgroundColor: event.color,
                  opacity: draggingEvent === event.id ? 0.7 : 1,
                }}
                onMouseDown={(e) => handleDragStart(e, event.id)}
              >
                <div className="font-semibold">{event.title}</div>
                <div className="text-xs opacity-90">
                  {event.startTime} - {event.endTime}
                </div>
                {event.source === "google" && (
                  <div className="text-xs opacity-75">📅 Google</div>
                )}
              </div>
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
    </div>
  );
}
