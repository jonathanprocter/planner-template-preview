import { useState, useEffect } from "react";
import { eventStore } from "@/lib/eventStore";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Filter } from "lucide-react";

interface CategoryFilterProps {
  onFilterChange: (categories: string[]) => void;
}

export function CategoryFilter({ onFilterChange }: CategoryFilterProps) {
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  useEffect(() => {
    // Get unique categories from all events
    const events = eventStore.getEvents();
    const uniqueCategories = Array.from(
      new Set(events.map(e => e.category).filter(Boolean) as string[])
    );
    setCategories(uniqueCategories);
    setSelectedCategories(uniqueCategories); // Select all by default
  }, []);

  const handleToggleCategory = (category: string) => {
    const newSelected = selectedCategories.includes(category)
      ? selectedCategories.filter(c => c !== category)
      : [...selectedCategories, category];
    
    setSelectedCategories(newSelected);
    onFilterChange(newSelected);
  };

  const handleSelectAll = () => {
    setSelectedCategories(categories);
    onFilterChange(categories);
  };

  const handleClearAll = () => {
    setSelectedCategories([]);
    onFilterChange([]);
  };

  if (categories.length === 0) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="inline-flex items-center justify-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50">
        <Filter className="h-4 w-4" />
        Filter by Category
        {selectedCategories.length < categories.length && (
          <span className="ml-1 text-xs bg-primary text-primary-foreground rounded-full px-2 py-0.5">
            {selectedCategories.length}/{categories.length}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <div className="flex gap-2 p-2 border-b">
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 h-7 text-xs"
            onClick={handleSelectAll}
          >
            Select All
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 h-7 text-xs"
            onClick={handleClearAll}
          >
            Clear All
          </Button>
        </div>
        {categories.map((category) => (
          <DropdownMenuCheckboxItem
            key={category}
            checked={selectedCategories.includes(category)}
            onCheckedChange={() => handleToggleCategory(category)}
          >
            {category}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
