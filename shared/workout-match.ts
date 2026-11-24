export type OpenWorkout = { id: number; scheduledDate: string; plannedMeters: number | null };
export type RunCandidate = { id: string; date: string; distanceMeters: number };

const MIN_RUN_METERS = 1000;

/** Each open workout takes the run of its own day, closest to the plan or else the longest. */
export function matchRunsToWorkouts<Run extends RunCandidate>(workouts: OpenWorkout[], runs: Run[], taken: Set<string>) {
  const used = new Set(taken);
  return [...workouts].sort((a, b) => a.id - b.id).flatMap((workout) => {
    const sameDay = runs.filter((run) => run.date === workout.scheduledDate && run.distanceMeters >= MIN_RUN_METERS && !used.has(run.id));
    if (!sameDay.length) return [];
    const { plannedMeters } = workout;
    const score = (run: Run) => (plannedMeters ? Math.abs(run.distanceMeters - plannedMeters) : -run.distanceMeters);
    const run = sameDay.reduce((best, other) => (score(other) < score(best) ? other : best));
    used.add(run.id);
    return [{ workoutId: workout.id, run }];
  });
}
