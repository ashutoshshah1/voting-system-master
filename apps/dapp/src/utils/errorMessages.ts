type ErrorContext =
  | "generic"
  | "authLogin"
  | "authRegister"
  | "kyc"
  | "vote"
  | "offlineSession"
  | "offlineRegister"
  | "offlineLink"
  | "offlineVote"
  | "admin";

type OfflineGateState = {
  pinReady: boolean;
  kycApproved: boolean;
  walletReady: boolean;
  officerVerificationRequired: boolean;
};

const joinNaturalList = (items: string[]) => {
  if (items.length === 0) {
    return "";
  }
  if (items.length === 1) {
    return items[0];
  }
  if (items.length === 2) {
    return `${items[0]} and ${items[1]}`;
  }
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
};

const getRawErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }
  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }
  return fallback;
};

export const getOfflineGateIssues = (gate: OfflineGateState) => {
  const issues: string[] = [];
  if (!gate.pinReady) {
    issues.push("create a 6-digit voter PIN");
  }
  if (!gate.kycApproved) {
    issues.push("complete admin KYC approval");
  }
  if (!gate.walletReady) {
    issues.push("wait for wallet setup to finish");
  }
  if (gate.officerVerificationRequired) {
    issues.push("complete officer verification");
  }
  return issues;
};

export const getOfflineGateTitle = (gate: OfflineGateState) => {
  if (!gate.pinReady && !gate.kycApproved) {
    return "Registration incomplete";
  }
  if (!gate.pinReady) {
    return "PIN setup required";
  }
  if (!gate.kycApproved) {
    return "KYC approval required";
  }
  if (!gate.walletReady) {
    return "Wallet setup required";
  }
  if (gate.officerVerificationRequired) {
    return "Verification required";
  }
  return "Setup required";
};

export const getOfflineGateMessage = (gate: OfflineGateState) => {
  const issues = getOfflineGateIssues(gate);
  if (!issues.length) {
    return "Identity verified. Ready for PIN confirmation.";
  }
  return `This card was recognized, but the voter cannot continue yet. Please ${joinNaturalList(
    issues
  )} before voting.`;
};

export const getUserFacingErrorMessage = (
  error: unknown,
  context: ErrorContext = "generic",
  fallback = "Something went wrong. Please try again."
) => {
  const message = getRawErrorMessage(error, fallback);
  const normalized = message.toLowerCase();

  if (/failed to fetch|networkerror|load failed/.test(normalized)) {
    return "Could not reach the server. Check that the local services are running and try again.";
  }
  if (/not authenticated|unauthorized|jwt|token/.test(normalized)) {
    return "Your session expired. Log in again and retry.";
  }
  if (/nid must be exactly 10 digits/.test(normalized)) {
    return "Enter the 10-digit NID number.";
  }
  if (/date of birth must use yyyy-mm-dd format/.test(normalized)) {
    return "Enter date of birth in YYYY-MM-DD format.";
  }
  if (/date of birth must be a real past date/.test(normalized)) {
    return "Enter a valid date of birth that is not in the future.";
  }
  if (/invalid credentials|nid or date of birth is incorrect/.test(normalized)) {
    return context === "authLogin"
      ? "NID and date of birth do not match any registered voter."
      : "The provided NID and date of birth do not match our records.";
  }
  if (/email or nid already registered/.test(normalized)) {
    return "An account with this email or NID already exists. Try logging in instead.";
  }
  if (/document file is required/.test(normalized)) {
    return "Upload an identity document before submitting KYC.";
  }
  if (/kyc not approved yet|kyc is not approved yet/.test(normalized)) {
    return "KYC approval is still pending. Ask an admin to approve this voter before voting.";
  }
  if (/wallet not generated|wallet is not ready for this voter/.test(normalized)) {
    return "The voting wallet is not ready yet. Ask an admin to finish voter setup.";
  }
  if (/unrecognized rfid card|this card is not registered yet/.test(normalized)) {
    return "This card is not registered yet. Use New voter or Link profile before voting.";
  }
  if (/user not found for provided nid\/dob/.test(normalized)) {
    return "No voter account matches that 10-digit NID and date of birth.";
  }
  if (/rfid card does not match this user/.test(normalized)) {
    return "The tapped card does not belong to this voter. Scan the correct card and try again.";
  }
  if (/rfid is already linked to another voter/.test(normalized)) {
    return "This RFID card is already linked to another voter.";
  }
  if (/pin entry is temporarily locked/.test(normalized)) {
    return "Too many wrong PIN attempts. Wait for the lock to expire, then try again.";
  }
  if (/invalid pin/.test(normalized)) {
    return context === "offlineVote"
      ? "The 6-digit voter PIN is incorrect."
      : "The PIN you entered is incorrect.";
  }
  if (/weak pin is not allowed/.test(normalized)) {
    return "Choose a stronger 6-digit PIN that is not an obvious sequence or repeated digit.";
  }
  if (/pin setup is required before offline voting/.test(normalized)) {
    return "This voter must create a 6-digit PIN before voting offline.";
  }
  if (/vote already recorded for this wallet/.test(normalized)) {
    return "This voter has already cast a vote in this election.";
  }
  if (/election is closed/.test(normalized)) {
    return "Voting is currently closed.";
  }
  if (/results already published|results are already published/.test(normalized)) {
    return "Voting is closed because results have already been published.";
  }
  if (/voter is not eligible/.test(normalized)) {
    return "This voter is not eligible for the current election.";
  }
  if (/failed to sync voter on-chain/.test(normalized)) {
    return "The voter could not be synchronized with the blockchain. Try again in a moment or contact an admin.";
  }
  if (/profile is not ready for voting/.test(normalized)) {
    return "This voter still has setup steps remaining before voting.";
  }
  if (/invalid payload/.test(normalized)) {
    if (context === "offlineSession") {
      return "Scan the RFID card again and make sure the card read completed successfully.";
    }
    if (context === "offlineRegister" || context === "offlineLink") {
      return "Check the voter details and try again.";
    }
    if (context === "vote" || context === "offlineVote") {
      return "The vote request was incomplete. Refresh and try again.";
    }
  }

  return message || fallback;
};
