import PDFDocument from 'pdfkit';

// Remove emojis and special characters from text
function removeEmojis(text: string): string {
  // Remove emojis, symbols, and other non-standard characters
  // Using surrogate pair ranges for emoji support without 'u' flag
  return text
    .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '') // Surrogate pairs (emojis)
    .replace(/[\u2600-\u27BF]/g, '') // Misc symbols
    .replace(/[\uFE00-\uFE0F]/g, '') // Variation selectors
    .replace(/[\u200D]/g, '') // Zero-width joiner
    .replace(/[\u20E3]/g, '') // Combining enclosing keycap
    .trim();
}

// Financial District color scheme for reMarkable 2 Pro
function getFinancialDistrictColors(calendarId?: string | null, title?: string) {
  // StimulusPractice calendars
  if (calendarId?.startsWith('6ac7ac649a345a77') || calendarId?.startsWith('79dfcb90ce59b1b0')) {
    return { border: '#243447', background: '#E7E9EC', leftFlag: '#243447' }; // Deep Indigo
  }
  
  // Flight events (detect by title)
  if (title?.toLowerCase().includes('flight')) {
    return { border: '#A63D3D', background: '#F6EAEA', leftFlag: '#A63D3D' }; // Merlot Red
  }
  
  // Holidays/Notes
  if (title?.toLowerCase().includes('holiday') || title?.toLowerCase().includes('note')) {
    return { border: '#3D5845', background: '#E9ECE9', leftFlag: '#3D5845' }; // Forest Pine
  }
  
  // Meetings
  if (title?.toLowerCase().includes('meeting')) {
    return { border: '#9A7547', background: '#F4F0E9', leftFlag: '#9A7547' }; // Rich Caramel
  }
  
  // Default: Work (Cool Slate)
  return { border: '#4F5D67', background: '#EBEDEF', leftFlag: '#4F5D67' };
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

export async function generateWeeklyPlannerPDF(
  appointments: Appointment[],
  startDate: Date,
  endDate: Date
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      // Create PDF document optimized for reMarkable Paper Pro
      // Weekly view: Landscape 679×509 points
      // Daily views: Portrait 509×679 points
      const doc = new PDFDocument({
        size: [679, 509], // Start with landscape for weekly view
        margins: { top: 0, bottom: 0, left: 0, right: 0 }, // No auto-margins
        bufferPages: true, // Enable manual page management
        autoFirstPage: true,
      });

      const buffers: Buffer[] = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      // Generate week dates
      const weekDays = [];
      const currentDate = new Date(startDate);
      for (let i = 0; i < 7; i++) {
        weekDays.push(new Date(currentDate));
        currentDate.setDate(currentDate.getDate() + 1);
      }

      // Page 1: Weekly Overview (Landscape - Grid Layout)
      generateWeeklyGridPage(doc, weekDays, appointments);

      // Pages 2-8: Daily Views (Portrait - Grid Layout)
      weekDays.forEach((day) => {
        generateDailyGridPage(doc, day, appointments);
      });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

// Pixel-perfect constants from specification
const START_HOUR = 6;
const END_HOUR = 21;
const HOUR_HEIGHT = 48;
const MARGIN = 18;
const TIME_COL_WIDTH = 48;
const PAGE_WEEKLY = { width: 679, height: 509, orientation: 'landscape' };
const PAGE_DAILY = { width: 509, height: 679, orientation: 'portrait' };

// Shared utility: Calculate Y position for a given time
function getYForTime(hour: number, minute: number, gridTop: number): number {
  return gridTop + ((hour + minute / 60) - START_HOUR) * HOUR_HEIGHT;
}

function generateWeeklyGridPage(
  doc: PDFKit.PDFDocument,
  weekDays: Date[],
  appointments: Appointment[]
) {
  const pageWidth = PAGE_WEEKLY.width;
  const pageHeight = PAGE_WEEKLY.height;
  const headerHeight = 60;
  
  // Title - dynamically generate from weekDays
  const firstDay = weekDays[0].toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  const lastDay = weekDays[6].toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  doc.fontSize(14).font('Helvetica-Bold')
    .text(`Week of ${firstDay} - ${lastDay}`, MARGIN, 20, {
      width: pageWidth - 2 * MARGIN,
      align: 'center'
    });

  // Grid setup
  const gridTop = headerHeight;
  const columnWidth = (pageWidth - 2 * MARGIN - TIME_COL_WIDTH) / 7;
  const totalHours = END_HOUR - START_HOUR;
  const gridHeight = totalHours * HOUR_HEIGHT;

  // Draw day headers
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  doc.fontSize(8).font('Helvetica-Bold');
  dayNames.forEach((day, i) => {
    const x = MARGIN + TIME_COL_WIDTH + i * columnWidth;
    doc.text(day, x, gridTop, { width: columnWidth, align: 'center' });
    const date = weekDays[i].getDate();
    doc.fontSize(7).font('Helvetica').text(date.toString(), x, gridTop + 12, { width: columnWidth, align: 'center' });
  });

  // Draw grid with pixel-perfect alignment
  const gridStartY = gridTop + 25;
  
  // Vertical lines
  doc.strokeColor('#E5E7EB').lineWidth(0.5);
  for (let i = 0; i <= 8; i++) {
    const x = MARGIN + (i === 0 ? 0 : TIME_COL_WIDTH + (i - 1) * columnWidth);
    doc.moveTo(x, gridStartY).lineTo(x, gridStartY + gridHeight).stroke();
  }

  // Horizontal lines (hour and half-hour) and time labels
  doc.fontSize(6).font('Helvetica');
  for (let i = 0; i <= totalHours; i++) {
    const y = gridStartY + i * HOUR_HEIGHT;
    
    // Hour line (darker)
    doc.strokeColor('#E5E7EB').lineWidth(0.5);
    doc.moveTo(MARGIN, y).lineTo(pageWidth - MARGIN, y).stroke();
    
    // Half-hour line (lighter)
    if (i < totalHours) {
      const halfY = y + HOUR_HEIGHT / 2;
      doc.strokeColor('#E5E7EB').lineWidth(0.25);
      doc.moveTo(MARGIN, halfY).lineTo(pageWidth - MARGIN, halfY).stroke();
    }
    
    // Time label
    if (i < totalHours) {
      const hour = START_HOUR + i;
      const timeLabel = hour === 0 ? '12a' : hour < 12 ? `${hour}a` : hour === 12 ? '12p' : `${hour - 12}p`;
      doc.fillColor('#111827').text(timeLabel, MARGIN + 2, y + 2, { width: TIME_COL_WIDTH - 4, align: 'left' });
    }
  }

  // Draw appointments
  appointments.forEach(apt => {
    const aptDate = new Date(apt.startTime);
    const dayIndex = weekDays.findIndex(d => 
      d.getFullYear() === aptDate.getFullYear() &&
      d.getMonth() === aptDate.getMonth() &&
      d.getDate() === aptDate.getDate()
    );

    if (dayIndex === -1) return;

    const hour = aptDate.getHours();
    const minute = aptDate.getMinutes();
    
    const endDate = new Date(apt.endTime);
    const endHour = endDate.getHours();
    const endMinute = endDate.getMinutes();
    
    if (hour < START_HOUR || hour >= END_HOUR) return; // Skip appointments outside grid

    // Use pixel-perfect Y-position calculation
    const startY = getYForTime(hour, minute, gridStartY);
    
    // Clamp end time to grid bounds to prevent overflow
    const clampedEndHour = Math.min(endHour + endMinute / 60, END_HOUR);
    const clampedStartHour = hour + minute / 60;
    const duration = clampedEndHour - clampedStartHour;
    const height = Math.max(duration * HOUR_HEIGHT, 10);

    const x = MARGIN + TIME_COL_WIDTH + dayIndex * columnWidth + 2;
    const width = columnWidth - 4;

    // Apply Financial District color scheme
    const colors = getFinancialDistrictColors(apt.calendarId, apt.title);
    
    // Draw appointment with Financial District styling
    doc.fillColor(colors.background).rect(x, startY, width, height).fill();
    doc.strokeColor(colors.border).lineWidth(1.5).rect(x, startY, width, height).stroke();
    doc.fillColor(colors.leftFlag).rect(x, startY, 4, height).fill();
    doc.fillColor('#000000');

    // Add link to daily page (page 2 = Monday, page 3 = Tuesday, etc.)
    const targetPage = dayIndex + 2;
    doc.link(x, startY, width, height, `#page=${targetPage}`);

    // Appointment text
    doc.fontSize(5).font('Helvetica');
    const timeStr = `${hour % 12 || 12}:${minute.toString().padStart(2, '0')}${hour < 12 ? 'a' : 'p'}`;
    const cleanTitle = removeEmojis(apt.title);
    doc.text(`${timeStr} ${cleanTitle}`, x + 6, startY + 2, {
      width: width - 8,
      height: height - 4,
      ellipsis: true
    });
  });

  doc.fillColor('#000000').strokeColor('#000000');
}

function generateDailyGridPage(
  doc: PDFKit.PDFDocument,
  day: Date,
  appointments: Appointment[]
) {
  // Add new page with portrait orientation
  doc.addPage({ size: [PAGE_DAILY.width, PAGE_DAILY.height], margin: 0 });
  
  const pageWidth = PAGE_DAILY.width;
  const pageHeight = PAGE_DAILY.height;
  const headerHeight = 50;
  
  // Clip all drawing to page bounds to prevent overflow
  doc.save();
  doc.rect(0, 0, pageWidth, pageHeight).clip();
  
  // Calculate hour height to fit page (679pt total - 50 header - 36 margins = 593pt / 15 hours = 39.53pt)
  const dailyHourHeight = Math.floor((pageHeight - headerHeight - 2 * MARGIN) / (END_HOUR - START_HOUR));
  
  // Title
  const dayName = day.toLocaleDateString('en-US', { weekday: 'long' });
  const dateStr = day.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  doc.fontSize(14).font('Helvetica-Bold')
    .text(`${dayName}, ${dateStr}`, MARGIN, 20, {
      width: pageWidth - 2 * MARGIN,
      align: 'center',
      continued: false
    });

  // Add "← Week View" button link back to page 1
  const buttonX = MARGIN;
  const buttonY = 20;
  const buttonWidth = 70;
  const buttonHeight = 20;
  
  // Draw button background
  doc.fillColor('#F5F5F5')
    .rect(buttonX, buttonY, buttonWidth, buttonHeight)
    .fill();
  doc.strokeColor('#243447')
    .lineWidth(1.5)
    .rect(buttonX, buttonY, buttonWidth, buttonHeight)
    .stroke();
  
  // Add button text with link
  doc.fontSize(8).font('Helvetica-Bold')
    .fillColor('#243447')
    .text('< Week View', buttonX + 5, buttonY + 6, { 
      link: '#page=1',
      width: buttonWidth - 10,
      align: 'left'
    })
    .fillColor('#000000');

  // Grid setup
  const gridTop = headerHeight;
  const totalHours = END_HOUR - START_HOUR;
  const gridHeight = totalHours * dailyHourHeight; // Calculated to fit page
  const contentWidth = pageWidth - 2 * MARGIN - TIME_COL_WIDTH;

  // Draw grid with pixel-perfect alignment
  const gridStartY = gridTop;
  
  // Vertical line separating time from content
  doc.strokeColor('#E5E7EB').lineWidth(0.5);
  doc.moveTo(MARGIN + TIME_COL_WIDTH, gridStartY).lineTo(MARGIN + TIME_COL_WIDTH, gridStartY + gridHeight).stroke();
  
  // Right border
  doc.moveTo(pageWidth - MARGIN, gridStartY).lineTo(pageWidth - MARGIN, gridStartY + gridHeight).stroke();

  // Horizontal lines (hour and half-hour) and time labels
  doc.fontSize(8).font('Helvetica');
  for (let i = 0; i <= totalHours; i++) {
    const y = gridStartY + i * dailyHourHeight;
    
    // Hour line
    doc.strokeColor('#E5E7EB').lineWidth(0.5);
    doc.moveTo(MARGIN, y).lineTo(pageWidth - MARGIN, y).stroke();
    
    // Half-hour line (lighter)
    if (i < totalHours) {
      const halfY = y + dailyHourHeight / 2;
      doc.strokeColor('#E5E7EB').lineWidth(0.25);
      doc.moveTo(MARGIN, halfY).lineTo(pageWidth - MARGIN, halfY).stroke();
    }
    
    // Time label
    if (i < totalHours) {
      const hour = START_HOUR + i;
      const timeLabel = hour === 0 ? '12:00 AM' : hour < 12 ? `${hour}:00 AM` : hour === 12 ? '12:00 PM' : `${hour - 12}:00 PM`;
      doc.fillColor('#111827').text(timeLabel, MARGIN + 2, y + 5, { width: TIME_COL_WIDTH - 4, height: dailyHourHeight - 10, align: 'left', lineBreak: false });
    }
  }

  // Filter appointments for this day
  const dayAppointments = appointments.filter(apt => {
    const aptDate = new Date(apt.startTime);
    return aptDate.getFullYear() === day.getFullYear() &&
           aptDate.getMonth() === day.getMonth() &&
           aptDate.getDate() === day.getDate();
  });

  // Draw appointments
  dayAppointments.forEach(apt => {
    const aptDate = new Date(apt.startTime);
    const hour = aptDate.getHours();
    const minute = aptDate.getMinutes();
    
    const endDate = new Date(apt.endTime);
    const endHour = endDate.getHours();
    const endMinute = endDate.getMinutes();
    
    if (hour < START_HOUR || hour >= END_HOUR) return; // Skip appointments outside grid

    // Calculate Y-position for daily view
    const startY = gridStartY + ((hour + minute / 60) - START_HOUR) * dailyHourHeight;
    
    // Clamp end time to grid bounds to prevent overflow
    const clampedEndHour = Math.min(endHour + endMinute / 60, END_HOUR);
    const clampedStartHour = hour + minute / 60;
    const duration = clampedEndHour - clampedStartHour;
    const height = Math.max(duration * dailyHourHeight, 15);

    const x = MARGIN + TIME_COL_WIDTH + 5;
    const width = contentWidth - 10;

    // Apply Financial District color scheme
    const colors = getFinancialDistrictColors(apt.calendarId, apt.title);
    
    // Draw appointment with Financial District styling
    doc.fillColor(colors.background).rect(x, startY, width, height).fill();
    doc.strokeColor(colors.border).lineWidth(1.5).rect(x, startY, width, height).stroke();
    doc.fillColor(colors.leftFlag).rect(x, startY, 4, height).fill();
    doc.fillColor('#000000');

    // Appointment text
    doc.fontSize(8).font('Helvetica-Bold');
    const timeStr = `${hour % 12 || 12}:${minute.toString().padStart(2, '0')}${hour < 12 ? 'AM' : 'PM'}`;
    const cleanTitle = removeEmojis(apt.title);
    doc.text(`${timeStr} - ${cleanTitle}`, x + 6, startY + 3, {
      width: width - 12,
      height: Math.max(height - 6, 10),
      ellipsis: true,
      lineBreak: false
    });

    if (apt.description && height > 25) {
      doc.fontSize(7).font('Helvetica');
      doc.text(apt.description, x + 6, startY + 15, {
        width: width - 12,
        height: height - 18,
        ellipsis: true
      });
    }
   });
  
  // Reset colors and restore graphics state
  doc.fillColor('#000000').strokeColor('#000000');
  doc.restore();
}
