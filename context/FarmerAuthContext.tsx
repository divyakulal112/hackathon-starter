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
  getFarmerSession,
  logoutFarmer,
  saveFarmerProfile,
  sendOtp as authSendOtp,
  verifyOtp as authVerifyOtp,
  type SendOtpResult,
  type VerifyOtpResult,
} from "@/lib/auth/farmerAuth";
import type { FarmerProfile, FarmerSession } from "@/lib/types";

interface FarmerAuthContextValue {
  session: FarmerSession | null;
  profile: FarmerProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  pendingPhone: string;
  setPendingPhone: (phone: string) => void;
  sendOtp: (phone: string) => Promise<SendOtpResult>;
  verifyOtp: (phone: string, otp: string) => Promise<VerifyOtpResult>;
  saveProfile: (data: Omit<FarmerProfile, "id" | "phone">) => Promise<FarmerProfile>;
  logout: () => Promise<void>;
  refreshSession: () => void;
}

const FarmerAuthContext = createContext<FarmerAuthContextValue | null>(null);

export function FarmerAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<FarmerSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingPhone, setPendingPhoneState] = useState<string>("");

  const refreshSession = useCallback(() => {
    const current = getFarmerSession();
    setSession(current);
  }, []);

  // Hydrate session after mount
  useEffect(() => {
    refreshSession();
    setIsLoading(false);
  }, [refreshSession]);

  const setPendingPhone = useCallback((phone: string) => {
    setPendingPhoneState(phone);
  }, []);

  const sendOtp = useCallback(async (phone: string): Promise<SendOtpResult> => {
    const res = await authSendOtp(phone);
    if (res.success) {
      setPendingPhoneState(phone);
    }
    return res;
  }, []);

  const verifyOtp = useCallback(
    async (phone: string, otp: string): Promise<VerifyOtpResult> => {
      const res = await authVerifyOtp(phone, otp);
      if (res.success) {
        refreshSession();
      }
      return res;
    },
    [refreshSession]
  );

  const saveProfile = useCallback(
    async (data: Omit<FarmerProfile, "id" | "phone">): Promise<FarmerProfile> => {
      const saved = await saveFarmerProfile(data);
      refreshSession();
      return saved;
    },
    [refreshSession]
  );

  const logout = useCallback(async () => {
    await logoutFarmer();
    setSession(null);
    setPendingPhoneState("");
  }, []);

  const value = useMemo(
    () => ({
      session,
      profile: session?.profile || null,
      isAuthenticated: Boolean(session?.phone),
      isLoading,
      pendingPhone,
      setPendingPhone,
      sendOtp,
      verifyOtp,
      saveProfile,
      logout,
      refreshSession,
    }),
    [
      session,
      isLoading,
      pendingPhone,
      setPendingPhone,
      sendOtp,
      verifyOtp,
      saveProfile,
      logout,
      refreshSession,
    ]
  );

  return (
    <FarmerAuthContext.Provider value={value}>
      {children}
    </FarmerAuthContext.Provider>
  );
}

export function useFarmerAuth(): FarmerAuthContextValue {
  const ctx = useContext(FarmerAuthContext);
  if (!ctx) {
    throw new Error("useFarmerAuth must be used within a <FarmerAuthProvider>");
  }
  return ctx;
}
