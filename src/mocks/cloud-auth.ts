// Mock for @lovable.dev/cloud-auth-js for local Capacitor builds
// This file is used when the cloud-auth package is not available (e.g. local iOS builds)

export function createLovableAuth() {
  return {
    signInWithOAuth: async (_provider: string, _opts?: any) => {
      console.warn("[Mock] @lovable.dev/cloud-auth-js is not available in local builds. OAuth sign-in will not work.");
      return { error: new Error("OAuth is not available in local builds. Please use email/password login.") };
    },
  };
}
