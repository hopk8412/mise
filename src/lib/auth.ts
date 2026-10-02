import { prismaAdapter } from "@better-auth/prisma-adapter";
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { admin } from "better-auth/plugins/admin";

import { prisma } from "@/lib/db";

export const auth = betterAuth({
  appName: "mise",
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
  },
  user: {
    changeEmail: { enabled: false },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
  },
  plugins: [
    // Supplies the role column plus the user-management endpoints the admin
    // area is built on, so none of that has to be written by hand.
    admin({ defaultRole: "user", adminRoles: ["admin"] }),
    // Must stay last: it wraps the other plugins' responses so that cookies set
    // during a server action are forwarded to the browser.
    nextCookies(),
  ],
});
