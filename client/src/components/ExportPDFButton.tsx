import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Download, Upload } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { uploadToGoogleDrive, getAccessToken } from "@/lib/googleCalendar";

interface ExportPDFButtonProps {
  weekStart: Date;
  weekEnd: Date;
}

export function ExportPDFButton({ weekStart, weekEnd }: ExportPDFButtonProps) {
  const exportMutation = trpc.appointments.exportPDF.useMutation();
  const [isUploadingToDrive, setIsUploadingToDrive] = useState(false);
  const [orientation, setOrientation] = useState<"landscape" | "portrait">("landscape");
  const [exportRange, setExportRange] = useState<"week" | "month">("week");

  const handleExport = async () => {
    const rangeText = exportRange === "month" ? "monthly (4 weeks)" : "weekly";
    toast.info(`Generating ${rangeText} PDF...`);

    try {
      const formatDate = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      // Calculate date range based on export type
      let startDate, endDate;
      if (exportRange === "month") {
        // Export 4 weeks starting from current week
        startDate = formatDate(weekStart);
        const monthEnd = new Date(weekStart);
        monthEnd.setDate(monthEnd.getDate() + 27); // 4 weeks = 28 days - 1
        endDate = formatDate(monthEnd);
      } else {
        // Export single week
        startDate = formatDate(weekStart);
        endDate = formatDate(weekEnd);
      }

      const result = await exportMutation.mutateAsync({
        startDate,
        endDate,
        orientation: orientation,
      });

      // Convert base64 to blob
      const binaryString = atob(result.pdf);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: 'application/pdf' });
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = result.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success("PDF exported successfully!");
    } catch (error) {
      console.error("Error exporting PDF:", error);
      toast.error("Failed to export PDF");
    }
  };

  const handleSaveToDrive = async () => {
    const rangeText = exportRange === "month" ? "monthly (4 weeks)" : "weekly";
    toast.info(`Generating ${rangeText} PDF for Google Drive...`);
    setIsUploadingToDrive(true);

    try {
      // Check if user is signed in to Google
      const accessToken = getAccessToken();
      if (!accessToken) {
        toast.error("Please sign in to Google Calendar first");
        setIsUploadingToDrive(false);
        return;
      }

      const formatDate = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      // Calculate date range based on export type
      let startDate, endDate;
      if (exportRange === "month") {
        // Export 4 weeks starting from current week
        startDate = formatDate(weekStart);
        const monthEnd = new Date(weekStart);
        monthEnd.setDate(monthEnd.getDate() + 27); // 4 weeks = 28 days - 1
        endDate = formatDate(monthEnd);
      } else {
        // Export single week
        startDate = formatDate(weekStart);
        endDate = formatDate(weekEnd);
      }

      // Generate PDF
      const result = await exportMutation.mutateAsync({
        startDate,
        endDate,
        orientation: orientation,
      });

      // Convert base64 to blob
      const binaryString = atob(result.pdf);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: 'application/pdf' });

      // Create filename with date range
      const startStr = weekStart.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
      const endStr = weekEnd.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
      const filename = `${startStr} - ${endStr}.pdf`;

      toast.info("Uploading to Google Drive...");

      // Upload to Google Drive
      const driveFile = await uploadToGoogleDrive(blob, filename, 'application/pdf');

      if (driveFile) {
        toast.success(`PDF saved to Google Drive as "${filename}"`);
      } else {
        toast.error("Failed to upload to Google Drive");
      }
    } catch (error: any) {
      console.error("Error saving to Google Drive:", error);
      toast.error(error?.message || "Failed to save to Google Drive");
    } finally {
      setIsUploadingToDrive(false);
    }
  };

  return (
    <div className="flex gap-2 items-center">
      <Select value={exportRange} onValueChange={(value: "week" | "month") => setExportRange(value)}>
        <SelectTrigger className="w-[120px]">
          <SelectValue placeholder="Range" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="week">Week</SelectItem>
          <SelectItem value="month">Month (4wks)</SelectItem>
        </SelectContent>
      </Select>
      <Select value={orientation} onValueChange={(value: "landscape" | "portrait") => setOrientation(value)}>
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Orientation" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="landscape">Landscape</SelectItem>
          <SelectItem value="portrait">Portrait</SelectItem>
        </SelectContent>
      </Select>
      <Button
        onClick={handleExport}
        disabled={exportMutation.isPending || isUploadingToDrive}
        variant="outline"
        className="flex items-center gap-2"
      >
        <Download className="w-4 h-4" />
        {exportMutation.isPending ? "Exporting..." : "Export to PDF"}
      </Button>
      <Button
        onClick={handleSaveToDrive}
        disabled={exportMutation.isPending || isUploadingToDrive}
        variant="outline"
        className="flex items-center gap-2"
      >
        <Upload className="w-4 h-4" />
        {isUploadingToDrive ? "Saving..." : "Save to Drive"}
      </Button>
    </div>
  );
}
