import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { eventStore, type Event } from "@/lib/eventStore";
import { AppointmentDialog } from "./AppointmentDialog";
import { AdvancedSearch } from "./AdvancedSearch";
import GoogleCalendarSync from "./GoogleCalendarSync";
import { CategoryFilter } from "./CategoryFilter";
import { EventTooltip } from "./EventTooltip";
import { AppointmentDetailsModal } from "./AppointmentDetailsModal";
import { trpc } from "@/lib/trpc";

export default function WeeklyView() {
  const [, setLocation] = useLocation();
  const [events, setEvents] = useState<Event[]>(eventStore.getEvents());
  const [draggingEvent, setDraggingEvent] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [selectedAppointment, setSelectedAppointment] = useState<Event | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogData, setDialogData] = useState<{ startTime: string; endTime: string; date: string } | undefined>();
  const [filteredCategories, setFilteredCategories] = useState<string[]>([]);

  // Fetch appointments from database for current week
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
  const formatDateISO = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const { data: dbAppointments, isLoading } = trpc.appointments.getByDateRange.useQuery({
    startDate: formatDateISO(weekDates[0]),
    endDate: formatDateISO(weekDates[6]),
  });

  // Merge database appointments with local events
  useEffect(() => {
    if (dbAppointments) {
      // Convert DB appointments to Event format
      const dbEvents: Event[] = dbAppointments.map((apt: any) => {
        // Check if this is a SimplePractice calendar (appointments with lock emoji)
        const isSimplePractice = apt.calendarId?.startsWith('6ac7ac649a345a77') || apt.calendarId?.startsWith('79dfcb90ce59b1b0');
        const isHoliday = apt.calendarId?.includes('holiday');
        
        return {
          id: apt.googleEventId || `db-${apt.id}`,
          title: apt.title,
          startTime: new Date(apt.startTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
          endTime: new Date(apt.endTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
          color: isHoliday ? '#34a853' : isSimplePractice ? '#6495ED' : apt.category === 'Work' ? '#4285f4' : apt.category === 'Meeting' ? '#ea4335' : '#34a853',
          source: 'google',
          date: apt.date,
          category: apt.category || 'Other',
          description: apt.description,
          calendarId: apt.calendarId,
          isSimplePractice,
          isHoliday,
        };
      });
      
      // Merge with local events
      const localEvents = eventStore.getEvents().filter(e => e.source !== 'google');
      setEvents([...localEvents, ...dbEvents]);
    }
  }, [dbAppointments]);

  useEffect(() => {
    const unsubscribe = eventStore.subscribe(() => {
      // Only update local events, keep DB events
      const localEvents = eventStore.getEvents().filter(e => e.source !== 'google');
      const googleEvents = events.filter(e => e.source === 'google');
      setEvents([...localEvents, ...googleEvents]);
    });

    return () => unsubscribe();
  }, [events]);

  const weekLabel = `Week of ${weekDates[0].toLocaleDateString("en-US", { month: "long", day: "numeric" })} - ${weekDates[6].toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`;

  const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const hours = Array.from({ length: 18 }, (_, i) => i + 6); // 6am to 11pm

  const getEventDayIndex = (event: Event) => {
    if (!event.date) return 0;
    // Parse date as local date to avoid timezone issues
    const [year, month, day] = event.date.split('-').map(Number);
    const eventDate = new Date(year, month - 1, day);
    const dayOfWeek = eventDate.getDay();
    return dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  };

  const handleDayHeaderClick = (date: Date) => {
    // Navigate to daily view with the selected date
    setLocation(`/daily?date=${formatDateISO(date)}`);
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
          className="absolute inline-flex items-center gap-2 bg-[#f3f3f3] border border-[#d0d0d0] rounded-lg cursor-pointer hover:bg-[#ececec] hover:shadow-md transition-all duration-200 hover:-translate-y-px"
          style={{
            left: "20px",
            top: "20px",
            padding: "6px 14px",
            boxShadow: "0 1px 2px rgba(0, 0, 0, 0.1)",
          }}
          onClick={() => setLocation("/daily")}
        >
          <svg className="w-5 h-5 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
            <rect x="3" y="5" width="18" height="16" rx="2" ry="2" fill="#f9f9f9" stroke="#b46b5e" strokeWidth="1.2"/>
            <rect x="3" y="5" width="18" height="3" rx="2" ry="2" fill="#b46b5e"/>
            <line x1="7" y1="3" x2="7" y2="7" stroke="#b46b5e" strokeWidth="1.4" strokeLinecap="round"/>
            <line x1="17" y1="3" x2="17" y2="7" stroke="#b46b5e" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
          <span className="font-medium text-base text-[#2e2e2e]" style={{ fontFamily: "Georgia, serif" }}>Daily View</span>
        </div>

        {/* Search Bar */}
        <div className="absolute" style={{ left: "350px", top: "30px" }}>
          <AdvancedSearch />
        </div>

        {/* Category Filter */}
        <div className="absolute" style={{ right: "220px", top: "30px" }}>
          <CategoryFilter onFilterChange={setFilteredCategories} />
        </div>

        {/* Google Calendar Sync Button */}
        <div className="absolute" style={{ right: "20px", top: "-60px" }}>
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
                  className="absolute rounded-md px-2 py-1 text-xs overflow-hidden z-10 cursor-move group shadow-sm"
                  style={{
                    left: `${x + 2}px`,
                    top: `${y}px`,
                    width: `${columnWidth - 4}px`,
                    height: `${height}px`,
                    backgroundColor: (event as any).isSimplePractice ? '#F5F5F0' : event.color,
                    color: (event as any).isSimplePractice ? '#333' : 'white',
                    border: (event as any).isSimplePractice ? '1.5px solid #6495ED' : '1px solid rgba(255,255,255,0.2)',
                    borderLeftWidth: (event as any).isSimplePractice ? '4px' : '1.5px',
                    borderLeftColor: (event as any).isSimplePractice ? '#6495ED' : undefined,
                    opacity: draggingEvent === event.id ? 0.7 : 1,
                  }}
                  onMouseDown={(e) => handleDragStart(e, event.id)}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedAppointment(event);
                    setModalOpen(true);
                  }}
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

        {/* Daily View Button - Bottom */}
        <div
          className="absolute inline-flex items-center gap-2 bg-[#f3f3f3] border border-[#d0d0d0] rounded-lg cursor-pointer hover:bg-[#ececec] hover:shadow-md transition-all duration-200 hover:-translate-y-px"
          style={{
            left: "50%",
            bottom: "40px",
            transform: "translateX(-50%)",
            padding: "6px 14px",
            boxShadow: "0 1px 2px rgba(0, 0, 0, 0.1)",
          }}
          onClick={() => setLocation("/daily")}
        >
          <svg className="w-5 h-5 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
            <rect x="3" y="5" width="18" height="16" rx="2" ry="2" fill="#f9f9f9" stroke="#b46b5e" strokeWidth="1.2"/>
            <rect x="3" y="5" width="18" height="3" rx="2" ry="2" fill="#b46b5e"/>
            <line x1="7" y1="3" x2="7" y2="7" stroke="#b46b5e" strokeWidth="1.4" strokeLinecap="round"/>
            <line x1="17" y1="3" x2="17" y2="7" stroke="#b46b5e" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
          <span className="font-medium text-base text-[#2e2e2e]" style={{ fontFamily: "Georgia, serif" }}>Daily View</span>
        </div>
      </div>

      <AppointmentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSave={handleSaveAppointment}
        initialData={dialogData}
      />

      <AppointmentDetailsModal
        appointment={selectedAppointment}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </div>
  );
}
