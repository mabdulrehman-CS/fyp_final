import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { ProtectedRoute } from "@/components/shared/ProtectedRoute";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Auth from "./pages/auth/Auth";
import AdminLogin from "./pages/admin/AdminLogin";
import CandidateDashboard from "./pages/candidate/Dashboard";
import CandidateProfile from "./pages/candidate/Profile";
import CandidateInterview from "./pages/candidate/Interview";
import CandidateSessions from "./pages/candidate/Sessions";
import CandidateReports from "./pages/candidate/Reports";
import CandidateRecommendations from "./pages/candidate/Recommendations";
import CandidateSettings from "./pages/candidate/Settings";
import AdminDashboard from "./pages/admin/Dashboard";
import AdminQuestions from "./pages/admin/Questions";
import AdminTestCases from "./pages/admin/TestCases";
import AdminUsers from "./pages/admin/Users";
import AdminSessions from "./pages/admin/Sessions";
import AdminRubrics from "./pages/admin/Rubrics";
import AdminSettings from "./pages/admin/Settings";

// New AI Interview Pages
import PreCheck from "./pages/candidate/PreCheck";
import InterviewRoom from "./pages/candidate/InterviewRoom";
import CodingSandbox from "./pages/candidate/CodingSandbox";
import ReportView from "./pages/candidate/ReportView";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <ErrorBoundary>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/admin/login" element={<AdminLogin />} />
              
              {/* Candidate Routes */}
              <Route path="/candidate/dashboard" element={<ProtectedRoute><CandidateDashboard /></ProtectedRoute>} />
              <Route path="/candidate/profile" element={<ProtectedRoute><CandidateProfile /></ProtectedRoute>} />
              <Route path="/candidate/interview" element={<ProtectedRoute><CandidateInterview /></ProtectedRoute>} />
              <Route path="/candidate/sessions" element={<ProtectedRoute><CandidateSessions /></ProtectedRoute>} />
              <Route path="/candidate/reports" element={<ProtectedRoute><CandidateReports /></ProtectedRoute>} />
              <Route path="/candidate/recommendations" element={<ProtectedRoute><CandidateRecommendations /></ProtectedRoute>} />
              <Route path="/candidate/settings" element={<ProtectedRoute><CandidateSettings /></ProtectedRoute>} />
              
              {/* AI Interview Flow */}
              <Route path="/pre-check" element={<ProtectedRoute><PreCheck /></ProtectedRoute>} />
              <Route path="/interview/:sessionId" element={<ProtectedRoute><InterviewRoom /></ProtectedRoute>} />
              <Route path="/interview/:sessionId/coding" element={<ProtectedRoute><CodingSandbox /></ProtectedRoute>} />
              <Route path="/interview/:sessionId/report" element={<ProtectedRoute><ReportView /></ProtectedRoute>} />
              
              {/* Admin Routes */}
              <Route path="/admin/dashboard" element={<ProtectedRoute requireAdmin><AdminDashboard /></ProtectedRoute>} />
              <Route path="/admin/questions" element={<ProtectedRoute requireAdmin><AdminQuestions /></ProtectedRoute>} />
              <Route path="/admin/test-cases" element={<ProtectedRoute requireAdmin><AdminTestCases /></ProtectedRoute>} />
              <Route path="/admin/users" element={<ProtectedRoute requireAdmin><AdminUsers /></ProtectedRoute>} />
              <Route path="/admin/sessions" element={<ProtectedRoute requireAdmin><AdminSessions /></ProtectedRoute>} />
              <Route path="/admin/rubrics" element={<ProtectedRoute requireAdmin><AdminRubrics /></ProtectedRoute>} />
              <Route path="/admin/settings" element={<ProtectedRoute requireAdmin><AdminSettings /></ProtectedRoute>} />
              
              <Route path="*" element={<NotFound />} />
            </Routes>
          </ErrorBoundary>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
