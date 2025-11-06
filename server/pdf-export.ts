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

interface DailyNote {
  date: string;
  content: string | null;
}

export async function generateWeeklyPlannerPDF(
  appointments: Appointment[],
  dailyNotes: DailyNote[],
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
        margins: { top: 20, bottom: 20, left: 20, right: 20 },
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
      generateWeeklyGridPage(doc, weekDays, appointments, dailyNotes);

      // Pages 2-8: Daily Views (Portrait - Grid Layout)
      weekDays.forEach((day, index) => {
        doc.addPage({ size: [509, 679] }); // Portrait orientation for daily views
        generateDailyGridPage(doc, day, appointments, dailyNotes);
      });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

function generateWeeklyGridPage(
  doc: PDFKit.PDFDocument,
  weekDays: Date[],
  appointments: Appointment[],
  dailyNotes: DailyNote[]
) {
  const pageWidth = 679; // Landscape orientation
  const pageHeight = 509;
  const margin = 20;
  const headerHeight = 60;
  
  // Title - dynamically generate from weekDays
  const firstDay = weekDays[0].toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  const lastDay = weekDays[6].toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  doc.fontSize(16).font('Helvetica-Bold')
    .text(`Week of ${firstDay} - ${lastDay}`, margin, 20, {
      width: pageWidth - 2 * margin,
      align: 'center'
    });

  // Grid setup
  const gridTop = headerHeight;
  const gridHeight = pageHeight - headerHeight - 40;
  const columnWidth = (pageWidth - 2 * margin - 40) / 7; // 40 for time column
  const timeColumnWidth = 40;
  
  // Hours to display (6 AM to 9 PM, appointments can extend to 10 PM)
  const startHour = 6;
  const endHour = 21;
  const totalHours = endHour - startHour + 1;
  const hourHeight = gridHeight / totalHours;

  // Draw day headers
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  doc.fontSize(8).font('Helvetica-Bold');
  dayNames.forEach((day, i) => {
    const x = margin + timeColumnWidth + i * columnWidth;
    doc.text(day, x, gridTop, { width: columnWidth, align: 'center' });
    const date = weekDays[i].getDate();
    doc.fontSize(7).font('Helvetica').text(date.toString(), x, gridTop + 12, { width: columnWidth, align: 'center' });
  });

  // Create notes map for quick lookup
  const notesMap = new Map<string, string>();
  dailyNotes.forEach(note => {
    if (note.content) {
      notesMap.set(note.date, note.content);
    }
  });

  // Draw daily notes section
  const notesY = gridTop + 25;
  const notesHeight = 35;
  doc.fontSize(5).font('Helvetica');
  weekDays.forEach((day, i) => {
    const x = margin + timeColumnWidth + i * columnWidth;
    const dateStr = day.toISOString().split('T')[0];
    const noteContent = notesMap.get(dateStr);
    
    // Draw notes box
    doc.strokeColor('#CCCCCC').lineWidth(0.5);
    doc.rect(x + 1, notesY, columnWidth - 2, notesHeight).stroke();
    
    if (noteContent) {
      doc.fontSize(4).font('Helvetica');
      doc.text(noteContent, x + 3, notesY + 2, {
        width: columnWidth - 6,
        height: notesHeight - 4,
        ellipsis: true
      });
    }
  });

  // Adjust grid top to account for notes section
  const adjustedGridTop = notesY + notesHeight;
  const adjustedGridHeight = pageHeight - adjustedGridTop - 20;
  const adjustedHourHeight = adjustedGridHeight / totalHours;

  // Draw grid
  doc.strokeColor('#CCCCCC').lineWidth(0.5);
  
  // Vertical lines
  for (let i = 0; i <= 8; i++) {
    const x = margin + (i === 0 ? 0 : timeColumnWidth + (i - 1) * columnWidth);
    doc.moveTo(x, adjustedGridTop).lineTo(x, adjustedGridTop + adjustedGridHeight).stroke();
  }

  // Horizontal lines and time labels
  doc.fontSize(6).font('Helvetica');
  for (let i = 0; i <= totalHours; i++) {
    const y = adjustedGridTop + i * adjustedHourHeight;
    doc.moveTo(margin, y).lineTo(pageWidth - margin, y).stroke();
    
    if (i < totalHours) {
      const hour = startHour + i;
      const timeLabel = hour === 0 ? '12a' : hour < 12 ? `${hour}a` : hour === 12 ? '12p' : `${hour - 12}p`;
      doc.text(timeLabel, margin + 2, y + 2, { width: timeColumnWidth - 4, align: 'left' });
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
    
    // Only show appointments that start between 6am and 9pm (21:00)
    if (hour < startHour || hour >= 22) return;

    const startY = adjustedGridTop + (hour - startHour + minute / 60) * adjustedHourHeight;
    const duration = (endHour - hour) + (endMinute - minute) / 60;
    const height = Math.max(duration * adjustedHourHeight, 10);

    const x = margin + timeColumnWidth + dayIndex * columnWidth + 2;
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
  appointments: Appointment[],
  dailyNotes: DailyNote[]
) {
  const pageWidth = 509; // Portrait orientation
  const pageHeight = 679;
  const margin = 20;
  const headerHeight = 50;
  
  // Title
  const dayName = day.toLocaleDateString('en-US', { weekday: 'long' });
  const dateDisplay = day.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  doc.fontSize(14).font('Helvetica-Bold')
    .text(`${dayName}, ${dateDisplay}`, margin, 20, {
      width: pageWidth - 2 * margin,
      align: 'center'
    });

  // Add "← Week View" button link back to page 1
  const buttonX = margin;
  const buttonY = 20;
  const buttonWidth = 70;
  const buttonHeight = 20;
  
  // Draw button background
  doc.fillColor('#E7E9EC')
    .rect(buttonX, buttonY, buttonWidth, buttonHeight)
    .fill();
  doc.strokeColor('#243447')
    .lineWidth(1)
    .rect(buttonX, buttonY, buttonWidth, buttonHeight)
    .stroke();
  
  // Add button text with link
  doc.fontSize(8).font('Helvetica')
    .fillColor('#243447')
    .text('← Week View', buttonX + 5, buttonY + 6, { 
      link: '#page=1',
      width: buttonWidth - 10,
      align: 'left'
    })
    .fillColor('#000000');

  // Find note for this day
  const dateStr = day.toISOString().split('T')[0];
  const dayNote = dailyNotes.find(note => note.date === dateStr);
  
  // Draw notes section
  const notesY = headerHeight;
  const notesHeight = 60;
  doc.fontSize(10).font('Helvetica-Bold');
  doc.text('Notes & Goals:', margin, notesY + 5, { width: pageWidth - 2 * margin });
  
  doc.strokeColor('#CCCCCC').lineWidth(0.5);
  doc.rect(margin, notesY + 20, pageWidth - 2 * margin, notesHeight - 20).stroke();
  
  if (dayNote && dayNote.content) {
    doc.fontSize(8).font('Helvetica');
    doc.text(dayNote.content, margin + 5, notesY + 25, {
      width: pageWidth - 2 * margin - 10,
      height: notesHeight - 30,
      ellipsis: true
    });
  } else {
    doc.fontSize(8).font('Helvetica-Oblique').fillColor('#999999');
    doc.text('No notes for this day', margin + 5, notesY + 25);
    doc.fillColor('#000000');
  }
  
  // Grid setup - adjust for notes section
  const gridTop = notesY + notesHeight + 10;
  const gridHeight = pageHeight - gridTop - 40;
  const timeColumnWidth = 50;
  const contentWidth = pageWidth - 2 * margin - timeColumnWidth;
  
  // Hours to display (6 AM to 9 PM, appointments can extend to 10 PM)
  const startHour = 6;
  const endHour = 21;
  const totalHours = endHour - startHour + 1;
  const hourHeight = gridHeight / totalHours;

  // Draw grid
  doc.strokeColor('#CCCCCC').lineWidth(0.5);
  
  // Vertical line separating time from content
  doc.moveTo(margin + timeColumnWidth, gridTop).lineTo(margin + timeColumnWidth, gridTop + gridHeight).stroke();
  
  // Right border
  doc.moveTo(pageWidth - margin, gridTop).lineTo(pageWidth - margin, gridTop + gridHeight).stroke();

  // Horizontal lines and time labels
  doc.fontSize(8).font('Helvetica');
  for (let i = 0; i <= totalHours; i++) {
    const y = gridTop + i * hourHeight;
    doc.moveTo(margin, y).lineTo(pageWidth - margin, y).stroke();
    
    if (i < totalHours) {
      const hour = startHour + i;
      const timeLabel = hour === 0 ? '12:00 AM' : hour < 12 ? `${hour}:00 AM` : hour === 12 ? '12:00 PM' : `${hour - 12}:00 PM`;
      doc.text(timeLabel, margin + 2, y + 5, { width: timeColumnWidth - 4, align: 'left' });
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
    
    // Only show appointments that start between 6am and 9pm (21:00)
    if (hour < startHour || hour >= 22) return;;

    const startY = gridTop + (hour - startHour + minute / 60) * hourHeight;
    const duration = (endHour - hour) + (endMinute - minute) / 60;
    const height = Math.max(duration * hourHeight, 15);

    const x = margin + timeColumnWidth + 5;
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
      ellipsis: true
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

  doc.fillColor('#000000').strokeColor('#000000');
}
