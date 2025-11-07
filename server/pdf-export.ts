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
    console.log('[Puppeteer] Starting browser launch...');
    browser = await puppeteer.launch({
      headless: true,
      executablePath: '/home/ubuntu/.cache/puppeteer/chrome/linux-142.0.7444.61/chrome-linux64/chrome',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
      ],
    });
    console.log('[Puppeteer] Browser launched successfully');
    
    const page = await browser.newPage();
    console.log('[Puppeteer] New page created');
    
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
    const url = `${baseUrl}/`;
    console.log(`[Puppeteer] Navigating to: ${url}`);
    console.log(`[Puppeteer] Base URL: ${baseUrl}`);
    console.log(`[Puppeteer] Auth cookie: ${authCookie ? 'present' : 'missing'}`);
    
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 60000, // Increased timeout
    });
    console.log('[Puppeteer] Page loaded successfully');
    
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
    console.log('[Puppeteer] Generating PDF...');
    const pdf = await page.pdf({
      width: '1620px',
      height: '2160px',
      printBackground: true,
      preferCSSPageSize: false,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });
    
    console.log(`[Puppeteer] PDF generated successfully: ${pdf.length} bytes`);
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

// Convert date to EST timezone for consistent PDF output
function toEST(date: Date): Date {
  // Create a new date string in EST timezone
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
  
  // Parse the EST string back to a Date object
  // Format: MM/DD/YYYY, HH:mm:ss
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
        margins: { top: 20, bottom: 20, left: 20, right: 20 },
      });

      const buffers: Buffer[] = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      // Generate week dates - FIXED: avoid date mutation issues
      // Create dates at noon EST to avoid timezone shift issues
      const weekDays: Date[] = [];
      for (let i = 0; i < 7; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);
        date.setHours(12, 0, 0, 0); // Set to noon to avoid timezone boundary issues
        weekDays.push(date);
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
  
  // Title - dynamically generate from weekDays with EST timezone
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
    // Convert to EST for date display
    const estDate = toEST(weekDays[i]);
    doc.fontSize(7).font('Helvetica').text(estDate.getDate().toString(), x, gridTop + 12, { width: columnWidth, align: 'center' });
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
    // Convert to EST for display
    const aptDate = toEST(new Date(apt.startTime));
    const estWeekDays = weekDays.map(d => toEST(d));
    
    const dayIndex = estWeekDays.findIndex(d => 
      d.getFullYear() === aptDate.getFullYear() &&
      d.getMonth() === aptDate.getMonth() &&
      d.getDate() === aptDate.getDate()
    );

    if (dayIndex === -1) return;

    const hour = aptDate.getHours();
    const minute = aptDate.getMinutes();
    
    const endDate = toEST(new Date(apt.endTime));
    const endHour = endDate.getHours();
    const endMinute = endDate.getMinutes();
    
    // FIXED: Changed >= to > so appointments at 9 PM (21:00) are included
    if (hour < startHour || hour > endHour) return;

    const startY = gridTop + 25 + (hour - startHour + minute / 60) * hourHeight;
    const duration = (endHour - hour) + (endMinute - minute) / 60;
    const height = Math.max(duration * hourHeight, 10);

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
  appointments: Appointment[]
) {
  const pageWidth = 509; // Portrait orientation
  const pageHeight = 679;
  const margin = 20;
  const headerHeight = 50;
  
  // Title with EST timezone
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
  doc.fontSize(14).font('Helvetica-Bold')
    .text(`${dayName}, ${dateStr}`, margin, 20, {
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
  
  // Add button text
  doc.fontSize(8).font('Helvetica')
    .fillColor('#243447')
    .text('← Week View', buttonX + 5, buttonY + 6, { 
      width: buttonWidth - 10,
      align: 'left'
    })
    .fillColor('#000000');
  
  // Add clickable link overlay
  doc.link(buttonX, buttonY, buttonWidth, buttonHeight, '#page=1');

  // Grid setup
  const gridTop = headerHeight;
  const gridHeight = pageHeight - headerHeight - 40;
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

  // Filter appointments for this day (using EST)
  const estDay = toEST(day);
  const dayAppointments = appointments.filter(apt => {
    const aptDate = toEST(new Date(apt.startTime));
    return aptDate.getFullYear() === estDay.getFullYear() &&
           aptDate.getMonth() === estDay.getMonth() &&
           aptDate.getDate() === estDay.getDate();
  });

  // Draw appointments
  dayAppointments.forEach(apt => {
    const aptDate = toEST(new Date(apt.startTime));
    const hour = aptDate.getHours();
    const minute = aptDate.getMinutes();
    
    const endDate = toEST(new Date(apt.endTime));
    const endHour = endDate.getHours();
    const endMinute = endDate.getMinutes();
    
    // FIXED: Changed >= to > so appointments at 9 PM (21:00) are included
    if (hour < startHour || hour > endHour) return;

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
