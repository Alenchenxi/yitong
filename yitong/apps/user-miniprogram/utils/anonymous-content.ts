import type { AppInstance } from '../app';

const visibilityUnsubscribers = new WeakMap<object, () => void>();
let anonymousContentExitPending = false;

export function bindAnonymousContentVisibility(
  owner: object,
  listener: (enabled: boolean) => void,
): void {
  visibilityUnsubscribers.get(owner)?.();
  const unsubscribe = getApp<AppInstance>().subscribeAnonymousContentVisibility(listener);
  visibilityUnsubscribers.set(owner, unsubscribe);
}

export function unbindAnonymousContentVisibility(owner: object): void {
  visibilityUnsubscribers.get(owner)?.();
  visibilityUnsubscribers.delete(owner);
}

function exitAnonymousContentPage(): void {
  if (anonymousContentExitPending) return;
  anonymousContentExitPending = true;
  wx.switchTab({
    url: '/pages/square/index',
    complete: () => {
      anonymousContentExitPending = false;
    },
  });
}

export function bindAnonymousContentPageGuard(owner: object): void {
  bindAnonymousContentVisibility(owner, (enabled) => {
    if (!enabled) exitAnonymousContentPage();
  });
}

export async function requireAnonymousContentVisibility(): Promise<boolean> {
  const app = getApp<AppInstance>();
  if (!app.requireAuth()) return false;
  if (await app.getAnonymousContentVisibility()) return true;
  exitAnonymousContentPage();
  return false;
}
