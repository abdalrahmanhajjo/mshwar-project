export const navigationMocks = {
  pathname: "/",
  search: "",
  replace: (_href?: string) => undefined,
  push: (_href?: string) => undefined,
};

export function usePathname() {
  return navigationMocks.pathname;
}

export function useRouter() {
  return {
    push: navigationMocks.push,
    replace: navigationMocks.replace,
    prefetch: () => undefined,
  };
}

export function useSearchParams() {
  return new URLSearchParams(navigationMocks.search);
}
