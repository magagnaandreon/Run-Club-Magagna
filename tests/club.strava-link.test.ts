import { beforeAll, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";

process.env.DATABASE_URL = "pglite:memory";
process.env.SESSION_SECRET = "test-session-secret-with-at-least-32-chars";
process.env.COACH_EMAIL = "coach@example.com";
process.env.COACH_SIGNUP_CODE = "coach-code";
process.env.EXPO_PUBLIC_API_BASE_URL = "https://api.example.com";

const strava = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock("../server/_core/stravaOAuth", async (original) => ({
  ...(await original<typeof import("../server/_core/stravaOAuth")>()),
  listStravaActivitiesSince: strava.list,
}));

const { stravaActivityRecords, stravaConnections } = await import("../drizzle/schema");
const { getDb } = await import("../server/db");
const { appRouter } = await import("../server/routers");
const { createContext } = await import("../server/_core/context");

async function callerFor(token?: string) {
  const req = { headers: token ? { authorization: `Bearer ${token}` } : {} } as Request;
  const ctx = await createContext({ req, res: { setHeader() {} } as unknown as Response, info: {} as never });
  return appRouter.createCaller(ctx);
}

const today = "2026-11-12";
const stravaRun = (id: string, date: string, km: number) => ({
  id, name: "Morning Run", sportType: "Run", type: "Run", startDate: `${date}T09:00:00Z`, startDateLocal: `${date}T06:00:00`,
  distanceMeters: km * 1000, movingTimeSeconds: km * 300, elevationGainMeters: 20, averageHeartRate: 150,
});
const workout = (title: string, scheduledDate: string, athleteId: number) => ({
  title, objective: "Base", level: "Todos", athleteId, scheduledDate,
  steps: [{ kind: "run" as const, label: "Corrida", distanceMeters: 8000 }],
});

describe("Strava runs closing workouts", () => {
  let coach: Awaited<ReturnType<typeof callerFor>>;
  let athlete: Awaited<ReturnType<typeof callerFor>>;
  let athleteId = 0;

  beforeAll(async () => {
    strava.list.mockResolvedValue({ items: [stravaRun("1", "2026-11-10", 8), stravaRun("2", "2026-11-11", 5)], truncated: false });
    const anonymous = await callerFor();
    const registered = await anonymous.account.register({ name: "Coach", email: "coach@example.com", password: "senha-do-coach-1", coachCode: "coach-code" });
    coach = await callerFor(registered.sessionToken);
    await anonymous.account.register({ name: "Aluna", email: "aluna@example.com", password: "senha-forte-123" });
    const [pending] = await coach.club.pendingAthletes();
    athleteId = pending.userId;
    await coach.club.approveAthlete({ athleteId });
    const signIn = await anonymous.account.signIn({ email: "aluna@example.com", password: "senha-forte-123" });
    if (signIn.status !== "authenticated") throw new Error("A aluna não entrou.");
    athlete = await callerFor(signIn.sessionToken);
    const db = (await getDb())!;
    await db.insert(stravaConnections).values({
      userId: athleteId, stravaAthleteHash: "aluna", encryptedTokenEnvelope: "x", scopes: "read", tokenExpiresAt: new Date(Date.now() + 3_600_000),
      consentedAt: new Date(), consentVersion: "2026-11", coachShareAt: new Date(),
    });
    await db.insert(stravaActivityRecords).values({ userId: athleteId, stravaActivityId: "1", startDate: new Date("2026-11-10T09:00:00Z"), summary: stravaRun("1", "2026-11-10", 8) as never });
  });

  it("closes the workout of the run's day and labels the run, counting it once", async () => {
    const { assignmentId } = await coach.club.createAndAssignWorkout(workout("Rodagem de terça", "2026-11-10", athleteId));
    const [assignment] = await athlete.club.myAssignments({ today });
    expect(assignment).toMatchObject({ id: assignmentId, status: "completed", run: { source: "strava", distanceMeters: 8000 } });

    const { period } = await athlete.insights.overview({ period: "all", today, tzOffsetMinutes: 180 });
    expect(period).toMatchObject({ runs: 2, distanceMeters: 13000, freeRuns: 1 });
    const detail = await coach.club.athleteDetail({ athleteId, today });
    expect(detail.totals).toMatchObject({ runs: 2, distanceMeters: 13000 });
    expect(detail.strava.runs.find((run) => run.id === "strava-1")?.workoutTitle).toBe("Rodagem de terça");
    expect((await coach.club.clubAthletes({ today })).find((item) => item.userId === athleteId)?.summary.last4WeeksDistanceMeters).toBe(8000);
  });

  it("lets the coach review the linked run", async () => {
    const [{ activity }] = await coach.club.coachActivityFeed();
    expect(activity).toMatchObject({ source: "strava", title: "Rodagem de terça" });
    await expect(coach.club.reviewActivity({ activityId: activity.id, rating: 5, comment: "Boa" })).resolves.toBeTruthy();
  });

  it("stays undone after the athlete says it was not this workout", async () => {
    const [{ id }] = await athlete.club.myAssignments({ today });
    await athlete.club.unlinkStravaRun({ assignmentId: id });
    expect((await athlete.club.myAssignments({ today }))[0]).toMatchObject({ status: "assigned", run: null });
    await athlete.insights.overview({ period: "all", today, tzOffsetMinutes: 180 });
    expect((await athlete.club.myAssignments({ today }))[0].status).toBe("assigned");
  });

  it("links a run of another day by hand, once", async () => {
    const [{ id }] = await athlete.club.myAssignments({ today });
    expect((await athlete.club.linkableRuns()).map((run) => run.id)).toEqual(["strava-2", "strava-1"]);
    await athlete.club.linkStravaRun({ assignmentId: id, runId: "strava-2" });
    expect((await athlete.club.myAssignments({ today }))[0]).toMatchObject({ status: "completed", run: { distanceMeters: 5000 } });
    expect((await athlete.club.linkableRuns()).map((run) => run.id)).toEqual(["strava-1"]);
    const { assignmentId } = await coach.club.createAndAssignWorkout(workout("Outro", "2026-11-20", athleteId));
    await expect(athlete.club.linkStravaRun({ assignmentId, runId: "strava-2" })).rejects.toThrow("outro treino");
  });

  it("leaves future workouts alone", async () => {
    const rows = await athlete.club.myAssignments({ today });
    expect(rows.find((row) => row.scheduledDate === "2026-11-20")?.status).toBe("assigned");
  });
});
