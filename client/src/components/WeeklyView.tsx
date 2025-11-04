import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { eventStore, type Event } from "@/lib/eventStore";

interface WeeklyConfig {
  header: {
    title: { x: number; y: number; fontSize: number; textAlign: string };
    navigation: { y: number; fontSize: number };
  };
  grid: {
    x: number;
    y: number;
    width: number;
    height: number;
    hourHeight: number;
    columnWidth: number;
    timeColumnWidth: number;
  };
}

export default function WeeklyView() {
  const [config, setConfig] = useState<WeeklyConfig | null>(null);
  const [svgContent, setSvgContent] = useState<string>("");
  const [, setLocation] = useLocation();
  const [events, setEvents] = useState<Event[]>(eventStore.getEvents());

  useEffect(() => {
    fetch("/week-config.json")
      .then((res) => res.json())
      .then((data) => setConfig(data));

    fetch("/week-template.svg")
      .then((res) => res.text())
      .then((svg) => setSvgContent(svg));

    const unsubscribe = eventStore.subscribe(() => {
      setEvents(eventStore.getEvents());
    });

    return () => unsubscribe();
  }, []);

  if (!config || !svgContent) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

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

  // Generate time labels (including 00:00 at bottom) - matching daily view format
  const generateTimeLabels = () => {
    const labels = [];
    for (let hour = 6; hour <= 23; hour++) {
      labels.push(`${hour.toString().padStart(2, "0")}:00`);
    }
    labels.push("00:00"); // Add midnight at the bottom
    return labels;
  };

  const timeLabels = generateTimeLabels();

  return (
    <div className="w-full h-full bg-white overflow-auto">
      <div className="relative mx-auto" style={{ width: "1620px", height: "2160px" }}>
        <div
          className="absolute inset-0"
          dangerouslySetInnerHTML={{ __html: svgContent }}
        />

        {/* Weekly Overview Button - Top - Exact match to screenshot */}
        <div
          className="absolute flex items-center justify-center bg-white border-2 border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 shadow-sm"
          style={{
            left: "20px",
            top: "20px",
            width: "280px",
            height: "70px",
            padding: "10px 20px",
          }}
          onClick={() => setLocation("/")}
        >
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-center justify-center bg-white border border-gray-300 rounded" style={{ width: "50px", height: "50px" }}>
              <div className="text-red-600 font-bold text-xs">17</div>
            </div>
            <span className="text-xl font-normal text-gray-800">Weekly Overview</span>
          </div>
        </div>

        <div
          className="absolute font-bold text-center"
          style={{
            left: "50%",
            top: "40px",
            fontSize: "28px",
            transform: "translateX(-50%)",
          }}
        >
          {weekLabel}
        </div>

        {/* Time labels - matching daily view style */}
        {timeLabels.map((time, idx) => {
          const y = config.grid.y + idx * config.grid.hourHeight;
          const isHour = time.endsWith(":00") && time !== "00:00";
          return (
            <div
              key={time}
              className="absolute"
              style={{
                left: `${config.grid.x - 80}px`,
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

        {/* Day headers */}
        {weekDates.map((date, idx) => {
          const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
          const x = config.grid.x + config.grid.timeColumnWidth + idx * config.grid.columnWidth;
          return (
            <div
              key={idx}
              className="absolute text-center font-semibold"
              style={{
                left: `${x}px`,
                top: `${config.grid.y - 40}px`,
                width: `${config.grid.columnWidth}px`,
                fontSize: "16px",
              }}
            >
              <div>{dayNames[idx]}</div>
              <div className="text-sm text-gray-600">{date.getDate()}</div>
            </div>
          );
        })}

        {/* Events */}
        {events.map((event) => {
          const [startH, startM] = event.startTime.split(":").map(Number);
          const [endH, endM] = event.endTime.split(":").map(Number);
          
          const startMinutes = (startH - 6) * 60 + startM;
          const endMinutes = (endH - 6) * 60 + endM;
          const pixelsPerMinute = config.grid.hourHeight / 60;
          
          const y = config.grid.y + startMinutes * pixelsPerMinute;
          const height = (endMinutes - startMinutes) * pixelsPerMinute;
          
          // For now, show on Monday (idx 0) - can be enhanced to parse actual dates
          const dayIdx = 0;
          const x = config.grid.x + config.grid.timeColumnWidth + dayIdx * config.grid.columnWidth;
          
          return (
            <div
              key={event.id}
              className="absolute rounded px-2 py-1 text-white text-xs overflow-hidden"
              style={{
                left: `${x + 5}px`,
                top: `${y}px`,
                width: `${config.grid.columnWidth - 10}px`,
                height: `${height}px`,
                backgroundColor: event.color,
              }}
            >
              <div className="font-semibold">{event.title}</div>
              <div className="text-xs opacity-90">
                {event.startTime} - {event.endTime}
              </div>
            </div>
          );
        })}

        {/* Weekly Overview Button - Bottom */}
        <div
          className="absolute flex items-center justify-center bg-white border-2 border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 shadow-sm"
          style={{
            left: "50%",
            bottom: "40px",
            transform: "translateX(-50%)",
            width: "280px",
            height: "70px",
            padding: "10px 20px",
          }}
          onClick={() => setLocation("/")}
        >
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-center justify-center bg-white border border-gray-300 rounded" style={{ width: "50px", height: "50px" }}>
              <div className="text-red-600 font-bold text-xs">17</div>
            </div>
            <span className="text-xl font-normal text-gray-800">Weekly Overview</span>
          </div>
        </div>
      </div>
    </div>
  );
}
