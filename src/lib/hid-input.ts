export type HidInputKind = "scan" | "quantity" | "ignore";

export type HidInputDecision = {
  kind: HidInputKind;
  value: string;
};

type Options = {
  minScanLength?: number;
  fastAverageMs?: number;
  fastTotalMs?: number;
};

export function classifyHidInput(
  value: string,
  timings: number[],
  terminated: boolean,
  options: Options = {},
): HidInputDecision {
  const normalized = value.trim();
  if (!normalized) return { kind: "ignore", value: normalized };

  const minScanLength = options.minScanLength ?? 6;
  const fastAverageMs = options.fastAverageMs ?? 45;
  const fastTotalMs = options.fastTotalMs ?? 280;
  const duration = timings.length > 1 ? timings[timings.length - 1] - timings[0] : 0;
  const averageGap = timings.length > 1 ? duration / (timings.length - 1) : Number.POSITIVE_INFINITY;
  const looksFast = averageGap <= fastAverageMs || duration <= fastTotalMs;

  if (terminated && looksFast && normalized.length >= 3) {
    return { kind: "scan", value: normalized };
  }

  if (normalized.length >= minScanLength && (terminated || looksFast)) {
    return { kind: "scan", value: normalized };
  }

  if (/^\d{1,5}$/.test(normalized)) {
    return { kind: "quantity", value: normalized };
  }

  if (terminated && normalized.length >= 3) {
    return { kind: "scan", value: normalized };
  }

  return { kind: "ignore", value: normalized };
}
