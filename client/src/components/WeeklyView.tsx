import { useState, useEffect, useCallback, useMemo } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { eventStore, type Event } from "@/lib/eventStore";
import { AppointmentDialog } from "./AppointmentDialog";
import { AdvancedSearch } from "./AdvancedSearch";
import GoogleCalendarSync from "./GoogleCalendarSync";
import { CategoryFilter } from "./CategoryFilter";
import { ExportPDFButton } from "./ExportPDFButton";
import { EventTooltip } from "./EventTooltip";
import { AppointmentDetailsModal } from "./AppointmentDetailsModal";
import { trpc } from "@/lib/trpc";
import { isSignedIn } from "@/lib/googleCalendar";

// Get access token from gapi if available
function getAccessToken(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const gapi = (window as any).gapi;
    if (gapi && gapi.client) {
      const token = gapi.client.getToken();
      return token?.access_token;
    }
  } catch (error) {
    console.warn('Could not get access token:', error);
  }
  return undefined;
}

export default function WeeklyView() {
  const [, setLocation] = useLocation();
  const [events, setEvents] = useState<Event[]>(eventStore.getEvents());
  const [draggingEvent, setDraggingEvent] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [selectedAppointment, setSelectedAppointment] = useState<Event | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogData, setDialogData] = useState<{ startTime: string; endTime: string; date: string } | undefined>();
  const [filteredCategories, setFilteredCategories] = useState<string[]>([]);
  const [weekOffset, setWeekOffset] = useState(0);
  
  const updateMutation = trpc.appointments.updateAppointment.useMutation();
  const deleteMutation = trpc.appointments.deleteAppointment.useMutation();
  const createMutation = trpc.appointments.createAppointment.useMutation();
  const utils = trpc.useUtils();

  const getWeekDates = useCallback((offset: number = 0) => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1) + (offset * 7));
    
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      dates.push(date);
    }
    return dates;
  }, []);

  const goToPreviousWeek = () => setWeekOffset(prev => prev - 1);
  const goToNextWeek = () => setWeekOffset(prev => prev + 1);
  const goToCurrentWeek = () => setWeekOffset(0);

  const weekDates = useMemo(() => getWeekDates(weekOffset), [getWeekDates, weekOffset]);
  
  const formatDateISO = useCallback((date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  const { data: dbAppointments, isLoading } = trpc.appointments.getByDateRange.useQuery({
    startDate: formatDateISO(weekDates[0]),
    endDate: formatDateISO(weekDates[6]),
  });

  const { data: dailyNotes } = trpc.dailyNotes.getByDateRange.useQuery({
    startDate: formatDateISO(weekDates[0]),
    endDate: formatDateISO(weekDates[6]),
  });

  const [editingNoteDate, setEditingNoteDate] = useState<string | null>(null);
  const [noteContent, setNoteContent] = useState<Record<string, string>>({});
  const upsertNoteMutation = trpc.dailyNotes.upsert.useMutation();

  useEffect(() => {
    if (dailyNotes) {
      const notesMap: Record<string, string> = {};
      dailyNotes.forEach((note: any) => {
        notesMap[note.date] = note.content || '';
      });
      setNoteContent(notesMap);
    }
  }, [dailyNotes]);

  useEffect(() => {
    if (dbAppointments) {
      const dbEvents: Event[] = dbAppointments.map((apt: any) => {
        const isSimplePractice = apt.calendarId?.startsWith('6ac7ac649a345a77') || apt.calendarId?.startsWith('79dfcb90ce59b1b0');
        const isHoliday = apt.calendarId?.includes('holiday');
        const isFlight = apt.title?.toLowerCase().includes('flight');
        const isMeeting = apt.title?.toLowerCase().includes('meeting');
        
        let color = '#4F5D67';
        if (isSimplePractice) color = '#243447';
        else if (isFlight) color = '#A63D3D';
        else if (isHoliday) color = '#3D5845';
        else if (isMeeting) color = '#9A7547';
        
        return {
          id: apt.googleEventId || `db-${apt.id}`,
          title: apt.title,
          startTime: new Date(apt.startTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/New_York' }),
          endTime: new Date(apt.endTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/New_York' }),
          color,
          source: 'google',
          date: apt.date,
          category: apt.category || 'Other',
          description: apt.description,
          calendarId: apt.calendarId,
          isSimplePractice,
          isHoliday,
          isFlight,
          isMeeting,
        };
      });
      
      const localEvents = eventStore.getEvents().filter(e => e.source !== 'google');
      setEvents([...localEvents, ...dbEvents]);
    }
  }, [dbAppointments]);

  useEffect(() => {
    const unsubscribe = eventStore.subscribe(() => {
      const localEvents = eventStore.getEvents().filter(e => e.source !== 'google');
      const googleEvents = events.filter(e => e.source === 'google');
      setEvents([...localEvents, ...googleEvents]);
    });

    return () => unsubscribe();
  }, [events]);

  // Calculate ISO week number
  const getISOWeek = useCallback((date: Date) => {
    const target = new Date(date.valueOf());
    const dayNr = (date.getDay() + 6) % 7;
    target.setDate(target.getDate() - dayNr + 3);
    const firstThursday = target.valueOf();
    target.setMonth(0, 1);
    if (target.getDay() !== 4) {
      target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
    }
    return 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
  }, []);

  const isoWeek = useMemo(() => getISOWeek(weekDates[0]), [weekDates, getISOWeek]);

  const weekLabel = useMemo(() => 
    `Week ${isoWeek}: ${weekDates[0].toLocaleDateString("en-US", { month: "long", day: "numeric" })} - ${weekDates[6].toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`,
    [weekDates, isoWeek]
  );

  const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const hours = Array.from({ length: 16 }, (_, i) => i + 6);

  const getEventDayIndex = useCallback((event: Event) => {
    if (!event.date) return 0;
    const [year, month, day] = event.date.split('-').map(Number);
    const eventDate = new Date(year, month - 1, day);
    const dayOfWeek = eventDate.getDay();
    return dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  }, []);

  const handleDayHeaderClick = useCallback((date: Date) => {
    setLocation(`/daily?date=${formatDateISO(date)}`);
  }, [setLocation, formatDateISO]);

  const handleTimeSlotClick = useCallback((dayIdx: number, hour: number) => {
    const date = weekDates[dayIdx];
    const startTime = `${hour.toString().padStart(2, "0")}:00`;
    const endTime = `${(hour + 1).toString().padStart(2, "0")}:00`;
    
    setDialogData({
      startTime,
      endTime,
      date: formatDateISO(date),
    });
    setDialogOpen(true);
  }, [weekDates, formatDateISO]);

  const handleSaveAppointment = useCallback(async (eventData: Omit<Event, "id">) => {
    const newEvent: Event = {
      ...eventData,
      id: Date.now().toString(),
    };
    eventStore.addEvent(newEvent);

    try {
      const accessToken = getAccessToken();
      await createMutation.mutateAsync({
        title: eventData.title,
        startTime: eventData.startTime,
        endTime: eventData.endTime,
        date: eventData.date || formatDateISO(new Date()),
        category: eventData.category,
        description: eventData.description,
        accessToken,
        calendarId: 'primary',
      });
      utils.appointments.getByDateRange.invalidate();
    } catch (error) {
      console.error('Failed to create appointment:', error);
      eventStore.deleteEvent(newEvent.id);
    }
  }, [createMutation, utils, formatDateISO]);

  const handleDragStart = useCallback((e: React.MouseEvent, eventId: string) => {
    const event = events.find(ev => ev.id === eventId);
    if (!event) return;
    
    setDraggingEvent(eventId);
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  }, [events]);

  const handleDragMove = useCallback((e: React.MouseEvent) => {
    if (!draggingEvent) return;
    e.preventDefault();
  }, [draggingEvent]);

  const handleDragEnd = useCallback(async (e: React.MouseEvent) => {
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
        const newDateISO = formatDateISO(newDate);
        
        eventStore.updateEvent(draggingEvent, {
          startTime: newStartTime,
          endTime: newEndTime,
          date: newDateISO,
        });
        
        if (event.source === 'google' && event.id) {
          try {
            const accessToken = getAccessToken();
            await updateMutation.mutateAsync({
              googleEventId: event.id,
              startTime: newStartTime,
              endTime: newEndTime,
              date: newDateISO,
              accessToken,
            });
            utils.appointments.getByDateRange.invalidate();
          } catch (error) {
            console.error('Failed to update appointment:', error);
            eventStore.updateEvent(draggingEvent, {
              startTime: event.startTime,
              endTime: event.endTime,
              date: event.date || '',
            });
          }
        }
      }
    }
    
    setDraggingEvent(null);
  }, [draggingEvent, events, weekDates, formatDateISO, updateMutation, utils]);

  const filteredEvents = useMemo(() => {
    return events.filter(event => {
      if (filteredCategories.length > 0 && event.category) {
        return filteredCategories.includes(event.category);
      }
      return filteredCategories.length === 0 || !event.category;
    });
  }, [events, filteredCategories]);

  return (
    <div 
      className="w-full h-full bg-white overflow-auto"
      onMouseMove={handleDragMove}
      onMouseUp={handleDragEnd}
    >
      <div className="relative mx-auto" style={{ width: "1620px", minHeight: "2160px", padding: "20px" }}>
        
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

        <div className="absolute" style={{ left: "350px", top: "30px" }}>
          <AdvancedSearch />
        </div>

        <div className="absolute" style={{ right: "220px", top: "30px" }}>
          <CategoryFilter onFilterChange={setFilteredCategories} />
        </div>

        <div className="absolute" style={{ right: "20px", top: "-60px" }}>
          <GoogleCalendarSync />
        </div>

        <div className="absolute" style={{ left: "20px", top: "100px" }}>
          <ExportPDFButton weekStart={weekDates[0]} weekEnd={weekDates[6]} />
        </div>

        <div className="absolute" style={{ left: "20px", top: "160px" }}>
          <div className="bg-white border border-gray-300 rounded-lg p-3 shadow-sm">
            <div className="text-xs font-semibold text-gray-700 mb-2">Color Legend</div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: '#243447' }}></div>
                <span className="text-xs text-gray-600">SimplePractice</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: '#3D5845' }}></div>
                <span className="text-xs text-gray-600">Holidays/Notes</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: '#4F5D67' }}></div>
                <span className="text-xs text-gray-600">Work</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: '#9A7547' }}></div>
                <span className="text-xs text-gray-600">Meetings</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: '#A63D3D' }}></div>
                <span className="text-xs text-gray-600">Flight Events</span>
              </div>
            </div>
          </div>
        </div>

        <div
          className="absolute font-bold text-center flex items-center gap-4"
          style={{
            left: "50%",
            top: "100px",
            fontSize: "28px",
            transform: "translateX(-50%)",
          }}
        >
          <Button
            variant="outline"
            size="sm"
            onClick={goToPreviousWeek}
            className="text-lg px-3 py-1"
          >
            ←
          </Button>
          <span>{weekLabel}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={goToNextWeek}
            className="text-lg px-3 py-1"
          >
            →
          </Button>
          {weekOffset !== 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={goToCurrentWeek}
              className="text-sm px-2 py-1"
            >
              Today
            </Button>
          )}
        </div>

        <div 
          id="weekly-grid"
          className="absolute" 
          style={{ top: "150px", left: "20px", right: "20px" }}
        >
          
          <div className="flex border-b-2 border-gray-300" style={{ height: "60px" }}>
            <div style={{ width: "100px" }} className="flex-shrink-0"></div>
            {dayNames.map((day, idx) => {
              const isToday = formatDateISO(weekDates[idx]) === formatDateISO(new Date());
              return (
                <div 
                  key={day}
                  className={`flex-1 text-center font-semibold border-l border-gray-300 flex flex-col justify-center cursor-pointer hover:bg-blue-50 transition-colors ${
                    isToday ? 'bg-blue-100' : ''
                  }`}
                  onClick={() => handleDayHeaderClick(weekDates[idx])}
                >
                  <div className={`text-base ${isToday ? 'text-blue-600' : ''}`}>{day}</div>
                  <div className={`text-sm ${isToday ? 'text-blue-500' : 'text-gray-600'}`}>
                    {weekDates[idx].getDate()}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex border-b border-gray-300" style={{ minHeight: "40px" }}>
            <div style={{ width: "100px" }} className="flex-shrink-0 pr-3 pt-2 text-right text-xs text-gray-500 font-semibold">
              All-Day
            </div>
            {dayNames.map((day, idx) => {
              const dateStr = formatDateISO(weekDates[idx]);
              const dayHolidays = filteredEvents.filter(event => {
                // Use the isHoliday flag set when loading from database
                const isHoliday = (event as any).isHoliday || event.category === 'Holidays/Notes' || event.color === '#3D5845';
                return isHoliday && event.date === dateStr;
              });
              
              return (
                <div 
                  key={`holiday-${day}`}
                  className="flex-1 border-l border-gray-300 p-1 flex flex-col gap-1"
                >
                  {dayHolidays.map(holiday => (
                    <div
                      key={holiday.id}
                      className="text-xs px-2 py-1 rounded text-white cursor-pointer hover:opacity-80"
                      style={{ backgroundColor: holiday.color }}
                      onClick={() => {
                        // Navigate to daily view for this holiday's date
                        const holidayDate = holiday.date || formatDateISO(weekDates[idx]);
                        setLocation(`/daily?date=${holidayDate}`);
                      }}
                    >
                      {holiday.title}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>

          <div className="flex border-b border-gray-300" style={{ minHeight: "80px" }}>
            <div style={{ width: "100px" }} className="flex-shrink-0 pr-3 pt-2 text-right text-xs text-gray-500 font-semibold">
              Notes
            </div>
            {dayNames.map((day, idx) => {
              const dateStr = formatDateISO(weekDates[idx]);
              const isEditing = editingNoteDate === dateStr;
              const content = noteContent[dateStr] || '';
              
              return (
                <div 
                  key={`note-${day}`}
                  className="flex-1 border-l border-gray-300 p-2 relative group"
                  onClick={() => {
                    if (!isEditing) {
                      setEditingNoteDate(dateStr);
                    }
                  }}
                >
                  {isEditing ? (
                    <textarea
                      value={content}
                      onChange={(e) => {
                        setNoteContent(prev => ({ ...prev, [dateStr]: e.target.value }));
                      }}
                      onBlur={async () => {
                        setEditingNoteDate(null);
                        if (content.trim()) {
                          await upsertNoteMutation.mutateAsync({
                            date: dateStr,
                            content: content.trim(),
                          });
                        }
                      }}
                      className="w-full h-full text-xs border-none outline-none resize-none bg-yellow-50 p-1"
                      placeholder="Add notes or goals for this day..."
                      autoFocus
                    />
                  ) : (
                    <div className="text-xs text-gray-600 whitespace-pre-wrap cursor-text hover:bg-yellow-50 transition-colors p-1 rounded min-h-[60px]">
                      {content || <span className="text-gray-400 italic">Click to add notes...</span>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="relative">
            {hours.map((hour) => {
              const time = `${hour.toString().padStart(2, "0")}:00`;
              const halfHourTime = `${hour.toString().padStart(2, "0")}:30`;
              
              return (
                <div key={hour} className="flex border-b border-gray-200 relative" style={{ height: "100px" }}>
                  <div 
                    style={{ width: "100px" }} 
                    className="flex-shrink-0 pr-3 pt-1 text-right font-semibold text-gray-700"
                  >
                    {time}
                  </div>
                  
                  <div 
                    style={{ width: "100px", position: "absolute", top: "50%", transform: "translateY(-50%)", left: "0" }} 
                    className="pr-3 text-right text-xs text-gray-500"
                  >
                    {halfHourTime}
                  </div>
                  
                  {dayNames.map((day, dayIdx) => {
                    const isToday = formatDateISO(weekDates[dayIdx]) === formatDateISO(new Date());
                    const now = new Date();
                    const currentHour = now.getHours();
                    const currentMinute = now.getMinutes();
                    const showCurrentTimeIndicator = isToday && hour === currentHour;
                    const indicatorPosition = (currentMinute / 60) * 100;
                    
                    return (
                      <div 
                        key={`${hour}-${dayIdx}`}
                        className={`flex-1 border-l border-gray-300 relative hover:bg-blue-50 transition-colors cursor-pointer ${
                          isToday ? 'bg-blue-50/30' : ''
                        }`}
                        onClick={() => handleTimeSlotClick(dayIdx, hour)}
                      >
                        <div className="absolute top-1/2 left-0 right-0 border-t border-gray-100"></div>
                        
                        {showCurrentTimeIndicator && (
                          <div 
                            className="absolute left-0 right-0 border-t-2 border-red-500 z-10"
                            style={{ top: `${indicatorPosition}%` }}
                          >
                            <div className="absolute -left-1 -top-1 w-2 h-2 bg-red-500 rounded-full"></div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {filteredEvents.map((event) => {
            // Skip holidays - they're shown in the all-day section
            const isHoliday = (event as any).isHoliday || event.category === 'Holidays/Notes' || event.color === '#3D5845';
            if (isHoliday) return null;
            
            const [startH, startM] = event.startTime.split(":").map(Number);
            const [endH, endM] = event.endTime.split(":").map(Number);
            
            if (startH < 6 || startH >= 24) return null;
            
            const startMinutes = (startH - 6) * 60 + startM;
            const endMinutes = (endH - 6) * 60 + endM;
            const pixelsPerMinute = 100 / 60;
            
            // Calculate header offset within grid: day names + all-day section + notes section
            // Note: Appointments are positioned relative to #weekly-grid container (not outer container)
            // All-day section: 40px base + 28px per holiday row (approximate)
            const maxHolidaysInAnyDay = Math.max(...weekDates.map((_, idx) => {
              const dateStr = formatDateISO(weekDates[idx]);
              return filteredEvents.filter(e => {
                const isHol = e.category === 'Holidays/Notes' || e.color === '#3D5845';
                return isHol && e.date === dateStr;
              }).length;
            }), 0);
            const dayNamesHeight = 60;
            const allDayHeight = maxHolidaysInAnyDay > 0 ? 40 + (maxHolidaysInAnyDay * 28) : 40;
            const notesHeight = 80; // Notes section has minHeight: 80px
            // Subtract 21px to compensate for rendering offset (was -71px, added 50px for 30-minute correction)
            const headerOffset = dayNamesHeight + allDayHeight + notesHeight - 21;
            
            const y = headerOffset + startMinutes * pixelsPerMinute;
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
                    backgroundColor: (() => {
                      if ((event as any).isSimplePractice) return '#E7E9EC';
                      if ((event as any).isFlight) return '#F6EAEA';
                      if ((event as any).isHoliday) return '#E9ECE9';
                      if ((event as any).isMeeting) return '#F4F0E9';
                      return '#EBEDEF';
                    })(),
                    color: '#333',
                    border: `1.5px solid ${event.color}`,
                    borderLeftWidth: '4px',
                    borderLeftColor: event.color,
                    opacity: draggingEvent === event.id ? 0.7 : 1,
                  }}
                  onMouseDown={(e) => handleDragStart(e, event.id)}
                  onClick={(e) => {
                    e.stopPropagation();
                    // Navigate to daily view for this appointment's date
                    const appointmentDate = event.date || formatDateISO(weekDates[dayIdx]);
                    setLocation(`/daily?date=${appointmentDate}`);
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
