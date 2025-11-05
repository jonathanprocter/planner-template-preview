import { useState } from "react";
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
  const [isSaving, setIsSaving] = useState(false);

  const updateNotesMutation = trpc.appointments.updateNotes.useMutation();

  if (!appointment) return null;

  const isSimplePractice = (appointment as any).isSimplePractice;
  const isHoliday = (appointment as any).isHoliday;
  const appointmentId = (appointment as any).calendarId ? appointment.id : null;

  const handleEditClick = () => {
    setEditedNotes(appointment.description || "");
    setIsEditing(true);
  };

  const handleSaveClick = async () => {
    if (!appointmentId) {
      toast.error("Cannot update notes for local appointments");
      return;
    }

    setIsSaving(true);
    try {
      await updateNotesMutation.mutateAsync({
        googleEventId: appointmentId,
        notes: editedNotes,
      });
      
      // Update local appointment object
      if (appointment) {
        appointment.description = editedNotes;
      }
      
      toast.success("Notes saved successfully!");
      setIsEditing(false);
    } catch (error) {
      toast.error("Failed to save notes");
      console.error("Error saving notes:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelClick = () => {
    setIsEditing(false);
    setEditedNotes("");
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
              <h3 className="font-semibold text-sm text-amber-700">📝 Client Notes</h3>
              {!isEditing && appointmentId && (
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
                  placeholder="Enter client notes here..."
                />
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={handleCancelClick}
                    disabled={isSaving}
                    className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg font-medium transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveClick}
                    disabled={isSaving}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                  >
                    {isSaving ? 'Saving...' : 'Save'}
                  </button>
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
