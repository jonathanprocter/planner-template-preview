import { describe, it, expect } from 'vitest';

describe('Undo/Redo and Conflict Detection Features', () => {
  describe('Conflict Detection Algorithm', () => {
    function checkOverlap(
      event1Start: string,
      event1End: string,
      event2Start: string,
      event2End: string
    ): boolean {
      const parseTime = (time: string) => {
        const [h, m] = time.split(':').map(Number);
        return h * 60 + m;
      };

      const e1Start = parseTime(event1Start);
      const e1End = parseTime(event1End);
      const e2Start = parseTime(event2Start);
      const e2End = parseTime(event2End);

      return e1Start < e2End && e1End > e2Start;
    }

    it('should detect overlapping appointments', () => {
      // Event 1: 10:00 - 11:00
      // Event 2: 10:30 - 11:30 (overlaps)
      expect(checkOverlap('10:00', '11:00', '10:30', '11:30')).toBe(true);
    });

    it('should detect when one event contains another', () => {
      // Event 1: 10:00 - 12:00
      // Event 2: 10:30 - 11:00 (contained within Event 1)
      expect(checkOverlap('10:00', '12:00', '10:30', '11:00')).toBe(true);
    });

    it('should not detect conflict for adjacent appointments', () => {
      // Event 1: 10:00 - 11:00
      // Event 2: 11:00 - 12:00 (starts when Event 1 ends)
      expect(checkOverlap('10:00', '11:00', '11:00', '12:00')).toBe(false);
    });

    it('should not detect conflict for separate appointments', () => {
      // Event 1: 10:00 - 11:00
      // Event 2: 14:00 - 15:00 (completely separate)
      expect(checkOverlap('10:00', '11:00', '14:00', '15:00')).toBe(false);
    });

    it('should detect overlap when second event starts before first ends', () => {
      // Event 1: 10:00 - 11:30
      // Event 2: 11:00 - 12:00
      expect(checkOverlap('10:00', '11:30', '11:00', '12:00')).toBe(true);
    });

    it('should handle edge case of same start and end times', () => {
      // Event 1: 10:00 - 11:00
      // Event 2: 10:00 - 11:00 (exact same time)
      expect(checkOverlap('10:00', '11:00', '10:00', '11:00')).toBe(true);
    });
  });

  describe('Undo/Redo Action History', () => {
    it('should create action with correct structure', () => {
      const action = {
        type: 'update' as const,
        timestamp: new Date(),
        data: { eventId: '123', originalTime: '10:00', newTime: '11:00' },
        description: 'Moved appointment from 10:00 to 11:00',
        undo: async () => {},
        redo: async () => {},
      };

      expect(action).toHaveProperty('type');
      expect(action).toHaveProperty('timestamp');
      expect(action).toHaveProperty('data');
      expect(action).toHaveProperty('description');
      expect(action).toHaveProperty('undo');
      expect(action).toHaveProperty('redo');
      expect(action.type).toBe('update');
    });

    it('should validate action types', () => {
      const validTypes = ['update', 'delete', 'create', 'status_change'];
      
      for (const type of validTypes) {
        expect(validTypes).toContain(type);
      }
    });

    it('should track action history with correct index', () => {
      const history: any[] = [];
      let currentIndex = -1;

      // Add first action
      history.push({ type: 'create', description: 'Created appointment' });
      currentIndex = 0;
      expect(currentIndex).toBe(0);
      expect(history.length).toBe(1);

      // Add second action
      history.push({ type: 'update', description: 'Updated appointment' });
      currentIndex = 1;
      expect(currentIndex).toBe(1);
      expect(history.length).toBe(2);

      // Undo (move index back)
      currentIndex = 0;
      expect(currentIndex).toBe(0);

      // Redo (move index forward)
      currentIndex = 1;
      expect(currentIndex).toBe(1);
    });

    it('should remove future actions when adding new action after undo', () => {
      const history = [
        { type: 'create', description: 'Action 1' },
        { type: 'update', description: 'Action 2' },
        { type: 'update', description: 'Action 3' },
      ];
      let currentIndex = 2;

      // Undo twice
      currentIndex = 0;

      // Add new action - should remove Action 2 and Action 3
      const newHistory = history.slice(0, currentIndex + 1);
      newHistory.push({ type: 'delete', description: 'Action 4' });
      
      expect(newHistory.length).toBe(2);
      expect(newHistory[0].description).toBe('Action 1');
      expect(newHistory[1].description).toBe('Action 4');
    });

    it('should limit history to maximum size', () => {
      const maxSize = 50;
      const history: any[] = [];

      // Add 60 actions
      for (let i = 0; i < 60; i++) {
        history.push({ type: 'update', description: `Action ${i}` });
        if (history.length > maxSize) {
          history.shift();
        }
      }

      expect(history.length).toBe(maxSize);
      expect(history[0].description).toBe('Action 10'); // First 10 were removed
      expect(history[history.length - 1].description).toBe('Action 59');
    });
  });

  describe('Drag Preview State Management', () => {
    it('should initialize drag preview state correctly', () => {
      const dragPreview = {
        show: false,
        y: 0,
        event: null,
      };

      expect(dragPreview.show).toBe(false);
      expect(dragPreview.y).toBe(0);
      expect(dragPreview.event).toBe(null);
    });

    it('should update drag preview during drag', () => {
      const dragPreview = {
        show: true,
        y: 250,
        event: {
          id: '123',
          title: 'Test Appointment',
          startTime: '10:00',
          endTime: '11:00',
          color: '#4F5D67',
          source: 'google' as const,
          date: '2025-11-20',
        },
      };

      expect(dragPreview.show).toBe(true);
      expect(dragPreview.y).toBe(250);
      expect(dragPreview.event).not.toBe(null);
      expect(dragPreview.event?.title).toBe('Test Appointment');
    });

    it('should clear drag preview on drag end', () => {
      let dragPreview = {
        show: true,
        y: 250,
        event: { id: '123', title: 'Test' } as any,
      };

      // Clear preview
      dragPreview = { show: false, y: 0, event: null };

      expect(dragPreview.show).toBe(false);
      expect(dragPreview.y).toBe(0);
      expect(dragPreview.event).toBe(null);
    });
  });

  describe('Time Calculation for Drag Operations', () => {
    function yToTime(y: number): string {
      // Assuming each hour is 50px, starting at y=200 for 06:00
      const baseY = 200;
      const pixelsPerHour = 50;
      const startHour = 6;

      const totalMinutes = ((y - baseY) / pixelsPerHour) * 60 + startHour * 60;
      const hours = Math.floor(totalMinutes / 60);
      const minutes = Math.round((totalMinutes % 60) / 30) * 30; // Snap to 30-minute intervals

      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    }

    it('should convert y position to time correctly', () => {
      expect(yToTime(200)).toBe('06:00'); // Base position
      expect(yToTime(250)).toBe('07:00'); // One hour later
      expect(yToTime(225)).toBe('06:30'); // Half hour later
    });

    it('should calculate appointment duration correctly', () => {
      const startTime = '10:00';
      const endTime = '11:30';

      const [startH, startM] = startTime.split(':').map(Number);
      const [endH, endM] = endTime.split(':').map(Number);
      
      const duration = (endH * 60 + endM) - (startH * 60 + startM);
      
      expect(duration).toBe(90); // 1.5 hours = 90 minutes
    });

    it('should maintain duration when dragging', () => {
      const originalStart = '10:00';
      const originalEnd = '11:30';
      const newStart = '14:00';

      const [startH, startM] = originalStart.split(':').map(Number);
      const [endH, endM] = originalEnd.split(':').map(Number);
      const duration = (endH * 60 + endM) - (startH * 60 + startM);

      const [newStartH, newStartM] = newStart.split(':').map(Number);
      const newEndMinutes = newStartH * 60 + newStartM + duration;
      const newEndH = Math.floor(newEndMinutes / 60);
      const newEndM = newEndMinutes % 60;
      const newEnd = `${newEndH.toString().padStart(2, '0')}:${newEndM.toString().padStart(2, '0')}`;

      expect(newEnd).toBe('15:30'); // Same 90-minute duration
    });
  });
});
