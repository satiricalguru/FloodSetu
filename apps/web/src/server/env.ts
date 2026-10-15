/** Secrets come from env (.env.example); dev defaults keep the demo zero-setup and fully offline. */
export const ENV = {
  secret: process.env.JALSETU_SECRET ?? "dev-only-secret-change-me",
  pepper: process.env.JALSETU_PEPPER ?? "dev-only-pepper-change-me",
  demo: process.env.JALSETU_DEMO !== "0" && (process.env.NODE_ENV !== "production" || process.env.JALSETU_DEMO === "1"),
  sms: (process.env.JALSETU_SMS_PROVIDER ?? "mock") as "mock" | "msg91" | "twilio",
  dataDir: process.env.JALSETU_DATA_DIR ?? `${process.cwd()}/.data`,
  retentionHours: Number(process.env.JALSETU_LOCATION_RETENTION_H ?? 24),
};
