import { and, asc, eq, gt, isNull, lte, or, sql, not } from "drizzle-orm";
import type { DatabaseClient } from "../../database/client.js";
import { creditAccounts, notifications, storageAccounts, users } from "../../database/schema.js";
import type { JobContext, JobResult } from "../../core/job.interface.js";
import { emailService } from "../../services/email.service.js";
import { logger } from "../../utils/logger.js";
import { env } from "../../config/env.js";

const MONTH_MS = 30 * 24 * 60 * 60 * 1000;
const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export class PlanExpiryService {
  constructor(private dbClient: DatabaseClient) {}

  async processPlanExpirations(ctx: JobContext): Promise<JobResult> {
    const db = this.dbClient.db;
    const now = new Date();
    const appUrl = (process.env.APP_URL || "https://mitfloww.com").replace(/\/$/, "");

    const result: JobResult = {
      scanned: 0,
      eligible: 0,
      processed: 0,
      deleted: 0,
      skipped: 0,
      failed: 0,
    };

    // 1. Process Active Paid Users (expiring soon or expired today)
    const paidUsers = await db
      .select({
        id: users.id,
        email: users.email,
        displayName: users.displayName,
        firstName: users.firstName,
        planKey: users.planKey,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(
        and(
          isNull(users.deletedAt),
          not(eq(users.planKey, "free")),
        ),
      );

    result.scanned += paidUsers.length;

    for (const user of paidUsers) {
      if (ctx.signal.aborted) break;
      if (!user.email) continue;

      const planExpiresAt = new Date(user.updatedAt.getTime() + MONTH_MS);
      const timeRemainingMs = planExpiresAt.getTime() - now.getTime();
      const daysRemaining = Math.max(0, Math.ceil(timeRemainingMs / ONE_DAY_MS));
      const cycleKey = user.updatedAt.toISOString().slice(0, 10);
      const planDisplayName = user.planKey.toUpperCase();
      const userName = user.displayName || user.firstName || null;
      const renewUrl = `${appUrl}/settings`;
      const expiryDateFormatted = planExpiresAt.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      // CASE A: Expired Today (now >= planExpiresAt) -> Downgrade & Send Expiry Email
      if (timeRemainingMs <= 0) {
        result.eligible++;
        const eventKey = `plan_expired:${user.id}:${cycleKey}`;

        try {
          if (!env.DRY_RUN) {
            // Check if already processed
            const [existing] = await db
              .select({ id: notifications.id })
              .from(notifications)
              .where(eq(notifications.eventKey, eventKey))
              .limit(1);

            if (!existing) {
              // 1. Downgrade user to Free plan
              await db
                .update(users)
                .set({ planKey: "free", updatedAt: now })
                .where(eq(users.id, user.id));

              // 2. Synchronize credit account
              await db
                .update(creditAccounts)
                .set({ planKey: "free", updatedAt: now })
                .where(eq(creditAccounts.ownerUserId, user.id));

              // 3. Synchronize storage account
              await db
                .update(storageAccounts)
                .set({ updatedAt: now })
                .where(eq(storageAccounts.ownerUserId, user.id));

              // 4. Send Plan Expired Email
              await emailService.sendPlanExpiredEmail({
                userEmail: user.email,
                userName,
                planName: planDisplayName,
                renewUrl,
              });

              // 5. Create In-App Notification (also acts as idempotent event record)
              await db
                .insert(notifications)
                .values({
                  title: "Plan expired",
                  description: `Your ${planDisplayName} plan has expired and your account has returned to the Free tier. Existing files are preserved.`,
                  category: 0,
                  eventKey,
                  metadata: { userId: user.id, planKey: user.planKey, expiredAt: now.toISOString() },
                  createdAt: now,
                  updatedAt: now,
                })
                .onConflictDoNothing({ target: notifications.eventKey });

              logger.info(`[PlanExpiryJob] User ${user.id} plan expired and downgraded to free`, {
                userId: user.id,
                email: user.email,
                previousPlan: user.planKey,
              });
              result.processed++;
            } else {
              result.skipped++;
            }
          } else {
            logger.info(`[PlanExpiryJob:DRY_RUN] Would expire and downgrade user ${user.id} (${user.email})`);
            result.processed++;
          }
        } catch (err) {
          logger.error(`[PlanExpiryJob] Error processing expiration for user ${user.id}`, { error: err });
          result.failed++;
        }
      }
      // CASE B: Expiring in <= 3 Days -> Send Pre-Expiry Warning Email
      else if (timeRemainingMs <= THREE_DAYS_MS) {
        result.eligible++;
        const eventKey = `plan_expiring_soon:${user.id}:${cycleKey}`;

        try {
          if (!env.DRY_RUN) {
            const [existing] = await db
              .select({ id: notifications.id })
              .from(notifications)
              .where(eq(notifications.eventKey, eventKey))
              .limit(1);

            if (!existing) {
              await emailService.sendPlanExpiringSoonEmail({
                userEmail: user.email,
                userName,
                planName: planDisplayName,
                daysRemaining,
                expiryDateFormatted,
                renewUrl,
              });

              await db
                .insert(notifications)
                .values({
                  title: "Plan expiring soon",
                  description: `Your ${planDisplayName} plan will expire in ${daysRemaining} days on ${expiryDateFormatted}. Renew to avoid upload limits.`,
                  category: 0,
                  eventKey,
                  metadata: { userId: user.id, planKey: user.planKey, daysRemaining },
                  createdAt: now,
                  updatedAt: now,
                })
                .onConflictDoNothing({ target: notifications.eventKey });

              logger.info(`[PlanExpiryJob] Sent pre-expiry warning to ${user.email} (${daysRemaining} days remaining)`);
              result.processed++;
            } else {
              result.skipped++;
            }
          } else {
            logger.info(`[PlanExpiryJob:DRY_RUN] Would send pre-expiry warning to ${user.email}`);
            result.processed++;
          }
        } catch (err) {
          logger.error(`[PlanExpiryJob] Error sending pre-expiry warning for user ${user.id}`, { error: err });
          result.failed++;
        }
      }
    }

    // 2. Process Post-Expiry Follow-up Emails (1 day after plan expired)
    const recentExpiredNotifications = await db
      .select({
        id: notifications.id,
        eventKey: notifications.eventKey,
        metadata: notifications.metadata,
        createdAt: notifications.createdAt,
      })
      .from(notifications)
      .where(
        and(
          sql`${notifications.eventKey} LIKE 'plan_expired:%'`,
          sql`NOT ${notifications.eventKey} LIKE 'plan_expired_followup:%'`,
          lte(notifications.createdAt, new Date(Date.now() - ONE_DAY_MS)),
          gt(notifications.createdAt, new Date(Date.now() - 3 * ONE_DAY_MS)),
        ),
      );

    for (const expNotif of recentExpiredNotifications) {
      if (ctx.signal.aborted) break;
      const meta = expNotif.metadata as Record<string, unknown> | null;
      const targetUserId = meta?.userId as string | undefined;
      const originalPlanKey = meta?.planKey as string | undefined;
      if (!targetUserId || !expNotif.eventKey) continue;

      const followupEventKey = expNotif.eventKey.replace("plan_expired:", "plan_expired_followup:");

      const [existingFollowup] = await db
        .select({ id: notifications.id })
        .from(notifications)
        .where(eq(notifications.eventKey, followupEventKey))
        .limit(1);

      if (existingFollowup) continue;

      const [targetUser] = await db
        .select({
          id: users.id,
          email: users.email,
          displayName: users.displayName,
          firstName: users.firstName,
          planKey: users.planKey,
        })
        .from(users)
        .where(eq(users.id, targetUserId))
        .limit(1);

      // Only send followup if they have not upgraded back to a paid plan already!
      if (targetUser?.email && targetUser.planKey === "free") {
        result.eligible++;
        const planDisplayName = (originalPlanKey || "Pro").toUpperCase();
        const userName = targetUser.displayName || targetUser.firstName || null;
        const renewUrl = `${appUrl}/settings`;

        try {
          if (!env.DRY_RUN) {
            await emailService.sendPlanExpiredFollowupEmail({
              userEmail: targetUser.email,
              userName,
              planName: planDisplayName,
              renewUrl,
            });

            await db
              .insert(notifications)
              .values({
                title: "Renew your plan",
                description: `Upgrade anytime to restore your ${planDisplayName} benefits and increased upload limits.`,
                category: 0,
                eventKey: followupEventKey,
                metadata: { userId: targetUser.id, planKey: originalPlanKey },
                createdAt: now,
                updatedAt: now,
              })
              .onConflictDoNothing({ target: notifications.eventKey });

            logger.info(`[PlanExpiryJob] Sent post-expiry follow-up email to ${targetUser.email}`);
            result.processed++;
          }
        } catch (err) {
          logger.error(`[PlanExpiryJob] Error sending post-expiry follow-up to ${targetUser.email}`, { error: err });
          result.failed++;
        }
      }
    }

    return result;
  }
}

