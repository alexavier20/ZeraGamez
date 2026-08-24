let pendingLogoutNavigations = 0;

export function beginLogoutNavigation(): void {
  pendingLogoutNavigations += 1;
}

export function endLogoutNavigation(): void {
  pendingLogoutNavigations = Math.max(0, pendingLogoutNavigations - 1);
}

export function isLogoutNavigationPending(): boolean {
  return pendingLogoutNavigations > 0;
}
