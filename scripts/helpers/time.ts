export function hasStartTimePassed(startTime?: string | null): boolean {
  if (!startTime) {
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
