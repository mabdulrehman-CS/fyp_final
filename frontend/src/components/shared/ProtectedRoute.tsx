import { ReactNode, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: ReactNode;
  requireAdmin?: boolean;
}

export function ProtectedRoute({ children, requireAdmin = false }: ProtectedRouteProps) {
  const { isAuthenticated, isAdmin, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      // Redirect to appropriate login page based on the attempted route
      if (location.pathname.startsWith('/admin')) {
        navigate('/admin/login', { replace: true, state: { from: location.pathname } });
      } else {
        navigate('/auth', { replace: true, state: { from: location.pathname } });
      }
      return;
    }

    if (requireAdmin && !isAdmin) {
      // Authenticated as candidate but trying to access admin route
      navigate('/candidate/dashboard', { replace: true });
      return;
    }

    if (!requireAdmin && isAdmin) {
      // Authenticated as admin but trying to access candidate route
      // (Optional: depending on your app rules, admins might not need candidate routes)
      if (location.pathname.startsWith('/candidate') || location.pathname.startsWith('/interview')) {
        navigate('/admin/dashboard', { replace: true });
      }
      return;
    }
  }, [isAuthenticated, isAdmin, isLoading, navigate, location, requireAdmin]);

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Prevent rendering children if unauthorized (while redirect is processing)
  if (!isAuthenticated) return null;
  if (requireAdmin && !isAdmin) return null;
  if (!requireAdmin && isAdmin && (location.pathname.startsWith('/candidate') || location.pathname.startsWith('/interview'))) return null;

  return <>{children}</>;
}
