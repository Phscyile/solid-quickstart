import { SESSION_COOKIE, getInvestigator, getSession, listVisibleCases, updateInvestigator } from './_portal-store.mts';

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

  if (req.method === 'GET') {
    const cases = await listVisibleCases(investigator.badge);
    return json({
      authenticated: true,
      investigator: {
        badge: investigator.badge,
        name: investigator.name,
        unit: investigator.unit || '',
        contact: investigator.contact || '',
      },
      cases,
    });
  }

  if (req.method === 'PATCH') {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return json({ error: 'Invalid JSON payload' }, 400);
    }

    const nextName = String(body?.name || '').trim().slice(0, 80);
    const nextUnit = String(body?.unit || '').trim().slice(0, 80);
    const nextContact = String(body?.contact || '').trim().slice(0, 120);
    if (!nextName) {
      return json({ error: 'Name is required.' }, 400);
    }

    const updatedInvestigator = await updateInvestigator({
      badge: investigator.badge,
      name: nextName,
      unit: nextUnit,
      contact: nextContact,
    });

    if (!updatedInvestigator) {
      return json({ error: 'Investigator not found.' }, 404);
    }

    return json({
      investigator: {
        badge: updatedInvestigator.badge,
        name: updatedInvestigator.name,
        unit: updatedInvestigator.unit || '',
        contact: updatedInvestigator.contact || '',
      },
    });
  }

  return json({ error: 'Method not allowed' }, 405);
};

export const config = {
  path: '/api/portal/me',
};
