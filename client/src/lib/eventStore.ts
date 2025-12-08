export interface Event {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  color: string;
  source?: string;
  date?: string; // ISO date string (YYYY-MM-DD) for weekly view placement
  category?: string; // Category label (e.g., "Work", "Personal", "Meeting")
  description?: string; // Client notes or appointment description
  recurring?: {
    frequency: "daily" | "weekly" | "monthly";
    endDate?: string; // Optional end date for recurring events
  };
  // Extended properties from database
  calendarId?: string;
  isSimplePractice?: boolean;
  isHoliday?: boolean;
  isFlight?: boolean;
  isMeeting?: boolean;
  status?: 'scheduled' | 'completed' | 'client_canceled' | 'therapist_canceled' | 'no_show';
  reminders?: string | string[];
  notes?: string;
  sessionNumber?: number | null;
  totalSessions?: number | null;
  presentingConcerns?: string;
  lastSessionDate?: string;
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

  /**
   * Subscribe to store changes
   * @param listener Callback function to be called on store updates
   * @returns Unsubscribe function
   */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Notify all subscribers of store changes
   */
  private notify(): void {
    this.listeners.forEach(listener => listener());
  }

  /**
   * Get all events (returns a copy to prevent external mutations)
   */
  getEvents(): Event[] {
    return [...this.events];
  }

  /**
   * Replace all events with a new array
   */
  setEvents(events: Event[]): void {
    this.events = events;
    this.notify();
  }

  /**
   * Add a new event to the store
   */
  addEvent(event: Event): void {
    this.events.push(event);
    this.notify();
  }

  /**
   * Update an existing event by ID
   */
  updateEvent(id: string, updates: Partial<Event>): void {
    const index = this.events.findIndex(e => e.id === id);
    if (index !== -1) {
      this.events[index] = { ...this.events[index], ...updates };
      this.notify();
    }
  }

  /**
   * Delete an event by ID
   */
  deleteEvent(id: string): void {
    this.events = this.events.filter(e => e.id !== id);
    this.notify();
  }

  /**
   * Get all tasks (returns a copy to prevent external mutations)
   */
  getTasks(): Task[] {
    return [...this.tasks];
  }

  /**
   * Replace all tasks with a new array
   */
  setTasks(tasks: Task[]): void {
    this.tasks = tasks;
    this.notify();
  }

  /**
   * Add a new task to the store
   */
  addTask(task: Task): void {
    this.tasks.push(task);
    this.notify();
  }

  /**
   * Update an existing task by ID
   */
  updateTask(id: string, updates: Partial<Task>): void {
    const index = this.tasks.findIndex(t => t.id === id);
    if (index !== -1) {
      this.tasks[index] = { ...this.tasks[index], ...updates };
      this.notify();
    }
  }

  /**
   * Delete a task by ID
   */
  deleteTask(id: string): void {
    this.tasks = this.tasks.filter(t => t.id !== id);
    this.notify();
  }

  /**
   * Search events by title or category
   * @param query Search query string
   * @returns Filtered array of events
   */
  searchEvents(query: string): Event[] {
    const lowerQuery = query.toLowerCase().trim();
    if (!lowerQuery) return this.getEvents();
    
    return this.events.filter(event => 
      event.title.toLowerCase().includes(lowerQuery) ||
      event.category?.toLowerCase().includes(lowerQuery) ||
      event.description?.toLowerCase().includes(lowerQuery)
    );
  }
}

export const CATEGORIES = [
  { name: "Work", color: "#3b82f6" },
  { name: "Personal", color: "#10b981" },
  { name: "Meeting", color: "#f59e0b" },
  { name: "Health", color: "#ef4444" },
  { name: "Social", color: "#8b5cf6" },
] as const;

export const eventStore = new EventStore();
export type { Task };
