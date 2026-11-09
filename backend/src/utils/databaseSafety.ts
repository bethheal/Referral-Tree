const PROTECTED_PRODUCTION_ENDPOINT_IDS = new Set(["ep-shiny-meadow-b4wwn8ke"]);
const CONNECTION_URL_NAMES = ["DATABASE_URL", "DIRECT_URL"] as const;
type ConnectionUrlName = (typeof CONNECTION_URL_NAMES)[number];

export const hasDatabaseConfiguration = () =>
  CONNECTION_URL_NAMES.some((name) => Boolean(process.env[name])) ||
  Boolean(process.env.DATABASE_TARGET) ||
  Boolean(process.env.NEON_ENDPOINT_ID);

const getEndpointId = (
  value: string,
  name: ConnectionUrlName,
  rejectProtectedProduction = true,
) => {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid PostgreSQL connection URL.`);
  }

  if (
    !["postgres:", "postgresql:"].includes(parsed.protocol) ||
    !parsed.username || !parsed.password || !parsed.pathname ||
    parsed.pathname === "/" || !parsed.hostname
  ) {
    throw new Error(`${name} must be a complete PostgreSQL connection URL.`);
  }

  const hostname = parsed.hostname.toLowerCase();
  if (["localhost", "127.0.0.1", "::1"].includes(hostname)) {
    return { endpointId: null, hostname };
  }
  if (!hostname.endsWith(".neon.tech")) {
    throw new Error(`${name} must use the approved Neon endpoint host.`);
  }

  const firstLabel = hostname.split(".", 1)[0] ?? "";
  const endpointId = firstLabel.endsWith("-pooler")
    ? firstLabel.slice(0, -"-pooler".length)
    : firstLabel;
  if (!endpointId.startsWith("ep-")) {
    throw new Error(`${name} does not contain a valid Neon endpoint ID.`);
  }
  if (rejectProtectedProduction && PROTECTED_PRODUCTION_ENDPOINT_IDS.has(endpointId)) {
    throw new Error(`${name} points to the protected original production endpoint.`);
  }
  return { endpointId, hostname };
};

const getConnectionUrls = () => {
  const values = Object.fromEntries(
    CONNECTION_URL_NAMES.map((name) => [name, process.env[name]]),
  ) as Record<ConnectionUrlName, string | undefined>;
  for (const name of CONNECTION_URL_NAMES) {
    if (!values[name]?.trim()) throw new Error(`${name} is required before database access.`);
  }
  return values as Record<ConnectionUrlName, string>;
};

/** Development command guard. Keep the protected production endpoint forbidden here. */
export const validateDatabaseEnvironment = () => {
  if (process.env.NODE_ENV === "production" || process.env.DATABASE_TARGET === "production") {
    throw new Error("Database commands are disabled for production environments.");
  }

  const target = process.env.DATABASE_TARGET;
  if (target !== "local" && target !== "angelfoods-dev") {
    throw new Error("DATABASE_TARGET must identify local or the approved development target.");
  }

  const values = getConnectionUrls();
  const database = getEndpointId(values.DATABASE_URL, "DATABASE_URL");
  const direct = getEndpointId(values.DIRECT_URL, "DIRECT_URL");

  if (target === "local") {
    if (database.endpointId !== null || direct.endpointId !== null) {
      throw new Error("DATABASE_TARGET=local requires both URLs to use localhost.");
    }
    return { target, databaseUrl: values.DATABASE_URL, directUrl: values.DIRECT_URL, endpointId: null };
  }

  const expectedEndpointId = process.env.NEON_ENDPOINT_ID?.trim();
  if (!expectedEndpointId || PROTECTED_PRODUCTION_ENDPOINT_IDS.has(expectedEndpointId)) {
    throw new Error("NEON_ENDPOINT_ID must identify the approved development endpoint.");
  }
  if (database.endpointId !== expectedEndpointId || direct.endpointId !== expectedEndpointId) {
    throw new Error("Both database URLs must match NEON_ENDPOINT_ID.");
  }

  return {
    target,
    databaseUrl: values.DATABASE_URL,
    directUrl: values.DIRECT_URL,
    endpointId: expectedEndpointId,
  };
};

/**
 * Production runtime guard. Production identity is configured separately from
 * the development endpoint and checked independently against both URLs.
 */
export const validateProductionDatabaseEnvironment = () => {
  if (process.env.NODE_ENV !== "production" || process.env.DATABASE_TARGET !== "production") {
    throw new Error("Production requires NODE_ENV=production and DATABASE_TARGET=production.");
  }
  const productionEndpoint = process.env.PRODUCTION_NEON_ENDPOINT_ID?.trim();
  const developmentEndpoint = process.env.NEON_ENDPOINT_ID?.trim();
  if (!productionEndpoint || !developmentEndpoint || productionEndpoint === developmentEndpoint) {
    throw new Error("PRODUCTION_NEON_ENDPOINT_ID and the configured development NEON_ENDPOINT_ID must be different.");
  }

  const values = getConnectionUrls();
  const database = getEndpointId(values.DATABASE_URL, "DATABASE_URL", false);
  const direct = getEndpointId(values.DIRECT_URL, "DIRECT_URL", false);
  if (
    database.endpointId === null || direct.endpointId === null ||
    database.endpointId !== productionEndpoint || direct.endpointId !== productionEndpoint ||
    database.endpointId === developmentEndpoint || direct.endpointId === developmentEndpoint
  ) {
    throw new Error("Both production database URLs must match PRODUCTION_NEON_ENDPOINT_ID and differ from the development endpoint.");
  }
  return {
    target: "production" as const,
    databaseUrl: values.DATABASE_URL,
    directUrl: values.DIRECT_URL,
    endpointId: productionEndpoint,
  };
};

export const validateDatabaseEnvironmentIfConfigured = () =>
  hasDatabaseConfiguration() ? validateDatabaseEnvironment() : null;
