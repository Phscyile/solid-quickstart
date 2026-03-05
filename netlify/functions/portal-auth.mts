import {
  SESSION_COOKIE,
  createInvestigator,
  createSession,
  deleteSession,
  getInvestigator,
  isBadgeValid,
  isPasswordValidForBadge,
  verifyPassword,
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

export default async (req: Request, context: { cookies: any }) => {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON payload' }, 400);
  }

  const action = String(body?.action || '').trim();
  const badge = String(body?.badge || '').trim();
  const password = String(body?.password || '').trim();

  if (action === 'logout') {
    const existingSessionId = context.cookies.get(SESSION_COOKIE) || getCookieFromHeader(req, SESSION_COOKIE);
    if (existingSessionId) {
      await deleteSession(existingSessionId);
    }
    context.cookies.delete(SESSION_COOKIE);
    return json({ ok: true });
  }

  if (!isBadgeValid(badge)) {
    return json({ error: 'Badge number must be numeric.' }, 400);
  }

  if (!isPasswordValidForBadge(badge, password)) {
    return json(
      { error: 'Password must match the badge number or a configured numeric pin length.' },
      400,
    );
  }

  if (action === 'signup') {
    const existingInvestigator = await getInvestigator(badge);
    if (existingInvestigator) {
      return json({ error: 'Badge already has an account.' }, 409);
    }

    const nameInput = String(body?.name || '').trim();
    const name = nameInput.length > 0 ? nameInput.slice(0, 80) : `Investigator ${badge}`;
    const investigator = await createInvestigator({ badge, name, password });
    const sessionId = await createSession(investigator.badge);

    context.cookies.set({
      name: SESSION_COOKIE,
      value: sessionId,
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
      httpOnly: true,
      sameSite: 'Lax',
      secure: new URL(req.url).protocol === 'https:',
    });

    return json({
      investigator: {
        badge: investigator.badge,
        name: investigator.name,
      },
    });
  }

  if (action === 'login') {
    const investigator = await getInvestigator(badge);
    if (!investigator || !verifyPassword(investigator.passwordHash, password)) {
      return json({ error: 'Invalid badge/password.' }, 401);
    }

    const sessionId = await createSession(investigator.badge);
    context.cookies.set({
      name: SESSION_COOKIE,
      value: sessionId,
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
      httpOnly: true,
      sameSite: 'Lax',
      secure: new URL(req.url).protocol === 'https:',
    });

    return json({
      investigator: {
        badge: investigator.badge,
        name: investigator.name,
      },
    });
  }

  return json({ error: 'Unsupported action.' }, 400);
};

export const config = {
  path: '/api/portal/auth',
};
