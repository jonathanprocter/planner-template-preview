import { useState } from "react";
import { Button } from "@/components/ui/button";

interface SmartRemindersProps {
  sessionNumber: number | null;
  totalSessions: number | null;
  currentReminders: string[];
  onAddReminder: (reminder: string) => void;
}

export function SmartReminders({ sessionNumber, totalSessions, currentReminders, onAddReminder }: SmartRemindersProps) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const generateSuggestions = (): Array<{ id: string; text: string; reason: string }> => {
    const suggestions: Array<{ id: string; text: string; reason: string }> = [];

    // Session-based reminders
    if (sessionNumber && totalSessions) {
      // First session
      if (sessionNumber === 1) {
        suggestions.push({
          id: "first-session-intake",
          text: "Complete intake paperwork and assessment",
          reason: "First session - initial assessment needed"
        });
        suggestions.push({
          id: "first-session-goals",
          text: "Establish treatment goals and expectations",
          reason: "First session - goal setting"
        });
      }

      // Mid-treatment check-in (around session 6-8)
      if (sessionNumber >= 6 && sessionNumber <= 8) {
        suggestions.push({
          id: "mid-treatment-review",
          text: "Review treatment progress and adjust goals if needed",
          reason: `Session ${sessionNumber} - mid-treatment checkpoint`
        });
      }

      // Approaching insurance authorization limit
      if (sessionNumber % 8 === 0 && sessionNumber < totalSessions) {
        suggestions.push({
          id: "insurance-auth",
          text: "Request insurance authorization for continued treatment",
          reason: `Session ${sessionNumber} - insurance authorization may be needed`
        });
      }

      // Approaching end of planned sessions
      if (totalSessions - sessionNumber <= 3 && totalSessions - sessionNumber > 0) {
        suggestions.push({
          id: "termination-planning",
          text: "Begin discussing treatment termination and aftercare planning",
          reason: `${totalSessions - sessionNumber} sessions remaining`
        });
      }

      // Final session
      if (sessionNumber === totalSessions) {
        suggestions.push({
          id: "final-session-summary",
          text: "Complete discharge summary and provide aftercare resources",
          reason: "Final session - wrap-up needed"
        });
      }
    }

    // General reminders that apply to any session
    suggestions.push({
      id: "progress-notes",
      text: "Complete progress notes within 24 hours",
      reason: "Standard documentation requirement"
    });

    // Filter out already added reminders and dismissed suggestions
    return suggestions.filter(
      s => !currentReminders.some(r => r.toLowerCase().includes(s.text.toLowerCase().substring(0, 20))) &&
           !dismissed.has(s.id)
    );
  };

  const suggestions = generateSuggestions();

  if (suggestions.length === 0) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-4 rounded-lg border-l-4 border-indigo-400">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">💡</span>
        <h3 className="font-semibold text-sm text-indigo-700">Smart Reminder Suggestions</h3>
      </div>

      <div className="space-y-2">
        {suggestions.map((suggestion) => (
          <div key={suggestion.id} className="bg-white p-3 rounded-lg border border-indigo-200 flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="text-sm font-medium text-gray-900">{suggestion.text}</div>
              <div className="text-xs text-gray-500 mt-1">{suggestion.reason}</div>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="bg-indigo-500 text-white hover:bg-indigo-600 border-0 text-xs"
                onClick={() => {
                  onAddReminder(suggestion.text);
                  const newDismissed = new Set(dismissed);
                  newDismissed.add(suggestion.id);
                  setDismissed(newDismissed);
                }}
              >
                + Add
              </Button>
              <button
                onClick={() => {
                  const newDismissed = new Set(dismissed);
                  newDismissed.add(suggestion.id);
                  setDismissed(newDismissed);
                }}
                className="text-gray-400 hover:text-gray-600 text-xs"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
