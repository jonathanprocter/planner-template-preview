import { PDFDocument, rgb, StandardFonts, PDFPage } from 'pdf-lib';

// Remove emojis and special characters from text
function removeEmojis(text: string): string {
  return text
    .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '') // Surrogate pairs (emojis)
    .replace(/[\u2600-\u27BF]/g, '') // Misc symbols
    .replace(/[\uFE00-\uFE0F]/g, '') // Variation selectors
    .replace(/[\u200D]/g, '') // Zero-width joiner
    .replace(/[\u20E3]/g, '') // Combining enclosing keycap
    .trim();
}

// Convert date to EST timezone for consistent PDF output
function toEST(date: Date): Date {
  const estString = date.toLocaleString('en-US', { 
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  
  const [datePart, timePart] = estString.split(', ');
  const [month, day, year] = datePart.split('/');
  const [hour, minute, second] = timePart.split(':');
  
  return new Date(
    parseInt(year),
    parseInt(month) - 1,
    parseInt(day),
    parseInt(hour),
    parseInt(minute),
    parseInt(second)
  );
}

// Financial District color scheme for reMarkable 2 Pro
function getFinancialDistrictColors(calendarId?: string | null, title?: string) {
  if (calendarId?.startsWith('6ac7ac649a345a77') || calendarId?.startsWith('79dfcb90ce59b1b0')) {
    return { border: '#243447', background: '#E7E9EC', leftFlag: '#243447' };
  }
  
  if (title?.toLowerCase().includes('flight')) {
    return { border: '#A63D3D', background: '#F6EAEA', leftFlag: '#A63D3D' };
  }
  
  if (title?.toLowerCase().includes('holiday') || title?.toLowerCase().includes('note')) {
    return { border: '#3D5845', background: '#E9ECE9', leftFlag: '#3D5845' };
  }
  
  if (title?.toLowerCase().includes('meeting')) {
    return { border: '#9A7547', background: '#F4F0E9', leftFlag: '#9A7547' };
  }
  
  return { border: '#4F5D67', background: '#EBEDEF', leftFlag: '#4F5D67' };
}

// Convert hex color to RGB values (0-1 range for pdf-lib)
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16) / 255,
    g: parseInt(result[2], 16) / 255,
    b: parseInt(result[3], 16) / 255
  } : { r: 0, g: 0, b: 0 };
}

interface Appointment {
  id: number | string;
  title: string;
  startTime: Date;
  endTime: Date;
  date: string;
  category?: string | null;
  description?: string | null;
  calendarId?: string | null;
}

// Constants for layout
const START_HOUR = 6;
const END_HOUR = 21;
const HOUR_HEIGHT = 48;
const MARGIN = 18;
const TIME_COL_WIDTH = 48;

export async function generateWeeklyPlannerPDF(
  appointments: Appointment[],
  startDate: Date,
  endDate: Date
): Promise<Buffer> {
  // Create PDF document
  const pdfDoc = await PDFDocument.create();
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Generate week dates
  const weekDays: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    weekDays.push(date);
  }

  // Page 1: Weekly Overview (Landscape)
  const weeklyPage = pdfDoc.addPage([679, 509]);
  await generateWeeklyGridPage(weeklyPage, weekDays, appointments, helvetica, helveticaBold);

  // Pages 2-8: Daily Views (Portrait)
  for (const day of weekDays) {
    const dailyPage = pdfDoc.addPage([509, 679]);
    await generateDailyGridPage(dailyPage, day, appointments, helvetica, helveticaBold);
  }

  // Save and return PDF
  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

async function generateWeeklyGridPage(
  page: PDFPage,
  weekDays: Date[],
  appointments: Appointment[],
  font: any,
  fontBold: any
) {
  const { width: pageWidth, height: pageHeight } = page.getSize();
  const margin = MARGIN;
  const headerHeight = 60;
  const timeColumnWidth = TIME_COL_WIDTH;
  
  // Calculate dynamic hour height to fit available space perfectly
  const totalHours = END_HOUR - START_HOUR;
  const availableHeight = pageHeight - headerHeight - margin * 2;
  const hourHeight = availableHeight / totalHours;
  
  // Title
  const firstDay = weekDays[0].toLocaleDateString('en-US', { 
    month: 'long', 
    day: 'numeric',
    timeZone: 'America/New_York'
  });
  const lastDay = weekDays[6].toLocaleDateString('en-US', { 
    month: 'long', 
    day: 'numeric', 
    year: 'numeric',
    timeZone: 'America/New_York'
  });
  
  page.drawText(`Week of ${firstDay} - ${lastDay}`, {
    x: margin,
    y: pageHeight - 30,
    size: 16,
    font: fontBold,
    color: rgb(0, 0, 0)
  });

  const gridTop = pageHeight - headerHeight;
  const gridHeight = availableHeight;
  const columnWidth = (pageWidth - margin - timeColumnWidth) / 7;

  // Day headers
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  dayNames.forEach((day, i) => {
    const x = margin + timeColumnWidth + i * columnWidth;
    const estDate = toEST(weekDays[i]);
    
    page.drawText(day, {
      x: x + columnWidth / 2 - 10,
      y: gridTop + 5,
      size: 10,
      font: fontBold,
      color: rgb(0, 0, 0)
    });
    
    page.drawText(estDate.getDate().toString(), {
      x: x + columnWidth / 2 - 5,
      y: gridTop - 7,
      size: 7,
      font: font,
      color: rgb(0.3, 0.3, 0.3)
    });
  });

  // All-Day Holidays Section
  const allDayHeight = 20;
  const allDayY = gridTop - allDayHeight;
  
  // Draw all-day section background
  page.drawRectangle({
    x: margin + timeColumnWidth,
    y: allDayY,
    width: pageWidth - margin - timeColumnWidth - margin,
    height: allDayHeight,
    color: rgb(0.98, 0.98, 0.98),
    borderColor: rgb(0.7, 0.7, 0.7),
    borderWidth: 0.5
  });
  
  // Draw holidays for each day
  weekDays.forEach((day, dayIndex) => {
    const dayStr = day.toISOString().split('T')[0];
    const holidays = appointments.filter(apt => {
      if (apt.date !== dayStr) return false;
      const isHoliday = apt.title?.toLowerCase().includes('holiday') || 
                       apt.title?.toLowerCase().includes('note') ||
                       apt.category === 'Holidays/Notes';
      return isHoliday;
    });
    
    if (holidays.length > 0) {
      const x = margin + timeColumnWidth + dayIndex * columnWidth;
      const holiday = holidays[0]; // Show first holiday if multiple
      const colors = getFinancialDistrictColors(holiday.calendarId, holiday.title);
      const rgb_color = hexToRgb(colors.leftFlag);
      
      // Draw small holiday indicator
      page.drawRectangle({
        x: x + 2,
        y: allDayY + 2,
        width: columnWidth - 4,
        height: allDayHeight - 4,
        color: rgb(rgb_color.r, rgb_color.g, rgb_color.b)
      });
      
      // Draw holiday text
      const cleanTitle = removeEmojis(holiday.title);
      const truncated = cleanTitle.length > 10 ? cleanTitle.substring(0, 10) + '...' : cleanTitle;
      page.drawText(truncated, {
        x: x + 4,
        y: allDayY + 6,
        size: 6,
        font: font,
        color: rgb(1, 1, 1)
      });
    }
  });

  // Adjust grid top to account for all-day section
  // The grid should start BELOW the all-day section
  const adjustedGridTop = allDayY - 2; // 2px spacing below all-day section
  const adjustedGridHeight = availableHeight - allDayHeight - 2;
  const adjustedHourHeight = adjustedGridHeight / totalHours;

  // Draw grid lines
  for (let hour = START_HOUR; hour <= END_HOUR; hour++) {
    const y = adjustedGridTop - (hour - START_HOUR) * adjustedHourHeight;
    
    // Hour line
    page.drawLine({
      start: { x: margin, y },
      end: { x: pageWidth - margin, y },
      thickness: 0.5,
      color: rgb(0.7, 0.7, 0.7)
    });
    
    // Half-hour line
    if (hour < END_HOUR) {
      const halfY = y - adjustedHourHeight / 2;
      page.drawLine({
        start: { x: margin + timeColumnWidth, y: halfY },
        end: { x: pageWidth - margin, y: halfY },
        thickness: 0.25,
        color: rgb(0.9, 0.9, 0.9)
      });
    }
    
    // Hour label
    const timeLabel = hour > 12 ? `${hour - 12}p` : `${hour}a`;
    page.drawText(timeLabel, {
      x: margin + 2,
      y: y - 5,
      size: 7,
      font: font,
      color: rgb(0.4, 0.4, 0.4)
    });
    
    // Half-hour label
    if (hour < END_HOUR) {
      const halfY = y - adjustedHourHeight / 2;
      const halfLabel = hour > 11 ? `${hour > 12 ? hour - 12 : hour}:30p` : `${hour}:30a`;
      page.drawText(halfLabel, {
        x: margin + 2,
        y: halfY - 5,
        size: 6,
        font: font,
        color: rgb(0.5, 0.5, 0.5)
      });
    }
  }

  // Vertical day dividers
  for (let i = 0; i <= 7; i++) {
    const x = margin + timeColumnWidth + i * columnWidth;
    page.drawLine({
      start: { x, y: adjustedGridTop },
      end: { x, y: margin },
      thickness: 0.5,
      color: rgb(0.7, 0.7, 0.7)
    });
  }

  // Draw appointments
  weekDays.forEach((day, dayIndex) => {
    const dayStr = day.toISOString().split('T')[0];
    const dayAppointments = appointments.filter(apt => apt.date === dayStr);
    
    dayAppointments.forEach(apt => {
      // Skip holidays - they're in the all-day section
      const isHoliday = apt.title?.toLowerCase().includes('holiday') || 
                       apt.title?.toLowerCase().includes('note') ||
                       apt.category === 'Holidays/Notes';
      if (isHoliday) return;
      
      // Get EST hours directly from toLocaleString
      const startEST = apt.startTime.toLocaleString('en-US', { 
        timeZone: 'America/New_York', 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
      });
      const endEST = apt.endTime.toLocaleString('en-US', { 
        timeZone: 'America/New_York', 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
      });
      const [startH, startM] = startEST.split(':').map(Number);
      const [endH, endM] = endEST.split(':').map(Number);
      const startHour = startH + startM / 60;
      const endHour = endH + endM / 60;
      
      // Skip if outside visible range
      if (endHour <= START_HOUR || startHour >= END_HOUR) return;
      
      // Clamp to visible range
      const clampedStart = Math.max(startHour, START_HOUR);
      const clampedEnd = Math.min(endHour, END_HOUR);
      
      const y = adjustedGridTop - (clampedStart - START_HOUR) * adjustedHourHeight;
      const calculatedHeight = (clampedEnd - clampedStart) * adjustedHourHeight - 2;
      
      // Ensure appointment doesn't overflow grid bottom
      const gridBottom = margin;
      const appointmentBottom = y - calculatedHeight;
      const height = appointmentBottom < gridBottom ? calculatedHeight - (gridBottom - appointmentBottom) : calculatedHeight;
      const x = margin + timeColumnWidth + dayIndex * columnWidth + 2;
      const width = columnWidth - 4;
      
      const colors = getFinancialDistrictColors(apt.calendarId, apt.title);
      const bgColor = hexToRgb(colors.background);
      const borderColor = hexToRgb(colors.border);
      
      // Background
      page.drawRectangle({
        x,
        y: y - height,
        width,
        height,
        color: rgb(bgColor.r, bgColor.g, bgColor.b)
      });
      
      // Border
      page.drawRectangle({
        x,
        y: y - height,
        width,
        height,
        borderColor: rgb(borderColor.r, borderColor.g, borderColor.b),
        borderWidth: 1
      });
      
      // Left flag
      page.drawRectangle({
        x,
        y: y - height,
        width: 3,
        height,
        color: rgb(borderColor.r, borderColor.g, borderColor.b)
      });
      
      // Title text
      const cleanTitle = removeEmojis(apt.title);
      const titleLines = cleanTitle.substring(0, 50);
      page.drawText(titleLines, {
        x: x + 6,
        y: y - 12,
        size: 7,
        font: font,
        color: rgb(0.1, 0.1, 0.1),
        maxWidth: width - 12
      });
    });
  });
}

async function generateDailyGridPage(
  page: PDFPage,
  day: Date,
  appointments: Appointment[],
  font: any,
  fontBold: any
) {
  const { width: pageWidth, height: pageHeight } = page.getSize();
  const margin = MARGIN;
  const headerHeight = 50;
  const notesHeight = 100;
  const timeColumnWidth = TIME_COL_WIDTH;
  
  // Calculate dynamic hour height to fit available space perfectly
  const totalHours = END_HOUR - START_HOUR;
  const availableHeight = pageHeight - headerHeight - notesHeight - margin * 2;
  const hourHeight = availableHeight / totalHours;
  
  // Title
  const estDay = toEST(day);
  const dayName = estDay.toLocaleDateString('en-US', { 
    weekday: 'long',
    timeZone: 'America/New_York'
  });
  const dateStr = estDay.toLocaleDateString('en-US', { 
    month: 'long', 
    day: 'numeric', 
    year: 'numeric',
    timeZone: 'America/New_York'
  });
  
  page.drawText(`${dayName}, ${dateStr}`, {
    x: margin,
    y: pageHeight - 30,
    size: 14,
    font: fontBold,
    color: rgb(0, 0, 0)
  });

  const gridTop = pageHeight - headerHeight;
  const gridHeight = availableHeight;
  const gridWidth = pageWidth - margin - timeColumnWidth;

  // Draw grid lines
  for (let hour = START_HOUR; hour <= END_HOUR; hour++) {
    const y = gridTop - (hour - START_HOUR) * hourHeight;
    
    // Hour line
    page.drawLine({
      start: { x: margin + timeColumnWidth, y },
      end: { x: pageWidth - margin, y },
      thickness: 0.5,
      color: rgb(0.7, 0.7, 0.7)
    });
    
    // Half-hour line
    if (hour < END_HOUR) {
      const halfY = y - hourHeight / 2;
      page.drawLine({
        start: { x: margin + timeColumnWidth, y: halfY },
        end: { x: pageWidth - margin, y: halfY },
        thickness: 0.25,
        color: rgb(0.9, 0.9, 0.9)
      });
    }
    
    // Hour label
    const timeLabel = hour > 12 ? `${hour - 12}:00 PM` : `${hour}:00 AM`;
    page.drawText(timeLabel, {
      x: margin,
      y: y - 5,
      size: 7,
      font: font,
      color: rgb(0.4, 0.4, 0.4)
    });
    
    // Half-hour label
    if (hour < END_HOUR) {
      const halfY = y - hourHeight / 2;
      const halfLabel = hour > 11 ? `${hour > 12 ? hour - 12 : hour}:30 PM` : `${hour}:30 AM`;
      page.drawText(halfLabel, {
        x: margin,
        y: halfY - 5,
        size: 6,
        font: font,
        color: rgb(0.5, 0.5, 0.5)
      });
    }
  }

  // Vertical grid line
  page.drawLine({
    start: { x: margin + timeColumnWidth, y: gridTop },
    end: { x: margin + timeColumnWidth, y: gridTop - gridHeight },
    thickness: 0.5,
    color: rgb(0.7, 0.7, 0.7)
  });

  // Draw appointments
  const dayStr = day.toISOString().split('T')[0];
  const dayAppointments = appointments.filter(apt => apt.date === dayStr);
  
  dayAppointments.forEach(apt => {
    const estStart = toEST(apt.startTime);
    const estEnd = toEST(apt.endTime);
    const startHour = estStart.getHours() + estStart.getMinutes() / 60;
    const endHour = estEnd.getHours() + estEnd.getMinutes() / 60;
    
    // Skip if outside visible range
    if (endHour <= START_HOUR || startHour >= END_HOUR) return;
    
    // Clamp to visible range
    const clampedStart = Math.max(startHour, START_HOUR);
    const clampedEnd = Math.min(endHour, END_HOUR);
    
    const y = gridTop - (clampedStart - START_HOUR) * hourHeight;
    const calculatedHeight = (clampedEnd - clampedStart) * hourHeight - 2;
    
    // Ensure appointment doesn't overflow grid bottom
    const gridBottom = gridTop - gridHeight;
    const appointmentBottom = y - calculatedHeight;
    const height = appointmentBottom < gridBottom ? calculatedHeight - (gridBottom - appointmentBottom) : calculatedHeight;
    const x = margin + timeColumnWidth + 2;
    const width = gridWidth - 4;
    
    const colors = getFinancialDistrictColors(apt.calendarId, apt.title);
    const bgColor = hexToRgb(colors.background);
    const borderColor = hexToRgb(colors.border);
    
    // Background
    page.drawRectangle({
      x,
      y: y - height,
      width,
      height,
      color: rgb(bgColor.r, bgColor.g, bgColor.b)
    });
    
    // Border
    page.drawRectangle({
      x,
      y: y - height,
      width,
      height,
      borderColor: rgb(borderColor.r, borderColor.g, borderColor.b),
      borderWidth: 1
    });
    
    // Left flag
    page.drawRectangle({
      x,
      y: y - height,
      width: 3,
      height,
      color: rgb(borderColor.r, borderColor.g, borderColor.b)
    });
    
    // Title text
    const cleanTitle = removeEmojis(apt.title);
    const timeText = `${estStart.getHours()}:${estStart.getMinutes().toString().padStart(2, '0')} - ${cleanTitle}`;
    page.drawText(timeText, {
      x: x + 6,
      y: y - 12,
      size: 8,
      font: font,
      color: rgb(0.1, 0.1, 0.1),
      maxWidth: width - 12
    });
  });

  // Daily notes section
  const notesY = gridTop - gridHeight - 20;
  page.drawText('Notes:', {
    x: margin,
    y: notesY,
    size: 10,
    font: fontBold,
    color: rgb(0, 0, 0)
  });
  
  // Draw note lines
  for (let i = 0; i < 5; i++) {
    const lineY = notesY - 20 - i * 15;
    page.drawLine({
      start: { x: margin, y: lineY },
      end: { x: pageWidth - margin, y: lineY },
      thickness: 0.25,
      color: rgb(0.8, 0.8, 0.8)
    });
  }
}
