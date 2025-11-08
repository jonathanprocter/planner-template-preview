import { useState } from "react";
import { Search, Calendar, X } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { toast } from "sonner";

export function AdvancedSearch() {
  const [, setLocation] = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [startDate, setStartDate] = useState("2015-01-01");
  const [endDate, setEndDate] = useState("2030-12-31");
  const [category, setCategory] = useState("");

  const searchQuery = trpc.appointments.search.useQuery(
    {
      query,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      category: category || undefined,
    },
    {
      enabled: false, // Only run when explicitly called
    }
  );

  const handleSearch = () => {
    if (!query.trim()) {
      toast.error("Please enter a search term");
      return;
    }
    searchQuery.refetch();
  };

  const handleClear = () => {
    setQuery("");
    setStartDate("2015-01-01");
    setEndDate("2030-12-31");
    setCategory("");
  };

  const navigateToAppointment = (date: string) => {
    setIsOpen(false);
    setLocation(`/daily?date=${date}`);
  };

  const formatDateTime = (dateStr: string, time: string) => {
    const date = new Date(dateStr);
    return `${date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    })} at ${time}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Search appointments (2015-2030)..."
            className="pl-10 pr-4"
            readOnly
          />
        </div>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Search Appointments (2015-2030)</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <Input
              placeholder="Search by title or description..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="pl-10 pr-4 text-lg"
              autoFocus
            />
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                Start Date
              </label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                min="2015-01-01"
                max="2030-12-31"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                End Date
              </label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min="2015-01-01"
                max="2030-12-31"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                Category
              </label>
              <Input
                placeholder="Filter by category..."
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button onClick={handleSearch} className="flex-1" disabled={searchQuery.isLoading}>
              {searchQuery.isLoading ? "Searching..." : "Search"}
            </Button>
            <Button onClick={handleClear} variant="outline">
              <X className="w-4 h-4 mr-2" />
              Clear
            </Button>
          </div>

          {/* Results */}
          <div className="border-t pt-4 overflow-y-auto max-h-96">
            {searchQuery.isLoading && (
              <div className="text-center py-8 text-gray-500">
                Searching appointments...
              </div>
            )}

            {searchQuery.isError && (
              <div className="text-center py-8 text-red-500">
                Error searching appointments. Please try again.
              </div>
            )}

            {searchQuery.data && searchQuery.data.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No appointments found matching your search.
              </div>
            )}

            {searchQuery.data && searchQuery.data.length > 0 && (
              <div className="space-y-2">
                <div className="text-sm text-gray-600 mb-3">
                  Found {searchQuery.data.length} appointment{searchQuery.data.length !== 1 ? "s" : ""}
                </div>
                {searchQuery.data.map((appointment: any) => (
                  <div
                    key={appointment.id}
                    className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => navigateToAppointment(appointment.date)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg mb-1">
                          {appointment.title}
                        </h3>
                        {appointment.description && (
                          <p className="text-sm text-gray-600 mb-2">
                            {appointment.description}
                          </p>
                        )}
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {formatDateTime(appointment.date, appointment.startTime)}
                          </div>
                          {appointment.category && (
                            <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                              {appointment.category}
                            </span>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigateToAppointment(appointment.date);
                        }}
                      >
                        View Day
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}