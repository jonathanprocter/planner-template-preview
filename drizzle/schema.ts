import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Appointments table for storing calendar events from 2015-2030.
 * Synced with Google Calendar with automatic backup and sync management.
 */
export const appointments = mysqlTable("appointments", {
  id: int("id").autoincrement().primaryKey(),
  /** User ID who owns this appointment */
  userId: int("userId").notNull(),
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
  status: mysqlEnum("status", ["scheduled", "completed", "client_canceled", "therapist_canceled", "no_show"]).default("scheduled").notNull(),
  /** Reminders and follow-up items (JSON array of strings) */
  reminders: text("reminders"),
  /** Session notes and observations */
  notes: text("notes"),
  /** Current session number */
  sessionNumber: int("sessionNumber"),
  /** Total planned sessions */
  totalSessions: int("totalSessions"),
  /** Presenting concerns (JSON array of strings) */
  presentingConcerns: text("presentingConcerns"),
  /** Last session date */
  lastSessionDate: varchar("lastSessionDate", { length: 10 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Appointment = typeof appointments.$inferSelect;
export type InsertAppointment = typeof appointments.$inferInsert;

/**
 * Daily notes table for storing notes and goals for each day
 */
export const dailyNotes = mysqlTable("dailyNotes", {
  id: int("id").autoincrement().primaryKey(),
  /** User ID who owns this note */
  userId: int("userId").notNull(),
  /** Date in YYYY-MM-DD format */
  date: varchar("date", { length: 10 }).notNull(),
  /** Note content */
  content: text("content"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type DailyNote = typeof dailyNotes.$inferSelect;
export type InsertDailyNote = typeof dailyNotes.$inferInsert;

/**
 * Deleted appointments table for tracking Google Calendar events that users have intentionally deleted
 * This prevents re-importing them during sync
 */
export const deletedAppointments = mysqlTable("deletedAppointments", {
  id: int("id").autoincrement().primaryKey(),
  /** User ID who deleted this appointment */
  userId: int("userId").notNull(),
  /** Google Calendar event ID that was deleted */
  googleEventId: varchar("googleEventId", { length: 255 }).notNull(),
  /** Calendar ID from Google Calendar */
  calendarId: varchar("calendarId", { length: 255 }),
  deletedAt: timestamp("deletedAt").defaultNow().notNull(),
});

export type DeletedAppointment = typeof deletedAppointments.$inferSelect;
export type InsertDeletedAppointment = typeof deletedAppointments.$inferInsert;

/**
 * Appointment history table for tracking all changes to appointments
 * Provides audit trail for status changes, reschedules, note edits, etc.
 */
export const appointmentHistory = mysqlTable("appointmentHistory", {
  id: int("id").autoincrement().primaryKey(),
  /** User ID who made the change */
  userId: int("userId").notNull(),
  /** Appointment ID that was changed */
  appointmentId: int("appointmentId").notNull(),
  /** Google Calendar event ID */
  googleEventId: varchar("googleEventId", { length: 255 }),
  /** Type of change made */
  changeType: mysqlEnum("changeType", ["created", "status_changed", "rescheduled", "notes_updated", "reminders_updated", "deleted"]).notNull(),
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