"use client";

import { onAuthStateChanged, signInWithEmailAndPassword, sendPasswordResetEmail, signOut, type User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { auth, db, initializeBeaconAppCheck } from "@/lib/firebase/client";
import type { Member, RoleName } from "@/types/crm";

const defaultOrganizationId = process.env.NEXT_PUBLIC_DEFAULT_ORGANIZATION_ID ?? "beacon-corporate-realty";
const defaultBranchId = process.env.NEXT_PUBLIC_DEFAULT_BRANCH_ID ?? "head-office";

interface AuthState {
  activeBranchId: string;
  activeOrganizationId: string;
  firebaseReady: boolean;
  loading: boolean;
  member: Member | null;
  resetPassword: (email: string) => Promise<void>;
  setActiveBranchId: (branchId: string) => void;
  signIn: (email: string, password: string) => Promise<void>;
  signOutUser: () => Promise<void>;
  user: User | null;
}

const AuthContext = createContext<AuthState | null>(null);

function normalizeMember(id: string, data: Record<string, unknown>): Member {
  const role = data.role as RoleName;
  const roles = Array.isArray(data.roles) ? data.roles as RoleName[] : [];
  return {
    id,
    ...data,
    branchAccess: data.branchAccess === "all" ? "all" : "own",
    roles: Array.from(new Set([...roles, role].filter(Boolean))),
  } as Member;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [member, setMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(Boolean(auth));
  const [activeBranchId, setActiveBranchId] = useState(defaultBranchId);

  useEffect(() => {
    initializeBeaconAppCheck();

    if (!auth) {
      return;
    }

    return onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      if (nextUser && db) {
        const snapshot = await getDoc(doc(db, `organizations/${defaultOrganizationId}/members/${nextUser.uid}`));
        const nextMember = snapshot.exists() ? normalizeMember(snapshot.id, snapshot.data()) : null;
        setMember(nextMember);
        setActiveBranchId(nextMember?.branchId ?? defaultBranchId);
      } else {
        setMember(null);
      }

      setLoading(false);
    });
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!auth) {
      throw new Error("Firebase Authentication is not configured.");
    }

    await signInWithEmailAndPassword(auth, email, password);
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    if (!auth) {
      throw new Error("Firebase Authentication is not configured.");
    }

    await sendPasswordResetEmail(auth, email);
  }, []);

  const signOutUser = useCallback(async () => {
    if (auth) {
      await signOut(auth);
    }
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      activeBranchId,
      activeOrganizationId: defaultOrganizationId,
      firebaseReady: Boolean(auth && db),
      loading,
      member,
      resetPassword,
      setActiveBranchId,
      signIn,
      signOutUser,
      user,
    }),
    [activeBranchId, loading, member, resetPassword, signIn, signOutUser, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }

  return context;
}
