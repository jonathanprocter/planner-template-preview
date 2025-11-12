import { useMemo } from "react";
import { Calendar, Clock, TrendingUp } from "lucide-react";

interface Appointment {
  id: string | number;
  title: string;
  date?: string;
  startTime: string;
  endTime: string;
  category?: string;
  calendarId?: string;
}

interface WeeklyStatsProps {
  appointments: Appointment[];
  weekDates: Date[];
}

export function WeeklyStats({ appointments, weekDates }: WeeklyStatsProps) {
  const stats = useMemo(() => {
    // Calculate total hours
    let totalMinutes = 0;
    const dayMinutes: { [key: string]: number } = {};
    
    // Initialize day minutes
    weekDates.forEach(date => {
      const dateStr = date.toISOString().split('T')[0];
      dayMinutes[dateStr] = 0;
    });

    // Filter out holidays and calculate hours
    appointments.forEach(apt => {
      const isHoliday = apt.calendarId?.toLowerCase().includes('holiday') || 
                       apt.category === 'Holidays/Notes';
      if (isHoliday) return;

      const [startH, startM] = apt.startTime.split(':').map(Number);
      const [endH, endM] = apt.endTime.split(':').map(Number);
      
      const startMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;
      const duration = endMinutes - startMinutes;
      
      if (duration > 0 && apt.date) {
        totalMinutes += duration;
        if (dayMinutes[apt.date] !== undefined) {
          dayMinutes[apt.date] += duration;
        }
      }
    });

    const totalHours = Math.floor(totalMinutes / 60);
    const remainingMinutes = totalMinutes % 60;

    // Find busiest day
    let busiestDay = '';
    let maxMinutes = 0;
    Object.entries(dayMinutes).forEach(([date, minutes]) => {
      if (minutes > maxMinutes) {
        maxMinutes = minutes;
        busiestDay = date;
      }
    });

    const busiestDayName = busiestDay ? new Date(busiestDay + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long' }) : 'N/A';

    // Count appointments (excluding holidays)
    const appointmentCount = appointments.filter(apt => {
      const isHoliday = apt.calendarId?.toLowerCase().includes('holiday') || 
                       apt.category === 'Holidays/Notes';
      return !isHoliday;
    }).length;

    return {
      totalHours: `${totalHours}h ${remainingMinutes}m`,
      busiestDay: busiestDayName,
      appointmentCount
    };
  }, [appointments, weekDates]);

  return (
    <div className="bg-white border border-gray-300 rounded-lg shadow-sm p-3">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-blue-600" />
          <div>
            <div className="text-xs text-gray-500">Total Hours</div>
            <div className="text-sm font-semibold text-gray-900">{stats.totalHours}</div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-green-600" />
          <div>
            <div className="text-xs text-gray-500">Busiest Day</div>
            <div className="text-sm font-semibold text-gray-900">{stats.busiestDay}</div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-purple-600" />
          <div>
            <div className="text-xs text-gray-500">Appointments</div>
            <div className="text-sm font-semibold text-gray-900">{stats.appointmentCount}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
