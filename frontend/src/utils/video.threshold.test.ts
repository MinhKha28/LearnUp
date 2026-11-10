import { expect, it } from "vitest";
import { videoThresholdPercent } from "./video.threshold";

it.each([[601, 541, 90], [100, 80, 80], [100, 100, 100], [0, 0, 0]])(
  "shows required seconds as a percentage of duration (%i, %i)", (duration, required, expected) => {
    expect(videoThresholdPercent(duration, required)).toBe(expected);
  },
);
