const APP_REFRESH_EVENT = "app:refresh";

export function triggerAppRefresh() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(APP_REFRESH_EVENT, {
      detail: {
        requestedAt: Date.now(),
      },
    }),
  );
}

export function subscribeToAppRefresh(listener: () => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handleRefresh = () => {
    listener();
  };

  window.addEventListener(APP_REFRESH_EVENT, handleRefresh);

  return () => {
    window.removeEventListener(APP_REFRESH_EVENT, handleRefresh);
  };
}
