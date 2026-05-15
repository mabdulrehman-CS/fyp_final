// User and Auth types
export interface User {
  id: string;
  email: string;
  role: 'admin' | 'candidate';
  status: string;
  profile_info?: {
    name?: string;
    phone?: string;
    photo_url?: string;
    cv_url?: string;
    cv_parsed?: Record<string, unknown>;
    bio?: string;
    skills?: string[];
    experience?: Experience[];
    education?: Education[];
  };
  created_at: string;
  last_login?: string;
}

export interface Profile {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  phone: string | null;
  bio: string | null;
  cv_url: string | null;
  cv_parsed_at: string | null;
  skills: string[];
  experience: Experience[];
  education: Education[];
  is_blocked: boolean;
  created_at: string;
  updated_at: string;
}


export interface Experience {
  company: string;
  role: string;
  duration: string;
  description?: string;
}

export interface Education {
  institution: string;
  degree: string;
  field: string;
  year: string;
}

export type AppRole = 'admin' | 'candidate';

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
}

// Interview types
export interface Interview {
  id: string;
  user_id: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  started_at: string | null;
  completed_at: string | null;
  technical_score: number | null;
  behavioral_score: number | null;
  coding_score: number | null;
  overall_score: number | null;
  transcript: TranscriptEntry[];
  code_submissions: CodeSubmission[];
  recording_url: string | null;
  feedback: string | null;
  created_at: string;
  updated_at: string;
}

export interface TranscriptEntry {
  role: 'user' | 'ai';
  content: string;
  timestamp: string;
}

export interface CodeSubmission {
  language: string;
  code: string;
  question_id: string;
  passed_tests: number;
  total_tests: number;
  submitted_at: string;
}

// Question types
export interface Question {
  id: string;
  title: string;
  content: string;
  category: 'technical' | 'behavioral' | 'hr';
  difficulty: 'easy' | 'medium' | 'hard';
  tags: string[];
  expected_answer: string | null;
  time_limit: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TestCase {
  id: string;
  question_id: string | null;
  input: string;
  expected_output: string;
  is_hidden: boolean;
  description: string | null;
  created_at: string;
  updated_at: string;
}

// Report types
export interface Report {
  id: string;
  interview_id: string;
  user_id: string;
  sections: ReportSection[];
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  pdf_url: string | null;
  created_at: string;
}

export interface ReportSection {
  name: string;
  score: number;
  maxScore: number;
  feedback: string;
}

// Course types
export interface Course {
  id: string;
  title: string;
  description: string | null;
  category: 'technical' | 'soft_skills' | 'industry';
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  duration_hours: number | null;
  thumbnail_url: string | null;
  url: string;
  tags: string[];
  created_at: string;
}

export interface UserCourse {
  id: string;
  user_id: string;
  course_id: string;
  status: 'not_started' | 'in_progress' | 'completed';
  progress: number;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

// Rubric types
export interface Rubric {
  id: string;
  name: string;
  description: string | null;
  technical_weight: number;
  behavioral_weight: number;
  subcategories: RubricSubcategory[];
  is_default: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface RubricSubcategory {
  name: string;
  weight: number;
  category: 'technical' | 'behavioral';
}

// Platform settings
export interface PlatformSettings {
  interview_time_limit: { minutes: number };
  features: {
    cv_parsing: boolean;
    ai_questions: boolean;
    code_execution: boolean;
  };
}

// Activity log
export interface ActivityLog {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

// Stats types
export interface DashboardStats {
  totalInterviews: number;
  recentInterviews: number;
  averageScore: number;
  completedInterviews: number;
}

export interface AdminStats {
  totalUsers: number;
  liveInterviews: number;
  totalQuestions: number;
  questionsByCategory: { category: string; count: number }[];
  userGrowth: { month: string; count: number }[];
}
