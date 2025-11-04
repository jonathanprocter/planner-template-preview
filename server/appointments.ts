import { and, between, eq, gte, lte } from "drizzle-orm";
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

  // Insert new
  const result = await db.insert(appointments).values(appointment);
  return result[0].insertId;
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

  // Get existing appointments
  const existing = await db
    .select()
    .from(appointments)
    .where(eq(appointments.userId, userId));

  const existingGoogleIds = new Set(
    existing.map((a) => a.googleEventId).filter(Boolean)
  );
  const incomingGoogleIds = new Set(googleEvents.map((e) => e.id));

  // Delete appointments that no longer exist in Google Calendar
  for (const appointment of existing) {
    if (
      appointment.googleEventId &&
      !incomingGoogleIds.has(appointment.googleEventId)
    ) {
      await deleteAppointmentByGoogleId(userId, appointment.googleEventId);
    }
  }

  // Upsert all incoming events
  for (const event of googleEvents) {
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
    deleted: existing.filter(
      (a) => a.googleEventId && !incomingGoogleIds.has(a.googleEventId)
    ).length,
  };
}
