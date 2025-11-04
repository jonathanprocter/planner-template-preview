import { type Event } from "@/lib/eventStore";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface EventTooltipProps {
  event: Event;
  children: React.ReactNode;
}

export function EventTooltip({ event, children }: EventTooltipProps) {
  return (
    <Tooltip delayDuration={300}>
      <TooltipTrigger asChild>
        {children}
      </TooltipTrigger>
      <TooltipContent side="right" className="max-w-sm p-4">
        <div className="space-y-2">
          <div className="font-semibold text-base">{event.title}</div>
          
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium">Time:</span>
            <span>{event.startTime} - {event.endTime}</span>
          </div>
          
          {event.date && (
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium">Date:</span>
              <span>{new Date(event.date).toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
                year: "numeric"
              })}</span>
            </div>
          )}
          
          {event.category && (
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium">Category:</span>
              <span className="px-2 py-1 rounded text-xs" style={{ backgroundColor: event.color + "40", color: event.color }}>
                {event.category}
              </span>
            </div>
          )}
          
          {event.source && (
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium">Source:</span>
              <span className="capitalize">{event.source === "google" ? "📅 Google Calendar" : "Local"}</span>
            </div>
          )}
          
          {event.recurring && (
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium">Recurring:</span>
              <span className="capitalize">{event.recurring.frequency}</span>
            </div>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
