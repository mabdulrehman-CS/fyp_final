/**
 * API Client for FastAPI Backend
 * Replaces Supabase with direct FastAPI calls
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

// Token management
let accessToken: string | null = localStorage.getItem('access_token');

export const setToken = (token: string | null) => {
  accessToken = token;
  if (token) {
    localStorage.setItem('access_token', token);
  } else {
    localStorage.removeItem('access_token');
  }
};

export const getToken = () => accessToken;

// Helper function for API calls
async function apiCall<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (accessToken) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${accessToken}`;
  }

  const url = `${API_BASE_URL}${endpoint}`;
  
  const response = await fetch(url, {
    ...options,
    headers,
  });

    if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'An error occurred' }));
    console.error(`[API] Error:`, error);
    throw new Error(error.detail || `HTTP error! status: ${response.status}`);
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

// Form data API call (for file uploads)
async function apiCallFormData<T>(
  endpoint: string,
  formData: FormData
): Promise<T> {
  const headers: HeadersInit = {};

  if (accessToken) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${accessToken}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'An error occurred' }));
    throw new Error(error.detail || `HTTP error! status: ${response.status}`);
  }

  return response.json();
}

// ==================== AUTH API ====================

export interface SignupRequest {
  email: string;
  password: string;
  name?: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
}

export interface User {
  id: string;
  email: string;
  role: 'admin' | 'candidate';
  status: string;
  profile_info?: {
    name?: string;
    phone?: string;
    photo_url?: string;
    photo_filename?: string;
    cv_url?: string;
    cv_filename?: string;
    cv_original_name?: string;
    cv_uploaded_at?: string;
    cv_parsed?: Record<string, unknown>;
    bio?: string;
    skills?: string[];
    experience?: string;
    education?: Array<{ institution?: string; degree?: string; field?: string; start_date?: string; end_date?: string }>;
    work_experience?: Array<{ company?: string; title?: string; description?: string; start_date?: string; end_date?: string; location?: string }>;
    projects?: Array<{ title?: string; description?: string; technologies?: string; github_url?: string; start_date?: string; end_date?: string }>;
    location?: string;
    linkedin?: string;
    github?: string;
    portfolio?: string;
  };
  created_at: string;
}

export const authAPI = {
  checkEmail: async (email: string): Promise<{ exists: boolean }> => {
    return apiCall(`/auth/check-email?email=${encodeURIComponent(email)}`);
  },
  signup: async (data: SignupRequest): Promise<User> => {
    return apiCall('/auth/signup', { method: 'POST', body: JSON.stringify(data) });
  },
  login: async (email: string, password: string): Promise<LoginResponse> => {
    const formData = new URLSearchParams();
    formData.append('username', email);
    formData.append('password', password);
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData,
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Login failed' }));
      throw new Error(error.detail || 'Login failed');
    }
    const data = await response.json();
    setToken(data.access_token);
    return data;
  },
  logout: () => { setToken(null); },
  forgotPassword: async (email: string): Promise<{ message: string }> => {
    return apiCall('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) });
  },
  verifyResetOTP: async (email: string, otp: string): Promise<{ valid: boolean }> => {
    return apiCall('/auth/verify-reset-otp', { method: 'POST', body: JSON.stringify({ email, otp }) });
  },
  resetPassword: async (email: string, otp: string, newPassword: string): Promise<{ message: string }> => {
    return apiCall('/auth/reset-password', { method: 'POST', body: JSON.stringify({ email, otp, new_password: newPassword }) });
  },
};

// ==================== USER API ====================

export interface ProfileUpdate {
  profile_info?: Record<string, unknown>;
  status?: string;
}

export interface PasswordChangeRequest {
  current_password: string;
  new_password: string;
  confirm_password: string;
}

export const userAPI = {
  getMe: async (): Promise<User> => apiCall('/users/me'),
  updateMe: async (data: ProfileUpdate): Promise<User> => {
    return apiCall('/users/me', { method: 'PUT', body: JSON.stringify(data) });
  },
  changePassword: async (data: PasswordChangeRequest): Promise<{ message: string }> => {
    return apiCall('/users/me/change-password', { method: 'POST', body: JSON.stringify(data) });
  },
  updateEmail: async (newEmail: string): Promise<{ message: string }> => {
    return apiCall('/users/me/update-email', { method: 'POST', body: JSON.stringify({ new_email: newEmail }) });
  },
  uploadPhoto: async (file: File): Promise<{ photo_url: string }> => {
    const formData = new FormData();
    formData.append('file', file);
    return apiCallFormData('/users/me/photo', formData);
  },
  uploadCV: async (file: File): Promise<any> => {
    const formData = new FormData();
    formData.append('file', file);
    return apiCallFormData('/users/me/upload-cv?parse=true', formData);
  },
  parseCV: async (): Promise<any> => {
    // Parsing now happens during upload with parse=true
    return { cv_parsed: true };
  },
  deleteAccount: async (reason: string): Promise<{ message: string }> => {
    return apiCall('/users/me/delete-account', { method: 'POST', body: JSON.stringify({ reason }) });
  },
  updateNotificationPreferences: async (prefs: Record<string, boolean>): Promise<{ message: string }> => {
    return apiCall('/users/me/notification-preferences', { method: 'POST', body: JSON.stringify(prefs) });
  },
  getNotificationPreferences: async (): Promise<Record<string, boolean>> => {
    return apiCall('/users/me/notification-preferences');
  },
};

// ==================== QUESTIONS API ====================

export interface Question {
  id: string;
  title: string;
  category: string;
  difficulty: string;
  description: string;
  programming_subcategory?: string;
  created_at: string;
}

export interface QuestionCreate {
  title: string;
  category: string;
  difficulty: string;
  description: string;
  programming_subcategory?: string;
}

export interface QuestionsResponse {
  items: Question[];
  total: number;
  page: number;
  limit: number;
}

export interface GenerateQuestionsRequest {
  prompt: string;
  category: string;
  difficulty: string;
  programming_subcategory?: string;
  count: number;
}

export const questionsAPI = {
  list: async (params: {
    page?: number; limit?: number; search?: string; category?: string;
    programming_subcategory?: string; difficulty?: string;
  } = {}): Promise<QuestionsResponse> => {
    const qp = new URLSearchParams();
    if (params.page) qp.append('page', params.page.toString());
    if (params.limit) qp.append('limit', params.limit.toString());
    if (params.search) qp.append('search', params.search);
    if (params.category) qp.append('category', params.category);
    if (params.programming_subcategory) qp.append('programming_subcategory', params.programming_subcategory);
    if (params.difficulty) qp.append('difficulty', params.difficulty);
    const qs = qp.toString();
    return apiCall(qs ? `/questions?${qs}` : '/questions');
  },
  getSubcategories: async (): Promise<string[]> => {
    const response = await apiCall<{ subcategories: string[] }>('/questions/programming-subcategories');
    return response.subcategories || [];
  },
  get: async (id: string): Promise<Question> => apiCall(`/questions/${id}`),
  create: async (data: QuestionCreate): Promise<Question> => {
    return apiCall('/questions', { method: 'POST', body: JSON.stringify(data) });
  },
  createBulk: async (data: QuestionCreate[]): Promise<{ message: string; inserted_ids: string[] }> => {
    return apiCall('/questions/bulk', { method: 'POST', body: JSON.stringify(data) });
  },
  update: async (id: string, data: Partial<QuestionCreate>): Promise<Question> => {
    return apiCall(`/questions/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },
  delete: async (id: string): Promise<void> => {
    return apiCall(`/questions/${id}`, { method: 'DELETE' });
  },
  generate: async (data: GenerateQuestionsRequest): Promise<Question[]> => {
    return apiCall('/questions/generate', { method: 'POST', body: JSON.stringify(data) });
  },
};

// ==================== TEST CASES API ====================

export interface TestCase {
  id: string;
  question_id: string;
  input: string;
  output: string;
  is_hidden: boolean;
}

export interface TestCaseCreate {
  question_id: string;
  input: string;
  output: string;
  is_hidden?: boolean;
}

export const testCasesAPI = {
  listCodingProblems: async (): Promise<any[]> => apiCall('/coding-problems'),
  listForQuestion: async (questionId: string): Promise<TestCase[]> => apiCall(`/testcases/${questionId}`),
  create: async (data: TestCaseCreate): Promise<TestCase> => {
    return apiCall('/testcases', { method: 'POST', body: JSON.stringify(data) });
  },
  createBulk: async (data: TestCaseCreate[]): Promise<{ message: string; inserted_ids: string[] }> => {
    return apiCall('/testcases/bulk', { method: 'POST', body: JSON.stringify(data) });
  },
  update: async (id: string, data: Partial<TestCaseCreate>): Promise<TestCase> => {
    return apiCall(`/testcases/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },
  delete: async (id: string): Promise<void> => {
    return apiCall(`/testcases/${id}`, { method: 'DELETE' });
  },
};

// ==================== SESSIONS API ====================

export interface Session {
  id: string;
  candidate_id: string;
  candidate_name: string;
  candidate_email: string;
  interview_type: string;
  status: 'active' | 'completed' | 'cancelled';
  current_question: number;
  total_questions: number;
  score?: number;
  duration_minutes?: number;
  created_at: string;
  completed_at?: string;
  duration?: string;
  progress?: number;
  start_time?: string;
  question?: string;
}

export interface SessionsResponse {
  items: Session[];
  total: number;
  page: number;
  limit: number;
}

export const sessionsAPI = {
  getLive: async (page = 1, limit = 10): Promise<SessionsResponse> => {
    return apiCall(`/admin/sessions/live?page=${page}&limit=${limit}`);
  },
  getHistory: async (page = 1, limit = 10): Promise<SessionsResponse> => {
    return apiCall(`/admin/sessions/history?page=${page}&limit=${limit}`);
  },
  get: async (id: string): Promise<Session> => apiCall(`/admin/sessions/${id}`),
};

// ==================== ADMIN API ====================

export interface Rubric {
  id: string;
  name: string;
  weight: number;
  description?: string;
}

export interface Settings {
  id: string;
  passingThresholdCoding: number;
  passingThresholdBehavioral: number;
  passingThresholdTechnical: number;
  [key: string]: unknown;
}

export interface DashboardStats {
  totalCandidates: number;
  activeSessions: number;
  completedInterviews: number;
  totalQuestions: number;
  averageScore: number;
  recentActivity: Array<{
    action: string;
    admin_email: string;
    timestamp: string;
    metadata?: Record<string, unknown>;
  }>;
  newUsersTrend?: Array<{ day: string; date: string; new_users: number; }>;
  categoryDistribution?: Array<{ name: string; value: number; }>;
}

interface BackendDashboardStats {
  total_candidates: number;
  active_sessions: number;
  total_questions: number;
  completed_sessions: number;
  recent_activity: Array<{
    action: string;
    admin_email: string;
    timestamp: string;
    metadata?: Record<string, unknown>;
  }>;
  new_users_trend?: Array<{ day: string; date: string; new_users: number; }>;
  category_distribution?: Array<{ name: string; value: number; }>;
}

export interface Candidate {
  id: string;
  email: string;
  full_name: string;
  role: string;
  status: string;
  profile_info?: { name?: string; phone?: string; };
  created_at: string;
  last_login?: string;
  sessionsCount?: number;
  avgScore?: number;
  lastInterview?: string;
}

interface BackendCandidate {
  id: string;
  email: string;
  role: string;
  status: string;
  profile_info?: { name?: string; phone?: string; };
  created_at: string;
}

export interface CandidatesResponse {
  items: Candidate[];
  total: number;
  page: number;
  limit: number;
}

export const adminAPI = {
  getProfile: async (): Promise<{ email: string; role: string; name: string }> => apiCall('/admin/profile'),
  changePassword: async (data: PasswordChangeRequest): Promise<{ message: string }> => {
    return apiCall('/admin/change-password', { method: 'POST', body: JSON.stringify(data) });
  },
  getRubrics: async (): Promise<Rubric[]> => apiCall('/admin/rubrics'),
  updateRubrics: async (rubrics: Rubric[]): Promise<{ status: string }> => {
    return apiCall('/admin/rubrics', { method: 'POST', body: JSON.stringify(rubrics) });
  },
  getSettings: async (): Promise<Settings> => apiCall('/admin/settings'),
  updateSettings: async (settings: Partial<Settings>): Promise<{ status: string }> => {
    return apiCall('/admin/settings', { method: 'POST', body: JSON.stringify(settings) });
  },
  getDashboardStats: async (): Promise<DashboardStats> => {
    const data = await apiCall<BackendDashboardStats>('/admin/stats');
    return {
      totalCandidates: data.total_candidates || 0,
      activeSessions: data.active_sessions || 0,
      completedInterviews: data.completed_sessions || 0,
      totalQuestions: data.total_questions || 0,
      averageScore: 0,
      recentActivity: data.recent_activity || [],
      newUsersTrend: data.new_users_trend,
      categoryDistribution: data.category_distribution,
    };
  },
  getActivityLogs: async (page = 1, limit = 20): Promise<{ items: Array<Record<string, unknown>>; total: number }> => {
    return apiCall(`/admin/activity-logs?page=${page}&limit=${limit}`);
  },
  getCandidates: async (params: { page?: number; limit?: number; search?: string; status?: string; } = {}): Promise<Candidate[]> => {
    const qp = new URLSearchParams();
    if (params.page) qp.append('page', params.page.toString());
    if (params.limit) qp.append('limit', params.limit.toString());
    if (params.search) qp.append('search', params.search);
    if (params.status) qp.append('status', params.status);
    const qs = qp.toString();
    const endpoint = qs ? `/admin/candidates?${qs}` : '/admin/candidates';
    const data = await apiCall<BackendCandidate[]>(endpoint);
    return data.map(c => ({ ...c, full_name: c.profile_info?.name || c.email.split('@')[0] || 'Unknown' }));
  },
  inviteCandidate: async (email: string, name?: string): Promise<{ message: string }> => {
    return apiCall('/admin/invite-candidate', { method: 'POST', body: JSON.stringify({ email, name }) });
  },
  updateCandidateStatus: async (id: string, status: string): Promise<{ message: string }> => {
    return apiCall(`/users/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
  },
};

// ==================== INTERVIEW API (for candidates) ====================

export interface InterviewSession {
  id: string;
  interview_type: 'technical' | 'coding' | 'behavioral' | string;
  status: 'pending' | 'in_progress' | 'completed' | 'pre_check' | string;
  current_question_index: number;
  position?: string;
  start_time?: string;
  final_report?: any;
  questions: Question[];
  answers: Array<{
    question_id: string;
    answer: string;
    score?: number;
    feedback?: string;
  }>;
  overall_score?: number;
  technical_score?: number;
  behavioral_score?: number;
  coding_score?: number;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  feedback?: string;
}

export const interviewAPI = {
  start: async (interviewType: string): Promise<InterviewSession> => {
    return apiCall('/interviews/start', { method: 'POST', body: JSON.stringify({ interview_type: interviewType }) });
  },
  submitAnswer: async (sessionId: string, questionId: string, answer: string): Promise<{
    score: number; feedback: string; next_question?: Question;
  }> => {
    return apiCall(`/api/interview/${sessionId}/answer`, { method: 'POST', body: JSON.stringify({ question_id: questionId, answer }) });
  },
  getHistory: async (): Promise<InterviewSession[]> => apiCall('/api/interview/history'),
  get: async (id: string): Promise<InterviewSession> => apiCall(`/api/interview/${id}`),
  end: async (sessionId: string): Promise<InterviewSession> => {
    return apiCall(`/api/interview/${sessionId}/complete`, { method: 'POST' });
  },
};

// ==================== AI INTERVIEW API (new full flow) ====================

export interface CVUploadResponse {
  session_id: string;
  candidate_name: string;
  extracted_skills: string[];
  experience_years: number;
  email: string;
}

export interface InterviewQuestion {
  id: string;
  text: string;
  difficulty: string;
  category: string;
}

export interface StartInterviewResponse {
  questions: InterviewQuestion[];
  total_questions: number;
  time_limit_seconds: number;
}

export interface SubmitAnswerResponse {
  score: number;
  feedback: string;
  next_question_id: string | null;
}

export interface CodingProblem {
  id: string;
  title: string;
  description: string;
  difficulty: string;
  template_code: Record<string, string>;
}

export interface SubmitCodeResponse {
  test_results: {
    score: number;
    passed: number;
    total: number;
    pass_rate?: number;
    results: Array<{
      test_case_id: string;
      status: string;
      expected: string;
      actual: string;
      input?: string;
      hidden: boolean;
    }>;
    logic_correct?: boolean;
    time_complexity?: string;
    space_complexity?: string;
    code_quality_score?: number;
    logic_score?: number;
    overall_coding_score?: number;
    issues?: string[];
    suggestions?: string[];
    feedback?: string;
  };
  plagiarism_score: number;
  is_flagged: boolean;
  coding_score: number;
}

export interface CompleteInterviewResponse {
  overall_score: number;
  technical_score: number;
  behavioral_score: number;
  coding_score: number;
  report_url: string;
}



export const aiInterviewAPI = {
  uploadCV: async (file: File): Promise<CVUploadResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    return apiCallFormData('/api/interview/upload-cv', formData);
  },

  startFromProfile: async (position: string, interviewMode: string = 'position', course: string = ''): Promise<{ session_id: string; candidate_name: string; position: string; interview_mode: string; course: string; extracted_skills: string[] }> => {
    return apiCall('/api/interview/start-from-profile', {
      method: 'POST',
      body: JSON.stringify({ position, interview_mode: interviewMode, course }),
    });
  },

  startInterview: async (sessionId: string): Promise<StartInterviewResponse> => {
    return apiCall(`/api/interview/${sessionId}/start`, { method: 'POST' });
  },

  async submitAnswer(sessionId: string, questionId: string, answerText: string, audioBase64?: string): Promise<{score: number, feedback: string, next_question_id: string | null, next_question_text: string}> {
    return apiCall(`/api/interview/${sessionId}/submit-answer`, {
      method: 'POST',
      body: JSON.stringify({
        question_id: questionId,
        answer_text: answerText,
        answer_audio_base64: audioBase64
      }),
    });
  },

  sendBehavioralFrame: async (sessionId: string, data: {
    eye_contact_score: number;
    dominant_emotion: string;
    emotion_scores: Record<string, number>;
    face_detected: boolean;
  }): Promise<{
    eye_contact_score: number; dominant_emotion: string; face_detected: boolean;
  }> => {
    return apiCall(`/api/interview/${sessionId}/behavioral-frame`, {
      method: 'POST',
      body: JSON.stringify({
        eye_contact_score: data.eye_contact_score,
        dominant_emotion: data.dominant_emotion,
        emotion_scores: data.emotion_scores,
        face_detected: data.face_detected,
        timestamp: new Date().toISOString(),
      }),
    });
  },

  sendBehavioralAudio: async (sessionId: string, audioBase64: string): Promise<{
    confidence_score: number; volume_level: number;
  }> => {
    return apiCall(`/api/interview/${sessionId}/behavioral-audio`, {
      method: 'POST',
      body: JSON.stringify({ audio_base64: audioBase64, timestamp: new Date().toISOString() }),
    });
  },

  sendProctoringEvent: async (sessionId: string, eventType: string): Promise<{
    acknowledged: boolean; warning_count: number;
  }> => {
    return apiCall(`/api/interview/${sessionId}/proctoring-event`, {
      method: 'POST',
      body: JSON.stringify({ event_type: eventType, timestamp: new Date().toISOString() }),
    });
  },

  transitionToCoding: async (sessionId: string): Promise<{ problem: CodingProblem }> => {
    return apiCall(`/api/interview/${sessionId}/transition-to-coding`, { method: 'POST' });
  },

  runCode: async (sessionId: string, code: string, language: string): Promise<{
    status: string; stdout: string; stderr: string; execution_time_ms: number;
  }> => {
    return apiCall(`/api/interview/${sessionId}/run-code`, {
      method: 'POST',
      body: JSON.stringify({ code, language }),
    });
  },

  submitCode: async (sessionId: string, code: string, language: string): Promise<SubmitCodeResponse> => {
    return apiCall(`/api/interview/${sessionId}/submit-code`, {
      method: 'POST',
      body: JSON.stringify({ code, language }),
    });
  },

  completeInterview: async (sessionId: string): Promise<CompleteInterviewResponse> => {
    return apiCall(`/api/interview/${sessionId}/complete`, { method: 'POST' });
  },

  getReport: async (sessionId: string): Promise<Record<string, unknown>> => {
    return apiCall(`/api/interview/${sessionId}/report`);
  },

  getReportPdfUrl: (sessionId: string): string => {
    return `${API_BASE_URL}/api/interview/${sessionId}/report/pdf`;
  },
};

// ==================== WebSocket Manager ====================

export class InterviewWebSocket {
  private ws: WebSocket | null = null;
  private callbacks: Record<string, Function[]> = {};

  connect(sessionId: string) {
    const wsUrl = API_BASE_URL.replace('http', 'ws');
    this.ws = new WebSocket(`${wsUrl}/api/interview/ws/${sessionId}`);

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const type = data.type;
        if (this.callbacks[type]) {
          this.callbacks[type].forEach(cb => cb(data));
        }
      } catch (e) {
        console.error('[WS] Parse error:', e);
      }
    };

    this.ws.onerror = (e) => console.error('[WS] Error:', e);
    this.ws.onclose = () => {};
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  sendAudioChunk(base64: string) {
    this.ws?.send(JSON.stringify({ type: 'answer_audio', data: base64 }));
  }

  sendFrame(base64: string) {
    this.ws?.send(JSON.stringify({ type: 'behavioral_frame', data: base64 }));
  }

  on(event: string, callback: Function) {
    if (!this.callbacks[event]) this.callbacks[event] = [];
    this.callbacks[event].push(callback);
  }

  onTranscription(cb: (data: { text: string }) => void) { this.on('transcription', cb); }
  onBehavioral(cb: (data: { eye_contact: number; emotion: string }) => void) { this.on('behavioral_update', cb); }
  onTimeWarning(cb: (data: { seconds_remaining: number }) => void) { this.on('time_warning', cb); }
  onPhaseTransition(cb: (data: unknown) => void) { this.on('phase_transition', cb); }
}

// Export all APIs
export default {
  auth: authAPI,
  user: userAPI,
  questions: questionsAPI,
  testCases: testCasesAPI,
  sessions: sessionsAPI,
  admin: adminAPI,
  interview: interviewAPI,
  aiInterview: aiInterviewAPI,
  setToken,
  getToken,
};
