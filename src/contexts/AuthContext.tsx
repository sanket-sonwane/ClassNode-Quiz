import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type UserRole = "teacher" | "student";

type User = {
  id: string;
  name: string;
  role: UserRole;
  email?: string;
};

type SignupResult = {
  success: boolean;
  needsConfirmation?: boolean;
};

type AuthContextType = {
  user: User | null;
  isInitializing: boolean;
  login: (name: string, role: UserRole, id?: string) => void;
  teacherLogin: (email: string, password: string) => Promise<boolean>;
  teacherSignup: (name: string, email: string, password: string) => Promise<SignupResult>;
  resetPassword: (email: string) => Promise<boolean>;
  updatePassword: (newPassword: string) => Promise<boolean>;
  logout: () => Promise<void>;
  roomCode: string | null;
  setRoomCode: (code: string | null) => void;
  isPasswordRecovery: boolean;
  recoveryError: string | null;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const RECOVERY_FLAG_KEY = "passwordRecovery";
const RECOVERY_REQUESTED_KEY = "passwordRecoveryRequested";
const REDIRECT_PATH = "/reset-password";
const MIN_PASSWORD_LENGTH = 6;

// Removes the auth tokens / error parameters from the address bar without
// triggering a navigation.
const stripAuthParams = () => {
  window.history.replaceState({}, document.title, window.location.pathname);
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState<boolean>(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState<boolean>(
    () => sessionStorage.getItem(RECOVERY_FLAG_KEY) === "1"
  );
  const [recoveryError, setRecoveryError] = useState<string | null>(null);

  const navigate = useNavigate();

  // Refs keep the auth listener from reading stale state.
  const recoveryRef = useRef<boolean>(isPasswordRecovery);
  const initStartedRef = useRef<boolean>(false);

  const setRecoveryFlag = useCallback((value: boolean) => {
    recoveryRef.current = value;
    setIsPasswordRecovery(value);
    if (value) {
      sessionStorage.setItem(RECOVERY_FLAG_KEY, "1");
    } else {
      sessionStorage.removeItem(RECOVERY_FLAG_KEY);
      sessionStorage.removeItem(RECOVERY_REQUESTED_KEY);
    }
  }, []);

  /**
   * Loads the teacher profile for an authenticated Supabase user.
   * Self-heals accounts that have an auth user but no `teachers` row
   * (legacy accounts, accounts created from the Supabase dashboard, or a
   * signup whose profile insert was blocked). Without this the account is
   * permanently locked out.
   */
  const hydrateTeacher = useCallback(async (authUser: SupabaseUser): Promise<User | null> => {
    try {
      const { data: existing, error: fetchError } = await supabase
        .from("teachers")
        .select("*")
        .eq("id", authUser.id)
        .maybeSingle();

      if (fetchError && fetchError.code !== "PGRST116") {
        console.error("Teacher profile fetch error:", fetchError);
      }

      let profile = existing;

      if (!profile) {
        const metadataName =
          typeof authUser.user_metadata?.name === "string"
            ? authUser.user_metadata.name
            : "";
        const fallbackName =
          metadataName || authUser.email?.split("@")[0] || "Teacher";
        const email = authUser.email ?? "";

        const { data: created, error: createError } = await supabase
          .from("teachers")
          .upsert(
            {
              id: authUser.id,
              name: fallbackName,
              email,
              password_hash: "", // Passwords are managed by Supabase Auth.
            },
            { onConflict: "id" }
          )
          .select()
          .single();

        if (createError || !created) {
          console.error("Could not create missing teacher profile:", createError);
          return null;
        }

        profile = created;
      }

      const teacherUser: User = {
        id: profile.id,
        name: profile.name,
        role: "teacher",
        email: profile.email,
      };

      setUser(teacherUser);

      // Restore the room code of an already-running quiz.
      const { data: quizData } = await supabase
        .from("quizzes")
        .select("id, room_code")
        .eq("created_by", profile.id)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();

      setRoomCode(quizData?.room_code ?? null);

      return teacherUser;
    } catch (error) {
      console.error("hydrateTeacher error:", error);
      return null;
    }
  }, []);

  /**
   * Consumes Supabase auth parameters from the current URL.
   * Returns how the session was established so the caller can route correctly.
   */
  const consumeAuthRedirect = useCallback(async (): Promise<
    "recovery" | "signed-in" | "error" | null
  > => {
    const url = new URL(window.location.href);
    const hashParams = new URLSearchParams(
      url.hash.startsWith("#") ? url.hash.slice(1) : url.hash
    );

    const errorCode = url.searchParams.get("error") || hashParams.get("error");
    const errorDescription =
      url.searchParams.get("error_description") || hashParams.get("error_description");

    if (errorCode) {
      const message = errorDescription
        ? decodeURIComponent(errorDescription.replace(/\+/g, " "))
        : "This link is invalid or has expired. Please request a new one.";
      setRecoveryFlag(false);
      setRecoveryError(message);
      stripAuthParams();
      return "error";
    }

    const accessToken = hashParams.get("access_token");
    const refreshToken = hashParams.get("refresh_token");
    const type = hashParams.get("type");
    const code = url.searchParams.get("code");

    const requestedRecovery =
      sessionStorage.getItem(RECOVERY_REQUESTED_KEY) === "1";
    const isRecovery = type === "recovery" || (type === null && requestedRecovery);

    if (accessToken && refreshToken) {
      // Mark recovery before setSession so the SIGNED_IN listener does not
      // treat the recovery session as a normal login.
      if (isRecovery) setRecoveryFlag(true);

      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      stripAuthParams();

      if (error) {
        setRecoveryFlag(false);
        setRecoveryError(error.message);
        return "error";
      }

      setRecoveryError(null);
      return isRecovery ? "recovery" : "signed-in";
    }

    if (code) {
      if (isRecovery) setRecoveryFlag(true);

      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      stripAuthParams();

      if (error) {
        setRecoveryFlag(false);
        setRecoveryError(error.message);
        return "error";
      }

      if (!data.session) return null;
      setRecoveryError(null);
      return isRecovery ? "recovery" : "signed-in";
    }

    return null;
  }, [setRecoveryFlag]);

  // Initial session hydration + auth event listener. Runs once.
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        setRecoveryFlag(true);
        navigate(REDIRECT_PATH, { replace: true });
        return;
      }

      if (event === "SIGNED_OUT") {
        setUser(null);
        setRoomCode(null);
        setRecoveryFlag(false);
        localStorage.removeItem("quizUser");
        localStorage.removeItem("quizRoomCode");
        localStorage.removeItem("studentId");
        return;
      }

      if (event === "SIGNED_IN" && session?.user && !recoveryRef.current) {
        // Handles email-confirmation and magic-link sign-ins. Login itself
        // hydrates and navigates explicitly.
        void hydrateTeacher(session.user);
      }
    });

    const initialize = async () => {
      if (initStartedRef.current) return;
      initStartedRef.current = true;

      try {
        const redirectResult = await consumeAuthRedirect();

        if (redirectResult === "recovery") {
          setRecoveryFlag(true);
          navigate(REDIRECT_PATH, { replace: true });
          return;
        }

        if (redirectResult === "error") {
          navigate(REDIRECT_PATH, { replace: true });
          return;
        }

        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session?.user) {
          if (recoveryRef.current) {
            // A refresh on the reset page: keep the recovery session but do
            // not treat the user as logged in yet.
            if (window.location.pathname !== REDIRECT_PATH) {
              navigate(REDIRECT_PATH, { replace: true });
            }
            return;
          }

          const teacher = await hydrateTeacher(session.user);
          if (teacher) {
            const path = window.location.pathname;
            if (path === "/" || path === "/login") {
              navigate("/teacher", { replace: true });
            }
          }
          return;
        }

        // No Supabase session: the recovery link is stale, or this is a
        // student session restored from localStorage.
        if (recoveryRef.current) {
          setRecoveryFlag(false);
        }

        const storedUser = localStorage.getItem("quizUser");
        if (storedUser) {
          try {
            const parsed = JSON.parse(storedUser) as User;
            if (parsed?.role === "student" && parsed?.name) {
              setUser(parsed);
              setRoomCode(localStorage.getItem("quizRoomCode"));
            } else {
              localStorage.removeItem("quizUser");
            }
          } catch (error) {
            console.error("Failed to restore student session:", error);
            localStorage.removeItem("quizUser");
          }
        }
      } catch (error) {
        console.error("Session check error:", error);
      } finally {
        setIsInitializing(false);
      }
    };

    void initialize();

    return () => {
      subscription.unsubscribe();
    };
  }, [consumeAuthRedirect, hydrateTeacher, navigate, setRecoveryFlag]);

  const teacherSignup = async (
    name: string,
    email: string,
    password: string
  ): Promise<SignupResult> => {
    try {
      const cleanName = name.trim();
      const cleanEmail = email.trim();

      if (!cleanName || !cleanEmail || !password) {
        toast.error("Please fill all required fields.");
        return { success: false };
      }

      if (password.length < MIN_PASSWORD_LENGTH) {
        toast.error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`);
        return { success: false };
      }

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            name: cleanName,
            role: "teacher",
          },
        },
      });

      if (authError) {
        const message = authError.message.toLowerCase();
        if (
          message.includes("already registered") ||
          message.includes("already been registered") ||
          message.includes("user already")
        ) {
          toast.error("An account with this email already exists. Please sign in instead.");
        } else {
          toast.error(authError.message);
        }
        return { success: false };
      }

      if (!authData.user) {
        toast.error("Signup failed. Please try again.");
        return { success: false };
      }

      // Supabase returns an obfuscated user (no identities) for an email that
      // is already registered when email enumeration protection is enabled.
      if (
        Array.isArray(authData.user.identities) &&
        authData.user.identities.length === 0
      ) {
        toast.error("An account with this email already exists. Please sign in instead.");
        return { success: false };
      }

      // Create the teacher profile. When email confirmation is required there
      // is no session yet, so this insert may be blocked by RLS; login
      // self-heals the profile later if that happens.
      const { error: teacherError } = await supabase.from("teachers").upsert(
        {
          id: authData.user.id,
          name: cleanName,
          email: cleanEmail,
          password_hash: "",
        },
        { onConflict: "id" }
      );

      if (teacherError) {
        console.warn("Teacher profile will be created on first login:", teacherError);
      }

      // Email confirmation is enabled: do NOT fake a login without a session.
      if (!authData.session) {
        toast.success(
          "Account created! Check your email to confirm it, then sign in."
        );
        return { success: true, needsConfirmation: true };
      }

      setUser({
        id: authData.user.id,
        name: cleanName,
        role: "teacher",
        email: cleanEmail,
      });
      setRoomCode(null);
      toast.success(`Welcome, ${cleanName}! Your account has been created.`);
      navigate("/teacher", { replace: true });
      return { success: true };
    } catch (error) {
      console.error("Signup error:", error);
      toast.error("Signup failed. Please try again.");
      return { success: false };
    }
  };

  const teacherLogin = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        console.error("Login error:", error);
        const message = error.message.toLowerCase();
        if (message.includes("email not confirmed")) {
          toast.error("Please confirm your email before signing in.");
        } else if (message.includes("invalid login credentials")) {
          toast.error("Incorrect email or password. Please try again.");
        } else {
          toast.error(error.message);
        }
        return false;
      }

      if (!data.user) {
        toast.error("Login failed. Please try again.");
        return false;
      }

      // A fresh login ends any password-recovery flow.
      setRecoveryFlag(false);
      sessionStorage.removeItem(RECOVERY_REQUESTED_KEY);

      const teacher = await hydrateTeacher(data.user);
      if (!teacher) {
        // Never leave the user authenticated with a broken profile.
        await supabase.auth.signOut();
        toast.error(
          "We could not load your teacher profile. Please try again or contact support."
        );
        return false;
      }

      toast.success(`Welcome back, ${teacher.name}!`);
      navigate("/teacher", { replace: true });
      return true;
    } catch (error) {
      console.error("Login error:", error);
      toast.error("Login failed. Please try again.");
      return false;
    }
  };

  const login = (name: string, role: UserRole, id?: string) => {
    const user: User = {
      // Prefer the real database id (students) over a generated one.
      id: id || `${Date.now()}${Math.random().toString(36).slice(2, 11)}`,
      name,
      role,
    };

    setUser(user);
    localStorage.setItem("quizUser", JSON.stringify(user));

    if (role === "teacher") {
      const newRoomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      setRoomCode(newRoomCode);
      localStorage.setItem("quizRoomCode", newRoomCode);
      toast.success(`Logged in as teacher: ${name}`);
      navigate("/teacher");
    } else {
      toast.success(`Logged in as student: ${name}`);
      navigate("/student");
    }
  };

  const resetPassword = async (email: string): Promise<boolean> => {
    try {
      const cleanEmail = email.trim();
      if (!cleanEmail) {
        toast.error("Please enter your email address.");
        return false;
      }

      // Lets the redirect handler know a recovery link was requested, which
      // also covers PKCE links that carry no `type` parameter.
      sessionStorage.setItem(RECOVERY_REQUESTED_KEY, "1");
      setRecoveryError(null);

      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: `${window.location.origin}${REDIRECT_PATH}`,
      });

      if (error) {
        console.error("Password reset error:", error);
        sessionStorage.removeItem(RECOVERY_REQUESTED_KEY);
        toast.error(error.message || "Failed to send reset email.");
        return false;
      }

      toast.success("Password reset email sent! Check your inbox.");
      return true;
    } catch (error) {
      console.error("Password reset error:", error);
      sessionStorage.removeItem(RECOVERY_REQUESTED_KEY);
      toast.error("An unexpected error occurred. Please try again.");
      return false;
    }
  };

  const updatePassword = async (newPassword: string): Promise<boolean> => {
    try {
      if (newPassword.length < MIN_PASSWORD_LENGTH) {
        toast.error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`);
        return false;
      }

      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        console.error("Password update error:", error);
        toast.error(error.message || "Failed to update password.");
        return false;
      }

      setRecoveryFlag(false);
      setRecoveryError(null);

      // End the recovery session so the new password must be used to sign in.
      await supabase.auth.signOut();
      setUser(null);
      setRoomCode(null);

      toast.success("Password updated! Please sign in with your new password.");
      navigate("/", { replace: true });
      return true;
    } catch (error) {
      console.error("Password update error:", error);
      toast.error("An unexpected error occurred. Please try again.");
      return false;
    }
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error("Logout error:", error);
    }

    setUser(null);
    setRoomCode(null);
    setRecoveryFlag(false);
    setRecoveryError(null);
    localStorage.removeItem("quizUser");
    localStorage.removeItem("quizRoomCode");
    localStorage.removeItem("studentId");
    navigate("/");
    toast.info("Logged out successfully");  };

  if (isInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-quiz-primary" />
        <span className="sr-only">Loading…</span>
      </div>
    );
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isInitializing,
        login,
        teacherLogin,
        teacherSignup,
        resetPassword,
        updatePassword,
        logout,
        roomCode,
        setRoomCode,
        isPasswordRecovery,
        recoveryError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
