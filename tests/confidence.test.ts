import { describe, expect, it } from "vitest";
import {
  CONFIDENCE_WEIGHTS,
  bandFor,
  computeTotal,
  score,
} from "@/lib/confidence";

describe("confidence weights", () => {
  it("sums to 100%", () => {
    const total = Object.values(CONFIDENCE_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(total).toBe(100);
  });
});

describe("computeTotal", () => {
  it("returns 0 for an empty signal set", () => {
    expect(computeTotal({ source: 0, content: 0, image: 0, video: 0, context: 0, human: 0 })).toBe(0);
  });

  it("returns 100 when every signal is perfect", () => {
    expect(computeTotal({ source: 100, content: 100, image: 100, video: 100, context: 100, human: 100 })).toBe(100);
  });

  it("applies the documented weights (source 25%)", () => {
    // Only source = 100, everything else 0 -> contribution is 25.
    expect(computeTotal({ source: 100, content: 0, image: 0, video: 0, context: 0, human: 0 })).toBe(25);
  });

  it("clamps out-of-range values", () => {
    expect(
      computeTotal({ source: 500, content: -50, image: 0, video: 0, context: 0, human: 0 }),
    ).toBe(25);
  });
});

describe("bandFor thresholds", () => {
  it("maps the documented bands", () => {
    expect(bandFor(95).label).toBe("موثق");
    expect(bandFor(80).label).toBe("صحيح");
    expect(bandFor(65).label).toBe("صحيح غالباً");
    expect(bandFor(50).label).toBe("مشبوه");
    expect(bandFor(10).label).toBe("غير صحيح");
  });

  it("treats boundaries inclusively", () => {
    expect(bandFor(90).band).toBe("verified");
    expect(bandFor(89).band).toBe("true");
    expect(bandFor(75).band).toBe("true");
    expect(bandFor(74).band).toBe("likely");
    expect(bandFor(60).band).toBe("likely");
    expect(bandFor(59).band).toBe("suspicious");
    expect(bandFor(40).band).toBe("suspicious");
    expect(bandFor(39).band).toBe("false");
  });
});

describe("score()", () => {
  it("produces a full breakdown whose contributions sum near the total", () => {
    const result = score({ source: 90, content: 80, image: 70, video: 60, context: 50, human: 40 });
    expect(result.components).toHaveLength(6);
    const sum = result.components.reduce((a, c) => a + c.contribution, 0);
    expect(Math.abs(sum - result.total)).toBeLessThanOrEqual(0.5);
    expect(result.verdict).toBeDefined();
    expect(result.bandLabel).toBeTruthy();
  });

  it("flags a low-trust claim as غير صحيح", () => {
    const result = score({ source: 15, content: 20, image: 10, video: 0, context: 20, human: 10 });
    expect(result.total).toBeLessThan(40);
    expect(result.bandLabel).toBe("غير صحيح");
  });
});
