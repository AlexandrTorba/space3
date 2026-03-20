export default {
  dialect: "turso",
  schema: "./src/schema.ts",
  out: "./migrations",
  dbCredentials: {
    url: "https://space3-db-alexandrtorba.aws-eu-west-1.turso.io",
    authToken: "***REDACTED_TOKEN***",
  },
};
