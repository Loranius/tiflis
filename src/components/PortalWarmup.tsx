// Route-level preloading already lives in AppShell. Keeping a second warmup here
// caused duplicate module/API work immediately after login, when the main screen
// should have the network and main thread to itself.
export function PortalWarmup() {
  return null;
}
