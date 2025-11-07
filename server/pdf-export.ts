import PDFDocument from 'pdfkit';
import puppeteer from 'puppeteer';

/**
 * Generate PDF by capturing the actual web view (matches screen exactly)
 * This ensures perfect visual parity with what users see in the browser
 */
export async function generateWebViewPDF(
  startDate: string,
  endDate: string,
  baseUrl: string,
  authCookie?: string
): Promise<Buffer> {
  let browser;
  
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
      ],
    });
    
    const page = await browser.newPage();
    
    // Set viewport to match your web view dimensions exactly
    await page.setViewport({
      width: 1620,
      height: 2160,
      deviceScaleFactor: 2, // High quality rendering
    });
    
    // Set auth cookie if provided
    if (authCookie) {
      await page.setCookie({
        name: 'manus_session',
        value: authCookie,
        domain: new URL(baseUrl).hostname,
      });
    }
    
    // Navigate to your weekly planner
    const url = `${baseUrl}/?date=${startDate}`;
    console.log(`Generating PDF for: ${url}`);
    
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 60000, // Increased timeout
    });
    
    // Wait for the calendar grid to fully render
    await page.waitForSelector('[class*="grid"]', { timeout: 10000 }).catch(() => {
      console.log('Grid selector not found, continuing anyway');
    });
    
    // Optional: Clean up UI for PDF export
    await page.evaluate(() => {
      // Remove animations for cleaner PDF
      const style = document.createElement('style');
      style.textContent = `
        * {
          animation: none !important;
          transition: none !important;
        }
      `;
      document.head.appendChild(style);
    });
    
    // Small delay to ensure everything is rendered
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Generate PDF
    const pdf = await page.pdf({
      width: '1620px',
      height: '2160px',
      printBackground: true,
      preferCSSPageSize: false,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });
    
    console.log('PDF generated successfully');
    return Buffer.from(pdf);
    
  } catch (error) {
    console.error('Error generating web view PDF:', error);
    console.error('Error stack:', (error as Error).stack);
    throw new Error(`Failed to generate PDF: ${(error as Error).message}`);
  } finally {
    if (browser) {
      await browser.close();
    }
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
      const chunks: Buffer[] = [];
      
      // Create notes map for quick lookup
      const notesMap = new Map<string, string>();
      dailyNotes.forEach(note => {
        if (note.content) {
          notesMap.set(note.date, note.content);
        }
      });
      
      // Generate week days
      const weekDays: Date[] = [];
      const current = new Date(startDate);
      while (current <= endDate) {
        weekDays.push(new Date(current));
        current.setDate(current.getDate() + 1);
      }
      
      // Page 1: Weekly Overview (Landscape)
      const doc = new PDFDocument({
        size: [679, 509], // Landscape for reMarkable 2 Pro
        margins: { top: 20, bottom: 20, left: 20, right: 20 }
      });
      
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      
      // Add named destination for page 1 (weekly view)
      doc.addNamedDestination('page_1', 'XYZ', 0, doc.page.height, 1);
      
      // Generate weekly grid page
      generateWeeklyGridPage(doc, weekDays, appointments, notesMap);
      
      // Pages 2-8: Daily Views (Portrait)
      weekDays.forEach((day, index) => {
        doc.addPage({
          size: [509, 679], // Portrait for reMarkable 2 Pro
          margins: { top: 20, bottom: 20, left: 20, right: 20 }
        });
        
        // Add named destination for this page
        const pageNum = index + 2; // Pages 2-8
        doc.addNamedDestination(`page_${pageNum}`, 'XYZ', 0, doc.page.height, 1);
        
        generateDailyGridPage(doc, day, index, appointments, notesMap);
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
  notesMap: Map<string, string>
) {
  const pageWidth = 679;
  const pageHeight = 509;
  const margin = 20;
  
  // Configuration
  const startHour = 6;
  const endHour = 21;
  const totalHours = endHour - startHour + 1; // 16 hours (6am-9pm inclusive)
  
  // Title
  const startMonth = weekDays[0].toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  const endMonth = weekDays[weekDays.length - 1].toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const title = `Week of ${startMonth} - ${endMonth}`;
  
  doc.fontSize(14).font('Helvetica-Bold').text(title, margin, margin, { align: 'center' });
  
  // Layout calculations
  const headerHeight = 50;
  const dayHeaderHeight = 30;
  const notesHeight = 40;
  const timeColumnWidth = 40;
  const dayColumnWidth = (pageWidth - margin * 2 - timeColumnWidth) / 7;
  
  const gridTop = headerHeight + dayHeaderHeight + notesHeight;
  const gridHeight = pageHeight - gridTop - margin;
  const hourHeight = gridHeight / totalHours;
  
  // Draw day headers
  let x = margin + timeColumnWidth;
  weekDays.forEach((day, index) => {
    const dayName = day.toLocaleDateString('en-US', { weekday: 'short' });
    const dayNum = day.getDate();
    
    doc.fontSize(10).font('Helvetica-Bold');
    doc.text(dayName, x, headerHeight, { width: dayColumnWidth, align: 'center' });
    doc.text(dayNum.toString(), x, headerHeight + 12, { width: dayColumnWidth, align: 'center' });
    
    x += dayColumnWidth;
  });
  
  // Draw notes section
  x = margin + timeColumnWidth;
  const notesY = headerHeight + dayHeaderHeight;
  
  weekDays.forEach((day) => {
    const dateStr = day.toISOString().split('T')[0];
    const noteContent = notesMap.get(dateStr);
    
    // Notes box
    doc.rect(x, notesY, dayColumnWidth, notesHeight).stroke();
    
    if (noteContent) {
      doc.fontSize(7).font('Helvetica');
      doc.text(noteContent, x + 2, notesY + 2, {
        width: dayColumnWidth - 4,
        height: notesHeight - 4,
        ellipsis: true
      });
    }
    
    x += dayColumnWidth;
  });
  
  // Draw time grid
  doc.strokeColor('#CCCCCC').lineWidth(0.5);
  
  // Vertical lines (day columns)
  for (let i = 0; i <= 7; i++) {
    const lineX = margin + timeColumnWidth + (i * dayColumnWidth);
    doc.moveTo(lineX, gridTop).lineTo(lineX, gridTop + gridHeight).stroke();
  }
  
  // Time grid - show every half-hour slot explicitly (like reference script)
  let rowY = gridTop;
  const rowHeight = hourHeight / 2; // Each half-hour gets its own row
  
  for (let hour = startHour; hour <= endHour; hour++) {
    for (const minute of ['00', '30']) {
      // Skip the last half-hour (we end at endHour:00)
      if (hour === endHour && minute === '30') break;
      
      // Draw horizontal grid line
      doc.strokeColor('#E0E0E0').lineWidth(0.5);
      doc.moveTo(margin + timeColumnWidth, rowY)
         .lineTo(pageWidth - margin, rowY)
         .stroke();
      
      // Format time label with AM/PM
      const isPM = hour >= 12;
      const displayHour = hour > 12 ? hour - 12 : (hour === 0 ? 12 : hour);
      const timeLabel = `${displayHour}:${minute} ${isPM ? 'PM' : 'AM'}`;
      
      // Draw time label (bold for :00, regular for :30)
      const font = minute === '00' ? 'Helvetica-Bold' : 'Helvetica';
      const fontSize = minute === '00' ? 8 : 7;
      doc.fontSize(fontSize).font(font)
         .fillColor('#000000')
         .text(timeLabel, margin, rowY + 2, { width: timeColumnWidth - 5, align: 'right' });
      
      rowY += rowHeight;
    }
  }
  
  // Draw appointments
  weekDays.forEach((day, dayIndex) => {
    const dayX = margin + timeColumnWidth + (dayIndex * dayColumnWidth);
    const dayDateStr = day.toISOString().split('T')[0];
    
    // Filter appointments for this day
    const dayAppointments = appointments.filter(apt => {
      const aptDate = new Date(apt.startTime);
      return aptDate.getFullYear() === day.getFullYear() &&
             aptDate.getMonth() === day.getMonth() &&
             aptDate.getDate() === day.getDate();
    });
    
    dayAppointments.forEach(apt => {
      // Use times directly from database (already in correct timezone)
      const aptStart = new Date(apt.startTime);
      const aptEnd = new Date(apt.endTime);
      
      const startHourVal = aptStart.getHours();
      const startMinute = aptStart.getMinutes();
      const endHourVal = aptEnd.getHours();
      const endMinute = aptEnd.getMinutes();
      
      // Skip if outside display range
      if (startHourVal < startHour || startHourVal >= 22) return;
      
      // Calculate position
      const startY = gridTop + ((startHourVal - startHour) + (startMinute / 60)) * hourHeight;
      const duration = (endHourVal - startHourVal) + ((endMinute - startMinute) / 60);
      const height = duration * hourHeight;
      
      // Get colors
      const colors = getFinancialDistrictColors(apt.calendarId, apt.title);
      
      // Draw appointment box
      const boxX = dayX + 2;
      const boxWidth = dayColumnWidth - 4;
      
      // Background
      doc.fillColor(colors.background)
         .rect(boxX, startY, boxWidth, height)
         .fill();
      
      // Left flag (4px wide)
      doc.fillColor(colors.leftFlag)
         .rect(boxX, startY, 4, height)
         .fill();
      
      // Border
      doc.strokeColor(colors.border).lineWidth(1)
         .rect(boxX, startY, boxWidth, height)
         .stroke();
      
      // Title
      const cleanTitle = removeEmojis(apt.title);
      doc.fillColor('#000000').fontSize(7).font('Helvetica');
      doc.text(cleanTitle, boxX + 6, startY + 2, {
        width: boxWidth - 8,
        height: height - 4,
        ellipsis: true
      });
      
      // Make appointment clickable (link to daily page)
      const targetPage = dayIndex + 2; // Page 2 is Monday, Page 3 is Tuesday, etc.
      // Use goTo action for internal PDF navigation
      doc.goTo(boxX, startY, boxWidth, height, `page_${targetPage}`);
    });
  });
}

function generateDailyGridPage(
  doc: PDFKit.PDFDocument,
  day: Date,
  dayIndex: number,
  appointments: Appointment[],
  notesMap: Map<string, string>
) {
  const pageWidth = 509;
  const pageHeight = 679;
  const margin = 20;
  
  // Configuration
  const startHour = 6;
  const endHour = 21;
  const totalHours = endHour - startHour + 1; // 16 hours
  
  // Header with back button
  const headerHeight = 40;
  const notesHeight = 50;
  
  // "← Week View" button
  const buttonX = margin;
  const buttonY = margin;
  const buttonWidth = 100;
  const buttonHeight = 24;
  
  // Button background
  doc.fillColor('#F5F5F5')
     .rect(buttonX, buttonY, buttonWidth, buttonHeight)
     .fill();
  
  // Button border
  doc.strokeColor('#243447').lineWidth(1.5)
     .rect(buttonX, buttonY, buttonWidth, buttonHeight)
     .stroke();
  
  // Button text
  doc.fillColor('#243447').fontSize(10).font('Helvetica-Bold');
  doc.text('< Week View', buttonX, buttonY + 7, { width: buttonWidth, align: 'center' });
  
  // Make button clickable (use goTo action for internal navigation)
  doc.goTo(buttonX, buttonY, buttonWidth, buttonHeight, 'page_1');
  
  // Date header
  const dateStr = day.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  doc.fillColor('#000000').fontSize(12).font('Helvetica-Bold');
  doc.text(dateStr, margin, buttonY, { align: 'center' });
  
  // Notes section
  const notesY = headerHeight;
  const dayDateStr = day.toISOString().split('T')[0];
  const noteContent = notesMap.get(dayDateStr);
  
  doc.fontSize(9).font('Helvetica-Bold');
  doc.text('Notes & Goals:', margin, notesY);
  
  doc.rect(margin, notesY + 15, pageWidth - margin * 2, notesHeight - 15).stroke();
  
  if (noteContent) {
    doc.fontSize(8).font('Helvetica');
    doc.text(noteContent, margin + 5, notesY + 20, {
      width: pageWidth - margin * 2 - 10,
      height: notesHeight - 25,
      ellipsis: true
    });
  }
  
  // Grid layout
  const gridTop = headerHeight + notesHeight + 10;
  const gridHeight = pageHeight - gridTop - margin;
  const hourHeight = gridHeight / totalHours;
  const timeColumnWidth = 70;
  const eventColumnWidth = pageWidth - margin * 2 - timeColumnWidth;
  
  // Draw grid
  doc.strokeColor('#CCCCCC').lineWidth(0.5);
  
  // Vertical line
  doc.moveTo(margin + timeColumnWidth, gridTop)
     .lineTo(margin + timeColumnWidth, gridTop + gridHeight)
     .stroke();
  
  // Time grid - show every half-hour slot explicitly (like reference script)
  let rowY = gridTop;
  const rowHeight = hourHeight / 2; // Each half-hour gets its own row
  
  for (let hour = startHour; hour <= endHour; hour++) {
    for (const minute of ['00', '30']) {
      // Skip the last half-hour (we end at endHour:00)
      if (hour === endHour && minute === '30') break;
      
      // Draw horizontal grid line
      doc.strokeColor('#E0E0E0').lineWidth(0.5);
      doc.moveTo(margin, rowY)
         .lineTo(pageWidth - margin, rowY)
         .stroke();
      
      // Format time label with AM/PM
      const isPM = hour >= 12;
      const displayHour = hour > 12 ? hour - 12 : (hour === 0 ? 12 : hour);
      const timeLabel = `${displayHour}:${minute} ${isPM ? 'PM' : 'AM'}`;
      
      // Draw time label (bold for :00, regular for :30)
      const font = minute === '00' ? 'Helvetica-Bold' : 'Helvetica';
      const fontSize = minute === '00' ? 9 : 7;
      doc.fontSize(fontSize).font(font)
         .fillColor('#000000')
         .text(timeLabel, margin, rowY + 4, { width: timeColumnWidth - 10, align: 'right' });
      
      rowY += rowHeight;
    }
  }
  
  // Draw appointments
  const dayAppointments = appointments.filter(apt => {
    const aptDate = new Date(apt.startTime);
    return aptDate.getFullYear() === day.getFullYear() &&
           aptDate.getMonth() === day.getMonth() &&
           aptDate.getDate() === day.getDate();
  });
  
  dayAppointments.forEach(apt => {
    // Use times directly from database (already in correct timezone)
    const aptStart = new Date(apt.startTime);
    const aptEnd = new Date(apt.endTime);
    
    const startHourVal = aptStart.getHours();
    const startMinute = aptStart.getMinutes();
    const endHourVal = aptEnd.getHours();
    const endMinute = aptEnd.getMinutes();
    
    // Skip if outside display range
    if (startHourVal < startHour || startHourVal >= 22) return;
    
    // Calculate position
    const startY = gridTop + ((startHourVal - startHour) + (startMinute / 60)) * hourHeight;
    const duration = (endHourVal - startHourVal) + ((endMinute - startMinute) / 60);
    const height = duration * hourHeight;
    
    // Get colors
    const colors = getFinancialDistrictColors(apt.calendarId, apt.title);
    
    // Draw appointment box
    const boxX = margin + timeColumnWidth + 5;
    const boxWidth = eventColumnWidth - 10;
    
    // Background
    doc.fillColor(colors.background)
       .rect(boxX, startY, boxWidth, height)
       .fill();
    
    // Left flag (4px wide)
    doc.fillColor(colors.leftFlag)
       .rect(boxX, startY, 4, height)
       .fill();
    
    // Border
    doc.strokeColor(colors.border).lineWidth(1)
       .rect(boxX, startY, boxWidth, height)
       .stroke();
    
    // Title and time
    const cleanTitle = removeEmojis(apt.title);
    const startTimeStr = aptStart.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    const endTimeStr = aptEnd.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    
    doc.fillColor('#000000').fontSize(9).font('Helvetica-Bold');
    doc.text(cleanTitle, boxX + 6, startY + 4, {
      width: boxWidth - 12,
      ellipsis: true
    });
    
    doc.fontSize(8).font('Helvetica');
    doc.text(`${startTimeStr} - ${endTimeStr}`, boxX + 6, startY + 16, {
      width: boxWidth - 12
    });
  });
  
  // Add navigation footer (yesterday/tomorrow)
  const footerY = pageHeight - margin - 28;
  const navButtonWidth = 110;
  const navButtonHeight = 24;
  
  // Yesterday button (left side)
  const yesterdayX = margin;
  
  // Button background
  doc.fillColor('#F5F5F5')
     .rect(yesterdayX, footerY, navButtonWidth, navButtonHeight)
     .fill();
  
  // Button border
  doc.strokeColor('#243447').lineWidth(1.5)
     .rect(yesterdayX, footerY, navButtonWidth, navButtonHeight)
     .stroke();
  
  // Button text
  doc.fillColor('#243447').fontSize(10).font('Helvetica-Bold');
  doc.text('< Yesterday', yesterdayX, footerY + 7, { width: navButtonWidth, align: 'center' });
  
  // Link to previous day (if not first day)
  if (dayIndex > 0) {
    const prevPage = dayIndex + 1; // dayIndex is 0-based, pages are 2-8
    doc.goTo(yesterdayX, footerY, navButtonWidth, navButtonHeight, `page_${prevPage}`);
  }
  
  // Tomorrow button (right side)
  const tomorrowX = pageWidth - margin - navButtonWidth;
  
  // Button background
  doc.fillColor('#F5F5F5')
     .rect(tomorrowX, footerY, navButtonWidth, navButtonHeight)
     .fill();
  
  // Button border
  doc.strokeColor('#243447').lineWidth(1.5)
     .rect(tomorrowX, footerY, navButtonWidth, navButtonHeight)
     .stroke();
  
  // Button text
  doc.fillColor('#243447').fontSize(10).font('Helvetica-Bold');
  doc.text('Tomorrow >', tomorrowX, footerY + 7, { width: navButtonWidth, align: 'center' });
  
  // Link to next day (if not last day)
  if (dayIndex < 6) {
    const nextPage = dayIndex + 3; // dayIndex is 0-based, pages are 2-8
    doc.goTo(tomorrowX, footerY, navButtonWidth, navButtonHeight, `page_${nextPage}`);
  }
}
