import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { type Event } from "@/lib/eventStore";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface AppointmentDetailsModalProps {
  appointment: Event | null;
  open: boolean;
  onClose: () => void;
}

export function AppointmentDetailsModal({ appointment, open, onClose }: AppointmentDetailsModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedNotes, setEditedNotes] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const updateNotesMutation = trpc.appointments.updateNotes.useMutation();

  const appointmentId = appointment ? appointment.id : null;
  const isSimplePractice = appointment ? (appointment as any).isSimplePractice : false;
  const isHoliday = appointment ? (appointment as any).isHoliday : false;
  const hasCalendarId = appointment ? !!(appointment as any).calendarId : false;

  // Auto-save effect with debouncing
  useEffect(() => {
    if (!isEditing || !appointmentId || !hasCalendarId) return;

    // Don't auto-save if notes haven't changed
    if (editedNotes === (appointment?.description || "")) return;

    setSaveStatus("saving");

    // Debounce: wait 2 seconds after user stops typing
    const timeoutId = setTimeout(async () => {
      try {
        await updateNotesMutation.mutateAsync({
          googleEventId: appointmentId,
          notes: editedNotes,
        });
        
        // Update local appointment object
        if (appointment) {
          appointment.description = editedNotes;
        }
        
        setSaveStatus("saved");
        
        // Reset to idle after 2 seconds
        setTimeout(() => {
          setSaveStatus("idle");
        }, 2000);
      } catch (error) {
        setSaveStatus("error");
        console.error("Error auto-saving notes:", error);
        
        // Reset to idle after 3 seconds
        setTimeout(() => {
          setSaveStatus("idle");
        }, 3000);
      }
    }, 2000);

    return () => clearTimeout(timeoutId);
  }, [editedNotes, isEditing, appointmentId, hasCalendarId, appointment]);

  if (!appointment) return null;

  const handleEditClick = () => {
    setEditedNotes(appointment.description || "");
    setIsEditing(true);
    setSaveStatus("idle");
  };

  const handleCancelClick = () => {
    setIsEditing(false);
    setEditedNotes("");
    setSaveStatus("idle");
  };

  const handleDoneClick = () => {
    setIsEditing(false);
    setSaveStatus("idle");
    toast.success("Notes updated!");
  };

  const getSaveStatusText = () => {
    switch (saveStatus) {
      case "saving":
        return "💾 Saving...";
      case "saved":
        return "✓ Saved";
      case "error":
        return "⚠️ Error saving";
      default:
        return "";
    }
  };

  const getSaveStatusColor = () => {
    switch (saveStatus) {
      case "saving":
        return "text-blue-600";
      case "saved":
        return "text-green-600";
      case "error":
        return "text-red-600";
      default:
        return "";
    }
  };

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
          <div className="bg-amber-50 p-4 rounded-lg border-l-4 border-amber-400">
            <div className="flex justify-between items-center mb-2">
              <div className="flex items-center gap-3">
                <h3 className="font-semibold text-sm text-amber-700">📝 Client Notes</h3>
                {isEditing && saveStatus !== "idle" && (
                  <span className={`text-xs font-medium ${getSaveStatusColor()}`}>
                    {getSaveStatusText()}
                  </span>
                )}
              </div>
              {!isEditing && hasCalendarId && (
                <button
                  onClick={handleEditClick}
                  className="text-sm px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded transition-colors"
                >
                  ✏️ Edit
                </button>
              )}
            </div>
            
            {isEditing ? (
              <div className="space-y-3">
                <textarea
                  value={editedNotes}
                  onChange={(e) => setEditedNotes(e.target.value)}
                  className="w-full min-h-[150px] p-3 border border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 resize-vertical"
                  placeholder="Enter client notes here... (auto-saves as you type)"
                  autoFocus
                />
                <div className="flex gap-2 justify-between items-center">
                  <p className="text-xs text-gray-500 italic">
                    Changes are saved automatically after you stop typing
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={handleCancelClick}
                      className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg font-medium transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDoneClick}
                      className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium transition-colors"
                    >
                      Done
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {appointment.description ? (
                  <p className="text-base whitespace-pre-wrap leading-relaxed">{appointment.description}</p>
                ) : (
                  <p className="text-gray-500 italic">No notes available for this appointment</p>
                )}
              </>
            )}
          </div>

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
        {!isEditing && (
          <div className="flex justify-end mt-6">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg font-medium transition-colors"
            >
              Close
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
