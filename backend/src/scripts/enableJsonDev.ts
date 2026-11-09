if (!["development", "test"].includes(process.env.NODE_ENV ?? "")) {
  throw new Error("JSON mode requires NODE_ENV to be explicitly set to development or test.");
}
if (process.env.STORAGE_MODE && process.env.STORAGE_MODE !== "json") {
  throw new Error("JSON mode conflicts with the configured storage mode.");
}
process.env.STORAGE_MODE = "json";
