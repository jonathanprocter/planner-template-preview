import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { type Event } from "@/lib/eventStore";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { deleteEvent, isSignedIn } from "@/lib/googleCalendar";
import { AppointmentHistoryModal } from "./AppointmentHistoryModal";
import { SmartReminders } from "./SmartReminders";
import { useUndoRedo } from "@/hooks/useUndoRedo";

// Extended Event type with additional properties
interface ExtendedEvent extends Event {
  isSimplePractice?: boolean;
  isHoliday?: boolean;
  calendarId?: string;
  noteTags?: string;
  reminders?: string;
  notes?: string;
  sessionNumber?: number | null;
  totalSessions?: number | null;
}

// Get access token from gapi if available
function getAccessToken(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const gapi = (window as any).gapi;
    if (gapi?.client && typeof gapi.client.getToken === 'function') {
      const token = gapi.client.getToken();
      return token?.access_token;
    }
  } catch (error) {
    console.warn('Could not get access token:', error);
  }
  return undefined;
}

// Safe JSON parse with error logging
function safeParseJSON<T>(json: string | null | undefined, fallback: T, context: string): T {
  if (!json) return fallback;
  try {
    const parsed = JSON.parse(json);
    return parsed as T;
  } catch (error) {
    console.error(`Failed to parse JSON for ${context}:`, error, 'Raw value:', json);
    return fallback;
  }
}

interface AppointmentDetailsModalProps {
  appointment: Event | null;
  open: boolean;
  onClose: () => void;
}

// Predefined note categories
const NOTE_CATEGORIES = [
  { id: "session", label: "Session Notes", color: "bg-blue-100 text-blue-800 border-blue-300" },
  { id: "treatment", label: "Treatment Plan", color: "bg-purple-100 text-purple-800 border-purple-300" },
  { id: "progress", label: "Progress", color: "bg-green-100 text-green-800 border-green-300" },
  { id: "administrative", label: "Administrative", color: "bg-gray-100 text-gray-800 border-gray-300" },
  { id: "billing", label: "Billing", color: "bg-yellow-100 text-yellow-800 border-yellow-300" },
  { id: "followup", label: "Follow-up", color: "bg-pink-100 text-pink-800 border-pink-300" },
];

export function AppointmentDetailsModal({ appointment, open, onClose }: AppointmentDetailsModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedNotes, setEditedNotes] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [status, setStatus] = useState<"scheduled" | "completed" | "client_canceled" | "therapist_canceled" | "no_show">("scheduled");
  const [reminders, setReminders] = useState<string[]>([]);
  const [sessionNotes, setSessionNotes] = useState("");
  const [sessionNumber, setSessionNumber] = useState<number | null>(null);
  const [totalSessions, setTotalSessions] = useState<number | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const updateNotesMutation = trpc.appointments.updateNotes.useMutation();
  const updateTagsMutation = trpc.appointments.updateNoteTags.useMutation();
  const updateDetailsMutation = trpc.appointments.updateAppointmentDetails.useMutation();
  const deleteMutation = trpc.appointments.deleteAppointment.useMutation();
  const utils = trpc.useUtils();
  const { addAction } = useUndoRedo();

  // Track pending mutation to prevent race conditions
  const pendingMutationRef = useRef<AbortController | null>(null);
  const lastSavedNotesRef = useRef<string>("");

  // Type-safe access to extended appointment properties
  const extendedAppointment = appointment as ExtendedEvent | null;
  const appointmentId = extendedAppointment?.id ?? null;
  const isSimplePractice = extendedAppointment?.isSimplePractice ?? false;
  const isHoliday = extendedAppointment?.isHoliday ?? false;
  const hasCalendarId = !!extendedAppointment?.calendarId;

  // Load tags and status when appointment changes
  useEffect(() => {
    if (extendedAppointment) {
      // Load tags with safe parsing
      const tags = safeParseJSON<string[]>(extendedAppointment.noteTags, [], 'noteTags');
      setSelectedTags(Array.isArray(tags) ? tags : []);

      // Load status
      setStatus(extendedAppointment.status || "scheduled");

      // Load reminders with safe parsing
      const remindersList = safeParseJSON<string[]>(extendedAppointment.reminders, [], 'reminders');
      setReminders(Array.isArray(remindersList) ? remindersList : []);

      // Load session notes
      setSessionNotes(extendedAppointment.notes || "");

      // Load session tracking
      setSessionNumber(extendedAppointment.sessionNumber ?? null);
      setTotalSessions(extendedAppointment.totalSessions ?? null);

      // Reset mutation tracking
      lastSavedNotesRef.current = extendedAppointment.description || "";
    }
  }, [extendedAppointment]);

  // Auto-save effect with debouncing and race condition prevention
  useEffect(() => {
    if (!isEditing || !appointmentId || !hasCalendarId) return;

    // Don't auto-save if notes haven't changed from last saved value
    if (editedNotes === lastSavedNotesRef.current) return;

    setSaveStatus("saving");

    // Cancel any pending mutation
    if (pendingMutationRef.current) {
      pendingMutationRef.current.abort();
    }

    // Create new abort controller for this mutation
    const abortController = new AbortController();
    pendingMutationRef.current = abortController;

    // Debounce: wait 2 seconds after user stops typing
    const timeoutId = setTimeout(async () => {
      // Check if this mutation was cancelled
      if (abortController.signal.aborted) return;

      try {
        await updateNotesMutation.mutateAsync({
          googleEventId: appointmentId,
          notes: editedNotes,
        });

        // Check if cancelled during async operation
        if (abortController.signal.aborted) return;

        // Update tracking ref
        lastSavedNotesRef.current = editedNotes;

        // Update local appointment object
        if (extendedAppointment) {
          extendedAppointment.description = editedNotes;
        }

        setSaveStatus("saved");

        // Reset to idle after 2 seconds
        setTimeout(() => {
          if (!abortController.signal.aborted) {
            setSaveStatus("idle");
          }
        }, 2000);
      } catch (error) {
        // Ignore abort errors
        if (abortController.signal.aborted) return;

        setSaveStatus("error");
        console.error("Error auto-saving notes:", error);

        // Reset to idle after 3 seconds
        setTimeout(() => {
          if (!abortController.signal.aborted) {
            setSaveStatus("idle");
          }
        }, 3000);
      }
    }, 2000);

    return () => {
      clearTimeout(timeoutId);
      abortController.abort();
    };
  }, [editedNotes, isEditing, appointmentId, hasCalendarId, extendedAppointment, updateNotesMutation]);

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

  const handleDelete = async () => {
    if (!appointment || !hasCalendarId) return;
    
    const confirmed = window.confirm(`Are you sure you want to delete "${appointment.title}"?`);
    if (!confirmed) return;

    try {
      const accessToken = getAccessToken();
      
      // Delete from database and Google Calendar (backend handles both)
      await deleteMutation.mutateAsync({
        googleEventId: appointment.id,
        accessToken,
      });
      toast.success("Appointment deleted successfully!");
      utils.appointments.getByDateRange.invalidate();
      onClose();
    } catch (error) {
      console.error('Failed to delete appointment:', error);
      toast.error("Failed to delete appointment");
    }
  };

  const handleTagToggle = async (tagId: string) => {
    if (!hasCalendarId || !appointmentId) {
      toast.error("Cannot update tags for local appointments");
      return;
    }

    const newTags = selectedTags.includes(tagId)
      ? selectedTags.filter(t => t !== tagId)
      : [...selectedTags, tagId];
    
    setSelectedTags(newTags);

    try {
      await updateTagsMutation.mutateAsync({
        googleEventId: appointmentId,
        tags: newTags,
      });
      
      // Update local appointment object
      if (extendedAppointment) {
        extendedAppointment.noteTags = JSON.stringify(newTags);
      }
      
      toast.success("Tags updated!");
    } catch (error) {
      // Revert on error
      setSelectedTags(selectedTags);
      toast.error("Failed to update tags");
      console.error("Error updating tags:", error);
    }
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

  const handleSaveChanges = async () => {
    if (!appointmentId || !hasCalendarId || !extendedAppointment) return;

    // Store original values for undo
    const originalStatus = extendedAppointment.status || 'scheduled';
    const originalReminders = safeParseJSON<string[]>(extendedAppointment.reminders, [], 'reminders');
    const originalNotes = extendedAppointment.notes || '';
    const originalSessionNumber = extendedAppointment.sessionNumber;
    const originalTotalSessions = extendedAppointment.totalSessions;
    
    try {
      await updateDetailsMutation.mutateAsync({
        googleEventId: appointmentId,
        status,
        reminders,
        notes: sessionNotes,
        sessionNumber,
        totalSessions,
      });
      
      // Update local appointment object
      if (extendedAppointment) {
        extendedAppointment.status = status;
        extendedAppointment.reminders = JSON.stringify(reminders);
        extendedAppointment.notes = sessionNotes;
        extendedAppointment.sessionNumber = sessionNumber;
        extendedAppointment.totalSessions = totalSessions;
      }
      
      // Add undo action
      addAction({
        type: 'status_change',
        timestamp: new Date(),
        data: { appointmentId, originalStatus, newStatus: status },
        description: `Changed ${appointment?.title} status from ${originalStatus} to ${status}`,
        undo: async () => {
          await updateDetailsMutation.mutateAsync({
            googleEventId: appointmentId,
            status: originalStatus,
            reminders: originalReminders,
            notes: originalNotes,
            sessionNumber: originalSessionNumber,
            totalSessions: originalTotalSessions,
          });
          await utils.appointments.getByDateRange.invalidate();
        },
        redo: async () => {
          await updateDetailsMutation.mutateAsync({
            googleEventId: appointmentId,
            status,
            reminders,
            notes: sessionNotes,
            sessionNumber,
            totalSessions,
          });
          await utils.appointments.getByDateRange.invalidate();
        },
      });
      
      toast.success("Changes saved successfully!");
      // Force refetch to ensure UI updates with new status/reminders/notes
      await utils.appointments.getByDateRange.invalidate();
    } catch (error) {
      toast.error("Failed to save changes");
      console.error("Error saving changes:", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-2xl font-bold">{appointment.title}</DialogTitle>
            {hasCalendarId && (
              <button
                onClick={() => setShowHistory(true)}
                className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                📜 History
              </button>
            )}
          </div>
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

          {/* Appointment Status */}
          {hasCalendarId && (
            <div className="bg-slate-50 p-4 rounded-lg border-l-4 border-slate-400">
              <h3 className="font-semibold text-sm text-slate-700 mb-3">📊 Appointment Status</h3>
              <div className="space-y-2">
                {[
                  { value: "scheduled", label: "Scheduled", icon: "📅" },
                  { value: "completed", label: "Completed", icon: "✓" },
                  { value: "client_canceled", label: "Client Canceled", icon: "⚠" },
                  { value: "therapist_canceled", label: "Therapist Canceled", icon: "⚠" },
                  { value: "no_show", label: "No-Show", icon: "✗" },
                ].map((option) => (
                  <label key={option.value} className="flex items-center gap-3 cursor-pointer hover:bg-slate-100 p-2 rounded transition-colors">
                    <input
                      type="radio"
                      name="status"
                      value={option.value}
                      checked={status === option.value}
                      onChange={(e) => setStatus(e.target.value as any)}
                      className="w-4 h-4"
                    />
                    <span className="text-base">{option.icon} {option.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Session Tracking */}
          {hasCalendarId && (
            <div className="bg-teal-50 p-4 rounded-lg border-l-4 border-teal-400">
              <h3 className="font-semibold text-sm text-teal-700 mb-3">📝 Session Tracking</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Session Number</label>
                  <input
                    type="number"
                    value={sessionNumber || ""}
                    onChange={(e) => setSessionNumber(e.target.value ? parseInt(e.target.value) : null)}
                    className="w-full px-3 py-2 border border-teal-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                    placeholder="e.g., 8"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Total Sessions</label>
                  <input
                    type="number"
                    value={totalSessions || ""}
                    onChange={(e) => setTotalSessions(e.target.value ? parseInt(e.target.value) : null)}
                    className="w-full px-3 py-2 border border-teal-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                    placeholder="e.g., 12"
                  />
                </div>
              </div>
              {sessionNumber && totalSessions && (
                <p className="text-sm text-teal-600 mt-2">Session {sessionNumber} of {totalSessions}</p>
              )}
            </div>
          )}

          {/* Smart Reminder Suggestions */}
          {hasCalendarId && (
            <SmartReminders
              sessionNumber={sessionNumber}
              totalSessions={totalSessions}
              currentReminders={reminders}
              onAddReminder={(reminder) => setReminders([...reminders, reminder])}
            />
          )}

          {/* Reminders/Follow-up */}
          {hasCalendarId && (
            <div className="bg-orange-50 p-4 rounded-lg border-l-4 border-orange-400">
              <h3 className="font-semibold text-sm text-orange-700 mb-3">📌 Reminders & Follow-up</h3>
              <div className="space-y-2">
                {reminders.map((reminder, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <span className="text-base">• {reminder}</span>
                    <button
                      onClick={() => setReminders(reminders.filter((_, i) => i !== index))}
                      className="ml-auto text-red-600 hover:text-red-800 text-sm"
                    >
                      ✗
                    </button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Add reminder..."
                    className="flex-1 px-3 py-2 border border-orange-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                        setReminders([...reminders, e.currentTarget.value.trim()]);
                        e.currentTarget.value = '';
                      }
                    }}
                  />
                </div>
                {reminders.length === 0 && (
                  <p className="text-xs text-gray-500 italic">Press Enter to add reminders</p>
                )}
              </div>
            </div>
          )}

          {/* Note Tags */}
          {hasCalendarId && (
            <div className="bg-indigo-50 p-4 rounded-lg border-l-4 border-indigo-400">
              <h3 className="font-semibold text-sm text-indigo-700 mb-3">🏷️ Note Categories</h3>
              <div className="flex flex-wrap gap-2">
                {NOTE_CATEGORIES.map((category) => {
                  const isSelected = selectedTags.includes(category.id);
                  return (
                    <button
                      key={category.id}
                      onClick={() => handleTagToggle(category.id)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium border-2 transition-all ${
                        isSelected
                          ? category.color + " shadow-sm"
                          : "bg-white text-gray-600 border-gray-300 hover:border-gray-400"
                      }`}
                    >
                      {isSelected && "✓ "}
                      {category.label}
                    </button>
                  );
                })}
              </div>
              {selectedTags.length === 0 && (
                <p className="text-xs text-gray-500 italic mt-2">Click to add note categories</p>
              )}
            </div>
          )}

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

        {/* Action buttons */}
        {!isEditing && (
          <div className="flex justify-between mt-6">
            <button
              onClick={handleDelete}
              disabled={!hasCalendarId || deleteMutation.isPending}
              className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </button>
            <div className="flex gap-2">
              {hasCalendarId && (
                <button
                  onClick={handleSaveChanges}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                >
                  Save Changes
                </button>
              )}
              <button
                onClick={onClose}
                className="px-6 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg font-medium transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </DialogContent>

      <AppointmentHistoryModal
        googleEventId={appointmentId}
        open={showHistory}
        onClose={() => setShowHistory(false)}
      />
    </Dialog>
  );
}
