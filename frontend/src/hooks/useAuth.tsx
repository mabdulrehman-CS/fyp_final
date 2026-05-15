import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { authAPI, userAPI, User, setToken, getToken } from '@/lib/api';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isCandidate: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch user profile
  const fetchUser = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    try {
      const userData = await userAPI.getMe();
      setUser(userData);
    } catch (error) {
      console.error('Error fetching user:', error);
      // Token might be invalid, clear it
      setToken(null);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Check for existing token on mount
  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const signIn = async (email: string, password: string) => {
    try {
      await authAPI.login(email, password);
      // Fetch user data after successful login
      const userData = await userAPI.getMe();
      setUser(userData);
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signUp = async (email: string, password: string, fullName?: string) => {
    try {
      // Register the user
      await authAPI.signup({
        email,
        password,
        name: fullName,
      });

      // Auto-login after signup
      await authAPI.login(email, password);
      const userData = await userAPI.getMe();
      setUser(userData);

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signOut = async () => {
    authAPI.logout();
    setUser(null);
  };

  const refreshUser = async () => {
    await fetchUser();
  };

  const isAuthenticated = !!user;
  const isAdmin = user?.role === 'admin';
  const isCandidate = user?.role === 'candidate';

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated,
        isAdmin,
        isCandidate,
        signIn,
        signUp,
        signOut,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

