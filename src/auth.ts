import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { loginSchema } from "@/lib/auth-credentials";
import { createSupabaseAnonClient } from "@/lib/supabase/anon";
import { syncPrismaUserFromSupabase } from "@/lib/supabase/sync-user";
import { prisma } from "@/lib/prisma";
import {
  sessionTokenCookieName,
  sessionTokenCookieOptions,
  useSecureAuthCookies,
} from "@/lib/session-cookie";
import { displayNameFromProfile, ensureUserBundle } from "@/lib/user-bundle";

class EmailNotVerifiedError extends CredentialsSignin {
  code = "email_not_verified";
}

const googleConfigured = Boolean(
  process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET,
);

const secureCookies = useSecureAuthCookies();

/** Vercel .env import sometimes keeps wrapping quotes on secrets. */
const authSecret = process.env.AUTH_SECRET?.trim().replace(/^["']|["']$/g, "");

const prismaAdapter = PrismaAdapter(prisma);

function toAdapterUser(user: {
  id: string;
  email: string | null;
  emailVerified: Date | null;
  name: string | null;
}) {
  return {
    id: user.id,
    email: user.email ?? "",
    emailVerified: user.emailVerified,
    name: user.name,
    image: null,
  };
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  secret: authSecret,
  adapter: {
    ...prismaAdapter,
    async createUser(data) {
      const { name, image: _image, ...rest } = data;
      const user = await prisma.user.create({
        data: {
          email: rest.email,
          emailVerified: rest.emailVerified ?? null,
        },
      });
      const firstName = typeof name === "string" ? name.trim() || null : null;
      await prisma.profile.upsert({
        where: { userId: user.id },
        create: { userId: user.id, firstName },
        update: firstName ? { firstName } : {},
      });
      return toAdapterUser({
        id: user.id,
        email: user.email,
        emailVerified: user.emailVerified,
        name: firstName,
      });
    },
    async getUser(id) {
      const user = await prisma.user.findUnique({
        where: { id },
        include: { profile: { select: { firstName: true, lastName: true } } },
      });
      if (!user) return null;
      return toAdapterUser({
        id: user.id,
        email: user.email,
        emailVerified: user.emailVerified,
        name: displayNameFromProfile(user.profile),
      });
    },
    async getUserByEmail(email) {
      const user = await prisma.user.findUnique({
        where: { email },
        include: { profile: { select: { firstName: true, lastName: true } } },
      });
      if (!user) return null;
      return toAdapterUser({
        id: user.id,
        email: user.email,
        emailVerified: user.emailVerified,
        name: displayNameFromProfile(user.profile),
      });
    },
  },
  providers: [
    Credentials({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const supabase = createSupabaseAnonClient();
        const { data, error } = await supabase.auth.signInWithPassword({
          email: parsed.data.email,
          password: parsed.data.password,
        });

        if (error || !data.user) {
          const msg = error?.message?.toLowerCase() ?? "";
          if (msg.includes("email not confirmed") || msg.includes("not confirmed")) {
            throw new EmailNotVerifiedError();
          }
          return null;
        }

        if (!data.user.email_confirmed_at) {
          throw new EmailNotVerifiedError();
        }

        const user = await syncPrismaUserFromSupabase(data.user);
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: null,
        };
      },
    }),
    ...(googleConfigured
      ? [
          Google({
            clientId: process.env.AUTH_GOOGLE_ID,
            clientSecret: process.env.AUTH_GOOGLE_SECRET,
          }),
        ]
      : []),
  ],
  session: { strategy: "jwt" },
  trustHost: true,
  cookies: {
    sessionToken: {
      name: sessionTokenCookieName(secureCookies),
      options: sessionTokenCookieOptions(secureCookies),
    },
  },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) {
        token.id = user.id;
        token.sub = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      const id = token.id ? String(token.id) : token.sub ? String(token.sub) : "";
      if (session.user && id) {
        session.user.id = id;
      }
      return session;
    },
  },
  events: {
    async createUser({ user }) {
      if (!user.id) return;
      await ensureUserBundle(user.id);
      const emailVerified =
        "emailVerified" in user
          ? (user as { emailVerified?: Date | null }).emailVerified
          : null;
      if (!emailVerified) {
        await prisma.user.update({
          where: { id: user.id },
          data: { emailVerified: new Date() },
        });
      }
    },
  },
});
