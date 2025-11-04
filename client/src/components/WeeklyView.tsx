import { useEffect, useState } from "react";

interface WeeklyConfig {
  header: {
    weekLabel: { x: number; y: number; fontSize: number; textAlign: string };
  };
  grid: {
    x: number;
    y: number;
    width: number;
    height: number;
    timeColumnWidth: number;
    dayColumnWidth: number;
    hourHeight: number;
    startTime: string;
    endTime: string;
    dayHeaderHeight: number;
    dayHeaderFontSize: number;
    timeFontSize: number;
  };
}

export default function WeeklyView() {
  const [config, setConfig] = useState<WeeklyConfig | null>(null);
  const [svgContent, setSvgContent] = useState<string>("");

  useEffect(() => {
    fetch("/week-config.json")
      .then((res) => res.json())
      .then((data) => setConfig(data));

    fetch("/week-template.svg")
      .then((res) => res.text())
      .then((svg) => setSvgContent(svg));
  }, []);

  if (!config || !svgContent) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const currentDate = new Date();
  
  // Grid starts at y=200 with 100px per hour
  
  // Get week dates
  const getWeekDates = () => {
    const dates = [];
    const startOfWeek = new Date(currentDate);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
    startOfWeek.setDate(diff);

    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      dates.push(date);
    }
    return dates;
  };

  const weekDates = getWeekDates();
  const weekLabel = `Week of ${weekDates[0].toLocaleDateString("en-US", { month: "long", day: "numeric" })} - ${weekDates[6].toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`;

  // Generate time labels
  const generateTimeLabels = () => {
    const labels = [];
    for (let hour = 6; hour <= 23; hour++) {
      labels.push(`${hour.toString().padStart(2, "0")}:00`);
    }
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

        {/* Header - Week Label */}
        <div
          className="absolute font-bold"
          style={{
            left: `${config.header.weekLabel.x}px`,
            top: `${config.header.weekLabel.y}px`,
            fontSize: `${config.header.weekLabel.fontSize}px`,
            transform: "translateX(-50%)",
          }}
        >
          {weekLabel}
        </div>

        {/* Day Headers */}
        {days.map((day, idx) => {
          const x = config.grid.x + config.grid.timeColumnWidth + idx * config.grid.dayColumnWidth;
          const y = 150; // Fixed header position
          const date = weekDates[idx];

          return (
            <div
              key={day}
              className="absolute text-center font-semibold"
              style={{
                left: `${x}px`,
                top: `${y}px`,
                width: `${config.grid.dayColumnWidth}px`,
                height: `${config.grid.dayHeaderHeight}px`,
                fontSize: `${config.grid.dayHeaderFontSize}px`,
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <div>{day}</div>
              <div className="text-sm font-normal">
                {date.toLocaleDateString("en-US", { month: "numeric", day: "numeric" })}
              </div>
            </div>
          );
        })}

        {/* Time Labels */}
        {timeLabels.map((time, idx) => {
          const y = 200 + idx * 100; // Start at y=200, 100px per hour
          return (
            <div
              key={time}
              className="absolute text-gray-600 text-center"
              style={{
                left: `${config.grid.x}px`,
                top: `${y - 10}px`,
                width: `${config.grid.timeColumnWidth}px`,
                fontSize: `${config.grid.timeFontSize}px`,
              }}
            >
              {time}
            </div>
          );
        })}

        {/* Sample Events */}
        {/* Monday 9-10am */}
        <div
          className="absolute rounded px-2 py-1 text-white text-xs overflow-hidden"
          style={{
            left: `${config.grid.x + config.grid.timeColumnWidth + 5}px`,
            top: `${200 + 3 * 100}px`, // 9am = 3 hours after 6am
            width: `${config.grid.dayColumnWidth - 10}px`,
            height: `${config.grid.hourHeight - 2}px`,
            backgroundColor: "#3b82f6",
          }}
        >
          <div className="font-semibold">Team Meeting</div>
          <div>9:00 - 10:00</div>
        </div>

        {/* Wednesday 2-3:30pm */}
        <div
          className="absolute rounded px-2 py-1 text-white text-xs overflow-hidden"
          style={{
            left: `${config.grid.x + config.grid.timeColumnWidth + 2 * config.grid.dayColumnWidth + 5}px`,
            top: `${200 + 8 * 100}px`, // 2pm = 8 hours after 6am
            width: `${config.grid.dayColumnWidth - 10}px`,
            height: `${config.grid.hourHeight * 1.5 - 2}px`,
            backgroundColor: "#10b981",
          }}
        >
          <div className="font-semibold">Client Call</div>
          <div>14:00 - 15:30</div>
        </div>

        {/* Friday 4-5pm */}
        <div
          className="absolute rounded px-2 py-1 text-white text-xs overflow-hidden"
          style={{
            left: `${config.grid.x + config.grid.timeColumnWidth + 4 * config.grid.dayColumnWidth + 5}px`,
            top: `${200 + 10 * 100}px`, // 4pm = 10 hours after 6am
            width: `${config.grid.dayColumnWidth - 10}px`,
            height: `${config.grid.hourHeight - 2}px`,
            backgroundColor: "#f59e0b",
          }}
        >
          <div className="font-semibold">Project Review</div>
          <div>16:00 - 17:00</div>
        </div>
      </div>
    </div>
  );
}
