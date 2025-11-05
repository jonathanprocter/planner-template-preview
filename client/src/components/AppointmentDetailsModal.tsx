import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { type Event } from "@/lib/eventStore";

interface AppointmentDetailsModalProps {
  appointment: Event | null;
  open: boolean;
  onClose: () => void;
}

export function AppointmentDetailsModal({ appointment, open, onClose }: AppointmentDetailsModalProps) {
  if (!appointment) return null;

  const isSimplePractice = (appointment as any).isSimplePractice;
  const isHoliday = (appointment as any).isHoliday;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">{appointment.title}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 mt-4">
          {/* Date and Time */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-semibold text-sm text-gray-600 mb-2">Date & Time</h3>
            <div className="space-y-1">
              <p className="text-lg">
                <span className="font-medium">Date:</span> {appointment.date ? new Date(appointment.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A'}
              </p>
              <p className="text-lg">
                <span className="font-medium">Time:</span> {appointment.startTime} - {appointment.endTime}
              </p>
            </div>
          </div>

          {/* Category and Source */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="font-semibold text-sm text-blue-600 mb-1">Category</h3>
              <p className="text-lg">{appointment.category || 'Uncategorized'}</p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <h3 className="font-semibold text-sm text-green-600 mb-1">Source</h3>
              <p className="text-lg">
                {isSimplePractice ? '🔒 SimplePractice' : isHoliday ? '🎉 Holiday' : appointment.source === 'google' ? '📅 Google Calendar' : 'Local'}
              </p>
            </div>
          </div>

          {/* Client Notes / Description */}
          {appointment.description && (
            <div className="bg-amber-50 p-4 rounded-lg border-l-4 border-amber-400">
              <h3 className="font-semibold text-sm text-amber-700 mb-2">📝 Client Notes</h3>
              <p className="text-base whitespace-pre-wrap leading-relaxed">{appointment.description}</p>
            </div>
          )}

          {!appointment.description && (
            <div className="bg-gray-50 p-4 rounded-lg border border-dashed border-gray-300">
              <p className="text-gray-500 text-center italic">No notes available for this appointment</p>
            </div>
          )}

          {/* Recurrence Info */}
          {appointment.recurring && (
            <div className="bg-purple-50 p-4 rounded-lg">
              <h3 className="font-semibold text-sm text-purple-600 mb-1">🔄 Recurring</h3>
              <p className="text-lg">{appointment.recurring.frequency}</p>
            </div>
          )}

          {/* Calendar ID (for debugging/reference) */}
          {(appointment as any).calendarId && (
            <div className="text-xs text-gray-400 pt-2 border-t">
              <p>Calendar ID: {(appointment as any).calendarId.substring(0, 40)}...</p>
            </div>
          )}
        </div>

        {/* Close button */}
        <div className="flex justify-end mt-6">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
