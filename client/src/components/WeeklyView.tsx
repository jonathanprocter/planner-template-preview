import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { eventStore, type Event } from "@/lib/eventStore";

export default function WeeklyView() {
  const [, setLocation] = useLocation();
  const [events, setEvents] = useState<Event[]>(eventStore.getEvents());

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

  const timeToY = (time: string) => {
    const [hours, minutes] = time.split(":").map(Number);
    const startHour = 6;
    const totalMinutes = (hours - startHour) * 60 + minutes;
    const pixelsPerMinute = 100 / 60; // 100px per hour
    return 200 + totalMinutes * pixelsPerMinute;
  };

  return (
    <div className="w-full h-full bg-white overflow-auto">
      <div className="relative mx-auto" style={{ width: "1620px", minHeight: "2160px", padding: "20px" }}>
        
        {/* Weekly Overview Button - Top - Exact match to screenshot */}
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
        <div className="absolute" style={{ top: "120px", left: "20px", right: "20px" }}>
          
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
              const isHour = true;
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
                      className="flex-1 border-l border-gray-300 relative"
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
            
            // For now, show on Monday (idx 0)
            const dayIdx = 0;
            const columnWidth = (1620 - 40 - 100) / 7;
            const x = 100 + dayIdx * columnWidth;
            
            return (
              <div
                key={event.id}
                className="absolute rounded px-2 py-1 text-white text-xs overflow-hidden z-10"
                style={{
                  left: `${x + 2}px`,
                  top: `${y}px`,
                  width: `${columnWidth - 4}px`,
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
