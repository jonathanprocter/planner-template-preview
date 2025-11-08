import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Download } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useState } from "react";

interface ExportPDFButtonProps {
  weekStart: Date;
  weekEnd: Date;
}

export function ExportPDFButton({ weekStart, weekEnd }: ExportPDFButtonProps) {
  const exportMutation = trpc.appointments.exportPDF.useMutation();
  const [format, setFormat] = useState<'web' | 'remarkable'>('remarkable');

  const handleExport = async () => {
    toast.info("Generating PDF...");

    try {
      const formatDate = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      const result = await exportMutation.mutateAsync({
        startDate: formatDate(weekStart),
        endDate: formatDate(weekEnd),
        format,
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

  return (
    <div className="flex gap-2">
      <select 
        value={format} 
        onChange={(e) => setFormat(e.target.value as 'web' | 'remarkable')}
        className="border rounded px-3 py-2 text-sm bg-background"
      >
        <option value="remarkable">reMarkable (679×509)</option>
        <option value="web">Web View (1620×2160)</option>
      </select>
      <Button
        onClick={handleExport}
        disabled={exportMutation.isPending}
        variant="outline"
        className="flex items-center gap-2"
      >
        <Download className="w-4 h-4" />
        {exportMutation.isPending ? "Exporting..." : "Export to PDF"}
      </Button>
    </div>
  );
}
