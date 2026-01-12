import { and, eq, gte, lte } from "drizzle-orm";
import { appointments, InsertAppointment } from "../drizzle/schema";
import { getDb } from "./db";

/**
 * Get appointments for a user within a date range
 */
export async function getUserAppointments(
  userId: number,
  startDate: string,
  endDate: string
) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(appointments)
    .where(
      and(
        eq(appointments.userId, userId),
        gte(appointments.date, startDate),
        lte(appointments.date, endDate)
      )
    )
    .orderBy(appointments.startTime);
}

/**
 * Get all appointments for a user (for full year sync)
 */
export async function getAllUserAppointments(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(appointments)
    .where(eq(appointments.userId, userId))
    .orderBy(appointments.startTime);
}

/**
 * Upsert appointment (insert or update based on googleEventId)
 */
export async function upsertAppointment(appointment: InsertAppointment) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // If googleEventId exists, try to find existing record
  if (appointment.googleEventId) {
    const existing = await db
      .select()
      .from(appointments)
      .where(
        and(
          eq(appointments.userId, appointment.userId),
          eq(appointments.googleEventId, appointment.googleEventId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      // Update existing
      await db
        .update(appointments)
        .set({
          ...appointment,
          updatedAt: new Date(),
        })
        .where(eq(appointments.id, existing[0].id));
      return existing[0].id;
    }
  }

  // Insert new - use .returning() for PostgreSQL compatibility
  const result = await db.insert(appointments).values(appointment).returning({ id: appointments.id });
  return result[0].id;
}

/**
 * Delete appointment by Google Event ID
 */
export async function deleteAppointmentByGoogleId(
  userId: number,
  googleEventId: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .delete(appointments)
    .where(
      and(
        eq(appointments.userId, userId),
        eq(appointments.googleEventId, googleEventId)
      )
    );
}

/**
 * Delete appointment by ID
 */
export async function deleteAppointment(userId: number, appointmentId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .delete(appointments)
    .where(
      and(eq(appointments.userId, userId), eq(appointments.id, appointmentId))
    );
}

/**
 * Sync appointments from Google Calendar
 * Handles additions, updates, and deletions
 */
export async function syncGoogleCalendarAppointments(
  userId: number,
  googleEvents: Array<{
    id: string;
    calendarId: string;
    title: string;
    description?: string;
    startTime: Date;
    endTime: Date;
    date: string;
    category?: string;
    recurrence?: string;
  }>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Get list of calendar IDs being synced
  const syncedCalendarIds = new Set(googleEvents.map((e) => e.calendarId));

  // Get list of deleted appointment IDs to skip during sync
  const { deletedAppointments } = await import("../drizzle/schema");
  const deleted = await db
    .select()
    .from(deletedAppointments)
    .where(eq(deletedAppointments.userId, userId));
  const deletedGoogleIds = new Set(deleted.map((d) => d.googleEventId));

  // Get existing appointments only from calendars being synced
  const existing = await db
    .select()
    .from(appointments)
    .where(eq(appointments.userId, userId));

  const incomingGoogleIds = new Set(googleEvents.map((e) => e.id));

  // Delete appointments that no longer exist in Google Calendar
  // BUT only delete from calendars we're currently syncing
  let deletedCount = 0;
  for (const appointment of existing) {
    if (
      appointment.googleEventId &&
      appointment.calendarId &&
      syncedCalendarIds.has(appointment.calendarId) &&
      !incomingGoogleIds.has(appointment.googleEventId)
    ) {
      await deleteAppointmentByGoogleId(userId, appointment.googleEventId);
      deletedCount++;
    }
  }

  // Upsert all incoming events (skip deleted ones)
  for (const event of googleEvents) {
    // Skip if user has deleted this appointment
    if (deletedGoogleIds.has(event.id)) {
      continue;
    }
    
    await upsertAppointment({
      userId,
      googleEventId: event.id,
      calendarId: event.calendarId,
      title: event.title,
      description: event.description,
      startTime: event.startTime,
      endTime: event.endTime,
      date: event.date,
      category: event.category,
      recurrence: event.recurrence,
      lastSynced: new Date(),
    });
  }

  return {
    synced: googleEvents.length,
    deleted: deletedCount,
  };
}
