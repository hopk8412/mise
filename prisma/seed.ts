// Runs on every container start (unless SEED_ON_START=false), so every step here
// must be safe to repeat against a database that has already been seeded.
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

async function seedAdministrator() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME?.trim() || "Administrator";

  if (!email || !password) {
    console.log("ADMIN_EMAIL or ADMIN_PASSWORD is not set; skipping the administrator.");
    return;
  }

  let user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    // Created through better-auth rather than inserted directly, so the password
    // is hashed exactly the way the sign-in path expects to verify it.
    const result = await auth.api.signUpEmail({ body: { email, password, name } });
    user = await prisma.user.findUniqueOrThrow({ where: { id: result.user.id } });
    // Sign-up opens a session as a side effect; nobody is holding its cookie.
    await prisma.session.deleteMany({ where: { userId: user.id } });
    console.log(`Created administrator ${email}.`);
  }

  // The admin plugin does not accept a role at sign-up, and an existing account
  // may have had its role changed since the last start.
  if (user.role !== "admin") {
    await prisma.user.update({ where: { id: user.id }, data: { role: "admin" } });
    console.log(`Granted the admin role to ${email}.`);
  }
}

async function main() {
  await seedAdministrator();
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
