import { eq, sql } from 'drizzle-orm';
import { db } from '../db/index.ts';
import { notifications, userActivity, users } from '../db/schema.ts';

export interface SyncUserInput {
  uid: string;
  email: string;
  emailVerified: boolean;
  fullName?: string;
  username?: string;
  institution?: string;
  department?: string;
  researchField?: string;
  country?: string;
  userCategory?: string;
  avatarUrl?: string | null;
}

const VALID_CATEGORIES = new Set([
  'Student',
  'Research Scholar',
  'Professor',
  'Scientist',
  'Laboratory Researcher',
  'Environmental Consultant',
  'Other',
]);

export async function getUserByUid(uid: string) {
  try {
    const rows = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
    return rows[0] ?? null;
  } catch (error) {
    console.error('Database query failed in getUserByUid:', error);
    throw new Error('Failed to retrieve user profile.', { cause: error });
  }
}

export async function getOrCreateUser(input: SyncUserInput) {
  try {
    const existing = await db.select().from(users).where(eq(users.uid, input.uid)).limit(1);
    if (existing[0]) {
      const updated = await db
        .update(users)
        .set({
          emailVerified: input.emailVerified || existing[0].emailVerified,
          lastLoginAt: new Date(),
          updatedAt: new Date(),
          ...(input.avatarUrl && !existing[0].avatarUrl ? { avatarUrl: input.avatarUrl } : {}),
        })
        .where(eq(users.uid, input.uid))
        .returning();
      return { user: updated[0], isNew: false };
    }

    const baseUsername = (
      input.username ||
      input.email.split('@')[0] ||
      `researcher_${input.uid.slice(0, 6)}`
    )
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .slice(0, 28);

    const uniqueSuffix = input.uid.slice(0, 4).toLowerCase();
    const candidateUsername = input.username ? baseUsername : `${baseUsername}_${uniqueSuffix}`;

    const category =
      input.userCategory && VALID_CATEGORIES.has(input.userCategory)
        ? input.userCategory
        : 'Scientist';

    // Public registration NEVER assigns admin role; always defaults to 'user'.
    const inserted = await db
      .insert(users)
      .values({
        uid: input.uid,
        fullName: (input.fullName || input.email.split('@')[0] || 'Researcher').trim().slice(0, 120),
        username: candidateUsername,
        email: input.email.toLowerCase().trim(),
        institution: (input.institution || '').trim().slice(0, 180),
        department: (input.department || '').trim().slice(0, 160),
        researchField: (input.researchField || '').trim().slice(0, 160),
        country: (input.country || '').trim().slice(0, 100),
        userCategory: category,
        role: 'user',
        accountStatus: 'active',
        avatarUrl: input.avatarUrl ?? null,
        emailVerified: input.emailVerified,
        lastLoginAt: new Date(),
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          lastLoginAt: new Date(),
          updatedAt: new Date(),
          emailVerified: input.emailVerified,
        },
      })
      .returning();

    const created = inserted[0];

    await db.insert(notifications).values({
      userId: created.id,
      title: 'Welcome to eDNA Biodiversity Platform',
      message: created.emailVerified
        ? 'Your researcher account is active and verified. Create a research project or upload an eDNA dataset to begin.'
        : 'Your researcher account was created. Please verify your email address to unlock full report distribution.',
      category: 'registration',
      status: 'unread',
    });

    await db.insert(userActivity).values({
      userId: created.id,
      action: 'account_registered',
      details: `Registered researcher profile (${created.userCategory})`,
    });

    return { user: created, isNew: true };
  } catch (error) {
    console.error('Database query failed in getOrCreateUser:', error);
    throw new Error('Account synchronization failed. Username or email may already be in use.', {
      cause: error,
    });
  }
}

export async function logUserActivity(
  userId: string,
  action: string,
  details?: string,
  ipAddress?: string
) {
  try {
    await db.insert(userActivity).values({
      userId,
      action,
      details: details ?? null,
      ipAddress: ipAddress ?? null,
    });
  } catch (error) {
    console.error('Failed to record user activity:', error);
  }
}

export async function countAdmins(): Promise<number> {
  try {
    const res = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(eq(users.role, 'admin'));
    return res[0]?.count ?? 0;
  } catch (error) {
    console.error('Failed to count admins:', error);
    return 0;
  }
}
