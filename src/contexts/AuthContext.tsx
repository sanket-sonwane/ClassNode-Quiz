import React, { createContext, useContext, useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type UserRole = "teacher" | "student";

type User = {
  id: string;
  name: string;
  role: UserRole;
  email?: string;
};

type AuthContextType = {
  user: User | null;
  login: (name: string, role: UserRole) => void;
  teacherLogin: (email: string, password: string) => Promise<boolean>;
  teacherSignup: (name: string, email: string, password: string) => Promise<boolean>;
  resetPassword: (email: string) => Promise<boolean>;
  updatePassword: (newPassword: string) => Promise<boolean>;
  logout: () => void;
  roomCode: string | null;
  setRoomCode: (code: string | null) => void;
  isPasswordRecovery: boolean;
  setIsPasswordRecovery: (value: boolean) => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState<boolean>(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Check for password recovery in URL (when user clicks reset link)
    const checkPasswordRecovery = () => {
      const hash = window.location.hash;
      const urlParams = new URLSearchParams(window.location.search);
      
      // Check if this is a recovery link
      if (hash.includes('access_token') && hash.includes('type=recovery')) {
        console.log('Password recovery detected in hash');
        setIsPasswordRecovery(true);
        
        // Extract tokens from hash
        const hashParams = new URLSearchParams(hash.substr(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        
        if (accessToken && refreshToken) {
          // Set the session with the tokens from URL
          supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          });
        }
        
        // Clear the hash for security
        window.history.replaceState({}, '', window.location.pathname);
        return true;
      }
      
      // Also check query params as fallback
      const accessToken = urlParams.get('access_token');
      const type = urlParams.get('type');
      
      if (type === 'recovery' && accessToken) {
        console.log('Password recovery detected in query params');
        setIsPasswordRecovery(true);
        return true;
      }
      
      return false;
    };

    // Check for existing Supabase session
    const checkSession = async () => {
      try {
        // First check if this is a password recovery
        const isRecovery = checkPasswordRecovery();
        
        if (isRecovery) {
          setIsLoading(false);
          return;
        }
        
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session && !isPasswordRecovery) {
          // Fetch teacher details from Supabase
          const { data, error } = await supabase
            .from('teachers')
            .select('*')
            .eq('id', session.user.id)
            .single();

          if (data) {
            const teacherUser: User = {
              id: data.id,
              name: data.name,
              role: 'teacher',
              email: data.email
            };
            
            setUser(teacherUser);
            
            // Fetch active quiz to get room code
            const { data: quizData } = await supabase
              .from('quizzes')
              .select('*')
              .eq('created_by', data.id)
              .eq('is_active', true)
              .maybeSingle();
              
            if (quizData) {
              setRoomCode(quizData.room_code);
            }
            
            if (location.pathname === "/" || location.pathname === "/login") {
              navigate("/teacher", { replace: true });
            }
          }
        }
      } catch (error) {
        console.error("Session check error:", error);
      } finally {
        setIsLoading(false);
      }
    };

    // Set up auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state change event:', event);
      
      if (event === 'PASSWORD_RECOVERY' && session) {
        console.log('Password recovery event detected');
        setIsPasswordRecovery(true);
        return;
      }
      
      if (event === 'SIGNED_IN' && session && !isPasswordRecovery) {
        // Handle successful login in the teacherLogin function instead
        return;
      }
      
      if (event === 'SIGNED_OUT') {
        setUser(null);
        setRoomCode(null);
        setIsPasswordRecovery(false);
      }
    });

    checkSession();

    return () => {
      subscription.unsubscribe();
    };
  }, [navigate, isPasswordRecovery, location.pathname]);

  const teacherSignup = async (name: string, email: string, password: string) => {
    try {
      setIsLoading(true);
      console.log("Starting teacher signup process");
      
      // Using signUp with auth.admin method which bypasses captcha
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
            role: 'teacher'
          }
        }
      });

      if (authError) {
        console.error("Auth signup error:", authError);
        toast.error(authError.message);
        return false;
      }

      if (authData.user) {
        // Generate a room code
        const newRoomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        
        // Insert teacher details into teachers table
        const { error: teacherError } = await supabase
          .from('teachers')
          .insert({
            id: authData.user.id,
            name,
            email,
            password_hash: '' // Note: passwords are handled by Supabase Auth
          });

        if (teacherError) {
          console.error("Teacher record creation error:", teacherError);
          toast.error(teacherError.message);
          return false;
        }

        const teacherUser: User = {
          id: authData.user.id,
          name,
          role: 'teacher',
          email
        };

        setUser(teacherUser);
        setRoomCode(newRoomCode);
        
        toast.success(`Welcome, ${name}! Your account has been created.`);
        navigate("/teacher", { replace: true }); // Use replace to prevent back button issues
        return true;
      }

      return false;
    } catch (error) {
      console.error("Signup error:", error);
      toast.error("Signup failed");
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const teacherLogin = async (email: string, password: string) => {
    try {
      setIsLoading(true);
      console.log("Starting teacher login process");
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        console.error("Login error:", error);
        if (error.message === "Invalid login credentials") {
          toast.error("Wrong credentials, please try again");
        } else {
          toast.error(error.message);
        }
        return false;
      }

      if (data.user) {
        // Fetch teacher details from Supabase
        const { data: teacherData, error: teacherError } = await supabase
          .from('teachers')
          .select('*')
          .eq('id', data.user.id)
          .single();

        if (teacherError) {
          console.error("Teacher fetch error:", teacherError);
          toast.error(teacherError.message);
          return false;
        }

        const teacherUser: User = {
          id: teacherData.id,
          name: teacherData.name,
          role: 'teacher',
          email: teacherData.email
        };

        setUser(teacherUser);
        
        // Fetch active quiz to get room code
        const { data: quizData } = await supabase
          .from('quizzes')
          .select('*')
          .eq('created_by', teacherData.id)
          .eq('is_active', true)
          .maybeSingle();
          
        if (quizData) {
          setRoomCode(quizData.room_code);
        } else {
          // No active quiz, so we'll create a new room code if needed when launching a quiz
          setRoomCode(null);
        }
        
        toast.success(`Welcome back, ${teacherData.name}!`);
        navigate("/teacher", { replace: true }); // Use replace to prevent back button issues
        return true;
      }

      return false;
    } catch (error) {
      console.error("Login error:", error);
      toast.error("Login failed");
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const login = (name: string, role: UserRole) => {
    // For simplicity, we're creating an ID based on timestamp + random
    const user = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      name,
      role
    };
    
    setUser(user);
    localStorage.setItem("quizUser", JSON.stringify(user));
    
    if (role === "teacher") {
      // Generate a random 6-character code for the teacher's room
      const newRoomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      setRoomCode(newRoomCode);
      localStorage.setItem("quizRoomCode", newRoomCode);
      
      toast.success(`Logged in as teacher: ${name}`);
      
      // Redirect to teacher dashboard
      navigate("/teacher");
    } else {
      toast.success(`Logged in as student: ${name}`);
      
      // Redirect to student dashboard
      navigate("/student");
    }
  };

  const resetPassword = async (email: string): Promise<boolean> => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/`,
      });

      if (error) {
        console.error('Password reset error:', error);
        toast.error(error.message || 'Failed to send reset email');
        return false;
      }

      toast.success('Password reset email sent! Check your inbox.');
      return true;
    } catch (error) {
      console.error('Password reset error:', error);
      toast.error('An unexpected error occurred');
      return false;
    }
  };

  const updatePassword = async (newPassword: string): Promise<boolean> => {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) {
        console.error('Password update error:', error);
        toast.error(error.message || 'Failed to update password');
        return false;
      }

      setIsPasswordRecovery(false);
      toast.success('Password updated successfully!');
      navigate("/", { replace: true });
      return true;
    } catch (error) {
      console.error('Password update error:', error);
      toast.error('An unexpected error occurred');
      return false;
    }
  };

  const logout = async () => {
    try {
      // Sign out from Supabase Auth
      await supabase.auth.signOut();
      
      setUser(null);
      setRoomCode(null);
      localStorage.removeItem("quizUser");
      localStorage.removeItem("quizRoomCode");
      navigate("/");
      toast.info("Logged out successfully");
    } catch (error) {
      console.error("Logout error:", error);
      toast.error("Failed to logout");
    }
  };

  if (isLoading) {
    return null; // or return a loading spinner
  }

  return (
    <AuthContext.Provider value={{ 
      user, 
      login, 
      teacherLogin, 
      teacherSignup, 
      resetPassword, 
      updatePassword, 
      logout, 
      roomCode, 
      setRoomCode, 
      isPasswordRecovery, 
      setIsPasswordRecovery 
    }}>
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
