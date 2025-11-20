#!/usr/bin/env python3
"""
Comprehensive System Audit Script for Planner Application
Identifies issues with drag-and-drop, duplication, notes display, and data accuracy
"""

import json
import os
import re
from pathlib import Path
from typing import List, Dict, Any

class SystemAuditor:
    def __init__(self, project_root: str):
        self.project_root = Path(project_root)
        self.issues = []
        self.warnings = []
        
    def log_issue(self, category: str, severity: str, description: str, file_path: str = "", line: int = 0):
        """Log an issue found during audit"""
        self.issues.append({
            "category": category,
            "severity": severity,
            "description": description,
            "file": file_path,
            "line": line
        })
        
    def log_warning(self, category: str, description: str, file_path: str = ""):
        """Log a warning found during audit"""
        self.warnings.append({
            "category": category,
            "description": description,
            "file": file_path
        })
    
    def audit_drag_drop_logic(self):
        """Audit drag-and-drop implementation"""
        print("🔍 Auditing drag-and-drop logic...")
        
        daily_view = self.project_root / "client/src/components/DailyView.tsx"
        if not daily_view.exists():
            self.log_issue("DRAG_DROP", "CRITICAL", "DailyView.tsx not found", str(daily_view))
            return
            
        content = daily_view.read_text()
        
        # Check for handleDragStart
        if "handleDragStart" not in content:
            self.log_issue("DRAG_DROP", "CRITICAL", "handleDragStart function not found", str(daily_view))
        
        # Check for handleDragMove
        if "handleDragMove" not in content:
            self.log_issue("DRAG_DROP", "CRITICAL", "handleDragMove function not found", str(daily_view))
            
        # Check for handleDragEnd
        if "handleDragEnd" not in content:
            self.log_issue("DRAG_DROP", "CRITICAL", "handleDragEnd function not found", str(daily_view))
            
        # Check if mouse handlers are attached
        if "onMouseMove" not in content:
            self.log_issue("DRAG_DROP", "CRITICAL", "onMouseMove handler not attached", str(daily_view))
        if "onMouseUp" not in content:
            self.log_issue("DRAG_DROP", "CRITICAL", "onMouseUp handler not attached", str(daily_view))
            
        # Check for event state management conflicts
        if content.count("setEvents(") > 5:
            self.log_warning("DRAG_DROP", "Multiple setEvents calls detected - potential state conflicts", str(daily_view))
            
        # Check for eventStore conflicts
        if "eventStore.subscribe" in content and "setEvents(eventStore.getEvents())" in content:
            self.log_issue("DRAG_DROP", "HIGH", "EventStore subscription conflicts with database events", str(daily_view))
            
        print(f"  ✓ Drag-and-drop audit complete")
    
    def audit_duplication_issues(self):
        """Audit for appointment duplication causes"""
        print("🔍 Auditing duplication issues...")
        
        daily_view = self.project_root / "client/src/components/DailyView.tsx"
        if not daily_view.exists():
            return
            
        content = daily_view.read_text()
        
        # Check for duplicate event merging
        if content.count("[...localEvents, ...dbEvents]") > 0:
            self.log_warning("DUPLICATION", "Event merging detected - verify no duplicates", str(daily_view))
            
        # Check for multiple useEffect hooks that set events
        useeffect_count = content.count("useEffect")
        setevents_in_useeffect = len(re.findall(r'useEffect.*?setEvents', content, re.DOTALL))
        if setevents_in_useeffect > 2:
            self.log_issue("DUPLICATION", "HIGH", f"Multiple useEffect hooks setting events ({setevents_in_useeffect})", str(daily_view))
            
        # Check if drag operations create new events instead of moving
        if "eventStore.addEvent" in content and "handleDragEnd" in content:
            # Check if addEvent is called in drag handlers
            drag_section = re.search(r'handleDragEnd.*?}', content, re.DOTALL)
            if drag_section and "addEvent" in drag_section.group():
                self.log_issue("DUPLICATION", "CRITICAL", "Drag operation may be creating new events", str(daily_view))
                
        print(f"  ✓ Duplication audit complete")
    
    def audit_notes_display(self):
        """Audit notes and reminders display logic"""
        print("🔍 Auditing notes and reminders display...")
        
        daily_view = self.project_root / "client/src/components/DailyView.tsx"
        if not daily_view.exists():
            return
            
        content = daily_view.read_text()
        
        # Check if notes field is loaded from database
        if "notes:" not in content or "notes: apt.notes" not in content:
            self.log_issue("NOTES_DISPLAY", "HIGH", "Notes field may not be loaded from database", str(daily_view))
            
        # Check if reminders field is loaded
        if "reminders:" not in content or "reminders: apt.reminders" not in content:
            self.log_issue("NOTES_DISPLAY", "HIGH", "Reminders field may not be loaded from database", str(daily_view))
            
        # Check for notes rendering in appointment block
        if "hasNotes" not in content:
            self.log_issue("NOTES_DISPLAY", "CRITICAL", "Notes display logic not found in appointment rendering", str(daily_view))
            
        # Check for reminders rendering
        if "hasReminders" not in content:
            self.log_issue("NOTES_DISPLAY", "CRITICAL", "Reminders display logic not found in appointment rendering", str(daily_view))
            
        # Check for multi-column layout
        if "showMultiColumn" not in content:
            self.log_warning("NOTES_DISPLAY", "Multi-column layout logic not found", str(daily_view))
            
        # Check for JSON parsing of reminders
        if "JSON.parse" in content and "reminders" in content:
            # Verify safe parsing
            if "try" not in content or "catch" not in content:
                self.log_issue("NOTES_DISPLAY", "MEDIUM", "Reminders JSON parsing not wrapped in try-catch", str(daily_view))
                
        print(f"  ✓ Notes display audit complete")
    
    def audit_data_accuracy(self):
        """Audit data loading and accuracy"""
        print("🔍 Auditing data accuracy...")
        
        daily_view = self.project_root / "client/src/components/DailyView.tsx"
        if not daily_view.exists():
            return
            
        content = daily_view.read_text()
        
        # Check for proper database query
        if "trpc.appointments.getByDateRange.useQuery" not in content:
            self.log_issue("DATA_ACCURACY", "CRITICAL", "Database query not found", str(daily_view))
            
        # Check if title field is properly loaded
        if "title: apt.title" not in content:
            self.log_warning("DATA_ACCURACY", "Title field mapping not found", str(daily_view))
            
        # Check for proper date handling
        if "currentDateStr" not in content:
            self.log_warning("DATA_ACCURACY", "Date string variable not found", str(daily_view))
            
        # Check backend router
        routers = self.project_root / "server/routers.ts"
        if routers.exists():
            router_content = routers.read_text()
            
            # Check if getByDateRange returns all necessary fields
            if "getByDateRange" in router_content:
                if "notes" not in router_content:
                    self.log_issue("DATA_ACCURACY", "HIGH", "Notes field may not be returned by getByDateRange", str(routers))
                if "reminders" not in router_content:
                    self.log_issue("DATA_ACCURACY", "HIGH", "Reminders field may not be returned by getByDateRange", str(routers))
                    
        print(f"  ✓ Data accuracy audit complete")
    
    def audit_database_schema(self):
        """Audit database schema"""
        print("🔍 Auditing database schema...")
        
        schema = self.project_root / "drizzle/schema.ts"
        if not schema.exists():
            self.log_issue("DATABASE", "CRITICAL", "Database schema file not found", str(schema))
            return
            
        content = schema.read_text()
        
        # Check for required fields in appointments table
        required_fields = ["title", "notes", "reminders", "status", "startTime", "endTime"]
        for field in required_fields:
            if field not in content:
                self.log_issue("DATABASE", "HIGH", f"Required field '{field}' not found in schema", str(schema))
                
        print(f"  ✓ Database schema audit complete")
    
    def audit_state_management(self):
        """Audit React state management"""
        print("🔍 Auditing state management...")
        
        daily_view = self.project_root / "client/src/components/DailyView.tsx"
        if not daily_view.exists():
            return
            
        content = daily_view.read_text()
        
        # Count useState hooks
        usestate_count = content.count("useState")
        if usestate_count > 15:
            self.log_warning("STATE_MANAGEMENT", f"High number of useState hooks ({usestate_count}) - consider refactoring", str(daily_view))
            
        # Check for proper cleanup in useEffect
        useeffect_with_cleanup = content.count("return () =>")
        useeffect_total = content.count("useEffect(")
        if useeffect_with_cleanup < useeffect_total // 2:
            self.log_warning("STATE_MANAGEMENT", "Many useEffect hooks without cleanup functions", str(daily_view))
            
        print(f"  ✓ State management audit complete")
    
    def generate_report(self):
        """Generate audit report"""
        print("\n" + "="*80)
        print("📊 AUDIT REPORT")
        print("="*80)
        
        if not self.issues and not self.warnings:
            print("\n✅ No issues found! System appears healthy.")
            return
            
        if self.issues:
            print(f"\n🚨 ISSUES FOUND: {len(self.issues)}")
            print("-"*80)
            
            # Group by severity
            critical = [i for i in self.issues if i["severity"] == "CRITICAL"]
            high = [i for i in self.issues if i["severity"] == "HIGH"]
            medium = [i for i in self.issues if i["severity"] == "MEDIUM"]
            
            if critical:
                print(f"\n🔴 CRITICAL ({len(critical)}):")
                for issue in critical:
                    print(f"  [{issue['category']}] {issue['description']}")
                    if issue['file']:
                        print(f"    File: {issue['file']}")
                        
            if high:
                print(f"\n🟠 HIGH ({len(high)}):")
                for issue in high:
                    print(f"  [{issue['category']}] {issue['description']}")
                    if issue['file']:
                        print(f"    File: {issue['file']}")
                        
            if medium:
                print(f"\n🟡 MEDIUM ({len(medium)}):")
                for issue in medium:
                    print(f"  [{issue['category']}] {issue['description']}")
                    if issue['file']:
                        print(f"    File: {issue['file']}")
                        
        if self.warnings:
            print(f"\n⚠️  WARNINGS: {len(self.warnings)}")
            print("-"*80)
            for warning in self.warnings:
                print(f"  [{warning['category']}] {warning['description']}")
                if warning['file']:
                    print(f"    File: {warning['file']}")
                    
        print("\n" + "="*80)
        
        # Save report to file
        report_file = self.project_root / "AUDIT_REPORT.json"
        with open(report_file, 'w') as f:
            json.dump({
                "issues": self.issues,
                "warnings": self.warnings,
                "summary": {
                    "total_issues": len(self.issues),
                    "critical": len([i for i in self.issues if i["severity"] == "CRITICAL"]),
                    "high": len([i for i in self.issues if i["severity"] == "HIGH"]),
                    "medium": len([i for i in self.issues if i["severity"] == "MEDIUM"]),
                    "warnings": len(self.warnings)
                }
            }, f, indent=2)
        print(f"\n📄 Full report saved to: {report_file}")
    
    def run_audit(self):
        """Run complete system audit"""
        print("\n" + "="*80)
        print("🔧 PLANNER SYSTEM AUDIT")
        print("="*80 + "\n")
        
        self.audit_drag_drop_logic()
        self.audit_duplication_issues()
        self.audit_notes_display()
        self.audit_data_accuracy()
        self.audit_database_schema()
        self.audit_state_management()
        
        self.generate_report()

if __name__ == "__main__":
    project_root = "/home/ubuntu/planner-template-preview"
    auditor = SystemAuditor(project_root)
    auditor.run_audit()
