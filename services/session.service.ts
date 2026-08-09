/**
 * Session service — management of active authentication sessions.
 */
import authSessionRepository from '@/repositories/auth-session.repository';
import { AppError, ErrorCodes } from '@/lib/errors';

const sessionService = {
  async listAllSessions() {
    return authSessionRepository.listAllSessions();
  },

  async listActiveForUser(userId: number) {
    return authSessionRepository.listActiveForUser(userId);
  },
  async revoke(sessionId: string) {
    const revoked = await authSessionRepository.revoke(sessionId);
    if (!revoked) throw new AppError(ErrorCodes.NOT_FOUND, 'Session not found', 404);
    return revoked;
  },

  async revokeOthers(userId: number, currentSessionToken: string) {
    return authSessionRepository.revokeOthersForUser(userId, currentSessionToken);
  },
};

export default sessionService;
