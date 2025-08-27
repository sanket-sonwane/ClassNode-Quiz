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
  logout: () => void;
  roomCode: string | null;
  setRoomCode: (code: string | null) => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Check for existing Supabase session
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
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
              .single();
              
            if (quizData) {
              setRoomCode(quizData.room_code);
            }
            
            navigate("/teacher");
          }
        }
      } catch (error) {
        console.error("Session check error:", error);
      } finally {
        setIsLoading(false);
      }
    };

    checkSession();
  }, []);

  useEffect(() => {
    if (user && location.pathname !== "/reset-password") {
      if (user.role === "teacher") {
        navigate("/teacher");
      } else if (user.role === "student") {
        navigate("/student");
      }
    }
  }, [user, location.pathname]);

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
        navigate("/teacher");
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
        toast.error(error.message);
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
          .single();
          
        if (quizData) {
          setRoomCode(quizData.room_code);
        } else {
          // No active quiz, so we'll create a new room code if needed when launching a quiz
          setRoomCode(null);
        }
        
        toast.success(`Welcome back, ${teacherData.name}!`);
        navigate("/teacher");
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

  const logout = () => {
    setUser(null);
    setRoomCode(null);
    localStorage.removeItem("quizUser");
    localStorage.removeItem("quizRoomCode");
    navigate("/");
    toast.info("Logged out successfully");
  };

  if (isLoading) {
    return null; // or return a loading spinner
  }

  return (
    <AuthContext.Provider value={{ user, login, teacherLogin, teacherSignup, logout, roomCode, setRoomCode }}>
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
