export interface UserIssue {
  id: string;
  description: string;
  timestamp: string;
  status: 'open' | 'resolved' | 'in-progress';
}

const STORAGE_KEY = 'yodhac_user_issues';

export function getIssues(): UserIssue[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as UserIssue[];
  } catch {
    return [];
  }
}

export function addIssue(description: string): UserIssue {
  const issues = getIssues();
  const newIssue: UserIssue = {
    id: crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    description: description.trim(),
    timestamp: new Date().toISOString(),
    status: 'open',
  };
  issues.unshift(newIssue);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(issues));
  return newIssue;
}

export function updateIssueStatus(id: string, status: UserIssue['status']): void {
  const issues = getIssues();
  const idx = issues.findIndex(i => i.id === id);
  if (idx !== -1) {
    issues[idx].status = status;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(issues));
  }
}

export function deleteIssue(id: string): void {
  const issues = getIssues().filter(i => i.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(issues));
}
