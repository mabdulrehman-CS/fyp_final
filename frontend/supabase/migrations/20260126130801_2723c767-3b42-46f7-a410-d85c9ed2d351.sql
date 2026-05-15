-- Create role enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'candidate');

-- Create profiles table
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    full_name TEXT,
    email TEXT,
    avatar_url TEXT,
    phone TEXT,
    bio TEXT,
    cv_url TEXT,
    cv_parsed_at TIMESTAMP WITH TIME ZONE,
    skills TEXT[] DEFAULT '{}',
    experience JSONB DEFAULT '[]',
    education JSONB DEFAULT '[]',
    is_blocked BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Create questions table
CREATE TABLE public.questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('technical', 'behavioral', 'hr')),
    difficulty TEXT NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
    tags TEXT[] DEFAULT '{}',
    expected_answer TEXT,
    time_limit INTEGER DEFAULT 120,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create test_cases table
CREATE TABLE public.test_cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE,
    input TEXT NOT NULL,
    expected_output TEXT NOT NULL,
    is_hidden BOOLEAN DEFAULT false,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create interviews table
CREATE TABLE public.interviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    technical_score NUMERIC(5,2),
    behavioral_score NUMERIC(5,2),
    coding_score NUMERIC(5,2),
    overall_score NUMERIC(5,2),
    transcript JSONB DEFAULT '[]',
    code_submissions JSONB DEFAULT '[]',
    recording_url TEXT,
    feedback TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create reports table
CREATE TABLE public.reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    interview_id UUID REFERENCES public.interviews(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    sections JSONB NOT NULL DEFAULT '[]',
    strengths TEXT[] DEFAULT '{}',
    weaknesses TEXT[] DEFAULT '{}',
    recommendations TEXT[] DEFAULT '{}',
    pdf_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create courses table
CREATE TABLE public.courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL CHECK (category IN ('technical', 'soft_skills', 'industry')),
    difficulty TEXT NOT NULL CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
    duration_hours INTEGER,
    thumbnail_url TEXT,
    url TEXT NOT NULL,
    tags TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_courses table (progress tracking)
CREATE TABLE public.user_courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
    status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed')),
    progress INTEGER DEFAULT 0,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, course_id)
);

-- Create rubrics table
CREATE TABLE public.rubrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    technical_weight NUMERIC(5,2) NOT NULL DEFAULT 60,
    behavioral_weight NUMERIC(5,2) NOT NULL DEFAULT 40,
    subcategories JSONB DEFAULT '[]',
    is_default BOOLEAN DEFAULT false,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create platform_settings table
CREATE TABLE public.platform_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL,
    value JSONB NOT NULL,
    updated_by UUID REFERENCES auth.users(id),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create activity_logs table
CREATE TABLE public.activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id UUID,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rubrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = _user_id
          AND role = _role
    )
$$;

-- Create function to get current user's roles
CREATE OR REPLACE FUNCTION public.get_my_roles()
RETURNS SETOF app_role
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT role FROM public.user_roles WHERE user_id = auth.uid()
$$;

-- Profiles policies
CREATE POLICY "Users can view their own profile" 
ON public.profiles FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" 
ON public.profiles FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" 
ON public.profiles FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all profiles" 
ON public.profiles FOR SELECT 
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update all profiles" 
ON public.profiles FOR UPDATE 
USING (public.has_role(auth.uid(), 'admin'));

-- User roles policies
CREATE POLICY "Users can view their own roles" 
ON public.user_roles FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles" 
ON public.user_roles FOR ALL 
USING (public.has_role(auth.uid(), 'admin'));

-- Questions policies (admins full access, candidates read-only)
CREATE POLICY "Anyone authenticated can view questions" 
ON public.questions FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Admins can manage questions" 
ON public.questions FOR ALL 
USING (public.has_role(auth.uid(), 'admin'));

-- Test cases policies
CREATE POLICY "Authenticated users can view non-hidden test cases" 
ON public.test_cases FOR SELECT 
TO authenticated
USING (NOT is_hidden);

CREATE POLICY "Admins can view all test cases" 
ON public.test_cases FOR SELECT 
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage test cases" 
ON public.test_cases FOR ALL 
USING (public.has_role(auth.uid(), 'admin'));

-- Interviews policies
CREATE POLICY "Users can view their own interviews" 
ON public.interviews FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own interviews" 
ON public.interviews FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own interviews" 
ON public.interviews FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all interviews" 
ON public.interviews FOR SELECT 
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update all interviews" 
ON public.interviews FOR UPDATE 
USING (public.has_role(auth.uid(), 'admin'));

-- Reports policies
CREATE POLICY "Users can view their own reports" 
ON public.reports FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all reports" 
ON public.reports FOR ALL 
USING (public.has_role(auth.uid(), 'admin'));

-- Courses policies (public read)
CREATE POLICY "Anyone can view courses" 
ON public.courses FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Admins can manage courses" 
ON public.courses FOR ALL 
USING (public.has_role(auth.uid(), 'admin'));

-- User courses policies
CREATE POLICY "Users can view their own course progress" 
ON public.user_courses FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own course progress" 
ON public.user_courses FOR ALL 
USING (auth.uid() = user_id);

-- Rubrics policies
CREATE POLICY "Authenticated users can view rubrics" 
ON public.rubrics FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Admins can manage rubrics" 
ON public.rubrics FOR ALL 
USING (public.has_role(auth.uid(), 'admin'));

-- Platform settings policies
CREATE POLICY "Authenticated users can view settings" 
ON public.platform_settings FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Admins can manage settings" 
ON public.platform_settings FOR ALL 
USING (public.has_role(auth.uid(), 'admin'));

-- Activity logs policies
CREATE POLICY "Users can view their own activity" 
ON public.activity_logs FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all activity" 
ON public.activity_logs FOR SELECT 
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can insert activity" 
ON public.activity_logs FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Add triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_questions_updated_at BEFORE UPDATE ON public.questions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_test_cases_updated_at BEFORE UPDATE ON public.test_cases FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_interviews_updated_at BEFORE UPDATE ON public.interviews FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_user_courses_updated_at BEFORE UPDATE ON public.user_courses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_rubrics_updated_at BEFORE UPDATE ON public.rubrics FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (user_id, email, full_name)
    VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
    
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'candidate');
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger for new user registration
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Insert default platform settings
INSERT INTO public.platform_settings (key, value) VALUES 
('interview_time_limit', '{"minutes": 15}'),
('features', '{"cv_parsing": true, "ai_questions": true, "code_execution": true}');

-- Insert default rubric
INSERT INTO public.rubrics (name, description, technical_weight, behavioral_weight, is_default, subcategories) VALUES 
('Default Rubric', 'Standard interview scoring rubric', 60, 40, true, '[
    {"name": "Problem Solving", "weight": 25, "category": "technical"},
    {"name": "Code Quality", "weight": 20, "category": "technical"},
    {"name": "System Design", "weight": 15, "category": "technical"},
    {"name": "Communication", "weight": 20, "category": "behavioral"},
    {"name": "Adaptability", "weight": 20, "category": "behavioral"}
]');

-- Insert sample courses
INSERT INTO public.courses (title, description, category, difficulty, duration_hours, url, tags) VALUES 
('Advanced Python Programming', 'Master advanced Python concepts including decorators, generators, and async programming', 'technical', 'advanced', 20, 'https://example.com/python', ARRAY['python', 'programming', 'backend']),
('Data Structures & Algorithms', 'Comprehensive course on DSA with coding exercises', 'technical', 'intermediate', 30, 'https://example.com/dsa', ARRAY['algorithms', 'data-structures', 'coding']),
('System Design Fundamentals', 'Learn to design scalable distributed systems', 'technical', 'advanced', 25, 'https://example.com/system-design', ARRAY['system-design', 'architecture', 'scalability']),
('Effective Communication Skills', 'Improve your professional communication', 'soft_skills', 'beginner', 10, 'https://example.com/communication', ARRAY['communication', 'soft-skills', 'interview']),
('Leadership in Tech', 'Develop leadership skills for technical roles', 'soft_skills', 'intermediate', 15, 'https://example.com/leadership', ARRAY['leadership', 'management', 'soft-skills'])