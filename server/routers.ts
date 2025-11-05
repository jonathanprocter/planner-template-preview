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
import { appointments } from "../drizzle/schema";
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

        // appointments already imported at top
        // drizzle-orm functions already imported at top

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

        // appointments already imported at top
        // drizzle-orm functions already imported at top

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

        // appointments already imported at top
        // drizzle-orm functions already imported at top

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
        })
      )
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        // appointments already imported at top

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
            googleEventId: `local-${Date.now()}`,
            calendarId: 'local',
          });

        return { success: true };
      }),

    // Update appointment time/date
    updateAppointment: protectedProcedure
      .input(
        z.object({
          googleEventId: z.string(),
          startTime: z.string(),
          endTime: z.string(),
          date: z.string(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        // appointments already imported at top
        // drizzle-orm functions already imported at top

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
        })
      )
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        // appointments already imported at top
        // drizzle-orm functions already imported at top

        // Delete from database
        await db
          .delete(appointments)
          .where(
            and(
              eq(appointments.userId, ctx.user.id),
              eq(appointments.googleEventId, input.googleEventId)
            )
          );

        return { success: true };
      }),

    // Export appointments to PDF
    exportPDF: protectedProcedure
      .input(
        z.object({
          startDate: z.string(),
          endDate: z.string(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        // appointments already imported at top
        // drizzle-orm functions already imported at top
        // generateWeeklyPlannerPDF already imported at top

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

        // Generate PDF
        const pdfBuffer = await generateWeeklyPlannerPDF(
          result,
          new Date(input.startDate),
          new Date(input.endDate)
        );

        // Return PDF as base64
        return {
          pdf: pdfBuffer.toString('base64'),
          filename: `planner-${input.startDate}-to-${input.endDate}.pdf`,
        };
      }),
  }),
});

export type AppRouter = typeof appRouter;
