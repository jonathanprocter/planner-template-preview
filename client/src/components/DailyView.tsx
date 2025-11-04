import { useEffect, useState } from "react";
import { useLocation } from "wouter";

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

interface SampleEvent {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  color: string;
}

interface Task {
  id: string;
  text: string;
  completed: boolean;
}

export default function DailyView() {
  const [config, setConfig] = useState<DailyConfig | null>(null);
  const [svgContent, setSvgContent] = useState<string>("");
  const [, setLocation] = useLocation();
  const [events, setEvents] = useState<SampleEvent[]>([
    { id: "1", title: "Team Meeting", startTime: "09:00", endTime: "10:00", color: "#3b82f6" },
    { id: "2", title: "Client Call", startTime: "14:00", endTime: "15:30", color: "#10b981" },
    { id: "3", title: "Project Review", startTime: "16:00", endTime: "17:00", color: "#f59e0b" },
  ]);
  const [tasks, setTasks] = useState<Task[]>([
    { id: "1", text: "Review project proposal", completed: false },
    { id: "2", text: "Send follow-up emails", completed: true },
    { id: "3", text: "Update documentation", completed: false },
    { id: "4", text: "Prepare presentation slides", completed: false },
  ]);
  const [editingSlot, setEditingSlot] = useState<string | null>(null);
  const [newEventTitle, setNewEventTitle] = useState("");

  useEffect(() => {
    fetch("/day-config.json")
      .then((res) => res.json())
      .then((data) => setConfig(data));

    fetch("/day-template.svg")
      .then((res) => res.text())
      .then((svg) => setSvgContent(svg));
  }, []);

  if (!config || !svgContent) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  const currentDate = new Date();
  const dateString = currentDate.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  // Calculate previous and next dates
  const previousDate = new Date(currentDate);
  previousDate.setDate(currentDate.getDate() - 1);
  const nextDate = new Date(currentDate);
  nextDate.setDate(currentDate.getDate() + 1);

  const formatNavDate = (date: Date) => {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${days[date.getDay()]} ${months[date.getMonth()]} ${date.getDate()}`;
  };

  // Calculate stats
  const totalAppointments = events.length;
  const calculateHours = () => {
    let totalMinutes = 0;
    events.forEach(event => {
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

  // Helper to convert time to y position
  const timeToY = (time: string) => {
    const [hours, minutes] = time.split(":").map(Number);
    const startHour = 6; // 06:00
    const totalMinutes = (hours - startHour) * 60 + minutes;
    const pixelsPerMinute = config.timeBlocks.hourHeight / 60;
    return config.timeBlocks.y + totalMinutes * pixelsPerMinute;
  };

  // Generate time labels
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

    const newEvent: SampleEvent = {
      id: Date.now().toString(),
      title: newEventTitle,
      startTime,
      endTime,
      color: "#8b5cf6",
    };

    setEvents([...events, newEvent]);
    setEditingSlot(null);
    setNewEventTitle("");
  };

  const handleDeleteEvent = (id: string) => {
    setEvents(events.filter(e => e.id !== id));
  };

  const toggleTask = (id: string) => {
    setTasks(tasks.map(task => 
      task.id === id ? { ...task, completed: !task.completed } : task
    ));
  };

  const addTask = () => {
    const newTask: Task = {
      id: Date.now().toString(),
      text: "New task",
      completed: false,
    };
    setTasks([...tasks, newTask]);
  };

  return (
    <div className="w-full h-full bg-white overflow-auto">
      <div className="relative mx-auto flex" style={{ width: "2020px", height: "2160px" }}>
        {/* Main Calendar Section */}
        <div className="relative" style={{ width: "1620px", height: "2160px" }}>
          {/* SVG Template Background */}
          <div
            className="absolute inset-0"
            dangerouslySetInnerHTML={{ __html: svgContent }}
          />

          {/* Header - Weekly Overview Button (Exact match to screenshot) */}
          <div
            className="absolute flex items-center justify-center bg-white border border-gray-400 rounded cursor-pointer hover:bg-gray-50"
            style={{
              left: "20px",
              top: "20px",
              width: "140px",
              height: "40px",
            }}
            onClick={() => setLocation("/weekly")}
          >
            <svg className="w-4 h-4 mr-1.5 text-red-500" fill="currentColor" viewBox="0 0 24 24">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" fill="none" stroke="currentColor" strokeWidth="2"/>
              <line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" strokeWidth="2"/>
              <line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" strokeWidth="2"/>
              <line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" strokeWidth="2"/>
            </svg>
            <span className="text-sm font-normal text-gray-700">Weekly Overview</span>
          </div>

          {/* Header - Date Title */}
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

          {/* Header - Appointment Count (centered below date) */}
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

          {/* Header - Calendar Legends (right side) */}
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
              <span className="text-gray-700">SimplePractice</span>
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

          {/* Stats Bar */}
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

          {/* Time Labels */}
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

          {/* Time Slot Click Areas */}
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

          {/* Sample Events */}
          {events.map((event) => {
            const startY = timeToY(event.startTime);
            const endY = timeToY(event.endTime);
            const height = endY - startY;

            return (
              <div
                key={event.id}
                className="absolute rounded px-2 py-1 text-white text-sm overflow-hidden group"
                style={{
                  left: `${config.timeBlocks.x + config.timeBlocks.labelWidth}px`,
                  top: `${startY}px`,
                  width: `${config.timeBlocks.width - config.timeBlocks.labelWidth - 20}px`,
                  height: `${height}px`,
                  backgroundColor: event.color,
                }}
              >
                <div className="font-semibold">{event.title}</div>
                <div className="text-xs">
                  {event.startTime} - {event.endTime}
                </div>
                <button
                  className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                  onClick={() => handleDeleteEvent(event.id)}
                >
                  ×
                </button>
              </div>
            );
          })}

          {/* Footer Navigation */}
          <div className="absolute" style={{ top: `${config.footerNav.y}px`, width: "100%" }}>
            <div
              className="absolute cursor-pointer hover:underline text-gray-700"
              style={{
                left: `${config.footerNav.items[0].x}px`,
                width: `${config.footerNav.items[0].width}px`,
                fontSize: `${config.footerNav.fontSize}px`,
                textAlign: "left",
              }}
            >
              ← {formatNavDate(previousDate)}
            </div>
            
            <div
              className="absolute flex items-center justify-center bg-white border-2 border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 shadow-sm"
              style={{
                left: `${config.footerNav.items[1].x}px`,
                width: `${config.footerNav.items[1].width}px`,
                height: "50px",
                top: "-10px",
              }}
              onClick={() => setLocation("/weekly")}
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" strokeWidth="2"/>
                <line x1="16" y1="2" x2="16" y2="6" strokeWidth="2"/>
                <line x1="8" y1="2" x2="8" y2="6" strokeWidth="2"/>
                <line x1="3" y1="10" x2="21" y2="10" strokeWidth="2"/>
              </svg>
              <span className="text-base font-normal text-gray-700">Weekly Overview</span>
            </div>
            
            <div
              className="absolute cursor-pointer hover:underline text-gray-700"
              style={{
                left: `${config.footerNav.items[2].x}px`,
                width: `${config.footerNav.items[2].width}px`,
                fontSize: `${config.footerNav.fontSize}px`,
                textAlign: "right",
              }}
            >
              {formatNavDate(nextDate)} →
            </div>
          </div>
        </div>

        {/* Task List Section (Right Side) */}
        <div className="relative bg-gray-50 border-l border-gray-300" style={{ width: "400px", height: "2160px", padding: "20px" }}>
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
    </div>
  );
}
