import { and, eq, inArray, lte } from "drizzle-orm";

import { activities, stravaConnections, workoutAssignments, workoutSteps, workouts } from "../../drizzle/schema";
import { paceSecondsPerKm, type TrainingEntry } from "../../shared/insights";
import { matchRunsToWorkouts } from "../../shared/workout-match";
import { getDb } from "../db";

const externalId = (entry: TrainingEntry) => entry.id.replace(/^strava-/, "");

/** Records a Strava run as the done workout, keeping the workout's name. False when either was already taken. */
export async function linkRun(athleteId: number, workout: { id: number; title: string }, run: TrainingEntry) {
  const db = await getDb();
  if (!db) return false;
  const [connection] = await db.select({ coachShareAt: stravaConnections.coachShareAt }).from(stravaConnections)
    .where(eq(stravaConnections.userId, athleteId)).limit(1);
  const completedAt = new Date(`${run.date}T12:00:00.000Z`);
  return db.transaction(async (tx) => {
    const inserted = await tx.insert(activities).values({
      athleteId,
      assignmentId: workout.id,
      source: "strava",
      externalActivityId: externalId(run),
      title: workout.title,
      distanceMeters: run.distanceMeters,
      durationSeconds: run.movingSeconds,
      averagePaceSecondsPerKm: paceSecondsPerKm(run.distanceMeters, run.movingSeconds),
      completedAt,
      shareWithCoach: Boolean(connection?.coachShareAt),
    }).onConflictDoNothing().returning({ id: activities.id });
    if (!inserted.length) return false;
    await tx.update(workoutAssignments).set({ status: "completed", completedAt }).where(eq(workoutAssignments.id, workout.id));
    return true;
  });
}

/** Closes the open workouts that have a Strava run on their day. Safe to run on every read. */
export async function linkRunsToWorkouts(athleteId: number, runs: TrainingEntry[], today: string) {
  const db = await getDb();
  if (!db || !runs.length) return 0;
  const open = await db.select({ id: workoutAssignments.id, scheduledDate: workoutAssignments.scheduledDate, workoutId: workouts.id, title: workouts.title })
    .from(workoutAssignments)
    .innerJoin(workouts, eq(workouts.id, workoutAssignments.workoutId))
    .where(and(
      eq(workoutAssignments.athleteId, athleteId),
      eq(workoutAssignments.status, "assigned"),
      eq(workoutAssignments.stravaLinkOff, false),
      lte(workoutAssignments.scheduledDate, today),
    ));
  if (!open.length) return 0;
  const [steps, linked] = await Promise.all([
    db.select({ workoutId: workoutSteps.workoutId, distanceMeters: workoutSteps.distanceMeters }).from(workoutSteps)
      .where(inArray(workoutSteps.workoutId, open.map((workout) => workout.workoutId))),
    db.select({ id: activities.externalActivityId }).from(activities)
      .where(and(eq(activities.athleteId, athleteId), eq(activities.source, "strava"))),
  ]);
  const plannedMeters = (workoutId: number) => steps.filter((step) => step.workoutId === workoutId).reduce((sum, step) => sum + (step.distanceMeters ?? 0), 0) || null;
  const matches = matchRunsToWorkouts(
    open.map(({ id, scheduledDate, workoutId }) => ({ id, scheduledDate, plannedMeters: plannedMeters(workoutId) })),
    runs,
    new Set(linked.map((row) => `strava-${row.id}`)),
  );
  let done = 0;
  for (const { workoutId, run } of matches) {
    const workout = open.find((item) => item.id === workoutId)!;
    if (await linkRun(athleteId, workout, run)) done += 1;
  }
  return done;
}
