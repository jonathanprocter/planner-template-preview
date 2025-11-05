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
      generateWeeklyGridPage(doc, weekDays, appointments);

      // Pages 2-8: Daily Views (Portrait - Grid Layout)
      weekDays.forEach((day, index) => {
        doc.addPage({ size: [509, 679] }); // Portrait orientation for daily views
        generateDailyGridPage(doc, day, appointments);
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
  appointments: Appointment[]
) {
  const pageWidth = 679; // Landscape orientation
  const pageHeight = 509;
  const margin = 20;
  const headerHeight = 60;
  
  // Title
  doc.fontSize(16).font('Helvetica-Bold')
    .text('Week of November 3 - November 9, 2025', margin, 20, {
      width: pageWidth - 2 * margin,
      align: 'center'
    });

  // Grid setup
  const gridTop = headerHeight;
  const gridHeight = pageHeight - headerHeight - 40;
  const columnWidth = (pageWidth - 2 * margin - 40) / 7; // 40 for time column
  const timeColumnWidth = 40;
  
  // Hours to display (6 AM to 10 PM)
  const startHour = 6;
  const endHour = 22;
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

  // Draw grid
  doc.strokeColor('#CCCCCC').lineWidth(0.5);
  
  // Vertical lines
  for (let i = 0; i <= 8; i++) {
    const x = margin + (i === 0 ? 0 : timeColumnWidth + (i - 1) * columnWidth);
    doc.moveTo(x, gridTop + 25).lineTo(x, gridTop + gridHeight).stroke();
  }

  // Horizontal lines and time labels
  doc.fontSize(6).font('Helvetica');
  for (let i = 0; i <= totalHours; i++) {
    const y = gridTop + 25 + i * hourHeight;
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
    // Convert UTC to EST (UTC-5)
    const estDate = new Date(aptDate.getTime() - 5 * 60 * 60 * 1000);
    const dayIndex = weekDays.findIndex(d => 
      d.getFullYear() === estDate.getFullYear() &&
      d.getMonth() === estDate.getMonth() &&
      d.getDate() === estDate.getDate()
    );

    if (dayIndex === -1) return;

    const hour = estDate.getHours();
    const minute = estDate.getMinutes();
    
    const endDate = new Date(apt.endTime);
    const estEndDate = new Date(endDate.getTime() - 5 * 60 * 60 * 1000);
    const endHour = estEndDate.getHours();
    const endMinute = estEndDate.getMinutes();
    
    if (hour < startHour || hour > endHour) return;

    const startY = gridTop + 25 + (hour - startHour + minute / 60) * hourHeight;
    const duration = (endHour - hour) + (endMinute - minute) / 60;
    const height = Math.max(duration * hourHeight, 10);

    const x = margin + timeColumnWidth + dayIndex * columnWidth + 2;
    const width = columnWidth - 4;

    // Check if SimplePractice appointment
    const isSimplePractice = apt.calendarId?.startsWith('6ac7ac649a345a77') || 
                            apt.calendarId?.startsWith('79dfcb90ce59b1b0');

    if (isSimplePractice) {
      // SimplePractice styling: white/ivory background, cornflower blue border, thick left flag
      doc.fillColor('#F5F5F0').rect(x, startY, width, height).fill();
      doc.strokeColor('#6495ED').lineWidth(1.5).rect(x, startY, width, height).stroke();
      doc.fillColor('#6495ED').rect(x, startY, 4, height).fill();
      doc.fillColor('#000000');
    } else {
      // Other events: green background
      doc.fillColor('#90EE90').rect(x, startY, width, height).fill();
      doc.strokeColor('#000000').lineWidth(0.5).rect(x, startY, width, height).stroke();
      doc.fillColor('#000000');
    }

    // Add link to daily page (page 2 = Monday, page 3 = Tuesday, etc.)
    const targetPage = dayIndex + 2;
    doc.link(x, startY, width, height, `page=${targetPage}`);

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
  const pageWidth = 509; // Portrait orientation
  const pageHeight = 679;
  const margin = 20;
  const headerHeight = 50;
  
  // Title
  const dayName = day.toLocaleDateString('en-US', { weekday: 'long' });
  const dateStr = day.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  doc.fontSize(14).font('Helvetica-Bold')
    .text(`${dayName}, ${dateStr}`, margin, 20, {
      width: pageWidth - 2 * margin,
      align: 'center'
    });

  // Add "← Week View" link back to page 1
  doc.fontSize(8).font('Helvetica')
    .fillColor('#0000EE');
  const backLinkText = '← Week View';
  const backLinkWidth = doc.widthOfString(backLinkText);
  doc.text(backLinkText, margin, 20, { underline: true });
  doc.link(margin, 20, backLinkWidth, 10, 'page=1');
  doc.fillColor('#000000');

  // Grid setup
  const gridTop = headerHeight;
  const gridHeight = pageHeight - headerHeight - 40;
  const timeColumnWidth = 50;
  const contentWidth = pageWidth - 2 * margin - timeColumnWidth;
  
  // Hours to display (6 AM to 10 PM)
  const startHour = 6;
  const endHour = 22;
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

  // Filter appointments for this day (convert to EST for comparison)
  const dayAppointments = appointments.filter(apt => {
    const aptDate = new Date(apt.startTime);
    // Convert UTC to EST (UTC-5)
    const estDate = new Date(aptDate.getTime() - 5 * 60 * 60 * 1000);
    return estDate.getFullYear() === day.getFullYear() &&
           estDate.getMonth() === day.getMonth() &&
           estDate.getDate() === day.getDate();
  });

  // Draw appointments
  dayAppointments.forEach(apt => {
    const aptDate = new Date(apt.startTime);
    // Convert UTC to EST (UTC-5)
    const estDate = new Date(aptDate.getTime() - 5 * 60 * 60 * 1000);
    const hour = estDate.getHours();
    const minute = estDate.getMinutes();
    
    const endDate = new Date(apt.endTime);
    const estEndDate = new Date(endDate.getTime() - 5 * 60 * 60 * 1000);
    const endHour = estEndDate.getHours();
    const endMinute = estEndDate.getMinutes();
    
    if (hour < startHour || hour > endHour) return;

    const startY = gridTop + (hour - startHour + minute / 60) * hourHeight;
    const duration = (endHour - hour) + (endMinute - minute) / 60;
    const height = Math.max(duration * hourHeight, 15);

    const x = margin + timeColumnWidth + 5;
    const width = contentWidth - 10;

    // Check if SimplePractice appointment
    const isSimplePractice = apt.calendarId?.startsWith('6ac7ac649a345a77') || 
                            apt.calendarId?.startsWith('79dfcb90ce59b1b0');

    if (isSimplePractice) {
      // SimplePractice styling: white/ivory background, cornflower blue border, thick left flag
      doc.fillColor('#F5F5F0').rect(x, startY, width, height).fill();
      doc.strokeColor('#6495ED').lineWidth(1.5).rect(x, startY, width, height).stroke();
      doc.fillColor('#6495ED').rect(x, startY, 4, height).fill();
      doc.fillColor('#000000');
    } else {
      // Other events: green background
      doc.fillColor('#90EE90').rect(x, startY, width, height).fill();
      doc.strokeColor('#000000').lineWidth(0.5).rect(x, startY, width, height).stroke();
      doc.fillColor('#000000');
    }

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
