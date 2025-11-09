import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { eventStore, type Event, type Task } from "@/lib/eventStore";
import { AppointmentDialog } from "./AppointmentDialog";
import { SearchBar } from "./SearchBar";
import GoogleCalendarSync from "./GoogleCalendarSync";
import { EventTooltip } from "./EventTooltip";
import { AppointmentDetailsModal } from "./AppointmentDetailsModal";
import { trpc } from "@/lib/trpc";

interface DailyConfig {
  header: {
    weeklyOverview: { x: number; y: number; width: number; height: number; textKey: string };
    dateTitle: { x: number; y: number; fontSize: number; textAlign: string };
    legends: { x: number; y: number; fontSize: number; gap: number };
  };
  statsBar: {
    y: number;
    fontSize: number;
    labelFontSize: number;
    items: Array<{ label: string; x: number; width: number }>;
  };
  timeBlocks: {
    x: number;
    y: number;
    width: number;
    height: number;
    startTime: string;
    endTime: string;
    hourHeight: number;
    fontSize: number;
    labelWidth: number;
    textPadding: number;
    dividerColor: string;
  };
  footerNav: {
    y: number;
    fontSize: number;
    items: Array<{ textKey: string; x: number; width: number; textAlign: string }>;
  };
}

export default function DailyView() {
  const [config, setConfig] = useState<DailyConfig | null>(null);
  const [svgContent, setSvgContent] = useState<string>("");
  const [, setLocation] = useLocation();
  const [events, setEvents] = useState<Event[]>(eventStore.getEvents());
  const [tasks, setTasks] = useState<Task[]>(eventStore.getTasks());
  const [editingSlot, setEditingSlot] = useState<string | null>(null);
  const [newEventTitle, setNewEventTitle] = useState("");
  const [draggingEvent, setDraggingEvent] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [selectedAppointment, setSelectedAppointment] = useState<Event | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogData, setDialogData] = useState<{ startTime: string; endTime: string; date: string } | undefined>();

  // Get date from URL parameter or use today
  const urlParams = new URLSearchParams(window.location.search);
  const dateParam = urlParams.get('date');
  const currentDate = dateParam ? (() => {
    const [year, month, day] = dateParam.split('-').map(Number);
    return new Date(year, month - 1, day);
  })() : new Date();
  
  // Format current date as YYYY-MM-DD for filtering
  const currentDateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;

  // Fetch appointments from database for current day
  const { data: dbAppointments, isLoading: isLoadingAppointments } = trpc.appointments.getByDateRange.useQuery({
    startDate: currentDateStr,
    endDate: currentDateStr,
  });

  useEffect(() => {
    fetch("/day-config.json")
      .then((res) => res.json())
      .then((data) => setConfig(data))
      .catch((error) => console.error("Failed to load day config:", error));

    fetch("/day-template.svg")
      .then((res) => res.text())
      .then((svg) => setSvgContent(svg))
      .catch((error) => console.error("Failed to load day template:", error));

    const unsubscribe = eventStore.subscribe(() => {
      setEvents(eventStore.getEvents());
      setTasks(eventStore.getTasks());
    });

    return () => unsubscribe();
  }, []);

  // Merge database appointments with local events
  useEffect(() => {
    if (dbAppointments) {
      // Convert DB appointments to Event format
      const dbEvents: Event[] = dbAppointments.map((apt: any) => {
        // Check if this is a StimulusPractice calendar
        const isStimulusPractice = apt.calendarId?.startsWith('6ac7ac649a345a77') || apt.calendarId?.startsWith('79dfcb90ce59b1b0');
        const isHoliday = apt.calendarId?.includes('holiday');
        const isFlight = apt.title?.toLowerCase().includes('flight');
        const isMeeting = apt.title?.toLowerCase().includes('meeting');
        
        // Financial District color scheme
        let color = '#4F5D67'; // Default: Work (Cool Slate)
        if (isStimulusPractice) color = '#243447'; // Deep Indigo
        else if (isFlight) color = '#A63D3D'; // Merlot Red
        else if (isHoliday) color = '#3D5845'; // Forest Pine
        else if (isMeeting) color = '#9A7547'; // Rich Caramel
        
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
          isStimulusPractice,
          isHoliday,
          isFlight,
          isMeeting,
        };
      });
      
      // Merge with local events for this date
      const localEvents = eventStore.getEvents().filter(e => e.source !== 'google' && e.date === currentDateStr);
      setEvents([...localEvents, ...dbEvents]);
    }
  }, [dbAppointments, currentDateStr]);

  if (!config || !svgContent) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  const dateString = currentDate.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  
  // Filter events for today only
  const todayEvents = events.filter(event => event.date === currentDateStr);

  const previousDate = new Date(currentDate);
  previousDate.setDate(currentDate.getDate() - 1);
  const nextDate = new Date(currentDate);
  nextDate.setDate(currentDate.getDate() + 1);

  const formatNavDate = (date: Date) => {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${days[date.getDay()]} ${months[date.getMonth()]} ${date.getDate()}`;
  };

  const totalAppointments = todayEvents.length;
  const calculateHours = () => {
    let totalMinutes = 0;
    todayEvents.forEach(event => {
      const [startH, startM] = event.startTime.split(":").map(Number);
      const [endH, endM] = event.endTime.split(":").map(Number);
      const startMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;
      totalMinutes += endMinutes - startMinutes;
    });
    return totalMinutes / 60;
  };
  const scheduledHours = calculateHours();
  const availableHours = 24 - scheduledHours;
  const freeTimePercent = Math.round((availableHours / 24) * 100);

  const timeToY = (time: string) => {
    const [hours, minutes] = time.split(":").map(Number);
    const startHour = 6;
    const totalMinutes = (hours - startHour) * 60 + minutes;
    const pixelsPerMinute = config.timeBlocks.hourHeight / 60;
    return config.timeBlocks.y + totalMinutes * pixelsPerMinute;
  };

  const yToTime = (y: number) => {
    const relativeY = y - config.timeBlocks.y;
    const pixelsPerMinute = config.timeBlocks.hourHeight / 60;
    const totalMinutes = Math.round(relativeY / pixelsPerMinute);
    const hours = Math.floor(totalMinutes / 60) + 6;
    const minutes = Math.round((totalMinutes % 60) / 30) * 30;
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
  };

  const generateTimeLabels = () => {
    const labels = [];
    for (let hour = 6; hour <= 23; hour++) {
      labels.push(`${hour.toString().padStart(2, "0")}:00`);
      if (hour < 23) {
        labels.push(`${hour.toString().padStart(2, "0")}:30`);
      }
    }
    labels.push("23:30");
    return labels;
  };

  const timeLabels = generateTimeLabels();

  const handleTimeSlotClick = (time: string) => {
    setEditingSlot(time);
    setNewEventTitle("");
  };

  const handleAddEvent = (startTime: string) => {
    if (!newEventTitle.trim()) return;
    
    const [hours, minutes] = startTime.split(":").map(Number);
    const endHours = minutes === 30 ? hours + 1 : hours;
    const endMinutes = minutes === 30 ? 0 : 30;
    const endTime = `${endHours.toString().padStart(2, "0")}:${endMinutes.toString().padStart(2, "0")}`;

    const newEvent: Event = {
      id: Date.now().toString(),
      title: newEventTitle,
      startTime,
      endTime,
      color: "#8b5cf6",
      source: "local",
      date: `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`,
    };

    eventStore.addEvent(newEvent);
    setEditingSlot(null);
    setNewEventTitle("");
  };

  const handleDeleteEvent = (id: string) => {
    eventStore.deleteEvent(id);
  };

  const handleDragStart = (e: React.MouseEvent, eventId: string) => {
    const event = events.find(ev => ev.id === eventId);
    if (!event) return;
    
    const eventY = timeToY(event.startTime);
    setDraggingEvent(eventId);
    setDragOffset({
      x: e.clientX,
      y: e.clientY - eventY,
    });
  };

  const handleDragMove = (e: React.MouseEvent) => {
    if (!draggingEvent || !config) return;
    
    const newY = e.clientY - dragOffset.y;
    const newStartTime = yToTime(newY);
    
    const event = events.find(ev => ev.id === draggingEvent);
    if (!event) return;

    const [startH, startM] = event.startTime.split(":").map(Number);
    const [endH, endM] = event.endTime.split(":").map(Number);
    const duration = (endH * 60 + endM) - (startH * 60 + startM);
    
    const [newStartH, newStartM] = newStartTime.split(":").map(Number);
    const newEndMinutes = newStartH * 60 + newStartM + duration;
    const newEndH = Math.floor(newEndMinutes / 60);
    const newEndM = newEndMinutes % 60;
    
    eventStore.updateEvent(draggingEvent, {
      startTime: newStartTime,
      endTime: `${newEndH.toString().padStart(2, "0")}:${newEndM.toString().padStart(2, "0")}`,
    });
  };

  const handleDragEnd = () => {
    setDraggingEvent(null);
  };

  const toggleTask = (id: string) => {
    const task = tasks.find(t => t.id === id);
    if (task) {
      eventStore.updateTask(id, { completed: !task.completed });
    }
  };

  const addTask = () => {
    const newTask: Task = {
      id: Date.now().toString(),
      text: "New task",
      completed: false,
    };
    eventStore.addTask(newTask);
  };

  const handleNavigateToPrevDay = () => {
    const prevDateStr = `${previousDate.getFullYear()}-${String(previousDate.getMonth() + 1).padStart(2, '0')}-${String(previousDate.getDate()).padStart(2, '0')}`;
    setLocation(`/daily?date=${prevDateStr}`);
  };

  const handleNavigateToNextDay = () => {
    const nextDateStr = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}-${String(nextDate.getDate()).padStart(2, '0')}`;
    setLocation(`/daily?date=${nextDateStr}`);
  };

  return (
    <div 
      className="w-full h-full bg-white overflow-auto"
      onMouseMove={handleDragMove}
      onMouseUp={handleDragEnd}
    >
      <div className="relative mx-auto flex" style={{ width: "2020px", height: "2160px" }}>
        <div className="relative" style={{ width: "1620px", height: "2160px" }}>
          <div
            className="absolute inset-0"
            dangerouslySetInnerHTML={{ __html: svgContent }}
          />

          {/* Weekly Overview Button - Top */}
          <div
            className="absolute inline-flex items-center gap-2 bg-[#f3f3f3] border border-[#d0d0d0] rounded-lg cursor-pointer hover:bg-[#ececec] hover:shadow-md transition-all duration-200 hover:-translate-y-px"
            style={{
              left: "20px",
              top: "20px",
              padding: "6px 14px",
              boxShadow: "0 1px 2px rgba(0, 0, 0, 0.1)",
            }}
            onClick={() => setLocation("/")}
          >
            <svg className="w-5 h-5 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
              <rect x="3" y="5" width="18" height="16" rx="2" ry="2" fill="#f9f9f9" stroke="#b46b5e" strokeWidth="1.2"/>
              <rect x="3" y="5" width="18" height="3" rx="2" ry="2" fill="#b46b5e"/>
              <line x1="7" y1="3" x2="7" y2="7" stroke="#b46b5e" strokeWidth="1.4" strokeLinecap="round"/>
              <line x1="17" y1="3" x2="17" y2="7" stroke="#b46b5e" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
            <span className="font-medium text-base text-[#2e2e2e]" style={{ fontFamily: "Georgia, serif" }}>Weekly Overview</span>
          </div>

          <div
            className="absolute font-bold text-center"
            style={{
              left: "50%",
              top: "24px",
              fontSize: "32px",
              transform: "translateX(-50%)",
            }}
          >
            {dateString}
          </div>

          <div
            className="absolute text-center text-gray-500 italic"
            style={{
              left: "50%",
              top: "62px",
              fontSize: "14px",
              transform: "translateX(-50%)",
            }}
          >
            {totalAppointments} appointments
          </div>

          <div
            className="absolute flex gap-6"
            style={{
              right: "20px",
              top: "24px",
              fontSize: "13px",
            }}
          >
            <div className="flex items-center gap-1.5">
              <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              </svg>
              <span className="text-gray-700">StimulusPractice</span>
            </div>
            <div className="flex items-center gap-1.5">
              <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 24 24">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              </svg>
              <span className="text-gray-700">Google Calendar</span>
            </div>
            <div className="flex items-center gap-1.5">
              <svg className="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 24 24">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              </svg>
              <span className="text-gray-700">Holidays in United States</span>
            </div>
          </div>

          <div className="absolute border-t border-b border-gray-300" style={{ top: "90px", width: "100%", height: "60px", backgroundColor: "#f9f9f9" }}>
            <div className="flex items-center justify-around h-full px-8">
              <div className="text-center">
                <div className="font-bold text-2xl">{totalAppointments}</div>
                <div className="text-sm text-gray-600">Appointments</div>
              </div>
              <div className="text-center">
                <div className="font-bold text-2xl">{scheduledHours.toFixed(1)}h</div>
                <div className="text-sm text-gray-600">Scheduled</div>
              </div>
              <div className="text-center">
                <div className="font-bold text-2xl">{availableHours.toFixed(1)}h</div>
                <div className="text-sm text-gray-600">Available</div>
              </div>
              <div className="text-center">
                <div className="font-bold text-2xl">{freeTimePercent}%</div>
                <div className="text-sm text-gray-600">Free Time</div>
              </div>
            </div>
          </div>

          {/* All-Day Holidays Section */}
          {todayEvents.filter((event: Event) => event.category === 'Holidays/Notes' || event.color === '#3D5845').length > 0 && (
            <div 
              className="absolute border-b border-gray-300" 
              style={{ 
                top: "150px", 
                left: "20px", 
                right: "20px", 
                minHeight: "40px",
                backgroundColor: "#fefefe",
                padding: "8px 12px"
              }}
            >
              <div className="text-xs font-semibold text-gray-600 mb-2">All-Day Events</div>
              <div className="flex flex-col gap-2">
                {todayEvents
                  .filter((event: Event) => event.category === 'Holidays/Notes' || event.color === '#3D5845')
                  .map((holiday: Event) => (
                    <div
                      key={holiday.id}
                      className="text-sm px-3 py-2 rounded text-white cursor-pointer hover:opacity-80 inline-block"
                      style={{ backgroundColor: holiday.color }}
                      onClick={() => {
                        setSelectedAppointment(holiday);
                        setModalOpen(true);
                      }}
                    >
                      {holiday.title}
                    </div>
                  ))
                }
              </div>
            </div>
          )}

          {timeLabels.map((time, idx) => {
            const y = config.timeBlocks.y + idx * 50;
            const isHour = time.endsWith(":00");
            return (
              <div
                key={time}
                className="absolute"
                style={{
                  left: `${config.timeBlocks.x - 80}px`,
                  top: `${y - 8}px`,
                  fontSize: `${isHour ? 18 : 16}px`,
                  fontWeight: isHour ? 600 : 400,
                  color: isHour ? "#444" : "#888",
                }}
              >
                {time}
              </div>
            );
          })}

          {timeLabels.map((time, idx) => {
            const y = config.timeBlocks.y + idx * 50;
            const hasEvent = events.some(e => e.startTime === time);
            
            return (
              <div
                key={`slot-${time}`}
                className="absolute cursor-pointer hover:bg-blue-50 transition-colors"
                style={{
                  left: `${config.timeBlocks.x + config.timeBlocks.labelWidth}px`,
                  top: `${y}px`,
                  width: `${config.timeBlocks.width - config.timeBlocks.labelWidth - 20}px`,
                  height: "48px",
                }}
                onClick={() => !hasEvent && handleTimeSlotClick(time)}
              >
                {editingSlot === time && (
                  <div className="absolute inset-0 bg-white border-2 border-blue-500 rounded p-2 z-50">
                    <input
                      type="text"
                      className="w-full text-sm border-b border-gray-300 outline-none mb-1"
                      placeholder="Event title..."
                      value={newEventTitle}
                      onChange={(e) => setNewEventTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleAddEvent(time);
                        if (e.key === "Escape") setEditingSlot(null);
                      }}
                      autoFocus
                    />
                    <div className="flex gap-1">
                      <button
                        className="text-xs bg-blue-500 text-white px-2 py-1 rounded"
                        onClick={() => handleAddEvent(time)}
                      >
                        Add
                      </button>
                      <button
                        className="text-xs bg-gray-300 px-2 py-1 rounded"
                        onClick={() => setEditingSlot(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {todayEvents
            .filter((event) => {
              // Skip holidays - they're shown in the all-day section
              const isHoliday = event.category === 'Holidays/Notes' || event.color === '#3D5845';
              return !isHoliday;
            })
            .map((event) => {
            const startY = timeToY(event.startTime);
            const endY = timeToY(event.endTime);
            const height = endY - startY;

            return (
              <EventTooltip key={event.id} event={event}>
                <div
                  className="absolute rounded-md px-3 py-2 group cursor-move shadow-sm"
                style={{
                  left: `${config.timeBlocks.x + config.timeBlocks.labelWidth}px`,
                  top: `${startY}px`,
                  width: `${config.timeBlocks.width - config.timeBlocks.labelWidth - 20}px`,
                  height: `${height}px`,
                  backgroundColor: (() => {
                    if ((event as any).isStimulusPractice) return '#E7E9EC';
                    if ((event as any).isFlight) return '#F6EAEA';
                    if ((event as any).isHoliday) return '#E9ECE9';
                    if ((event as any).isMeeting) return '#F4F0E9';
                    return '#EBEDEF'; // Work
                  })(),
                  color: '#333',
                  border: `1.5px solid ${event.color}`,
                  borderLeftWidth: '4px',
                  borderLeftColor: event.color,
                  opacity: draggingEvent === event.id ? 0.7 : 1,
                  minHeight: '40px',
                }}
                onMouseDown={(e) => handleDragStart(e, event.id)}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedAppointment(event);
                  setModalOpen(true);
                }}
              >
                <div className="font-semibold text-sm leading-tight mb-1 overflow-hidden text-ellipsis" style={{ 
                  display: '-webkit-box',
                  WebkitLineClamp: height > 60 ? 2 : 1,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden'
                }}>
                  {event.title}
                </div>
                <div className="text-xs opacity-90 font-medium">
                  {event.startTime} - {event.endTime}
                </div>
                {event.category && height > 60 && (
                  <div className="text-xs opacity-75 mt-1 truncate">{event.category}</div>
                )}
                <button
                  className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 bg-red-600 hover:bg-red-700 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold shadow-md transition-all"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteEvent(event.id);
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  ×
                </button>
                </div>
              </EventTooltip>
            );
          })}

          <div className="absolute" style={{ top: `${config.footerNav.y}px`, width: "100%" }}>
            <div
              className="absolute cursor-pointer hover:underline text-gray-700"
              style={{
                left: `${config.footerNav.items[0].x}px`,
                width: `${config.footerNav.items[0].width}px`,
                fontSize: `${config.footerNav.fontSize}px`,
                textAlign: "left",
              }}
              onClick={handleNavigateToPrevDay}
            >
              ← {formatNavDate(previousDate)}
            </div>
            
            {/* Weekly Overview Button - Bottom */}
            <div
              className="absolute inline-flex items-center gap-2 bg-[#f3f3f3] border border-[#d0d0d0] rounded-lg cursor-pointer hover:bg-[#ececec] hover:shadow-md transition-all duration-200 hover:-translate-y-px"
              style={{
                left: `${config.footerNav.items[1].x}px`,
                top: "-10px",
                padding: "6px 14px",
                boxShadow: "0 1px 2px rgba(0, 0, 0, 0.1)",
              }}
              onClick={() => setLocation("/")}
            >
              <svg className="w-5 h-5 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                <rect x="3" y="5" width="18" height="16" rx="2" ry="2" fill="#f9f9f9" stroke="#b46b5e" strokeWidth="1.2"/>
                <rect x="3" y="5" width="18" height="3" rx="2" ry="2" fill="#b46b5e"/>
                <line x1="7" y1="3" x2="7" y2="7" stroke="#b46b5e" strokeWidth="1.4" strokeLinecap="round"/>
                <line x1="17" y1="3" x2="17" y2="7" stroke="#b46b5e" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
              <span className="font-medium text-base text-[#2e2e2e]" style={{ fontFamily: "Georgia, serif" }}>Weekly Overview</span>
            </div>
            
            <div
              className="absolute cursor-pointer hover:underline text-gray-700"
              style={{
                left: `${config.footerNav.items[2].x}px`,
                width: `${config.footerNav.items[2].width}px`,
                fontSize: `${config.footerNav.fontSize}px`,
                textAlign: "right",
              }}
              onClick={handleNavigateToNextDay}
            >
              {formatNavDate(nextDate)} →
            </div>
          </div>
        </div>

        <div className="relative bg-gray-50 border-l border-gray-300" style={{ width: "400px", height: "2160px", padding: "20px" }}>
          <div className="mb-4">
            <SearchBar onResultClick={(event) => {
              if (event.date) {
                setLocation(`/daily?date=${event.date}`);
              }
            }} />
          </div>
          
          <div className="mb-4">
            <GoogleCalendarSync />
          </div>

          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-xl font-bold">Tasks</h3>
            <button
              className="text-sm bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600"
              onClick={addTask}
            >
              + Add Task
            </button>
          </div>
          
          <div className="space-y-2">
            {tasks.map((task) => (
              <div key={task.id} className="flex items-start gap-2 p-2 bg-white rounded border border-gray-200 hover:shadow-sm">
                <input
                  type="checkbox"
                  checked={task.completed}
                  onChange={() => toggleTask(task.id)}
                  className="mt-1 w-4 h-4 cursor-pointer"
                />
                <span className={`flex-1 ${task.completed ? "line-through text-gray-400" : "text-gray-700"}`}>
                  {task.text}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <AppointmentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSave={(data) => {
          const newEvent: Event = {
            id: Date.now().toString(),
            title: data.title,
            startTime: data.startTime,
            endTime: data.endTime,
            color: "#4285f4",
            source: "local",
            date: data.date,
            category: data.category,
          };
          eventStore.addEvent(newEvent);
          setDialogOpen(false);
        }}
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