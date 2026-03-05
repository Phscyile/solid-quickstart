import { getStore } from '@netlify/blobs';
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';

export type InvestigatorRecord = {
  badge: string;
  name: string;
  passwordHash: string;
  createdAt: string;
};

export type CaseRecord = {
  id: string;
  title: string;
  summary: string;
  status: 'active';
  assignedBadges: string[];
  startedByBadge: string;
  createdAt: string;
};

type SessionRecord = {
  badge: string;
  createdAt: string;
};

const investigatorsStore = getStore('portal-investigators');
const casesStore = getStore('portal-cases');
const sessionsStore = getStore('portal-sessions');

const INVESTIGATOR_KEY_PREFIX = 'investigator/';
const CASE_KEY_PREFIX = 'case/';
const SESSION_KEY_PREFIX = 'session/';

export const SESSION_COOKIE = 'portal_session';

export const isBadgeValid = (badge: string) => /^\d{1,10}$/.test(badge);

export const isPasswordValidForBadge = (badge: string, password: string) => {
  const pinLength = Number.parseInt(process.env.PORTAL_PIN_LENGTH || '4', 10);
  const exactPin = new RegExp(`^\\d{${Math.max(1, pinLength)}}$`);
  return password === badge || exactPin.test(password);
};

const hashPassword = (password: string) => createHash('sha256').update(password).digest('hex');

export const verifyPassword = (storedHash: string, password: string) => {
  const candidateHash = hashPassword(password);
  const a = Buffer.from(storedHash);
  const b = Buffer.from(candidateHash);

  if (a.length !== b.length) {
    return false;
  }

  return timingSafeEqual(a, b);
};

export const getInvestigator = async (badge: string) =>
  investigatorsStore.get(`${INVESTIGATOR_KEY_PREFIX}${badge}`, { type: 'json' }) as Promise<InvestigatorRecord | null>;

export const createInvestigator = async ({
  badge,
  name,
  password,
}: {
  badge: string;
  name: string;
  password: string;
}) => {
  const record: InvestigatorRecord = {
    badge,
    name,
    passwordHash: hashPassword(password),
    createdAt: new Date().toISOString(),
  };

  await investigatorsStore.setJSON(`${INVESTIGATOR_KEY_PREFIX}${badge}`, record);
  return record;
};

export const createSession = async (badge: string) => {
  const sessionId = randomUUID();
  const record: SessionRecord = { badge, createdAt: new Date().toISOString() };
  await sessionsStore.setJSON(`${SESSION_KEY_PREFIX}${sessionId}`, record);
  return sessionId;
};

export const getSession = async (sessionId: string) =>
  sessionsStore.get(`${SESSION_KEY_PREFIX}${sessionId}`, { type: 'json' }) as Promise<SessionRecord | null>;

export const deleteSession = async (sessionId: string) =>
  sessionsStore.delete(`${SESSION_KEY_PREFIX}${sessionId}`);

export const listVisibleCases = async (badge: string) => {
  const { blobs } = await casesStore.list({ prefix: CASE_KEY_PREFIX });
  const visibleCases: CaseRecord[] = [];

  for (const entry of blobs) {
    const caseRecord = await casesStore.get(entry.key, { type: 'json' });
    if (!caseRecord) {
      continue;
    }
    const typedCase = caseRecord as CaseRecord;
    const isAssigned = typedCase.assignedBadges.includes(badge);
    const isStartedByInvestigator = typedCase.startedByBadge === badge;
    if (isAssigned || isStartedByInvestigator) {
      visibleCases.push(typedCase);
    }
  }

  return visibleCases.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
};

export const createCase = async ({
  title,
  summary,
  assignedBadges,
  startedByBadge,
}: {
  title: string;
  summary: string;
  assignedBadges: string[];
  startedByBadge: string;
}) => {
  const caseRecord: CaseRecord = {
    id: randomUUID(),
    title,
    summary,
    status: 'active',
    assignedBadges,
    startedByBadge,
    createdAt: new Date().toISOString(),
  };

  await casesStore.setJSON(`${CASE_KEY_PREFIX}${caseRecord.id}`, caseRecord);
  return caseRecord;
};
