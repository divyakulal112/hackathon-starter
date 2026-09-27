"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  getCentreSession,
  logoutCentre,
  saveCentreProfileAndOperations,
  sendCentreOtp as authSendCentreOtp,
  verifyCentreOtp as authVerifyCentreOtp,
  type SendCentreOtpResult,
  type VerifyCentreOtpResult,
} from "@/lib/auth/centreAuth";
import type { CentreOperations, CentreProfile, CentreSession } from "@/lib/types";

interface CentreAuthContextValue {
  session: CentreSession | null;
  profile: CentreProfile | null;
  operations: CentreOperations | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  pendingCentreId: string;
  pendingPhone: string;
  setPendingCredentials: (centreId: string, phone: string) => void;
  sendOtp: (centreId: string, phone: string) => Promise<SendCentreOtpResult>;
  verifyOtp: (centreId: string, phone: string, otp: string) => Promise<VerifyCentreOtpResult>;
  saveProfileAndOperations: (
    profile: Omit<CentreProfile, "id">,
    operations: Omit<CentreOperations, "centreId">
  ) => Promise<{ profile: CentreProfile; operations: CentreOperations }>;
  logout: () => Promise<void>;
  refreshSession: () => void;
}

const CentreAuthContext = createContext<CentreAuthContextValue | null>(null);

export function CentreAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<CentreSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingCentreId, setPendingCentreId] = useState<string>("");
  const [pendingPhone, setPendingPhone] = useState<string>("");

  const refreshSession = useCallback(() => {
    const current = getCentreSession();
    setSession(current);
  }, []);

  useEffect(() => {
    refreshSession();
    setIsLoading(false);
  }, [refreshSession]);

  const setPendingCredentials = useCallback((centreId: string, phone: string) => {
    setPendingCentreId(centreId);
    setPendingPhone(phone);
  }, []);

  const sendOtp = useCallback(
    async (centreId: string, phone: string): Promise<SendCentreOtpResult> => {
      const res = await authSendCentreOtp(centreId, phone);
      if (res.success) {
        setPendingCentreId(centreId);
        setPendingPhone(phone);
      }
      return res;
    },
    []
  );

  const verifyOtp = useCallback(
    async (centreId: string, phone: string, otp: string): Promise<VerifyCentreOtpResult> => {
      const res = await authVerifyCentreOtp(centreId, phone, otp);
      if (res.success) {
        refreshSession();
      }
      return res;
    },
    [refreshSession]
  );

  const saveProfileAndOperations = useCallback(
    async (
      profile: Omit<CentreProfile, "id">,
      operations: Omit<CentreOperations, "centreId">
    ) => {
      const res = await saveCentreProfileAndOperations(profile, operations);
      refreshSession();
      return res;
    },
    [refreshSession]
  );

  const logout = useCallback(async () => {
    await logoutCentre();
    setSession(null);
    setPendingCentreId("");
    setPendingPhone("");
  }, []);

  const value = useMemo(
    () => ({
      session,
      profile: session?.profile || null,
      operations: session?.operations || null,
      isAuthenticated: Boolean(session?.centreId),
      isLoading,
      pendingCentreId,
      pendingPhone,
      setPendingCredentials,
      sendOtp,
      verifyOtp,
      saveProfileAndOperations,
      logout,
      refreshSession,
    }),
    [
      session,
      isLoading,
      pendingCentreId,
      pendingPhone,
      setPendingCredentials,
      sendOtp,
      verifyOtp,
      saveProfileAndOperations,
      logout,
      refreshSession,
    ]
  );

  return (
    <CentreAuthContext.Provider value={value}>
      {children}
    </CentreAuthContext.Provider>
  );
}

export function useCentreAuth(): CentreAuthContextValue {
  const ctx = useContext(CentreAuthContext);
  if (!ctx) {
    throw new Error("useCentreAuth must be used within a <CentreAuthProvider>");
  }
  return ctx;
}
