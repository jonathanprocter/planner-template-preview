import { useEffect, useState } from "react";

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
  title: string;
  startTime: string;
  endTime: string;
  color: string;
}

export default function DailyView() {
  const [config, setConfig] = useState<DailyConfig | null>(null);
  const [svgContent, setSvgContent] = useState<string>("");

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

  // Sample events
  const sampleEvents: SampleEvent[] = [
    { title: "Team Meeting", startTime: "09:00", endTime: "10:00", color: "#3b82f6" },
    { title: "Client Call", startTime: "14:00", endTime: "15:30", color: "#10b981" },
    { title: "Project Review", startTime: "16:00", endTime: "17:00", color: "#f59e0b" },
  ];

  // Calculate stats
  const totalAppointments = sampleEvents.length;
  const scheduledHours = 3.5;
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

  return (
    <div className="w-full h-full bg-white overflow-auto">
      <div className="relative mx-auto" style={{ width: "1620px", height: "2160px" }}>
        {/* SVG Template Background */}
        <div
          className="absolute inset-0"
          dangerouslySetInnerHTML={{ __html: svgContent }}
        />

        {/* Header - Weekly Overview Button */}
        <div
          className="absolute flex items-center justify-center bg-white border-2 border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 shadow-sm"
          style={{
            left: `${config.header.weeklyOverview.x}px`,
            top: `${config.header.weeklyOverview.y}px`,
            width: `${config.header.weeklyOverview.width}px`,
            height: `${config.header.weeklyOverview.height}px`,
          }}
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" strokeWidth="2"/>
            <line x1="16" y1="2" x2="16" y2="6" strokeWidth="2"/>
            <line x1="8" y1="2" x2="8" y2="6" strokeWidth="2"/>
            <line x1="3" y1="10" x2="21" y2="10" strokeWidth="2"/>
          </svg>
          <span className="text-base font-normal text-gray-700">{config.header.weeklyOverview.textKey}</span>
        </div>

        {/* Header - Date Title */}
        <div
          className="absolute font-bold"
          style={{
            left: `${config.header.dateTitle.x}px`,
            top: `${config.header.dateTitle.y}px`,
            fontSize: `${config.header.dateTitle.fontSize}px`,
            transform: "translateX(-50%)",
          }}
        >
          {dateString}
        </div>

        {/* Header - Calendar Legends */}
        <div
          className="absolute flex gap-4"
          style={{
            left: `${config.header.legends.x}px`,
            top: `${config.header.legends.y}px`,
            fontSize: `${config.header.legends.fontSize}px`,
          }}
        >
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-500 rounded"></div>
            <span>SimplePractice</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-500 rounded"></div>
            <span>Google Calendar</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-orange-500 rounded"></div>
            <span>Holidays</span>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="absolute" style={{ top: `${config.statsBar.y}px`, width: "100%" }}>
          {config.statsBar.items.map((item, idx) => {
            const values = [totalAppointments, `${scheduledHours}h`, `${availableHours}h`, `${freeTimePercent}%`];
            return (
              <div
                key={idx}
                className="absolute text-center"
                style={{
                  left: `${item.x}px`,
                  width: `${item.width}px`,
                }}
              >
                <div className="font-bold" style={{ fontSize: `${config.statsBar.fontSize}px` }}>
                  {values[idx]}
                </div>
                <div style={{ fontSize: `${config.statsBar.labelFontSize}px` }}>{item.label}</div>
              </div>
            );
          })}
        </div>

        {/* Time Labels */}
        {timeLabels.map((time, idx) => {
          const y = config.timeBlocks.y + idx * 50; // 50px per 30-minute block
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

        {/* Sample Events */}
        {sampleEvents.map((event, idx) => {
          const startY = timeToY(event.startTime);
          const endY = timeToY(event.endTime);
          const height = endY - startY;

          return (
            <div
              key={idx}
              className="absolute rounded px-2 py-1 text-white text-sm overflow-hidden"
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
            </div>
          );
        })}

        {/* Footer Navigation */}
        <div className="absolute" style={{ top: `${config.footerNav.y}px`, width: "100%" }}>
          {/* Previous Day */}
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
          
          {/* Weekly Overview Button */}
          <div
            className="absolute flex items-center justify-center bg-white border-2 border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 shadow-sm"
            style={{
              left: `${config.footerNav.items[1].x}px`,
              width: `${config.footerNav.items[1].width}px`,
              height: "50px",
              top: "-10px",
            }}
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" strokeWidth="2"/>
              <line x1="16" y1="2" x2="16" y2="6" strokeWidth="2"/>
              <line x1="8" y1="2" x2="8" y2="6" strokeWidth="2"/>
              <line x1="3" y1="10" x2="21" y2="10" strokeWidth="2"/>
            </svg>
            <span className="text-base font-normal text-gray-700">Weekly Overview</span>
          </div>
          
          {/* Next Day */}
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
    </div>
  );
}
