import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DailyView from "@/components/DailyView";
import WeeklyView from "@/components/WeeklyView";
import { Calendar, CalendarDays, Info } from "lucide-react";

export default function Home() {
  const [activeView, setActiveView] = useState<"daily" | "weekly">("daily");
  const [showInfo, setShowInfo] = useState(true);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="bg-white border-b shadow-sm">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Planner Template Preview</h1>
              <p className="text-slate-600 mt-1">Custom CalSync Template Visualization</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowInfo(!showInfo)}
              className="gap-2"
            >
              <Info className="w-4 h-4" />
              {showInfo ? "Hide" : "Show"} Info
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8">
        {/* Info Card */}
        {showInfo && (
          <Card className="mb-6 border-blue-200 bg-blue-50">
            <CardHeader>
              <CardTitle className="text-blue-900">About This Preview</CardTitle>
              <CardDescription className="text-blue-700">
                This is a live preview of your custom daily and weekly planner templates designed for CalSync integration.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-blue-800 space-y-2">
              <p>
                <strong>Daily View:</strong> Features a full-width time grid (06:00-23:30), statistics bar showing appointments/scheduled/available hours, and navigation buttons.
              </p>
              <p>
                <strong>Weekly View:</strong> Traditional 7-column layout (Monday-Sunday) with hourly time slots from 06:00-23:00.
              </p>
              <p className="text-xs text-blue-600 mt-4">
                Sample events are displayed to demonstrate how calendar entries will appear in the final CalSync integration.
              </p>
            </CardContent>
          </Card>
        )}

        {/* View Switcher */}
        <Tabs value={activeView} onValueChange={(v) => setActiveView(v as "daily" | "weekly")} className="w-full">
          <div className="flex justify-center mb-6">
            <TabsList className="grid w-[400px] grid-cols-2">
              <TabsTrigger value="daily" className="gap-2">
                <Calendar className="w-4 h-4" />
                Daily View
              </TabsTrigger>
              <TabsTrigger value="weekly" className="gap-2">
                <CalendarDays className="w-4 h-4" />
                Weekly View
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Daily View */}
          <TabsContent value="daily" className="mt-0">
            <Card className="overflow-hidden">
              <CardHeader className="bg-slate-50 border-b">
                <CardTitle>Daily Template Preview</CardTitle>
                <CardDescription>
                  Dimensions: 1620 × 2160 pixels (reMarkable tablet resolution)
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-auto" style={{ maxHeight: "calc(100vh - 300px)" }}>
                  <DailyView />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Weekly View */}
          <TabsContent value="weekly" className="mt-0">
            <Card className="overflow-hidden">
              <CardHeader className="bg-slate-50 border-b">
                <CardTitle>Weekly Template Preview</CardTitle>
                <CardDescription>
                  Dimensions: 1620 × 2160 pixels (reMarkable tablet resolution)
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-auto" style={{ maxHeight: "calc(100vh - 300px)" }}>
                  <WeeklyView />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Configuration Details */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Template Configuration</CardTitle>
            <CardDescription>Key settings for your custom templates</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold text-lg mb-3">Daily View Settings</h3>
                <ul className="space-y-2 text-sm">
                  <li className="flex justify-between">
                    <span className="text-slate-600">Time Range:</span>
                    <span className="font-medium">06:00 - 23:30</span>
                  </li>
                  <li className="flex justify-between">
                    <span className="text-slate-600">Hour Height:</span>
                    <span className="font-medium">100px</span>
                  </li>
                  <li className="flex justify-between">
                    <span className="text-slate-600">Grid Width:</span>
                    <span className="font-medium">1420px</span>
                  </li>
                  <li className="flex justify-between">
                    <span className="text-slate-600">Stats Bar:</span>
                    <span className="font-medium">4 metrics</span>
                  </li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-3">Weekly View Settings</h3>
                <ul className="space-y-2 text-sm">
                  <li className="flex justify-between">
                    <span className="text-slate-600">Time Range:</span>
                    <span className="font-medium">06:00 - 23:00</span>
                  </li>
                  <li className="flex justify-between">
                    <span className="text-slate-600">Hour Height:</span>
                    <span className="font-medium">100px</span>
                  </li>
                  <li className="flex justify-between">
                    <span className="text-slate-600">Day Columns:</span>
                    <span className="font-medium">7 (Mon-Sun)</span>
                  </li>
                  <li className="flex justify-between">
                    <span className="text-slate-600">Column Width:</span>
                    <span className="font-medium">200px</span>
                  </li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
