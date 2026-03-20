import { For, Match, Show, Switch, createEffect, createMemo, createSignal } from 'solid-js';

type Investigator = {
  badge: string;
  name: string;
  unit?: string;
  contact?: string;
};

type CaseRecord = {
  id: string;
  title: string;
  summary: string;
  status: 'active';
  assignedBadges: string[];
  startedByBadge: string;
  createdAt: string;
};

type ViewMode = 'choice' | 'login' | 'signup' | 'dashboard';

const request = async (path: string, init?: RequestInit) => {
  const response = await fetch(path, {
    credentials: 'include',
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...(init?.headers || {}),
    },
    ...init,
  });

  let payload: any = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw new Error(payload?.error || 'Request failed');
  }

  return payload;
};

export default function Home() {
  const [view, setView] = createSignal<ViewMode>('choice');
  const [loadingSession, setLoadingSession] = createSignal(true);
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal('');

  const [investigator, setInvestigator] = createSignal<Investigator | null>(null);
  const [cases, setCases] = createSignal<CaseRecord[]>([]);

  const [loginBadge, setLoginBadge] = createSignal('');
  const [loginPassword, setLoginPassword] = createSignal('');

  const [signupName, setSignupName] = createSignal('');
  const [signupBadge, setSignupBadge] = createSignal('');
  const [signupPassword, setSignupPassword] = createSignal('');
  const [signupUnit, setSignupUnit] = createSignal('');
  const [signupContact, setSignupContact] = createSignal('');

  const [newCaseTitle, setNewCaseTitle] = createSignal('');
  const [newCaseSummary, setNewCaseSummary] = createSignal('');
  const [newCaseAssignedBadges, setNewCaseAssignedBadges] = createSignal('');
  const [profileName, setProfileName] = createSignal('');
  const [profileUnit, setProfileUnit] = createSignal('');
  const [profileContact, setProfileContact] = createSignal('');

  const assignedCases = createMemo(() => {
    const currentInvestigator = investigator();
    if (!currentInvestigator) {
      return [];
    }
    return cases().filter((caseRecord) => caseRecord.assignedBadges.includes(currentInvestigator.badge));
  });

  const startedCases = createMemo(() => {
    const currentInvestigator = investigator();
    if (!currentInvestigator) {
      return [];
    }
    return cases().filter((caseRecord) => caseRecord.startedByBadge === currentInvestigator.badge);
  });

  const loadSession = async () => {
    try {
      const data = await request('/api/portal/me', { method: 'GET' });
      setInvestigator(data.investigator);
      setCases(data.cases || []);
      setView('dashboard');
    } catch {
      setInvestigator(null);
      setCases([]);
      setView('choice');
    } finally {
      setLoadingSession(false);
    }
  };

  createEffect(() => {
    void loadSession();
  });

  createEffect(() => {
    const currentInvestigator = investigator();
    if (!currentInvestigator) {
      return;
    }
    setProfileName(currentInvestigator.name || '');
    setProfileUnit(currentInvestigator.unit || '');
    setProfileContact(currentInvestigator.contact || '');
  });

  const clearAuthForm = () => {
    setLoginBadge('');
    setLoginPassword('');
    setSignupBadge('');
    setSignupName('');
    setSignupPassword('');
    setSignupUnit('');
    setSignupContact('');
  };

  const handleLogin = async (event: SubmitEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');

    try {
      await request('/api/portal/auth', {
        method: 'POST',
        body: JSON.stringify({
          action: 'login',
          badge: loginBadge(),
          password: loginPassword(),
        }),
      });
      clearAuthForm();
      await loadSession();
    } catch (err: any) {
      setError(err?.message || 'Login failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleSignup = async (event: SubmitEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');

    try {
      await request('/api/portal/auth', {
        method: 'POST',
        body: JSON.stringify({
          action: 'signup',
          name: signupName(),
          unit: signupUnit(),
          contact: signupContact(),
          badge: signupBadge(),
          password: signupPassword(),
        }),
      });
      clearAuthForm();
      await loadSession();
    } catch (err: any) {
      setError(err?.message || 'Account creation failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleSignupFromLogin = async () => {
    if (!loginBadge().trim() || !loginPassword().trim()) {
      setError('Enter badge number and password before creating an account.');
      return;
    }

    setBusy(true);
    setError('');
    try {
      await request('/api/portal/auth', {
        method: 'POST',
        body: JSON.stringify({
          action: 'signup',
          badge: loginBadge(),
          password: loginPassword(),
        }),
      });
      clearAuthForm();
      await loadSession();
    } catch (err: any) {
      setError(err?.message || 'Account creation failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = async () => {
    setBusy(true);
    setError('');
    try {
      await request('/api/portal/auth', {
        method: 'POST',
        body: JSON.stringify({ action: 'logout' }),
      });
    } catch {}
    setInvestigator(null);
    setCases([]);
    setView('choice');
    setBusy(false);
  };

  const refreshCases = async () => {
    try {
      const data = await request('/api/portal/cases', { method: 'GET' });
      setCases(data.cases || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load active cases.');
    }
  };

  const handleCreateCase = async (event: SubmitEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');

    const badges = newCaseAssignedBadges()
      .split(',')
      .map((badge) => badge.trim())
      .filter(Boolean);

    try {
      const data = await request('/api/portal/cases', {
        method: 'POST',
        body: JSON.stringify({
          title: newCaseTitle(),
          summary: newCaseSummary(),
          assignedBadges: badges,
        }),
      });
      setCases((currentCases) => [data.case, ...currentCases]);
      setNewCaseTitle('');
      setNewCaseSummary('');
      setNewCaseAssignedBadges('');
    } catch (err: any) {
      setError(err?.message || 'Unable to create case.');
    } finally {
      setBusy(false);
    }
  };

  const handleProfileSave = async (event: SubmitEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const data = await request('/api/portal/me', {
        method: 'PATCH',
        body: JSON.stringify({
          name: profileName(),
          unit: profileUnit(),
          contact: profileContact(),
        }),
      });
      setInvestigator(data.investigator);
    } catch (err: any) {
      setError(err?.message || 'Failed to save investigator profile.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section class="portal-shell">
      <header class="portal-header">
        <p class="portal-kicker">San Andreas State Investigations</p>
        <h1 class="portal-title">Investigator Portal</h1>
        <p class="portal-subtitle">Secure access for investigator identity and active case visibility.</p>
      </header>

      <Show when={error()}>
        <p class="portal-error">{error()}</p>
      </Show>

      <Switch>
        <Match when={loadingSession()}>
          <div class="portal-card">
            <p>Checking login session...</p>
          </div>
        </Match>

        <Match when={view() === 'choice'}>
          <div class="portal-grid">
            <article class="portal-card">
              <h2 class="card-title">Log In</h2>
              <p>Enter badge number and password to access active cases.</p>
              <button class="portal-btn portal-btn-primary" onClick={() => setView('login')}>
                Go to Log In
              </button>
            </article>

            <article class="portal-card">
              <h2 class="card-title">Create Account</h2>
              <p>New investigators can register with badge number credentials.</p>
              <button class="portal-btn" onClick={() => setView('signup')}>
                Go to Create Account
              </button>
            </article>
          </div>
        </Match>

        <Match when={view() === 'login'}>
          <form class="portal-card portal-form" onSubmit={handleLogin}>
            <h2 class="card-title">Log In</h2>
            <label>
              Badge number
              <input
                type="text"
                inputmode="numeric"
                required
                value={loginBadge()}
                onInput={(event) => setLoginBadge(event.currentTarget.value)}
              />
            </label>
            <label>
              Password
              <input
                type="password"
                required
                value={loginPassword()}
                onInput={(event) => setLoginPassword(event.currentTarget.value)}
              />
            </label>
            <div class="portal-actions">
              <button class="portal-btn portal-btn-primary" type="submit" disabled={busy()}>
                {busy() ? 'Logging in...' : 'Log In'}
              </button>
              <button class="portal-btn" type="button" disabled={busy()} onClick={handleSignupFromLogin}>
                Create Account with These Credentials
              </button>
              <button class="portal-btn" type="button" onClick={() => setView('choice')}>
                Back
              </button>
            </div>
          </form>
        </Match>

        <Match when={view() === 'signup'}>
          <form class="portal-card portal-form" onSubmit={handleSignup}>
            <h2 class="card-title">Create Account</h2>
            <label>
              Investigator name
              <input
                type="text"
                value={signupName()}
                onInput={(event) => setSignupName(event.currentTarget.value)}
                placeholder="Detective Jane Doe"
              />
            </label>
            <label>
              Unit or division
              <input
                type="text"
                value={signupUnit()}
                onInput={(event) => setSignupUnit(event.currentTarget.value)}
                placeholder="Major Crimes"
              />
            </label>
            <label>
              Contact info
              <input
                type="text"
                value={signupContact()}
                onInput={(event) => setSignupContact(event.currentTarget.value)}
                placeholder="Radio 3A-12 / Discord"
              />
            </label>
            <label>
              Badge number (username)
              <input
                type="text"
                inputmode="numeric"
                required
                value={signupBadge()}
                onInput={(event) => setSignupBadge(event.currentTarget.value)}
                placeholder="733"
              />
            </label>
            <label>
              Password
              <input
                type="password"
                required
                value={signupPassword()}
                onInput={(event) => setSignupPassword(event.currentTarget.value)}
                placeholder="Badge number or PIN length"
              />
            </label>
            <p class="helper-text">Password must be the badge number or a numeric PIN (default length is 4).</p>
            <div class="portal-actions">
              <button class="portal-btn portal-btn-primary" type="submit" disabled={busy()}>
                {busy() ? 'Creating...' : 'Create Account'}
              </button>
              <button class="portal-btn" type="button" onClick={() => setView('choice')}>
                Back
              </button>
            </div>
          </form>
        </Match>

        <Match when={view() === 'dashboard'}>
          <div class="portal-stack">
            <article class="portal-card">
              <h2 class="card-title">Investigator Profile</h2>
              <p>
                <strong>Name:</strong> {investigator()?.name}
              </p>
              <p>
                <strong>Badge:</strong> {investigator()?.badge}
              </p>
              <p>
                <strong>Unit:</strong> {investigator()?.unit || 'Not set'}
              </p>
              <p>
                <strong>Contact:</strong> {investigator()?.contact || 'Not set'}
              </p>
              <div class="portal-actions">
                <button class="portal-btn" onClick={refreshCases}>
                  Refresh Cases
                </button>
                <button class="portal-btn portal-btn-danger" onClick={handleLogout}>
                  Log Out
                </button>
              </div>
            </article>

            <form class="portal-card portal-form" onSubmit={handleProfileSave}>
              <h2 class="card-title">Update Profile Information</h2>
              <label>
                Name
                <input
                  type="text"
                  required
                  value={profileName()}
                  onInput={(event) => setProfileName(event.currentTarget.value)}
                />
              </label>
              <label>
                Unit or division
                <input
                  type="text"
                  value={profileUnit()}
                  onInput={(event) => setProfileUnit(event.currentTarget.value)}
                />
              </label>
              <label>
                Contact info
                <input
                  type="text"
                  value={profileContact()}
                  onInput={(event) => setProfileContact(event.currentTarget.value)}
                />
              </label>
              <button class="portal-btn portal-btn-primary" type="submit" disabled={busy()}>
                {busy() ? 'Saving...' : 'Save Profile'}
              </button>
            </form>

            <form class="portal-card portal-form" onSubmit={handleCreateCase}>
              <h2 class="card-title">Start New Case</h2>
              <label>
                Case title
                <input
                  type="text"
                  required
                  value={newCaseTitle()}
                  onInput={(event) => setNewCaseTitle(event.currentTarget.value)}
                />
              </label>
              <label>
                Summary
                <textarea
                  rows={3}
                  value={newCaseSummary()}
                  onInput={(event) => setNewCaseSummary(event.currentTarget.value)}
                />
              </label>
              <label>
                Assign badge numbers (comma separated)
                <input
                  type="text"
                  inputmode="numeric"
                  value={newCaseAssignedBadges()}
                  onInput={(event) => setNewCaseAssignedBadges(event.currentTarget.value)}
                  placeholder="733, 124, 991"
                />
              </label>
              <button class="portal-btn portal-btn-primary" type="submit" disabled={busy()}>
                {busy() ? 'Saving...' : 'Create Case'}
              </button>
            </form>

            <div class="portal-grid">
              <article class="portal-card">
                <h2 class="card-title">Active Cases Assigned To You</h2>
                <Show when={assignedCases().length > 0} fallback={<p>No assigned active cases.</p>}>
                  <ul class="case-list">
                    <For each={assignedCases()}>
                      {(caseRecord) => (
                        <li>
                          <h3>{caseRecord.title}</h3>
                          <p>{caseRecord.summary || 'No summary provided.'}</p>
                          <small>Started by badge {caseRecord.startedByBadge}</small>
                        </li>
                      )}
                    </For>
                  </ul>
                </Show>
              </article>

              <article class="portal-card">
                <h2 class="card-title">Active Cases You Started</h2>
                <Show when={startedCases().length > 0} fallback={<p>No started active cases.</p>}>
                  <ul class="case-list">
                    <For each={startedCases()}>
                      {(caseRecord) => (
                        <li>
                          <h3>{caseRecord.title}</h3>
                          <p>{caseRecord.summary || 'No summary provided.'}</p>
                          <small>Assigned badges: {caseRecord.assignedBadges.join(', ') || 'None'}</small>
                        </li>
                      )}
                    </For>
                  </ul>
                </Show>
              </article>
            </div>
          </div>
        </Match>
      </Switch>
    </section>
  );
}
