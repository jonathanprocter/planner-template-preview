import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { format } from "date-fns";

interface AppointmentHistoryModalProps {
  googleEventId: string | null;
  open: boolean;
  onClose: () => void;
}

export function AppointmentHistoryModal({ googleEventId, open, onClose }: AppointmentHistoryModalProps) {
  const { data: history, isLoading } = trpc.appointments.getHistory.useQuery(
    { googleEventId: googleEventId || "" },
    { enabled: !!googleEventId && open }
  );

  const getChangeIcon = (changeType: string) => {
    switch (changeType) {
      case "created": return "✨";
      case "status_changed": return "📊";
      case "rescheduled": return "📅";
      case "notes_updated": return "📝";
      case "reminders_updated": return "📌";
      case "deleted": return "🗑️";
      default: return "📋";
    }
  };

  const getChangeColor = (changeType: string) => {
    switch (changeType) {
      case "created": return "bg-green-50 border-green-200";
      case "status_changed": return "bg-blue-50 border-blue-200";
      case "rescheduled": return "bg-yellow-50 border-yellow-200";
      case "notes_updated": return "bg-purple-50 border-purple-200";
      case "reminders_updated": return "bg-orange-50 border-orange-200";
      case "deleted": return "bg-red-50 border-red-200";
      default: return "bg-gray-50 border-gray-200";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold flex items-center gap-2">
            📜 Appointment History
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-gray-500">Loading history...</div>
          </div>
        ) : !history || history.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="text-6xl mb-4">📭</div>
            <div className="text-gray-500 text-lg">No history available</div>
            <div className="text-gray-400 text-sm mt-2">Changes will be tracked going forward</div>
          </div>
        ) : (
          <div className="space-y-4 mt-4">
            {/* Timeline */}
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200"></div>

              {/* History items */}
              {history.map((item, index) => (
                <div key={item.id} className="relative flex gap-4 mb-6">
                  {/* Timeline dot */}
                  <div className="flex-shrink-0 w-12 h-12 rounded-full bg-white border-2 border-gray-300 flex items-center justify-center text-xl z-10">
                    {getChangeIcon(item.changeType)}
                  </div>

                  {/* Content */}
                  <div className={`flex-1 border rounded-lg p-4 ${getChangeColor(item.changeType)}`}>
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="font-semibold text-gray-900 capitalize">
                          {item.changeType.replace(/_/g, ' ')}
                        </div>
                        <div className="text-xs text-gray-500">
                          {format(new Date(item.createdAt), 'PPpp')}
                        </div>
                      </div>
                    </div>

                    {item.description && (
                      <div className="text-sm text-gray-700 mb-2">
                        {item.description}
                      </div>
                    )}

                    {item.fieldChanged && (
                      <div className="text-xs text-gray-600 mt-2">
                        <span className="font-medium">Field:</span> {item.fieldChanged}
                      </div>
                    )}

                    {(item.oldValue || item.newValue) && (
                      <div className="grid grid-cols-2 gap-4 mt-3 text-xs">
                        {item.oldValue && (
                          <div>
                            <div className="font-medium text-gray-600 mb-1">Previous:</div>
                            <div className="bg-white/50 p-2 rounded border border-gray-200">
                              {item.oldValue}
                            </div>
                          </div>
                        )}
                        {item.newValue && (
                          <div>
                            <div className="font-medium text-gray-600 mb-1">New:</div>
                            <div className="bg-white/50 p-2 rounded border border-gray-200">
                              {item.newValue}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

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
