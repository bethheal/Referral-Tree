import { prisma } from "../services/prismaClient.ts";

if (process.env.DATABASE_TARGET !== "angelfoods-dev" || process.env.NEON_BRANCH !== "angelfoods-dev") {
  throw new Error("This diagnostic is restricted to angelfoods-dev.");
}
const endpoint = process.env.NEON_ENDPOINT_ID;
const connectionString = process.env.DATABASE_URL;
if (!endpoint || !connectionString || !new URL(connectionString).hostname.startsWith(`${endpoint}-pooler.`)) {
  throw new Error("DATABASE_URL does not match the approved Neon pooled endpoint.");
}

try {
  const result = await prisma.$queryRaw<Array<{ database: string; serverTime: Date }>>`SELECT current_database() AS database, now() AS "serverTime"`;
  console.log(JSON.stringify({ event: "prisma_database_connected", database: result[0]?.database, branch: "angelfoods-dev", serverTime: result[0]?.serverTime.toISOString() }));
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
