import { prisma } from "../services/prismaClient.ts";
import { validateDatabaseEnvironment } from "../utils/databaseSafety.ts";

const database = validateDatabaseEnvironment();
if (database.target !== "angelfoods-dev") {
  throw new Error("This diagnostic is restricted to angelfoods-dev.");
}

try {
  const result = await prisma.$queryRaw<Array<{ database: string; serverTime: Date }>>`SELECT current_database() AS database, now() AS "serverTime"`;
  console.log(JSON.stringify({ event: "prisma_database_connected", database: result[0]?.database, target: database.target, serverTime: result[0]?.serverTime.toISOString() }));
} catch {
  console.error("Prisma database diagnostic failed.");
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
