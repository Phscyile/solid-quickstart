import {
  SESSION_COOKIE,
  createCase,
  getInvestigator,
  getSession,
  isBadgeValid,
  listVisibleCases,
} from './_portal-store.mts';

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

const getCurrentInvestigator = async (req: Request, context: { cookies: any }) => {
  const sessionId = context.cookies.get(SESSION_COOKIE) || getCookieFromHeader(req, SESSION_COOKIE);
  if (!sessionId) {
    return null;
  }

  const session = await getSession(sessionId);
  if (!session) {
    return null;
  }

  return getInvestigator(session.badge);
};

export default async (req: Request, context: { cookies: any }) => {
  const investigator = await getCurrentInvestigator(req, context);
  if (!investigator) {
    return json({ error: 'Unauthorized' }, 401);
  }

  if (req.method === 'GET') {
    const cases = await listVisibleCases(investigator.badge);
    return json({ cases });
  }

  if (req.method === 'POST') {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return json({ error: 'Invalid JSON payload' }, 400);
    }

    const title = String(body?.title || '').trim().slice(0, 120);
    const summary = String(body?.summary || '').trim().slice(0, 800);
    const assignedBadges = Array.isArray(body?.assignedBadges)
      ? body.assignedBadges
          .map((value: unknown) => String(value || '').trim())
          .filter((value: string) => isBadgeValid(value))
      : [];

    if (!title) {
      return json({ error: 'Case title is required.' }, 400);
    }

    const normalizedAssignedBadges = [...new Set(assignedBadges)];
    const caseRecord = await createCase({
      title,
      summary,
      assignedBadges: normalizedAssignedBadges,
      startedByBadge: investigator.badge,
    });

    return json({ case: caseRecord }, 201);
  }

  return json({ error: 'Method not allowed' }, 405);
};

export const config = {
  path: '/api/portal/cases',
};
