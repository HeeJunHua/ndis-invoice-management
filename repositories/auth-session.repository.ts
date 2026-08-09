/**
 * Repository for the auth_session table. A session is considered "active" when
 * revoked_at IS NULL AND expires_at is in the future — both conditions are
 * checked consistently here so callers never have to duplicate that logic.
 */
import { db } from '@/db';
import { createHash } from 'crypto';
import type { DB } from '@/db/schema';
import type { Insertable } from 'kysely';

export type AuthSessionRow = DB['auth_session'];
export type NewAuthSession = Insertable<AuthSessionRow>;

function hashToken(rawToken: string) {
  return createHash('sha256').update(rawToken).digest('hex');
}

const authSessionRepository = {
  /**
   * Creates a new session row (called on successful login).
   * token_hash should be a hash of the raw session token — never store the
   * raw token itself, since this table is queried on every authenticated request.
   */
  async create(input: NewAuthSession) {
    return db
      .insertInto('auth_session')
      .values(input)
      .returningAll()
      .executeTakeFirstOrThrow();
  },

  /**
   * Finds an active session by its token hash. Used on every authenticated
   * request to validate the incoming session cookie/header.
   */
  async findActiveByTokenHash(tokenHash: string) {
    return db
      .selectFrom('auth_session')
      .selectAll()
      .where('token_hash', '=', tokenHash)
      .where('revoked_at', 'is', null)
      .where('expires_at', '>', new Date())
      .executeTakeFirst();
  },

  /**
   * Lists all sessions (active and inactive) for administrative purposes.
   */
  async listAllSessions() {
    return db
      .selectFrom('auth_session')
      .innerJoin('app_user', 'app_user.id', 'auth_session.user_id')
      .leftJoin('rbac_role', 'rbac_role.id', 'auth_session.role_id')
      .select([
        'auth_session.id',
        'auth_session.user_id',
        'auth_session.role_id',
        'auth_session.token_hash',
        'auth_session.user_agent',
        'auth_session.ip',
        'auth_session.expires_at',
        'auth_session.created_at',
        'auth_session.revoked_at',
        'app_user.full_name as user_name',
        'rbac_role.label as role_name',
      ])
      .orderBy('auth_session.created_at', 'desc')
      .execute();
  },

  /**
   * Lists active sessions for a SPECIFIC user (used for self-service session management / logout everywhere else).
   */
  async listActiveForUser(userId: number) {
    return db
      .selectFrom('auth_session')
      .innerJoin('app_user', 'app_user.id', 'auth_session.user_id')
      .leftJoin('rbac_role', 'rbac_role.id', 'auth_session.role_id')
      .select([
        'auth_session.id',
        'auth_session.user_id',
        'auth_session.role_id',
        'auth_session.token_hash',
        'auth_session.user_agent',
        'auth_session.ip',
        'auth_session.expires_at',
        'auth_session.created_at',
        'auth_session.revoked_at',
        'app_user.full_name as user_name',
        'rbac_role.label as role_name',
      ])
      .where('auth_session.user_id', '=', userId)
      .where('auth_session.revoked_at', 'is', null)
      .where('auth_session.expires_at', '>', new Date())
      .orderBy('auth_session.created_at', 'desc')
      .execute();
  },

  /**
   * Revokes a single session by id (logout, or admin-initiated revoke).
   * Only revokes if not already revoked — idempotent.
   */
  async revoke(id: string) {
    return db
      .updateTable('auth_session')
      .set({ revoked_at: new Date() })
      .where('id', '=', id)
      .where('revoked_at', 'is', null)
      .returningAll()
      .executeTakeFirst();
  },

  async revokeOthersForUser(userId: number, currentSessionToken: string) {
    const currentTokenHash = currentSessionToken ? hashToken(currentSessionToken) : null;

    let query = db
      .updateTable('auth_session')
      .set({ revoked_at: new Date() })
      .where('user_id', '=', userId)
      .where('revoked_at', 'is', null);

    // Only exclude current token if a valid current token was provided
    if (currentTokenHash) {
      query = query.where('token_hash', '!=', currentTokenHash);
    }

    return query.execute();
  },
};

export default authSessionRepository;