interface Event {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  color: string;
  source?: string;
  date?: string; // ISO date string (YYYY-MM-DD) for weekly view placement
  category?: string; // Category label (e.g., "Work", "Personal", "Meeting")
  recurring?: {
    frequency: "daily" | "weekly" | "monthly";
    endDate?: string; // Optional end date for recurring events
  };
}

interface Task {
  id: string;
  text: string;
  completed: boolean;
}

class EventStore {
  private events: Event[] = [];

  private tasks: Task[] = [];

  private listeners: Set<() => void> = new Set();

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach(listener => listener());
  }

  getEvents(): Event[] {
    return [...this.events];
  }

  setEvents(events: Event[]) {
    this.events = events;
    this.notify();
  }

  addEvent(event: Event) {
    this.events.push(event);
    this.notify();
  }

  updateEvent(id: string, updates: Partial<Event>) {
    const index = this.events.findIndex(e => e.id === id);
    if (index !== -1) {
      this.events[index] = { ...this.events[index], ...updates };
      this.notify();
    }
  }

  deleteEvent(id: string) {
    this.events = this.events.filter(e => e.id !== id);
    this.notify();
  }

  getTasks(): Task[] {
    return [...this.tasks];
  }

  setTasks(tasks: Task[]) {
    this.tasks = tasks;
    this.notify();
  }

  addTask(task: Task) {
    this.tasks.push(task);
    this.notify();
  }

  updateTask(id: string, updates: Partial<Task>) {
    const index = this.tasks.findIndex(t => t.id === id);
    if (index !== -1) {
      this.tasks[index] = { ...this.tasks[index], ...updates };
      this.notify();
    }
  }

  searchEvents(query: string): Event[] {
    const lowerQuery = query.toLowerCase();
    return this.events.filter(event => 
      event.title.toLowerCase().includes(lowerQuery) ||
      event.category?.toLowerCase().includes(lowerQuery)
    );
  }
}

export const CATEGORIES = [
  { name: "Work", color: "#3b82f6" },
  { name: "Personal", color: "#10b981" },
  { name: "Meeting", color: "#f59e0b" },
  { name: "Health", color: "#ef4444" },
  { name: "Social", color: "#8b5cf6" },
];

export const eventStore = new EventStore();
export type { Event, Task };
