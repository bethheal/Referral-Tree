import { prisma } from "../services/prismaClient.ts";

if (process.env.DATABASE_TARGET !== "angelfoods-dev" || process.env.NEON_BRANCH !== "angelfoods-dev") throw new Error("Fixture cleanup is restricted to angelfoods-dev.");
const endpoint = process.env.NEON_ENDPOINT_ID;
const connection = process.env.DATABASE_URL;
if (!endpoint || !connection || !new URL(connection).hostname.startsWith(`${endpoint}-pooler.`)) throw new Error("Database endpoint does not match angelfoods-dev.");
const fixtures = await prisma.user.findMany({
  where: { id: { startsWith: "integration-" }, email: { startsWith: "integration-", endsWith: "@example.invalid" } },
  select: { id: true },
});
if (fixtures.length > 15) throw new Error("Unexpected number of integration fixtures; refusing cleanup.");
const userIds = fixtures.map((fixture) => fixture.id);
const result = await prisma.$transaction(async (tx) => {
  await tx.invoice.deleteMany({ where: { userId: { in: userIds } } });
  await tx.productOrder.deleteMany({ where: { userId: { in: userIds } } });
  return tx.user.deleteMany({ where: { id: { in: userIds } } });
});
console.log(JSON.stringify({ event: "integration_fixtures_cleaned", count: result.count }));
await prisma.$disconnect();
