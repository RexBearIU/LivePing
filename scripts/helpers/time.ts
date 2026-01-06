export function hasStartTimePassed(startTime?: string | null): boolean {
  if (!startTime) {
    return true;
  }

  const isoPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
  if (!isoPattern.test(startTime)) {
    console.warn(`⚠️ Invalid start time format (expected ISO UTC): ${startTime}. Continuing immediately.`);
    return true;
  }

  const parsed = new Date(startTime);
  if (Number.isNaN(parsed.getTime())) {
    console.warn(`⚠️ Invalid start time provided: ${startTime}. Continuing immediately.`);
    return true;
  }

  const now = new Date();
  if (now < parsed) {
    console.log(`⏳ Start time not reached (${parsed.toISOString()}), exiting early.`);
    return false;
  }

  return true;
}
