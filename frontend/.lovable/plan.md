

# IntraView AI - Complete Implementation Plan

## Overview
A modern, production-ready AI interview platform with three main sections: a public landing page, a Candidate Portal (6 pages), and an Admin Portal (7 pages). Built with Lovable Cloud for backend/auth and Lovable AI for intelligent features.

---

## 🎨 Design System
- **Aesthetic**: High-tech, premium SaaS with glassmorphism and gradient accents
- **Color Palette**: Deep blues and purples with electric accent colors
- **Animations**: Smooth page transitions and micro-interactions using Framer Motion
- **Typography**: Clean, modern sans-serif (Inter/Geist)

---

## 🏠 Public Pages

### Landing Page
- **Hero Section**: Animated headline with particle/wave effects, dual CTAs ("Start as Candidate" / "Admin Login")
- **Features Grid**: Three interactive cards showcasing AI Analysis, Code Sandbox, and Behavioral Scoring
- **Social Proof**: Testimonials carousel and key metrics
- **Footer**: Navigation links and contact information

### Authentication
- **Candidate Auth** (`/auth`): Email/password signup & login with Google OAuth option
- **Admin Auth** (`/admin/login`): Secure login-only form (no public registration)

---

## 👤 Candidate Portal (6 Sidebar Pages)

### 1. Dashboard (`/candidate/dashboard`)
- **Stats Cards**: Recent Interviews, Total Interviews, Average Score (animated counters)
- **Start Interview Card**: Prominent CTA button to launch new interview
- **Recent Activity Timeline**: Scrollable list of latest actions with timestamps
- **Quick Stats Charts**: Mini visualizations of performance trends

### 2. Profile (`/candidate/profile`)
- **User Information**: Editable name, email, profile picture upload
- **CV Upload Zone**: Drag-and-drop area with progress animation
- **CV Parsing**: "Parsing..." animation with Lovable AI extracting skills
- **Skills Display**: Tag cloud of extracted competencies

### 3. Interview Room (`/candidate/interview`)
- **Pre-Check Stage**: Webcam, microphone, and screen share permission validators (must pass all to proceed)
- **Phase 1 - Technical Interview**:
  - Video feed panel (self-view)
  - AI interviewer chat with Speech-to-Text transcription
  - Countdown timer
  - Question display area
- **Phase 2 - Coding Challenge**:
  - Split-screen: Problem description | Monaco Code Editor
  - Language selector (Python, JavaScript, etc.)
  - Run/Submit buttons with execution feedback
  - AI plagiarism check on submission

### 4. Reports (`/candidate/reports`)
- **Interview History Table**: Sortable/filterable list of all sessions
- **Report Card Modal**: Detailed PDF-style view with section scores
- **Download Button**: Export report as PDF
- **Score Breakdown**: Visual representation of performance areas

### 5. Recommendations (`/candidate/recommendations`)
- **Personalized Courses**: Grid of course cards based on weak areas from reports
- **Search Bar**: Find additional learning resources
- **Progress Tracking**: Mark courses as started/completed
- **Category Filters**: Technical, Soft Skills, Industry-specific

### 6. Settings (`/candidate/settings`)
- **Password Change**: Secure form with validation
- **Email Update**: With verification flow
- **Notification Preferences**: Toggle email/push notifications
- **Account Actions**: Delete account option

---

## 🛡️ Admin Portal (7 Sidebar Pages)

### 1. Dashboard (`/admin/dashboard`)
- **Stat Cards**: Total Users, Live Interviews (with live badge), Total Questions
- **Question Category Pie Chart**: Visual breakdown of question bank
- **User Growth Bar Chart**: Monthly registration trends
- **Recent Activity Feed**: Latest platform actions

### 2. Question Bank (`/admin/questions`)
- **Questions Table**: Full CRUD with inline editing
- **AI Generate Button**: Create questions using Lovable AI
- **Category Management**: Technical, Behavioral, HR tags
- **CSV Import**: Upload with format validation and preview

### 3. Test Cases (`/admin/test-cases`)
- **Test Cases Table**: Linked to coding problems
- **CRUD Operations**: Add, edit, delete test cases
- **JSON/CSV Import**: Bulk upload with format instructions tooltip
- **Test Case Preview**: Show input/expected output pairs

### 4. Users/Candidates (`/admin/users`)
- **User Table**: Searchable, sortable candidate list
- **User Detail Drawer**: Profile info + interview history
- **Actions**: Block/Unblock, Delete user
- **Export**: Download user data as CSV

### 5. Interview Sessions (`/admin/sessions`)
- **Live Interviews Tab**: Real-time list with green "LIVE" badges
- **Past Interviews Tab**: Complete session history
- **Session Details**: View recording/transcript/scores
- **Quick Actions**: End session, flag for review

### 6. Rubrics (`/admin/rubrics`)
- **Scoring Weights**: Sliders for Technical vs Behavioral allocation
- **Category Breakdown**: Fine-tune sub-category weights
- **Preset Templates**: Save/load different rubric configurations
- **Preview**: See how weights affect sample scores

### 7. Settings (`/admin/settings`)
- **Admin Password**: Secure update form
- **Interview Time Limit**: Global timer setting (default: 15 minutes)
- **Platform Config**: Enable/disable features
- **Audit Log**: View recent admin actions

---

## 🔧 Technical Implementation

### Backend (Lovable Cloud)
- **Authentication**: Email/password + Google OAuth for candidates, email-only for admins
- **Database Tables**: users, profiles, interviews, questions, test_cases, reports, courses, rubrics, user_roles
- **Role-Based Access**: Separate admin role table with security definer functions
- **Edge Functions**: CV parsing, AI question generation, code execution

### AI Features (Lovable AI)
- **CV Parsing**: Extract skills, experience, education from uploaded resumes
- **Question Generation**: AI-powered question creation for Question Bank
- **Interview Conductor**: Real-time AI interviewer for technical/behavioral questions
- **Code Analysis**: Evaluate submitted code for correctness and style

### Responsiveness
- **Dashboards**: Fully responsive for all devices
- **Interview Room**: Desktop-only with mobile warning banner

---

## 📁 Project Structure

```
src/
├── pages/
│   ├── Index.tsx (Landing)
│   ├── auth/ (Candidate/Admin auth)
│   ├── candidate/ (6 portal pages)
│   └── admin/ (7 portal pages)
├── components/
│   ├── landing/ (Hero, Features, Footer)
│   ├── candidate/ (Dashboard, Interview, etc.)
│   ├── admin/ (Tables, Charts, Forms)
│   └── shared/ (Sidebar, Charts, Cards)
├── hooks/ (useAuth, useInterview, etc.)
├── lib/ (api, utils, constants)
└── types/ (TypeScript interfaces)
```

---

This plan delivers a complete, production-ready platform with real AI capabilities, secure authentication, and a premium user experience.

