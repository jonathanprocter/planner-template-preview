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
          className="absolute flex items-center justify-center bg-gray-200 border border-gray-400 rounded cursor-pointer hover:bg-gray-300"
          style={{
            left: `${config.header.weeklyOverview.x}px`,
            top: `${config.header.weeklyOverview.y}px`,
            width: `${config.header.weeklyOverview.width}px`,
            height: `${config.header.weeklyOverview.height}px`,
          }}
        >
          <span className="text-lg font-medium">{config.header.weeklyOverview.textKey}</span>
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
          return (
            <div
              key={time}
              className="absolute text-gray-600"
              style={{
                left: `${config.timeBlocks.x - 90}px`,
                top: `${y - 10}px`,
                fontSize: `${config.timeBlocks.fontSize}px`,
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
          {config.footerNav.items.map((item, idx) => (
            <div
              key={idx}
              className="absolute cursor-pointer hover:underline"
              style={{
                left: `${item.x}px`,
                width: `${item.width}px`,
                fontSize: `${config.footerNav.fontSize}px`,
                textAlign: item.textAlign as any,
              }}
            >
              {item.textKey}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
