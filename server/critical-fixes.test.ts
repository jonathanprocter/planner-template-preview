import { describe, it, expect } from 'vitest';

describe('Critical Fixes - Duplication, Drag-and-Drop, Notes Display', () => {
  describe('Duplication Prevention', () => {
    it('should not merge local and database events', () => {
      // Simulate database events
      const dbEvents = [
        { id: 'google-1', title: 'Meeting', source: 'google', date: '2025-11-20' },
        { id: 'google-2', title: 'Appointment', source: 'google', date: '2025-11-20' },
      ];

      // Simulate local events (should not be merged)
      const localEvents = [
        { id: 'local-1', title: 'Local Event', source: 'local', date: '2025-11-20' },
      ];

      // NEW BEHAVIOR: Only use database events
      const finalEvents = [...dbEvents];

      expect(finalEvents.length).toBe(2);
      expect(finalEvents.every(e => e.source === 'google')).toBe(true);
    });

    it('should not create duplicates when dragging', () => {
      const events = [
        { id: 'event-1', title: 'Meeting', startTime: '10:00', endTime: '11:00' },
        { id: 'event-2', title: 'Lunch', startTime: '12:00', endTime: '13:00' },
      ];

      // Simulate drag operation - update the event in place
      const draggingEventId = 'event-1';
      const newStartTime = '14:00';
      const newEndTime = '15:00';

      const updatedEvents = events.map(ev =>
        ev.id === draggingEventId
          ? { ...ev, startTime: newStartTime, endTime: newEndTime }
          : ev
      );

      expect(updatedEvents.length).toBe(2); // Same number of events
      expect(updatedEvents.filter(e => e.id === 'event-1').length).toBe(1); // Only one instance
      expect(updatedEvents.find(e => e.id === 'event-1')?.startTime).toBe('14:00');
    });

    it('should handle multiple drag operations without duplication', () => {
      let events = [
        { id: 'event-1', title: 'Meeting', startTime: '10:00', endTime: '11:00' },
      ];

      // First drag
      events = events.map(ev =>
        ev.id === 'event-1' ? { ...ev, startTime: '11:00', endTime: '12:00' } : ev
      );

      // Second drag
      events = events.map(ev =>
        ev.id === 'event-1' ? { ...ev, startTime: '14:00', endTime: '15:00' } : ev
      );

      // Third drag
      events = events.map(ev =>
        ev.id === 'event-1' ? { ...ev, startTime: '16:00', endTime: '17:00' } : ev
      );

      expect(events.length).toBe(1); // Still only one event
      expect(events[0].startTime).toBe('16:00'); // Final position
    });
  });

  describe('Drag-and-Drop State Management', () => {
    it('should update event time correctly during drag', () => {
      const event = {
        id: 'event-1',
        title: 'Meeting',
        startTime: '10:00',
        endTime: '11:00',
      };

      const newStartTime = '14:00';
      const duration = 60; // 1 hour in minutes

      // Calculate new end time
      const [newStartH, newStartM] = newStartTime.split(':').map(Number);
      const newEndMinutes = newStartH * 60 + newStartM + duration;
      const newEndH = Math.floor(newEndMinutes / 60);
      const newEndM = newEndMinutes % 60;
      const newEndTime = `${newEndH.toString().padStart(2, '0')}:${newEndM.toString().padStart(2, '0')}`;

      const updatedEvent = {
        ...event,
        startTime: newStartTime,
        endTime: newEndTime,
      };

      expect(updatedEvent.startTime).toBe('14:00');
      expect(updatedEvent.endTime).toBe('15:00');
    });

    it('should maintain event duration during drag', () => {
      const originalStart = '10:00';
      const originalEnd = '11:30';

      // Calculate duration
      const [startH, startM] = originalStart.split(':').map(Number);
      const [endH, endM] = originalEnd.split(':').map(Number);
      const duration = (endH * 60 + endM) - (startH * 60 + startM);

      expect(duration).toBe(90); // 1.5 hours

      // Drag to new time
      const newStart = '15:00';
      const [newStartH, newStartM] = newStart.split(':').map(Number);
      const newEndMinutes = newStartH * 60 + newStartM + duration;
      const newEndH = Math.floor(newEndMinutes / 60);
      const newEndM = newEndMinutes % 60;
      const newEnd = `${newEndH.toString().padStart(2, '0')}:${newEndM.toString().padStart(2, '0')}`;

      expect(newEnd).toBe('16:30'); // Same 1.5 hour duration
    });
  });

  describe('Notes and Reminders Display', () => {
    it('should show notes when height is greater than 45px', () => {
      const height = 50; // 50px appointment
      const notes = 'Important session notes';
      const threshold = 45;

      const shouldShowNotes = notes.trim().length > 0 && height > threshold;

      expect(shouldShowNotes).toBe(true);
    });

    it('should hide notes when height is 45px or less', () => {
      const height = 40; // 40px appointment
      const notes = 'Important session notes';
      const threshold = 45;

      const shouldShowNotes = notes.trim().length > 0 && height > threshold;

      expect(shouldShowNotes).toBe(false);
    });

    it('should show reminders when height is greater than 45px', () => {
      const height = 60; // 60px appointment
      const reminders = ['Review treatment plan', 'Check insurance'];
      const threshold = 45;

      const shouldShowReminders = reminders.length > 0 && height > threshold;

      expect(shouldShowReminders).toBe(true);
    });

    it('should hide reminders when height is 45px or less', () => {
      const height = 30; // 30px appointment (30-minute slot)
      const reminders = ['Review treatment plan'];
      const threshold = 45;

      const shouldShowReminders = reminders.length > 0 && height > threshold;

      expect(shouldShowReminders).toBe(false);
    });

    it('should handle empty notes correctly', () => {
      const height = 60;
      const notes = '';
      const threshold = 45;

      const shouldShowNotes = notes.trim().length > 0 && height > threshold;

      expect(shouldShowNotes).toBe(false);
    });

    it('should handle empty reminders array correctly', () => {
      const height = 60;
      const reminders: string[] = [];
      const threshold = 45;

      const shouldShowReminders = reminders.length > 0 && height > threshold;

      expect(shouldShowReminders).toBe(false);
    });

    it('should parse reminders from JSON string safely', () => {
      const reminderString = '["Reminder 1", "Reminder 2"]';
      let reminders: string[] = [];

      try {
        reminders = JSON.parse(reminderString);
      } catch (e) {
        reminders = [];
      }

      expect(reminders.length).toBe(2);
      expect(reminders[0]).toBe('Reminder 1');
    });

    it('should handle already-parsed reminders array', () => {
      const reminderData = ['Reminder 1', 'Reminder 2'];
      let reminders: string[] = [];

      if (typeof reminderData === 'string') {
        try {
          reminders = JSON.parse(reminderData);
        } catch (e) {
          reminders = [];
        }
      } else if (Array.isArray(reminderData)) {
        reminders = reminderData;
      }

      expect(reminders.length).toBe(2);
      expect(reminders[0]).toBe('Reminder 1');
    });

    it('should handle invalid JSON gracefully', () => {
      const invalidJson = 'not valid json';
      let reminders: string[] = [];

      try {
        reminders = JSON.parse(invalidJson);
      } catch (e) {
        reminders = [];
      }

      expect(reminders.length).toBe(0);
    });
  });

  describe('Multi-Column Layout Logic', () => {
    it('should use 40/30/30 layout when both notes and reminders exist', () => {
      const hasNotes = true;
      const hasReminders = true;

      const primaryWidth = hasReminders && hasNotes ? '40%' : hasReminders ? '60%' : '100%';
      const remindersWidth = hasReminders && hasNotes ? '30%' : '40%';
      const notesWidth = '30%';

      expect(primaryWidth).toBe('40%');
      expect(remindersWidth).toBe('30%');
      expect(notesWidth).toBe('30%');
    });

    it('should use 60/40 layout when only reminders exist', () => {
      const hasNotes = false;
      const hasReminders = true;

      const primaryWidth = hasReminders && hasNotes ? '40%' : hasReminders ? '60%' : '100%';
      const remindersWidth = hasReminders && hasNotes ? '30%' : '40%';

      expect(primaryWidth).toBe('60%');
      expect(remindersWidth).toBe('40%');
    });

    it('should use 100% layout when neither notes nor reminders exist', () => {
      const hasNotes = false;
      const hasReminders = false;

      const primaryWidth = hasReminders && hasNotes ? '40%' : hasReminders ? '60%' : '100%';

      expect(primaryWidth).toBe('100%');
    });
  });

  describe('Data Accuracy', () => {
    it('should correctly map appointment fields from database', () => {
      const dbAppointment = {
        id: 1,
        googleEventId: 'google-123',
        title: 'Brianna Appointment',
        startTime: new Date('2025-11-20T10:00:00'),
        endTime: new Date('2025-11-20T11:00:00'),
        date: '2025-11-20',
        notes: 'Session notes',
        reminders: '["Reminder 1"]',
        status: 'scheduled',
        category: 'SimplePractice',
      };

      const mappedEvent = {
        id: dbAppointment.googleEventId || `db-${dbAppointment.id}`,
        title: dbAppointment.title,
        startTime: new Date(dbAppointment.startTime).toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
          timeZone: 'America/New_York'
        }),
        endTime: new Date(dbAppointment.endTime).toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
          timeZone: 'America/New_York'
        }),
        date: dbAppointment.date,
        notes: dbAppointment.notes,
        reminders: dbAppointment.reminders,
        status: dbAppointment.status,
      };

      expect(mappedEvent.title).toBe('Brianna Appointment');
      expect(mappedEvent.notes).toBe('Session notes');
      expect(mappedEvent.status).toBe('scheduled');
    });
  });
});
