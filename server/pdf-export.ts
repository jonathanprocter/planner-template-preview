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

      // Title
      doc.fontSize(20).font('Helvetica-Bold').text(`Weekly Planner`, { align: 'center' });
      doc.fontSize(12).font('Helvetica').text(`${startDate} to ${endDate}`, { align: 'center' });
      doc.moveDown(1);

      // Group appointments by date
      const appointmentsByDate: { [key: string]: Appointment[] } = {};
      appointments.forEach((apt) => {
        if (!appointmentsByDate[apt.date]) {
          appointmentsByDate[apt.date] = [];
        }
        appointmentsByDate[apt.date].push(apt);
      });

      // Sort dates
      const sortedDates = Object.keys(appointmentsByDate).sort();

      // Render each day
      sortedDates.forEach((date, index) => {
        const dayAppointments = appointmentsByDate[date];
        
        // Day header
        const dateObj = new Date(date + 'T00:00:00');
        const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
        const dateStr = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        
        doc.fontSize(14).font('Helvetica-Bold').text(`${dayName}, ${dateStr}`, { underline: true });
        doc.moveDown(0.5);

        // Sort appointments by start time
        dayAppointments.sort((a, b) => {
          return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
        });

        // Render appointments
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

          doc.fontSize(11).font('Helvetica-Bold').text(`${startTime} - ${endTime}`, { continued: true });
          doc.font('Helvetica').text(` ${apt.title}`);
          
          if (apt.description) {
            doc.fontSize(9).font('Helvetica').text(`  ${apt.description}`, { indent: 10 });
          }
          
          doc.moveDown(0.3);
        });

        doc.moveDown(0.7);

        // Add page break if not last day and running out of space
        if (index < sortedDates.length - 1 && doc.y > 580) {
          doc.addPage();
        }
      });

      // Finalize PDF
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
