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
  /** Recurring appointment settings (JSON) */
  recurrence: text("recurrence"),
  /** Last synced with Google Calendar */
  lastSynced: timestamp("lastSynced"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Appointment = typeof appointments.$inferSelect;
export type InsertAppointment = typeof appointments.$inferInsert;