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
  }),
});

export type AppRouter = typeof appRouter;
