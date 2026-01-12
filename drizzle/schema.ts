import { integer, pgEnum, pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const roleEnum = pgEnum("role", ["user", "admin"]);

export const users = pgTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: serial("id").primaryKey(),
  /** User identifier. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: roleEnum("role").default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Status enum for appointments
 */
export const appointmentStatusEnum = pgEnum("appointment_status", ["scheduled", "completed", "client_canceled", "therapist_canceled", "no_show"]);

/**
 * Appointments table for storing calendar events from 2015-2030.
 * Synced with Google Calendar with automatic backup and sync management.
 */
export const appointments = pgTable("appointments", {
  id: serial("id").primaryKey(),
  /** User ID who owns this appointment */
  userId: integer("userId").notNull(),
  /** Google Calendar event ID for sync tracking */
  googleEventId: varchar("googleEventId", { length: 255 }),
  /** Calendar ID from Google Calendar */
  calendarId: varchar("calendarId", { length: 255 }),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),
  /** Start date and time */
  startTime: timestamp("startTime").notNull(),
  /** End date and time */
  endTime: timestamp("endTime").notNull(),
  /** Date in YYYY-MM-DD format for quick filtering */
  date: varchar("date", { length: 10 }).notNull(),
  /** Category for color-coding */
  category: varchar("category", { length: 100 }),
  /** Note tags for categorizing notes (JSON array of strings) */
  noteTags: text("noteTags"),
  /** Recurring appointment settings (JSON) */
  recurrence: text("recurrence"),
  /** Last synced with Google Calendar */
  lastSynced: timestamp("lastSynced"),
  /** Appointment status for tracking completion and cancellations */
  status: appointmentStatusEnum("status").default("scheduled").notNull(),
  /** Reminders and follow-up items (JSON array of strings) */
  reminders: text("reminders"),
  /** Session notes and observations */
  notes: text("notes"),
  /** Current session number */
  sessionNumber: integer("sessionNumber"),
  /** Total planned sessions */
  totalSessions: integer("totalSessions"),
  /** Presenting concerns (JSON array of strings) */
  presentingConcerns: text("presentingConcerns"),
  /** Last session date */
  lastSessionDate: varchar("lastSessionDate", { length: 10 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type Appointment = typeof appointments.$inferSelect;
export type InsertAppointment = typeof appointments.$inferInsert;

/**
 * Daily notes table for storing notes and goals for each day
 */
export const dailyNotes = pgTable("dailyNotes", {
  id: serial("id").primaryKey(),
  /** User ID who owns this note */
  userId: integer("userId").notNull(),
  /** Date in YYYY-MM-DD format */
  date: varchar("date", { length: 10 }).notNull(),
  /** Note content */
  content: text("content"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type DailyNote = typeof dailyNotes.$inferSelect;
export type InsertDailyNote = typeof dailyNotes.$inferInsert;

/**
 * Deleted appointments table for tracking Google Calendar events that users have intentionally deleted
 * This prevents re-importing them during sync
 */
export const deletedAppointments = pgTable("deletedAppointments", {
  id: serial("id").primaryKey(),
  /** User ID who deleted this appointment */
  userId: integer("userId").notNull(),
  /** Google Calendar event ID that was deleted */
  googleEventId: varchar("googleEventId", { length: 255 }).notNull(),
  /** Calendar ID from Google Calendar */
  calendarId: varchar("calendarId", { length: 255 }),
  deletedAt: timestamp("deletedAt").defaultNow().notNull(),
});

export type DeletedAppointment = typeof deletedAppointments.$inferSelect;
export type InsertDeletedAppointment = typeof deletedAppointments.$inferInsert;

/**
 * Change type enum for appointment history
 */
export const changeTypeEnum = pgEnum("change_type", ["created", "status_changed", "rescheduled", "notes_updated", "reminders_updated", "deleted"]);

/**
 * Appointment history table for tracking all changes to appointments
 * Provides audit trail for status changes, reschedules, note edits, etc.
 */
export const appointmentHistory = pgTable("appointmentHistory", {
  id: serial("id").primaryKey(),
  /** User ID who made the change */
  userId: integer("userId").notNull(),
  /** Appointment ID that was changed */
  appointmentId: integer("appointmentId").notNull(),
  /** Google Calendar event ID */
  googleEventId: varchar("googleEventId", { length: 255 }),
  /** Type of change made */
  changeType: changeTypeEnum("changeType").notNull(),
  /** Field that was changed (e.g., 'status', 'startTime', 'notes') */
  fieldChanged: varchar("fieldChanged", { length: 100 }),
  /** Previous value (JSON or text) */
  oldValue: text("oldValue"),
  /** New value (JSON or text) */
  newValue: text("newValue"),
  /** Human-readable description of the change */
  description: text("description"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AppointmentHistory = typeof appointmentHistory.$inferSelect;
export type InsertAppointmentHistory = typeof appointmentHistory.$inferInsert;
