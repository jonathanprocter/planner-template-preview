import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { eventStore, type Event } from "@/lib/eventStore";

interface SearchBarProps {
  onResultClick?: (event: Event) => void;
}

export function SearchBar({ onResultClick }: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Event[]>([]);
  const [showResults, setShowResults] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleSearch = (value: string) => {
    setQuery(value);
    if (value.trim().length > 0) {
      const searchResults = eventStore.searchEvents(value);
      setResults(searchResults);
      setShowResults(true);
    } else {
      setResults([]);
      setShowResults(false);
    }
  };

  const handleResultClick = (event: Event) => {
    setShowResults(false);
    setQuery("");
    onResultClick?.(event);
  };

  const handleBlur = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => setShowResults(false), 200);
  };

  return (
    <div className="relative w-full max-w-md">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
        <Input
          type="text"
          placeholder="Search appointments..."
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          onFocus={() => query && setShowResults(true)}
          onBlur={handleBlur}
          className="pl-10"
        />
      </div>

      {showResults && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
          {results.map((event) => (
            <div
              key={event.id}
              className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
              onClick={() => handleResultClick(event)}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: event.color }}
                />
                <div className="flex-1">
                  <div className="font-medium text-sm">{event.title}</div>
                  <div className="text-xs text-gray-500">
                    {event.date} • {event.startTime} - {event.endTime}
                    {event.category && ` • ${event.category}`}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showResults && results.length === 0 && query && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-50 px-4 py-3 text-sm text-gray-500">
          No appointments found
        </div>
      )}
    </div>
  );
}
