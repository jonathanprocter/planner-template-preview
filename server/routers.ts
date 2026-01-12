import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import {
  deleteAppointment,
  getAllUserAppointments,
  getUserAppointments,
  syncGoogleCalendarAppointments,
  upsertAppointment,
} from "./appointments";
import { getDb } from "./db";
import { appointments, dailyNotes, appointmentHistory } from "../drizzle/schema";
import { and, eq, gte, lte, or, like } from "drizzle-orm";
import { generateWeeklyPlannerPDF } from "./pdf-export";

export const appRouter = router({
  // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  appointments: router({
    // Get appointments for a date range
    getByDateRange: protectedProcedure
      .input(
        z.object({
          startDate: z.string(),
          endDate: z.string(),
        })
      )
      .query(async ({ ctx, input }) => {
        return await getUserAppointments(
          ctx.user.id,
          input.startDate,
          input.endDate
        );
      }),

    // Get all appointments (for full sync)
    getAll: protectedProcedure.query(async ({ ctx }) => {
      return await getAllUserAppointments(ctx.user.id);
    }),

    // Create or update appointment
    upsert: protectedProcedure
      .input(
        z.object({
          id: z.number().optional(),
          googleEventId: z.string().optional(),
          calendarId: z.string().optional(),
          title: z.string(),
          description: z.string().optional(),
          startTime: z.date(),
          endTime: z.date(),
          date: z.string(),
          category: z.string().optional(),
          recurrence: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const appointmentId = await upsertAppointment({
          ...input,
          userId: ctx.user.id,
          lastSynced: new Date(),
        });
        return { id: appointmentId };
      }),

    // Delete appointment
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await deleteAppointment(ctx.user.id, input.id);
        return { success: true };
      }),

    // Search appointments across all dates
    search: protectedProcedure
      .input(
        z.object({
          query: z.string(),
          startDate: z.string().optional(),
          endDate: z.string().optional(),
          category: z.string().optional(),
        })
      )
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) return [];

        const conditions = [eq(appointments.userId, ctx.user.id)];

        // Search in title and description
        if (input.query) {
          const searchCondition = or(
            like(appointments.title, `%${input.query}%`),
            like(appointments.description, `%${input.query}%`)
          );
          if (searchCondition) {
            conditions.push(searchCondition);
          }
        }

        // Date range filter
        if (input.startDate) {
          conditions.push(gte(appointments.date, input.startDate));
        }
        if (input.endDate) {
          conditions.push(lte(appointments.date, input.endDate));
        }

        // Category filter
        if (input.category) {
          conditions.push(eq(appointments.category, input.category));
        }

        return await db
          .select()
          .from(appointments)
          .where(and(...conditions))
          .orderBy(appointments.startTime)
          .limit(100);
      }),

    // Sync from Google Calendar
    syncFromGoogle: protectedProcedure
      .input(
        z.object({
          events: z.array(
            z.object({
              id: z.string(),
              calendarId: z.string(),
              title: z.string(),
              description: z.string().optional(),
              startTime: z.date(),
              endTime: z.date(),
              date: z.string(),
              category: z.string().optional(),
              recurrence: z.string().optional(),
            })
          ),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const result = await syncGoogleCalendarAppointments(
          ctx.user.id,
          input.events
        );
        return result;
      }),

    // Update appointment notes
    updateNotes: protectedProcedure
      .input(
        z.object({
          googleEventId: z.string(),
          notes: z.string(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        await db
          .update(appointments)
          .set({ description: input.notes })
          .where(
            and(
              eq(appointments.userId, ctx.user.id),
              eq(appointments.googleEventId, input.googleEventId)
            )
          );

        return { success: true };
      }),

    // Update appointment note tags
    updateNoteTags: protectedProcedure
      .input(
        z.object({
          googleEventId: z.string(),
          tags: z.array(z.string()),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        await db
          .update(appointments)
          .set({ noteTags: JSON.stringify(input.tags) })
          .where(
            and(
              eq(appointments.userId, ctx.user.id),
              eq(appointments.googleEventId, input.googleEventId)
            )
          );

        return { success: true };
      }),

    // Update appointment details (status, reminders, session tracking)
    updateAppointmentDetails: protectedProcedure
      .input(
        z.object({
          googleEventId: z.string(),
          status: z.enum(["scheduled", "completed", "client_canceled", "therapist_canceled", "no_show"]).optional(),
          reminders: z.array(z.string()).optional(),
          notes: z.string().optional(),
          sessionNumber: z.number().nullable().optional(),
          totalSessions: z.number().nullable().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const updateData: any = {};
        if (input.status !== undefined) updateData.status = input.status;
        if (input.reminders !== undefined) updateData.reminders = JSON.stringify(input.reminders);
        if (input.notes !== undefined) updateData.notes = input.notes;
        if (input.sessionNumber !== undefined) updateData.sessionNumber = input.sessionNumber;
        if (input.totalSessions !== undefined) updateData.totalSessions = input.totalSessions;

        await db
          .update(appointments)
          .set(updateData)
          .where(
            and(
              eq(appointments.userId, ctx.user.id),
              eq(appointments.googleEventId, input.googleEventId)
            )
          );

        return { success: true };
      }),

    // Create new appointment
    createAppointment: protectedProcedure
      .input(
        z.object({
          title: z.string(),
          startTime: z.string(),
          endTime: z.string(),
          date: z.string(),
          category: z.string().optional(),
          description: z.string().optional(),
          accessToken: z.string().optional(),
          calendarId: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        let googleEventId = `local-${Date.now()}`;
        let finalCalendarId = input.calendarId || 'primary';

        // If access token provided, create in Google Calendar
        if (input.accessToken) {
          const { createGoogleCalendarEvent } = await import('./googleCalendarApi');
          const result = await createGoogleCalendarEvent(
            input.accessToken,
            finalCalendarId,
            {
              summary: input.title,
              description: input.description,
              start: {
                dateTime: `${input.date}T${input.startTime}:00`,
                timeZone: 'America/New_York',
              },
              end: {
                dateTime: `${input.date}T${input.endTime}:00`,
                timeZone: 'America/New_York',
              },
            }
          );

          if (result) {
            googleEventId = result.id;
            finalCalendarId = result.calendarId;
          }
        }

        // Insert into database
        await db
          .insert(appointments)
          .values({
            userId: ctx.user.id,
            title: input.title,
            startTime: new Date(`${input.date}T${input.startTime}`),
            endTime: new Date(`${input.date}T${input.endTime}`),
            date: input.date,
            category: input.category || 'Other',
            description: input.description || '',
            googleEventId,
            calendarId: finalCalendarId,
          });

        return { success: true, googleEventId };
      }),

    // Update appointment time/date
    updateAppointment: protectedProcedure
      .input(
        z.object({
          googleEventId: z.string(),
          startTime: z.string(),
          endTime: z.string(),
          date: z.string(),
          accessToken: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        // Get appointment details to find calendarId
        const appointment = await db
          .select()
          .from(appointments)
          .where(
            and(
              eq(appointments.userId, ctx.user.id),
              eq(appointments.googleEventId, input.googleEventId)
            )
          )
          .limit(1);

        // If access token provided and event is from Google Calendar, update in Google
        if (input.accessToken && appointment.length > 0 && !input.googleEventId.startsWith('local-')) {
          const { updateGoogleCalendarEvent } = await import('./googleCalendarApi');
          const calendarId = appointment[0]?.calendarId || 'primary';
          await updateGoogleCalendarEvent(
            input.accessToken,
            calendarId,
            input.googleEventId,
            {
              start: {
                dateTime: `${input.date}T${input.startTime}:00`,
                timeZone: 'America/New_York',
              },
              end: {
                dateTime: `${input.date}T${input.endTime}:00`,
                timeZone: 'America/New_York',
              },
            }
          );
        }

        // Update in database
        await db
          .update(appointments)
          .set({
            startTime: new Date(`${input.date}T${input.startTime}`),
            endTime: new Date(`${input.date}T${input.endTime}`),
            date: input.date,
          })
          .where(
            and(
              eq(appointments.userId, ctx.user.id),
              eq(appointments.googleEventId, input.googleEventId)
            )
          );

        return { success: true };
      }),

     // Delete appointment
    deleteAppointment: protectedProcedure
      .input(
        z.object({
          googleEventId: z.string(),
          accessToken: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        // Get the appointment details before deleting
        const appointment = await db
          .select()
          .from(appointments)
          .where(
            and(
              eq(appointments.userId, ctx.user.id),
              eq(appointments.googleEventId, input.googleEventId)
            )
          )
          .limit(1);

        // If access token provided and event is from Google Calendar, delete from Google
        if (input.accessToken && appointment.length > 0 && !input.googleEventId.startsWith('local-')) {
          const { deleteGoogleCalendarEvent } = await import('./googleCalendarApi');
          const calendarId = appointment[0]?.calendarId || 'primary';
          await deleteGoogleCalendarEvent(
            input.accessToken,
            calendarId,
            input.googleEventId
          );
        }

        // Delete from database
        await db
          .delete(appointments)
          .where(
            and(
              eq(appointments.userId, ctx.user.id),
              eq(appointments.googleEventId, input.googleEventId)
            )
          );
        // Track this deletion to prevent re-import during sync
        if (appointment.length > 0) {
          const { deletedAppointments } = await import("../drizzle/schema");
          const calendarId = appointment[0]?.calendarId ?? null;
          await db.insert(deletedAppointments).values({
            userId: ctx.user.id,
            googleEventId: input.googleEventId,
            calendarId,
          });
        }

        return { success: true };
      }),

    // Export appointments to PDF
    exportPDF: protectedProcedure
      .input(
        z.object({
          startDate: z.string(),
          endDate: z.string(),
          orientation: z.enum(["landscape", "portrait"]).optional().default("landscape"),
        })
      )
      .mutation(async ({ ctx, input }) => {
        try {
          const db = await getDb();
          if (!db) throw new Error("Database not available");

          // Fetch appointments for the date range
          const result = await db
            .select()
            .from(appointments)
            .where(
              and(
                eq(appointments.userId, ctx.user.id),
                gte(appointments.date, input.startDate),
                lte(appointments.date, input.endDate)
              )
            );

          // Generate PDF - parse dates in local timezone to avoid UTC shift
          const parseLocalDate = (dateStr: string): Date => {
            const parts = dateStr.split('-');
            if (parts.length !== 3) {
              throw new Error(`Invalid date format: ${dateStr}. Expected YYYY-MM-DD`);
            }
            const [year, month, day] = parts.map(Number);
            if (isNaN(year) || isNaN(month) || isNaN(day)) {
              throw new Error(`Invalid date components in: ${dateStr}`);
            }
            if (month < 1 || month > 12) {
              throw new Error(`Invalid month ${month} in date: ${dateStr}`);
            }
            if (day < 1 || day > 31) {
              throw new Error(`Invalid day ${day} in date: ${dateStr}`);
            }
            return new Date(year, month - 1, day);
          };
          
          const pdfBuffer = await generateWeeklyPlannerPDF(
            result,
            parseLocalDate(input.startDate),
            parseLocalDate(input.endDate),
            input.orientation || "landscape"
          );

          // Return PDF as base64
          return {
            pdf: pdfBuffer.toString('base64'),
            filename: `planner-${input.startDate}-to-${input.endDate}.pdf`,
          };
        } catch (error) {
          console.error('PDF Export Error:', error);
          throw new Error(`Failed to generate PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }),

    // Bulk update status for multiple appointments
    bulkUpdateStatus: protectedProcedure
      .input(
        z.object({
          googleEventIds: z.array(z.string()),
          status: z.enum(["scheduled", "completed", "client_canceled", "therapist_canceled", "no_show"]),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        // Update all appointments
        for (const googleEventId of input.googleEventIds) {
          await db
            .update(appointments)
            .set({ status: input.status })
            .where(
              and(
                eq(appointments.userId, ctx.user.id),
                eq(appointments.googleEventId, googleEventId)
              )
            );
        }

        return { success: true, updated: input.googleEventIds.length };
      }),

    // Get appointment history
    getHistory: protectedProcedure
      .input(z.object({ googleEventId: z.string() }))
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) return [];

        const { appointmentHistory } = await import("../drizzle/schema");
        const history = await db
          .select()
          .from(appointmentHistory)
          .where(
            and(
              eq(appointmentHistory.userId, ctx.user.id),
              eq(appointmentHistory.googleEventId, input.googleEventId)
            )
          )
          .orderBy(appointmentHistory.createdAt);

        return history;
      }),
  }),

  dailyNotes: router({
    // Get notes for a date range
    getByDateRange: protectedProcedure
      .input(
        z.object({
          startDate: z.string(),
          endDate: z.string(),
        })
      )
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) return [];

        return await db
          .select()
          .from(dailyNotes)
          .where(
            and(
              eq(dailyNotes.userId, ctx.user.id),
              gte(dailyNotes.date, input.startDate),
              lte(dailyNotes.date, input.endDate)
            )
          );
      }),

    // Get note for a specific date
    getByDate: protectedProcedure
      .input(z.object({ date: z.string() }))
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) return null;

        const result = await db
          .select()
          .from(dailyNotes)
          .where(
            and(
              eq(dailyNotes.userId, ctx.user.id),
              eq(dailyNotes.date, input.date)
            )
          )
          .limit(1);

        const [first] = result;
        return first ?? null;
      }),

    // Upsert note for a specific date
    upsert: protectedProcedure
      .input(
        z.object({
          date: z.string(),
          content: z.string(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        // Check if note exists
        const existing = await db
          .select()
          .from(dailyNotes)
          .where(
            and(
              eq(dailyNotes.userId, ctx.user.id),
              eq(dailyNotes.date, input.date)
            )
          )
          .limit(1);

        const [existingNote] = existing;
        if (existingNote) {
          // Update existing
          await db
            .update(dailyNotes)
            .set({ content: input.content, updatedAt: new Date() })
            .where(eq(dailyNotes.id, existingNote.id));
          return { id: existingNote.id };
        } else {
          // Insert new - use .returning() for PostgreSQL compatibility
          const result = await db.insert(dailyNotes).values({
            userId: ctx.user.id,
            date: input.date,
            content: input.content,
          }).returning({ id: dailyNotes.id });
          return { id: result[0]?.id ?? 0 };
        }
      }),
  }),
});

export type AppRouter = typeof appRouter;
