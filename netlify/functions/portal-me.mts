import { SESSION_COOKIE, getInvestigator, getSession, listVisibleCases } from './_portal-store.mts';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });

const getCookieFromHeader = (req: Request, name: string) => {
  const cookieHeader = req.headers.get('cookie');
  if (!cookieHeader) {
    return null;
  }
  const parts = cookieHeader.split(';').map((part) => part.trim());
  const match = parts.find((part) => part.startsWith(`${name}=`));
  if (!match) {
    return null;
  }
  return decodeURIComponent(match.slice(name.length + 1));
};

export default async (req: Request, context: { cookies: any }) => {
  if (req.method !== 'GET') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const sessionId = context.cookies.get(SESSION_COOKIE) || getCookieFromHeader(req, SESSION_COOKIE);
  if (!sessionId) {
    return json({ authenticated: false }, 401);
  }

  const session = await getSession(sessionId);
  if (!session) {
    return json({ authenticated: false }, 401);
  }

  const investigator = await getInvestigator(session.badge);
  if (!investigator) {
    return json({ authenticated: false }, 401);
  }

  const cases = await listVisibleCases(investigator.badge);
  return json({
    authenticated: true,
    investigator: { badge: investigator.badge, name: investigator.name },
    cases,
  });
};

export const config = {
  path: '/api/portal/me',
};
