import type { IncomingMessage } from 'http';
import { parse as parseCookie } from 'cookie';
import { pool } from '../db';

export async function getUserFromSession(sessionId: string): Promise<{ userId: string } | null> {
  try {
    const query = `SELECT sess FROM sessions WHERE sid = $1 AND expire > NOW()`;
    const result = await pool.query(query, [sessionId]);
    
    if (!result.rows || result.rows.length === 0) {
      return null;
    }
    
    const sessionData = result.rows[0].sess as any;
    
    if (sessionData?.passport?.user?.claims?.sub) {
      return { userId: sessionData.passport.user.claims.sub };
    }
    
    return null;
  } catch (error) {
    console.error('[WebSocket Auth] Error getting user from session:', error);
    return null;
  }
}

export async function getTenantFromQuery(req: IncomingMessage): Promise<string | null> {
  try {
    if (!req.url) return null;
    const url = new URL(req.url, `http://${req.headers.host}`);
    return url.searchParams.get('tenantId');
  } catch (error) {
    console.error('[WebSocket Auth] Error parsing tenant from query:', error);
    return null;
  }
}

export async function parseSessionCookie(req: IncomingMessage): Promise<string | null> {
  try {
    const cookies = parseCookie(req.headers.cookie || '');
    const sessionId = cookies['connect.sid']?.split('s:')[1]?.split('.')[0];
    return sessionId || null;
  } catch (error) {
    console.error('[WebSocket Auth] Error parsing session cookie:', error);
    return null;
  }
}
