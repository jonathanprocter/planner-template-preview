interface Event {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  color: string;
  source?: string;
  date?: string; // ISO date string (YYYY-MM-DD) for weekly view placement
}

interface Task {
  id: string;
  text: string;
  completed: boolean;
}

class EventStore {
  private events: Event[] = [
    { id: "1", title: "Team Meeting", startTime: "09:00", endTime: "10:00", color: "#3b82f6", source: "local", date: new Date().toISOString().split('T')[0] },
    { id: "2", title: "Client Call", startTime: "14:00", endTime: "15:30", color: "#10b981", source: "local", date: new Date().toISOString().split('T')[0] },
    { id: "3", title: "Project Review", startTime: "16:00", endTime: "17:00", color: "#f59e0b", source: "local", date: new Date().toISOString().split('T')[0] },
  ];

  private tasks: Task[] = [
    { id: "1", text: "Review project proposal", completed: false },
    { id: "2", text: "Send follow-up emails", completed: true },
    { id: "3", text: "Update documentation", completed: false },
    { id: "4", text: "Prepare presentation slides", completed: false },
  ];

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
}

export const eventStore = new EventStore();
export type { Event, Task };
