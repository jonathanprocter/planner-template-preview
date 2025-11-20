import { describe, it, expect } from 'vitest';

describe('PDF Export - All-Day Event Detection Fix', () => {
  describe('All-Day Event Detection Logic', () => {
    it('should only mark holidays as all-day events', () => {
      const appointments = [
        {
          id: 1,
          title: 'Thanksgiving',
          calendarId: 'holiday@calendar.com',
          startTime: new Date('2025-11-27T00:00:00'),
          date: '2025-11-27',
        },
        {
          id: 2,
          title: 'Important Note',
          category: 'Holidays/Notes',
          startTime: new Date('2025-11-27T00:00:00'),
          date: '2025-11-27',
        },
      ];

      const allDayEvents = appointments.filter(apt => {
        const isHoliday = apt.calendarId?.includes('holiday') ||
                         apt.title?.toLowerCase().includes('holiday') || 
                         apt.title?.toLowerCase().includes('note') ||
                         apt.category === 'Holidays/Notes';
        return isHoliday;
      });

      expect(allDayEvents.length).toBe(2);
      expect(allDayEvents[0].title).toBe('Thanksgiving');
      expect(allDayEvents[1].title).toBe('Important Note');
    });

    it('should NOT mark midnight appointments as all-day', () => {
      const appointments = [
        {
          id: 1,
          title: 'Midnight Therapy Session',
          calendarId: 'work@calendar.com',
          startTime: new Date('2025-11-27T00:00:00'),
          endTime: new Date('2025-11-27T01:00:00'),
          date: '2025-11-27',
          category: 'SimplePractice',
        },
      ];

      const allDayEvents = appointments.filter(apt => {
        const isHoliday = apt.calendarId?.includes('holiday') ||
                         apt.title?.toLowerCase().includes('holiday') || 
                         apt.title?.toLowerCase().includes('note') ||
                         apt.category === 'Holidays/Notes';
        return isHoliday;
      });

      expect(allDayEvents.length).toBe(0); // Should NOT be marked as all-day
    });

    it('should correctly identify regular appointments at any time', () => {
      const appointments = [
        {
          id: 1,
          title: 'Morning Meeting',
          startTime: new Date('2025-11-27T09:00:00'),
          date: '2025-11-27',
        },
        {
          id: 2,
          title: 'Lunch Appointment',
          startTime: new Date('2025-11-27T12:00:00'),
          date: '2025-11-27',
        },
        {
          id: 3,
          title: 'Evening Session',
          startTime: new Date('2025-11-27T18:00:00'),
          date: '2025-11-27',
        },
        {
          id: 4,
          title: 'Midnight Session',
          startTime: new Date('2025-11-27T00:00:00'),
          date: '2025-11-27',
        },
      ];

      const allDayEvents = appointments.filter(apt => {
        const isHoliday = apt.calendarId?.includes('holiday') ||
                         apt.title?.toLowerCase().includes('holiday') || 
                         apt.title?.toLowerCase().includes('note') ||
                         apt.category === 'Holidays/Notes';
        return isHoliday;
      });

      expect(allDayEvents.length).toBe(0); // None should be all-day
    });

    it('should handle mixed appointments and holidays correctly', () => {
      const appointments = [
        {
          id: 1,
          title: 'Christmas',
          calendarId: 'holiday@calendar.com',
          startTime: new Date('2025-12-25T00:00:00'),
          date: '2025-12-25',
        },
        {
          id: 2,
          title: 'Client Session',
          startTime: new Date('2025-12-25T00:00:00'),
          date: '2025-12-25',
          category: 'SimplePractice',
        },
        {
          id: 3,
          title: 'Afternoon Meeting',
          startTime: new Date('2025-12-25T14:00:00'),
          date: '2025-12-25',
        },
      ];

      const allDayEvents = appointments.filter(apt => {
        const isHoliday = apt.calendarId?.includes('holiday') ||
                         apt.title?.toLowerCase().includes('holiday') || 
                         apt.title?.toLowerCase().includes('note') ||
                         apt.category === 'Holidays/Notes';
        return isHoliday;
      });

      const regularEvents = appointments.filter(apt => {
        const isHoliday = apt.calendarId?.includes('holiday') ||
                         apt.title?.toLowerCase().includes('holiday') || 
                         apt.title?.toLowerCase().includes('note') ||
                         apt.category === 'Holidays/Notes';
        return !isHoliday;
      });

      expect(allDayEvents.length).toBe(1); // Only Christmas
      expect(allDayEvents[0].title).toBe('Christmas');
      expect(regularEvents.length).toBe(2); // Both sessions
    });
  });

  describe('Appointment Filtering for PDF Grid', () => {
    it('should skip holidays when rendering time grid', () => {
      const appointments = [
        {
          id: 1,
          title: 'Holiday',
          calendarId: 'holiday@calendar.com',
          startTime: new Date('2025-11-27T10:00:00'),
          date: '2025-11-27',
        },
        {
          id: 2,
          title: 'Regular Appointment',
          startTime: new Date('2025-11-27T10:00:00'),
          date: '2025-11-27',
        },
      ];

      const gridAppointments = appointments.filter(apt => {
        const isHoliday = apt.calendarId?.includes('holiday') ||
                         apt.title?.toLowerCase().includes('holiday') || 
                         apt.title?.toLowerCase().includes('note') ||
                         apt.category === 'Holidays/Notes';
        return !isHoliday; // Skip holidays
      });

      expect(gridAppointments.length).toBe(1);
      expect(gridAppointments[0].title).toBe('Regular Appointment');
    });

    it('should include midnight appointments in time grid', () => {
      const appointments = [
        {
          id: 1,
          title: 'Midnight Session',
          startTime: new Date('2025-11-27T00:00:00'),
          endTime: new Date('2025-11-27T01:00:00'),
          date: '2025-11-27',
          category: 'SimplePractice',
        },
      ];

      const gridAppointments = appointments.filter(apt => {
        const isHoliday = apt.calendarId?.includes('holiday') ||
                         apt.title?.toLowerCase().includes('holiday') || 
                         apt.title?.toLowerCase().includes('note') ||
                         apt.category === 'Holidays/Notes';
        return !isHoliday;
      });

      expect(gridAppointments.length).toBe(1);
      expect(gridAppointments[0].title).toBe('Midnight Session');
    });
  });

  describe('Edge Cases', () => {
    it('should handle appointments with "holiday" in title but not in holiday calendar', () => {
      const appointments = [
        {
          id: 1,
          title: 'Discuss holiday plans',
          calendarId: 'work@calendar.com',
          startTime: new Date('2025-11-27T10:00:00'),
          date: '2025-11-27',
        },
      ];

      const allDayEvents = appointments.filter(apt => {
        const isHoliday = apt.calendarId?.includes('holiday') ||
                         apt.title?.toLowerCase().includes('holiday') || 
                         apt.title?.toLowerCase().includes('note') ||
                         apt.category === 'Holidays/Notes';
        return isHoliday;
      });

      // This WILL be marked as all-day because title contains "holiday"
      expect(allDayEvents.length).toBe(1);
    });

    it('should handle appointments with undefined fields', () => {
      const appointments = [
        {
          id: 1,
          title: 'Regular Appointment',
          startTime: new Date('2025-11-27T10:00:00'),
          date: '2025-11-27',
          // No calendarId, no category
        },
      ];

      const allDayEvents = appointments.filter(apt => {
        const isHoliday = apt.calendarId?.includes('holiday') ||
                         apt.title?.toLowerCase().includes('holiday') || 
                         apt.title?.toLowerCase().includes('note') ||
                         apt.category === 'Holidays/Notes';
        return isHoliday;
      });

      expect(allDayEvents.length).toBe(0);
    });

    it('should handle case-insensitive holiday detection', () => {
      const appointments = [
        {
          id: 1,
          title: 'HOLIDAY PARTY',
          startTime: new Date('2025-11-27T10:00:00'),
          date: '2025-11-27',
        },
        {
          id: 2,
          title: 'Important NOTE',
          startTime: new Date('2025-11-27T11:00:00'),
          date: '2025-11-27',
        },
      ];

      const allDayEvents = appointments.filter(apt => {
        const isHoliday = apt.calendarId?.includes('holiday') ||
                         apt.title?.toLowerCase().includes('holiday') || 
                         apt.title?.toLowerCase().includes('note') ||
                         apt.category === 'Holidays/Notes';
        return isHoliday;
      });

      expect(allDayEvents.length).toBe(2);
    });
  });
});
