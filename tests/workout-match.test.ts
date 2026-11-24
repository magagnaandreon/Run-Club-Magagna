import { describe, expect, it } from "vitest";

import { matchRunsToWorkouts } from "../shared/workout-match";

const run = (id: string, date: string, km: number) => ({ id, date, distanceMeters: km * 1000 });

describe("matching runs to workouts", () => {
  it("takes the run of the workout's day, closest to the plan", () => {
    const matches = matchRunsToWorkouts([{ id: 1, scheduledDate: "2026-11-05", plannedMeters: 8000 }], [run("a", "2026-11-05", 3), run("b", "2026-11-05", 7.5), run("c", "2026-11-06", 8)], new Set());
    expect(matches).toEqual([{ workoutId: 1, run: expect.objectContaining({ id: "b" }) }]);
  });

  it("uses the longest run without a planned distance and never repeats a run", () => {
    const workouts = [{ id: 1, scheduledDate: "2026-11-05", plannedMeters: null }, { id: 2, scheduledDate: "2026-11-05", plannedMeters: null }];
    const matches = matchRunsToWorkouts(workouts, [run("a", "2026-11-05", 3), run("b", "2026-11-05", 7)], new Set());
    expect(matches.map((match) => [match.workoutId, match.run.id])).toEqual([[1, "b"], [2, "a"]]);
  });

  it("skips runs already taken, very short ones and other days", () => {
    const workouts = [{ id: 1, scheduledDate: "2026-11-05", plannedMeters: null }];
    expect(matchRunsToWorkouts(workouts, [run("a", "2026-11-05", 5), run("b", "2026-11-05", 0.5), run("c", "2026-11-04", 5)], new Set(["a"]))).toEqual([]);
  });
});
