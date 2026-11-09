import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.ts";
import { provisionInitialSuperAdmin, validateInitialSuperAdminInput } from "../services/initialSuperAdmin.ts";
import { validateDatabaseEnvironment } from "../utils/databaseSafety.ts";

const database = validateDatabaseEnvironment();
const connectionString = database.directUrl;
const input = validateInitialSuperAdminInput({
  email: process.env.ADMIN_EMAIL,
  confirmation: process.env.CONFIRM_ADMIN_EMAIL,
  name: process.env.ADMIN_NAME,
  password: process.env.ADMIN_PASSWORD,
  mfaEncryptionKey: process.env.MFA_ENCRYPTION_KEY,
});

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
try {
  await prisma.$transaction(
    (tx) => provisionInitialSuperAdmin(tx, input),
    { maxWait: 10_000, timeout: 20_000 },
  );
  console.log(JSON.stringify({ event: "initial_super_admin_created", nextStep: "Sign in and complete authenticator MFA enrollment before accessing admin APIs." }));
} finally {
  await prisma.$disconnect();
}
