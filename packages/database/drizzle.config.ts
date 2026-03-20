export default {
  dialect: "turso",
  schema: "./src/schema.ts",
  out: "./migrations",
  dbCredentials: {
    url: "https://space3-db-alexandrtorba.aws-eu-west-1.turso.io",
    authToken: "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NzQwMDYzMTMsImlkIjoiMDE5ZDBhZmItMzkwMS03MzBkLWI3YTUtZDdmMzU5YjYzMzFmIiwicmlkIjoiMDQwYzQ1MTUtNTdmMS00YzY3LTk1YWMtOGU2ZjNmZDAxM2EwIn0.WMzSIIyiVFd5_FZzyR3FQTovbeM-_8QwNxad1pcxbtw9ecPx_P-JsF7Q3NJ302XDeQyta87p5CM1-8x_CL1DDw",
  },
};
