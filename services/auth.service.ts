/**
 * Auth service: email/password login, session issuance, and logout.
 * This is the only place password verification and session token generation happen —
 * repositories stay dumb data access, this is where the actual auth logic lives.
 */
import { randomBytes, createHash } from 'crypto';
import argon2 from 'argon2';
import appUserRepository from '@/repositories/app-user.repository';
import authPasswordRepository from '@/repositories/auth-password.repository';
import authSessionRepository from '@/repositories/auth-session.repository';
import rbacRepository from '@/repositories/rbac.repository';

// Session lifetime — 7 days is a reasonable default for this kind of admin tool.
// Documented as an assumption in the README since the brief doesn't specify a value.
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Hashes a raw session token with SHA-256 for storage/lookup.
 * Session tokens are looked up on every authenticated request, so a fast hash
 * is used here — argon2 (slow, intentionally) is reserved for login passwords only.
 */
function hashToken(rawToken: string) {
  return createHash('sha256').update(rawToken).digest('hex');
}

const authService = {
  /**
   * Verifies email/password and creates a new session on success.
   * Throws a generic-message error on any failure (wrong email, wrong password,
   * or no password set) so the API layer never leaks which part was wrong.
   */
  async login(input: { email: string; password: string; userAgent?: string; ip?: string }) {
    const user = await appUserRepository.findByEmail(input.email);
    if (!user) {
      throw new Error('Invalid email or password');
    }

    const passwordRecord = await authPasswordRepository.findByUserId(user.id);
    if (!passwordRecord) {
      throw new Error('Invalid email or password');
    }

    const passwordValid = await argon2.verify(passwordRecord.password_hash, input.password);
    if (!passwordValid) {
      throw new Error('Invalid email or password');
    }

    // A user may have multiple roles assigned; for session purposes we use the
    // first active role found. Documented as an assumption in the README —
    // the brief doesn't specify role-selection behavior for multi-role users.
    const roles = await rbacRepository.listRolesForUser(user.id);
    if (roles.length === 0) {
      throw new Error('User has no assigned role');
    }
    const activeRole = roles[0];

    const rawToken = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

    await authSessionRepository.create({
      user_id: user.id,
      role_id: activeRole.id,
      token_hash: hashToken(rawToken),
      user_agent: input.userAgent ?? null,
      ip: input.ip ?? null,
      expires_at: expiresAt,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
      },
      sessionToken: rawToken,
      expiresAt,
    };
  },

  /**
   * Validates a raw session token from an incoming request. Returns the
   * active session row (with user_id/role_id) if valid, or null if not.
   */
  async validateSession(rawToken: string) {
    const tokenHash = hashToken(rawToken);
    const session = await authSessionRepository.findActiveByTokenHash(tokenHash);
    return session ?? null;
  },

  /**
   * Logs out by revoking the session tied to the given raw token.
   * Safe to call even if the token is already invalid/expired — just no-ops.
   */
  async logout(rawToken: string) {
    const tokenHash = hashToken(rawToken);
    const session = await authSessionRepository.findActiveByTokenHash(tokenHash);
    if (session) {
      await authSessionRepository.revoke(session.id);
    }
    return session ?? null;
  },
};

export default authService;