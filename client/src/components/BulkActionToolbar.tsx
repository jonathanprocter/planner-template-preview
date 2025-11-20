import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface BulkActionToolbarProps {
  selectedCount: number;
  onClearSelection: () => void;
  onBulkStatusUpdate: (status: "scheduled" | "completed" | "client_canceled" | "therapist_canceled" | "no_show") => void;
}

export function BulkActionToolbar({ selectedCount, onClearSelection, onBulkStatusUpdate }: BulkActionToolbarProps) {
  if (selectedCount === 0) return null;

  const statusOptions = [
    { value: "scheduled" as const, label: "Scheduled", icon: "📅", color: "bg-blue-500" },
    { value: "completed" as const, label: "Completed", icon: "✓", color: "bg-green-500" },
    { value: "client_canceled" as const, label: "Client Canceled", icon: "⚠", color: "bg-red-500" },
    { value: "therapist_canceled" as const, label: "Therapist Canceled", icon: "⚠", color: "bg-yellow-500" },
    { value: "no_show" as const, label: "No-Show", icon: "✗", color: "bg-gray-500" },
  ];

  return (
    <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 bg-white border-2 border-gray-300 rounded-lg shadow-2xl px-6 py-4 z-50 flex items-center gap-4">
      <div className="flex items-center gap-2">
        <div className="bg-blue-100 text-blue-800 font-bold px-3 py-1 rounded-full text-sm">
          {selectedCount} selected
        </div>
        <button
          onClick={onClearSelection}
          className="text-gray-500 hover:text-gray-700 text-sm underline"
        >
          Clear
        </button>
      </div>

      <div className="h-6 w-px bg-gray-300"></div>

      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-gray-700">Update Status:</span>
        {statusOptions.map((option) => (
          <Button
            key={option.value}
            size="sm"
            variant="outline"
            className={`${option.color} text-white hover:opacity-80 border-0`}
            onClick={() => {
              onBulkStatusUpdate(option.value);
              toast.success(`Updated ${selectedCount} appointments to ${option.label}`);
            }}
          >
            {option.icon} {option.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
