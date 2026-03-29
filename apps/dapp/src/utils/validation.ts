const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const NID_PATTERN = /^\d{10}$/;
const MIN_DOB_YEAR = 1900;

export const MIN_DOB = `${MIN_DOB_YEAR}-01-01`;

export const getTodayDateValue = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = `${today.getMonth() + 1}`.padStart(2, "0");
  const day = `${today.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const MAX_DOB = getTodayDateValue();

export const normalizeNidInput = (value: string) =>
  value.replace(/\D/g, "").slice(0, 10);

const parseDateOnly = (value: string) => {
  if (!DATE_ONLY_PATTERN.test(value)) {
    return null;
  }

  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }

  return parsed;
};

export const validateNid = (nid: string) =>
  NID_PATTERN.test(nid) ? null : "NID must be exactly 10 digits.";

export const validateDob = (dob: string) => {
  const parsed = parseDateOnly(dob);
  if (!parsed) {
    return "Date of birth must be a valid date.";
  }

  const minDob = Date.UTC(MIN_DOB_YEAR, 0, 1);
  const today = new Date();
  const maxDob = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate()
  );
  const dobTime = parsed.getTime();

  if (dobTime < minDob) {
    return `Date of birth must be on or after ${MIN_DOB}.`;
  }

  if (dobTime > maxDob) {
    return "Date of birth cannot be in the future.";
  }

  return null;
};
