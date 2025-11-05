import PDFDocument from 'pdfkit';

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
      // Create PDF document optimized for reMarkable 2 Pro
      const doc = new PDFDocument({
        size: [509, 679], // reMarkable 2 Pro dimensions in points
        margins: { top: 30, bottom: 30, left: 20, right: 20 },
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

      // Page 1: Weekly Overview (Grid Layout)
      generateWeeklyGridPage(doc, weekDays, appointments);

      // Pages 2-8: Daily Views (Grid Layout)
      weekDays.forEach((day, index) => {
        doc.addPage();
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
  const pageWidth = 509;
  const pageHeight = 679;
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
  
  // Hours to display (6 AM to 11 PM)
  const startHour = 6;
  const endHour = 23;
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
  for (let hour = 0; hour <= totalHours; hour++) {
    const y = gridTop + 25 + hour * hourHeight;
    doc.moveTo(margin, y).lineTo(pageWidth - margin, y).stroke();
    
    if (hour < totalHours) {
      const displayHour = startHour + hour;
      const timeLabel = `${displayHour.toString().padStart(2, '0')}:00`;
      doc.fontSize(6).font('Helvetica').fillColor('#000000')
        .text(timeLabel, margin + 2, y + 2, { width: timeColumnWidth - 4 });
    }
  }

  // Draw appointments
  weekDays.forEach((day, dayIndex) => {
    const dayAppointments = appointments.filter(apt => {
      const aptDate = new Date(apt.startTime);
      return aptDate.toDateString() === day.toDateString();
    });

    dayAppointments.forEach(apt => {
      const startTime = new Date(apt.startTime);
      const endTime = new Date(apt.endTime);
      
      // Convert to EST
      const estStartTime = new Date(startTime.toLocaleString('en-US', { timeZone: 'America/New_York' }));
      const estEndTime = new Date(endTime.toLocaleString('en-US', { timeZone: 'America/New_York' }));
      
      const startHourFloat = estStartTime.getHours() + estStartTime.getMinutes() / 60;
      const endHourFloat = estEndTime.getHours() + estEndTime.getMinutes() / 60;
      
      if (startHourFloat >= startHour && startHourFloat <= endHour) {
        const startY = gridTop + 25 + (startHourFloat - startHour) * hourHeight;
        const height = Math.max((endHourFloat - startHourFloat) * hourHeight, 10);
        const x = margin + timeColumnWidth + dayIndex * columnWidth + 2;
        const width = columnWidth - 4;

        // Determine color based on calendar
        const isSimplePractice = apt.calendarId?.includes('6ac7ac649a345a77') || 
                                  apt.calendarId?.includes('79dfcb90ce59b1b0');
        
        if (isSimplePractice) {
          // SimplePractice: white bg with cornflower border
          doc.rect(x, startY, width, height)
            .fillAndStroke('#F5F5F0', '#6495ED');
          doc.lineWidth(1.5);
          doc.moveTo(x, startY).lineTo(x, startY + height).stroke('#6495ED');
          doc.lineWidth(0.5);
          
          // Add clickable link to jump to daily page
          doc.link(x, startY, width, height, `#daily-page-${dayIndex}`);
          doc.ref({ Type: 'Action', S: 'GoTo', D: [`daily-page-${dayIndex}`, 'FitH', 0] });
          
          doc.fontSize(5).font('Helvetica').fillColor('#333333')
            .text(apt.title, x + 2, startY + 2, { 
              width: width - 4, 
              height: height - 4,
              ellipsis: true 
            });
        } else {
          // Other events: green
          doc.rect(x, startY, width, height)
            .fillAndStroke('#90EE90', '#228B22');
          
          // Add clickable link to jump to daily page
          doc.link(x, startY, width, height, `#daily-page-${dayIndex}`);
          doc.ref({ Type: 'Action', S: 'GoTo', D: [`daily-page-${dayIndex}`, 'FitH', 0] });
          
          doc.fontSize(5).font('Helvetica').fillColor('#000000')
            .text(apt.title, x + 2, startY + 2, { 
              width: width - 4, 
              height: height - 4,
              ellipsis: true 
            });
        }
      }
    });
  });
}

function generateDailyGridPage(
  doc: PDFKit.PDFDocument,
  day: Date,
  appointments: Appointment[]
) {
  const pageWidth = 509;
  const pageHeight = 679;
  const margin = 20;
  const headerHeight = 50;
  
  // Title
  const dayName = day.toLocaleDateString('en-US', { weekday: 'long' });
  const dateStr = day.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  
  doc.fontSize(14).font('Helvetica-Bold')
    .text(dayName, margin, 20, { width: pageWidth - 2 * margin, align: 'center' });
  doc.fontSize(10).font('Helvetica')
    .text(dateStr, margin, 38, { width: pageWidth - 2 * margin, align: 'center' });
  
  // Add "Back to Week" link button
  const buttonX = pageWidth - margin - 80;
  const buttonY = 20;
  const buttonWidth = 75;
  const buttonHeight = 20;
  doc.rect(buttonX, buttonY, buttonWidth, buttonHeight)
    .fillAndStroke('#6495ED', '#4169E1');
  doc.fontSize(8).font('Helvetica-Bold').fillColor('#FFFFFF')
    .text('← Week View', buttonX, buttonY + 6, { width: buttonWidth, align: 'center' });
  doc.link(buttonX, buttonY, buttonWidth, buttonHeight, '#weekly-overview');
  doc.ref({ Type: 'Action', S: 'GoTo', D: ['weekly-overview', 'FitH', 0] });

  // Grid setup
  const gridTop = headerHeight;
  const gridHeight = pageHeight - headerHeight - 40;
  const timeColumnWidth = 50;
  const appointmentColumnWidth = pageWidth - 2 * margin - timeColumnWidth;
  
  // Hours to display (6 AM to 11 PM)
  const startHour = 6;
  const endHour = 23;
  const totalHours = endHour - startHour + 1;
  const hourHeight = gridHeight / totalHours;

  // Draw grid
  doc.strokeColor('#CCCCCC').lineWidth(0.5);
  
  // Vertical lines
  doc.moveTo(margin, gridTop).lineTo(margin, gridTop + gridHeight).stroke();
  doc.moveTo(margin + timeColumnWidth, gridTop).lineTo(margin + timeColumnWidth, gridTop + gridHeight).stroke();
  doc.moveTo(pageWidth - margin, gridTop).lineTo(pageWidth - margin, gridTop + gridHeight).stroke();

  // Horizontal lines and time labels
  for (let hour = 0; hour <= totalHours; hour++) {
    const y = gridTop + hour * hourHeight;
    doc.moveTo(margin, y).lineTo(pageWidth - margin, y).stroke();
    
    if (hour < totalHours) {
      const displayHour = startHour + hour;
      const timeLabel = `${displayHour.toString().padStart(2, '0')}:00`;
      doc.fontSize(8).font('Helvetica').fillColor('#000000')
        .text(timeLabel, margin + 5, y + 5, { width: timeColumnWidth - 10 });
    }
  }

  // Get appointments for this day
  const dayAppointments = appointments.filter(apt => {
    const aptDate = new Date(apt.startTime);
    return aptDate.toDateString() === day.toDateString();
  });

  // Draw appointments
  dayAppointments.forEach(apt => {
    const startTime = new Date(apt.startTime);
    const endTime = new Date(apt.endTime);
    
    // Convert to EST
    const estStartTime = new Date(startTime.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const estEndTime = new Date(endTime.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    
    const startHourFloat = estStartTime.getHours() + estStartTime.getMinutes() / 60;
    const endHourFloat = estEndTime.getHours() + estEndTime.getMinutes() / 60;
    
    if (startHourFloat >= startHour && startHourFloat <= endHour) {
      const startY = gridTop + (startHourFloat - startHour) * hourHeight;
      const height = Math.max((endHourFloat - startHourFloat) * hourHeight, 15);
      const x = margin + timeColumnWidth + 3;
      const width = appointmentColumnWidth - 6;

      // Determine color based on calendar
      const isSimplePractice = apt.calendarId?.includes('6ac7ac649a345a77') || 
                                apt.calendarId?.includes('79dfcb90ce59b1b0');
      
      if (isSimplePractice) {
        // SimplePractice: white bg with cornflower border and thick left border
        doc.rect(x, startY + 2, width, height - 4)
          .fillAndStroke('#F5F5F0', '#6495ED');
        
        // Thick left border
        doc.lineWidth(3);
        doc.moveTo(x, startY + 2).lineTo(x, startY + height - 2).stroke('#6495ED');
        doc.lineWidth(0.5);
        
        // Title
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#333333')
          .text(apt.title, x + 6, startY + 5, { 
            width: width - 10, 
            ellipsis: true 
          });
        
        // Time
        const timeStr = `${estStartTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'America/New_York' })} - ${estEndTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'America/New_York' })}`;
        doc.fontSize(6).font('Helvetica').fillColor('#666666')
          .text(timeStr, x + 6, startY + 15, { width: width - 10 });
      } else {
        // Other events: green
        doc.rect(x, startY + 2, width, height - 4)
          .fillAndStroke('#90EE90', '#228B22');
        
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000')
          .text(apt.title, x + 4, startY + 5, { 
            width: width - 8, 
            ellipsis: true 
          });
        
        const timeStr = `${estStartTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'America/New_York' })} - ${estEndTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'America/New_York' })}`;
        doc.fontSize(6).font('Helvetica').fillColor('#000000')
          .text(timeStr, x + 4, startY + 15, { width: width - 8 });
      }
    }
  });
}
