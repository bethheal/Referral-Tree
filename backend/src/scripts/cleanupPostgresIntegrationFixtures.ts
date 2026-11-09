import { prisma } from "../services/prismaClient.ts";
import { validateDatabaseEnvironment } from "../utils/databaseSafety.ts";

const database = validateDatabaseEnvironment();
if (database.target !== "angelfoods-dev") throw new Error("Fixture cleanup is restricted to angelfoods-dev.");
const fixtures = await prisma.user.findMany({
  where: { id: { startsWith: "integration-" }, email: { startsWith: "integration-", endsWith: "@example.invalid" } },
  select: { id: true },
});
if (fixtures.length > 15) throw new Error("Unexpected number of integration fixtures; refusing cleanup.");
const userIds = fixtures.map((fixture) => fixture.id);
const result = await prisma.$transaction(async (tx) => {
  await tx.invoice.deleteMany({ where: { userId: { in: userIds } } });
  await tx.productOrder.deleteMany({ where: { userId: { in: userIds } } });
  await tx.membership.deleteMany({ where: { userId: { in: userIds } } });
  return tx.user.deleteMany({ where: { id: { in: userIds } } });
});
console.log(JSON.stringify({ event: "integration_fixtures_cleaned", count: result.count }));
await prisma.$disconnect();
