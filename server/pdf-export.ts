import PDFDocument from "pdfkit";
import { Readable } from "stream";

interface Appointment {
  id: number;
  title: string;
  description: string | null;
  startTime: Date;
  endTime: Date;
  date: string;
  category: string | null;
}

export async function generateWeeklyPlannerPDF(
  appointments: Appointment[],
  startDate: string,
  endDate: string
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      // Create PDF optimized for reMarkable 2 Pro (portrait orientation)
      // reMarkable dimensions: 1620×2160 pixels at 229 PPI
      // Convert to points (72 PPI): 1620/229*72 = 509.2pt width, 2160/229*72 = 679pt height
      const doc = new PDFDocument({
        size: [509, 679], // Custom size for reMarkable 2 Pro
        margins: { top: 30, bottom: 30, left: 30, right: 30 },
        info: {
          Title: `Weekly Planner ${startDate} to ${endDate}`,
          Author: 'Planner App',
        },
      });

      const buffers: Buffer[] = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(buffers);
        resolve(pdfBuffer);
      });
      doc.on('error', reject);

      // Group appointments by date
      const appointmentsByDate: { [key: string]: Appointment[] } = {};
      appointments.forEach((apt) => {
        if (!appointmentsByDate[apt.date]) {
          appointmentsByDate[apt.date] = [];
        }
        appointmentsByDate[apt.date].push(apt);
      });

      // Get all 7 days of the week
      const weekDays: string[] = [];
      const start = new Date(startDate + 'T00:00:00');
      for (let i = 0; i < 7; i++) {
        const day = new Date(start);
        day.setDate(start.getDate() + i);
        const dateStr = day.toISOString().split('T')[0];
        weekDays.push(dateStr);
        // Ensure each day has an entry
        if (!appointmentsByDate[dateStr]) {
          appointmentsByDate[dateStr] = [];
        }
      }

      // ===== PAGE 1: WEEKLY OVERVIEW =====
      doc.fontSize(24).font('Helvetica-Bold').text('Weekly Overview', { align: 'center' });
      doc.fontSize(14).font('Helvetica').text(`${startDate} to ${endDate}`, { align: 'center' });
      doc.moveDown(2);

      // Render weekly summary
      weekDays.forEach((date) => {
        const dayAppointments = appointmentsByDate[date] || [];
        const dateObj = new Date(date + 'T00:00:00');
        const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
        const dateStr = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        
        doc.fontSize(12).font('Helvetica-Bold').text(`${dayName}, ${dateStr}`, { underline: true });
        doc.moveDown(0.3);

        if (dayAppointments.length === 0) {
          doc.fontSize(10).font('Helvetica').fillColor('#666666').text('  No appointments');
          doc.fillColor('#000000'); // Reset color
        } else {
          // Sort appointments by start time
          dayAppointments.sort((a, b) => {
            return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
          });

          dayAppointments.forEach((apt) => {
            const startTime = new Date(apt.startTime).toLocaleTimeString('en-US', { 
              hour: 'numeric', 
              minute: '2-digit',
              hour12: true 
            });
            const endTime = new Date(apt.endTime).toLocaleTimeString('en-US', { 
              hour: 'numeric', 
              minute: '2-digit',
              hour12: true 
            });

            doc.fontSize(10).font('Helvetica').text(`  ${startTime} - ${endTime}: ${apt.title}`);
          });
        }
        
        doc.moveDown(0.8);
      });

      // ===== PAGES 2-8: DAILY VIEWS =====
      weekDays.forEach((date, dayIndex) => {
        doc.addPage();
        
        const dayAppointments = appointmentsByDate[date] || [];
        const dateObj = new Date(date + 'T00:00:00');
        const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
        const dateStr = dateObj.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
        
        // Daily page header
        doc.fontSize(22).font('Helvetica-Bold').text(dayName, { align: 'center' });
        doc.fontSize(14).font('Helvetica').text(dateStr, { align: 'center' });
        doc.moveDown(2);

        if (dayAppointments.length === 0) {
          doc.fontSize(12).font('Helvetica').fillColor('#999999').text('No appointments scheduled', { align: 'center' });
          doc.fillColor('#000000'); // Reset color
        } else {
          // Sort appointments by start time
          dayAppointments.sort((a, b) => {
            return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
          });

          // Render appointments with details
          dayAppointments.forEach((apt, index) => {
            const startTime = new Date(apt.startTime).toLocaleTimeString('en-US', { 
              hour: 'numeric', 
              minute: '2-digit',
              hour12: true 
            });
            const endTime = new Date(apt.endTime).toLocaleTimeString('en-US', { 
              hour: 'numeric', 
              minute: '2-digit',
              hour12: true 
            });

            // Time and title
            doc.fontSize(14).font('Helvetica-Bold').text(`${startTime} - ${endTime}`);
            doc.fontSize(12).font('Helvetica-Bold').text(apt.title, { indent: 10 });
            
            // Category
            if (apt.category) {
              doc.fontSize(10).font('Helvetica').fillColor('#666666').text(`Category: ${apt.category}`, { indent: 10 });
              doc.fillColor('#000000'); // Reset color
            }
            
            // Description
            if (apt.description) {
              doc.fontSize(10).font('Helvetica').text(`Notes: ${apt.description}`, { 
                indent: 10,
                width: 440,
                align: 'left'
              });
            }
            
            // Separator line
            if (index < dayAppointments.length - 1) {
              doc.moveDown(0.5);
              doc.strokeColor('#CCCCCC')
                 .lineWidth(0.5)
                 .moveTo(30, doc.y)
                 .lineTo(479, doc.y)
                 .stroke();
              doc.moveDown(0.5);
            } else {
              doc.moveDown(1);
            }
          });
        }

        // Add notes section at bottom
        doc.moveDown(2);
        doc.fontSize(10).font('Helvetica-Bold').text('Notes:', { underline: true });
        doc.moveDown(0.5);
        
        // Draw lines for notes
        const linesRemaining = Math.floor((619 - doc.y) / 20); // Calculate remaining space
        for (let i = 0; i < Math.min(linesRemaining, 10); i++) {
          doc.strokeColor('#DDDDDD')
             .lineWidth(0.5)
             .moveTo(30, doc.y + 15)
             .lineTo(479, doc.y + 15)
             .stroke();
          doc.moveDown(1.2);
        }
      });

      // Finalize PDF
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
