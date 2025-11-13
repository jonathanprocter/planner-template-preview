import { PDFDocument, rgb, StandardFonts, PDFPage, PDFName, PDFDict, PDFArray, PDFNumber } from 'pdf-lib';

// Add clickable link annotation to a PDF page
function addInternalLink(
  page: PDFPage,
  x: number,
  y: number,
  width: number,
  height: number,
  targetPage: PDFPage,
  pdfDoc: PDFDocument
) {
  const context = pdfDoc.context;
  
  // Create link annotation using target page reference directly
  const linkAnnotation = context.obj({
    Type: 'Annot',
    Subtype: 'Link',
    Rect: [x, y, x + width, y + height],
    Border: [0, 0, 0],
    Dest: [targetPage.ref, 'XYZ', null, null, null],
  });
  
  // Add annotation to page
  const annots = page.node.get(PDFName.of('Annots'));
  if (annots instanceof PDFArray) {
    annots.push(linkAnnotation);
  } else {
    page.node.set(PDFName.of('Annots'), context.obj([linkAnnotation]));
  }
}

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

// Wrap text to fit within a given width
function wrapText(text: string, font: any, fontSize: number, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const testWidth = font.widthOfTextAtSize(testLine, fontSize);
    
    if (testWidth > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  
  if (currentLine) {
    lines.push(currentLine);
  }
  
  return lines;
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
  endDate: Date,
  orientation: "landscape" | "portrait" = "landscape"
): Promise<Buffer> {
  // Create PDF document
  const pdfDoc = await PDFDocument.create();
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Generate week dates - set time to noon to avoid timezone shifts
  const weekDays: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    date.setHours(12, 0, 0, 0); // Set to noon to avoid timezone edge cases
    weekDays.push(date);
  }

  // Pages 2-8: Daily Views (Portrait) - create first so we can link to them
  const dailyPages: PDFPage[] = [];
  for (const day of weekDays) {
    const dailyPage = pdfDoc.addPage([509, 679]);
    dailyPages.push(dailyPage);
    await generateDailyGridPage(dailyPage, day, appointments, helvetica, helveticaBold, pdfDoc);
  }

  // Page 1: Weekly Overview - create last but will be first in final PDF
  // Orientation: Landscape (679×509) or Portrait (509×679)
  const weeklyPage = orientation === "landscape" 
    ? pdfDoc.addPage([679, 509])
    : pdfDoc.addPage([509, 679]);
  await generateWeeklyGridPage(weeklyPage, weekDays, appointments, helvetica, helveticaBold, dailyPages, pdfDoc, orientation);
  
  // Add "< Weekly Overview" links to daily pages now that weekly page exists
  dailyPages.forEach((dailyPage) => {
    const { width: pageWidth } = dailyPage.getSize();
    const linkText = '< Weekly Overview';
    const linkX = pageWidth / 2 - helvetica.widthOfTextAtSize(linkText, 9) / 2;
    const linkY = MARGIN + 5;
    
    addInternalLink(
      dailyPage,
      linkX - 5,
      linkY - 2,
      helvetica.widthOfTextAtSize(linkText, 9) + 10,
      12,
      weeklyPage,
      pdfDoc
    );
  });
  
  // Move weekly page to the beginning
  const pages = pdfDoc.getPages();
  pdfDoc.removePage(pages.length - 1); // Remove from end
  pdfDoc.insertPage(0, weeklyPage); // Insert at beginning

  // Save and return PDF
  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

async function generateWeeklyGridPage(
  page: PDFPage,
  weekDays: Date[],
  appointments: Appointment[],
  font: any,
  fontBold: any,
  dailyPages?: PDFPage[],
  pdfDoc?: PDFDocument,
  orientation: "landscape" | "portrait" = "landscape"
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

  // Day headers with full or abbreviated names based on orientation
  const dayNames = orientation === "portrait"
    ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    : ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  dayNames.forEach((dayName, i) => {
    const x = margin + timeColumnWidth + i * columnWidth;
    const currentDay = weekDays[i];
    
    // Format: "Monday, Nov 10"
    const monthShort = currentDay.toLocaleDateString('en-US', { 
      month: 'short',
      timeZone: 'America/New_York'
    });
    const dayNum = currentDay.toLocaleDateString('en-US', { 
      day: 'numeric',
      timeZone: 'America/New_York'
    });
    const dateStr = `${dayName}, ${monthShort} ${dayNum}`;
    
    // Align text: left for portrait (to prevent cutoff), center for landscape
    const textWidth = font.widthOfTextAtSize(dateStr, 8);
    
    const textX = orientation === "portrait" 
      ? x + 2 // Left-align with small padding
      : x + (columnWidth - textWidth) / 2; // Center-align
    const textY = gridTop + 5;
    
    page.drawText(dateStr, {
      x: textX,
      y: textY,
      size: 8,
      font: fontBold,
      color: rgb(0, 0, 0)
    });
    
    // Add clickable link to daily page
    if (pdfDoc && dailyPages && dailyPages[i]) {
      addInternalLink(
        page,
        x,
        textY - 2,
        columnWidth,
        12,
        dailyPages[i], // Pass the actual daily page object
        pdfDoc
      );
    }
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
    // Use local date string to avoid UTC shift
    const dayStr = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
    const holidays = appointments.filter(apt => {
      if (apt.date !== dayStr) return false;
      const isHoliday = apt.calendarId?.includes('holiday') ||
                       apt.title?.toLowerCase().includes('holiday') || 
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
      
      // Draw holiday text with smaller font to fit full text
      const cleanTitle = removeEmojis(holiday.title);
      page.drawText(cleanTitle, {
        x: x + 4,
        y: allDayY + 6,
        size: 5,
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
    // Use local date string to avoid UTC shift
    const dayStr = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
    const dayAppointments = appointments.filter(apt => apt.date === dayStr);
    
    dayAppointments.forEach(apt => {
      // Skip holidays - they're in the all-day section
      const isHoliday = apt.calendarId?.includes('holiday') ||
                       apt.title?.toLowerCase().includes('holiday') || 
                       apt.title?.toLowerCase().includes('note') ||
                       apt.category === 'Holidays/Notes';
      if (isHoliday) return;
      
      // Get EST hours directly from toLocaleTimeString
      const startEST = apt.startTime.toLocaleTimeString('en-US', { 
        timeZone: 'America/New_York', 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
      });
      const endEST = apt.endTime.toLocaleTimeString('en-US', { 
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
      
      // Add clickable link to corresponding daily page
      if (dailyPages && pdfDoc && dailyPages[dayIndex]) {
        addInternalLink(
          page,
          x,
          y - height,
          width,
          height,
          dailyPages[dayIndex], // Pass the actual daily page object
          pdfDoc
        );
      }
      
      // Title text with wrapping (include time)
      const cleanTitle = removeEmojis(apt.title);
      const timeText = `${startEST.substring(0, 5)}`; // e.g., "08:00"
      const fullText = `${timeText} - ${cleanTitle}`;
      const fontSize = 6; // Smaller font to fit time + title
      const lineHeight = fontSize + 2;
      const textLines = wrapText(fullText, font, fontSize, width - 12);
      
      // Draw each line of text
      textLines.forEach((line, lineIndex) => {
        const textY = y - 12 - (lineIndex * lineHeight);
        // Only draw if text is within the appointment box
        if (textY > (y - height + 4)) {
          page.drawText(line, {
            x: x + 6,
            y: textY,
            size: fontSize,
            font: font,
            color: rgb(0.1, 0.1, 0.1)
          });
        }
      });
    });
  });
}

async function generateDailyGridPage(
  page: PDFPage,
  day: Date,
  appointments: Appointment[],
  font: any,
  fontBold: any,
  pdfDoc?: PDFDocument
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
  
  // Title - use direct timezone conversion to avoid day shift
  const dayName = day.toLocaleDateString('en-US', { 
    weekday: 'long',
    timeZone: 'America/New_York'
  });
  const dateStr = day.toLocaleDateString('en-US', { 
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

  // Draw all-day holidays section
  // Use local date string to avoid UTC shift
  const dayStr = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
  const dayAppointments = appointments.filter(apt => apt.date === dayStr);
  const holidays = dayAppointments.filter(apt => {
    const isHoliday = apt.calendarId?.includes('holiday') ||
                     apt.title?.toLowerCase().includes('holiday') || 
                     apt.title?.toLowerCase().includes('note') ||
                     apt.category === 'Holidays/Notes';
    return isHoliday;
  });
  
  if (holidays.length > 0) {
    const allDayY = gridTop + 10;
    const allDayHeight = 24;
    
    // Draw "All-Day Events" label
    page.drawText('All-Day Events:', {
      x: margin + timeColumnWidth + 5,
      y: allDayY + allDayHeight - 8,
      size: 8,
      font: fontBold,
      color: rgb(0.4, 0.4, 0.4)
    });
    
    // Draw holidays
    holidays.forEach((holiday, idx) => {
      const holidayY = allDayY - (idx * 20) - 5;
      const colors = getFinancialDistrictColors(holiday.calendarId, holiday.title);
      const rgb_color = hexToRgb(colors.leftFlag);
      
      page.drawRectangle({
        x: margin + timeColumnWidth + 5,
        y: holidayY - 14,
        width: gridWidth - 10,
        height: 16,
        color: rgb(rgb_color.r, rgb_color.g, rgb_color.b)
      });
      
      const cleanTitle = removeEmojis(holiday.title);
      page.drawText(cleanTitle, {
        x: margin + timeColumnWidth + 8,
        y: holidayY - 10,
        size: 7,
        font,
        color: rgb(1, 1, 1)
      });
    });
  }
  
  // Draw appointments
  
  dayAppointments.forEach(apt => {
    // Skip holidays - they're shown in the all-day section
    const isHoliday = apt.calendarId?.includes('holiday') ||
                     apt.title?.toLowerCase().includes('holiday') || 
                     apt.title?.toLowerCase().includes('note') ||
                     apt.category === 'Holidays/Notes';
    if (isHoliday) return;
    
    // Get EST hours directly from toLocaleTimeString
    const startEST = apt.startTime.toLocaleTimeString('en-US', { 
      timeZone: 'America/New_York', 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
    const endEST = apt.endTime.toLocaleTimeString('en-US', { 
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
    
    const y = gridTop - (clampedStart - START_HOUR) * hourHeight;
    const calculatedHeight = (clampedEnd - clampedStart) * hourHeight - 2;
    
    // Ensure appointment doesn't overflow grid bottom
    const gridBottom = gridTop - gridHeight;
    const appointmentBottom = y - calculatedHeight;
    const height = appointmentBottom < gridBottom ? calculatedHeight - (gridBottom - appointmentBottom) : calculatedHeight;
    const x = margin + timeColumnWidth + 2;
    // Fix: subtract margin from gridWidth to keep appointment within right margin
    const width = gridWidth - margin - 4;
    
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
    
    // Title text with wrapping
    const cleanTitle = removeEmojis(apt.title);
    const timeText = `${startH}:${startM.toString().padStart(2, '0')} - ${cleanTitle}`;
    const fontSize = 8;
    const lineHeight = fontSize + 2;
    const textLines = wrapText(timeText, font, fontSize, width - 12);
    
    // Draw each line of text
    textLines.forEach((line, lineIndex) => {
      const textY = y - 12 - (lineIndex * lineHeight);
      // Only draw if text is within the appointment box
      if (textY > (y - height + 4)) {
        page.drawText(line, {
          x: x + 6,
          y: textY,
          size: fontSize,
          font: font,
          color: rgb(0.1, 0.1, 0.1)
        });
      }
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
  
  // Add "< Weekly Overview" link at bottom
  const linkText = '< Weekly Overview';
  const linkX = pageWidth / 2 - font.widthOfTextAtSize(linkText, 9) / 2;
  const linkY = margin + 5;
  
  page.drawText(linkText, {
    x: linkX,
    y: linkY,
    size: 9,
    font: fontBold,
    color: rgb(0.2, 0.4, 0.8) // Blue color to indicate it's a link
  });
  
  // Add clickable link to weekly overview page
  // Note: We need to pass the weekly page, but it's not created yet when daily pages are generated
  // So we'll need to add these links after the weekly page is created
}
