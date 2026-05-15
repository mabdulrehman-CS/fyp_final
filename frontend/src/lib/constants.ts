// Navigation items for candidate portal
export const candidateNavItems = [
  {
    title: 'Dashboard',
    href: '/candidate/dashboard',
    icon: 'LayoutDashboard',
  },
  {
    title: 'Profile',
    href: '/candidate/profile',
    icon: 'User',
  },
  {
    title: 'Interview Room',
    href: '/candidate/interview',
    icon: 'Video',
  },
  {
    title: 'Reports',
    href: '/candidate/reports',
    icon: 'FileText',
  },
  {
    title: 'Recommendations',
    href: '/candidate/recommendations',
    icon: 'BookOpen',
  },
  {
    title: 'Settings',
    href: '/candidate/settings',
    icon: 'Settings',
  },
] as const;

// Navigation items for admin portal
export const adminNavItems = [
  {
    title: 'Dashboard',
    href: '/admin/dashboard',
    icon: 'LayoutDashboard',
  },
  {
    title: 'Question Bank',
    href: '/admin/questions',
    icon: 'HelpCircle',
  },
  {
    title: 'Test Cases',
    href: '/admin/test-cases',
    icon: 'FileCode',
  },
  {
    title: 'Users',
    href: '/admin/users',
    icon: 'Users',
  },
  {
    title: 'Sessions',
    href: '/admin/sessions',
    icon: 'PlayCircle',
  },
  {
    title: 'Rubrics',
    href: '/admin/rubrics',
    icon: 'Sliders',
  },
  {
    title: 'Settings',
    href: '/admin/settings',
    icon: 'Settings',
  },
] as const;

// Difficulty colors
export const difficultyColors = {
  easy: 'bg-success/20 text-success',
  medium: 'bg-warning/20 text-warning',
  hard: 'bg-destructive/20 text-destructive',
  beginner: 'bg-success/20 text-success',
  intermediate: 'bg-warning/20 text-warning',
  advanced: 'bg-destructive/20 text-destructive',
} as const;

// Category colors
export const categoryColors = {
  technical: 'bg-primary/20 text-primary',
  behavioral: 'bg-accent/20 text-accent',
  hr: 'bg-purple-500/20 text-purple-400',
  soft_skills: 'bg-accent/20 text-accent',
  industry: 'bg-blue-500/20 text-blue-400',
} as const;

// Status colors
export const statusColors = {
  pending: 'bg-muted text-muted-foreground',
  in_progress: 'bg-warning/20 text-warning',
  completed: 'bg-success/20 text-success',
  cancelled: 'bg-destructive/20 text-destructive',
  not_started: 'bg-muted text-muted-foreground',
} as const;

// Supported programming languages
export const programmingLanguages = [
  { value: 'javascript', label: 'JavaScript', extension: 'js' },
  { value: 'typescript', label: 'TypeScript', extension: 'ts' },
  { value: 'python', label: 'Python', extension: 'py' },
  { value: 'java', label: 'Java', extension: 'java' },
  { value: 'cpp', label: 'C++', extension: 'cpp' },
  { value: 'go', label: 'Go', extension: 'go' },
] as const;

// Default interview time limit in minutes
export const DEFAULT_INTERVIEW_TIME_LIMIT = 15;

// Animation variants for Framer Motion
export const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
};

export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

export const scaleIn = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 },
};

export const slideInRight = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 },
};

export const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};
