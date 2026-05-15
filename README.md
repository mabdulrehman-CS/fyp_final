# IntraView AI - AI-Powered Interview Simulation Platform

A comprehensive interview preparation and assessment platform that helps candidates practice technical and behavioral interviews while enabling administrators to conduct and manage interview sessions efficiently.

## 🚀 Features

### For Candidates
- **Practice Interviews**: Practice coding, behavioral, and system design interviews
- **Progress Tracking**: Monitor your performance and improvement over time
- **Detailed Reports**: Get comprehensive feedback on your interview performance
- **Profile Management**: Create and manage your candidate profile
- **AI-Powered Questions**: Access to AI-generated interview questions

### For Administrators
- **Question Bank Management**: Create, edit, and manage interview questions
- **Live Session Monitoring**: Track active interview sessions in real-time
- **Candidate Management**: Invite, manage, and track candidate accounts
- **Analytics Dashboard**: View system statistics and activity logs
- **AI Question Generation**: Generate questions using Google Gemini AI
- **Bulk Data Import**: Import questions from CSV files

## 🛠️ Technology Stack

### Frontend
- **React 18** - Modern UI component library
- **Vite** - Lightning-fast build tool
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Modern styling
- **Shadcn UI** - Component library
- **React Hooks** - State management

### Backend
- **FastAPI** - High-performance Python web framework
- **MongoDB** - NoSQL database with Motor (async driver)
- **JWT** - Secure token-based authentication
- **Google Gemini API** - AI-powered question generation
- **SMTP** - Email service integration

## 📋 Prerequisites

- **Node.js** (v18 or higher)
- **Python** (v3.11 or higher)
- **MongoDB** (v6.0 or higher)
- **Git**

## 🔧 Installation

### 1. Clone the Repository

```bash
git clone https://github.com/akramusman/Intraview-AI.git
cd Intraview-AI
```

### 2. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv .venv

# Activate virtual environment
# Windows
.venv\Scripts\activate
# Linux/Mac
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install
# or
pnpm install
```

### 4. Environment Variables

Create a `.env` file in the `backend` directory:

```env
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB_NAME=intraview_ai
JWT_SECRET_KEY=your_secret_key_here
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
NODEMAILER_EMAIL=your_email@gmail.com
NODEMAILER_PASSWORD=your_app_password
GEMINI_API_KEY=your_gemini_api_key
```

Create a `.env` file in the `frontend` directory:

```env
VITE_API_URL=http://localhost:8000
```

### 5. Database Setup

Make sure MongoDB is running on your system:

```bash
# Start MongoDB (if not running as a service)
mongod
```

### 6. Seed Initial Data

```bash
cd backend
python -m scripts.seed_data
```

This will:
- Create an admin account (`admin@intraview.ai` / `Admin@123`)
- Import sample questions
- Set up initial data

## 🚀 Running the Application

### Start Backend Server

```bash
cd backend
uvicorn app.main:app --reload --port 8000
```

Backend API will be available at `http://localhost:8000`

### Start Frontend Server

```bash
cd frontend
npm run dev
# or
pnpm dev
```

Frontend will be available at `http://localhost:8080`

## 📁 Project Structure

```
IntraView-AI/
├── backend/                 # FastAPI backend
│   ├── app/
│   │   ├── core/           # Core utilities (config, security, email)
│   │   ├── models/         # Pydantic data models
│   │   ├── routers/        # API route handlers
│   │   ├── database.py     # Database connection
│   │   ├── deps.py         # FastAPI dependencies
│   │   └── main.py         # FastAPI application entry point
│   ├── scripts/            # Utility scripts
│   ├── data/               # Data files
│   └── requirements.txt    # Python dependencies
│
├── frontend/               # React Vite frontend
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── pages/          # Application routes
│   │   ├── lib/            # Utility libraries
│   │   └── hooks/          # Custom React hooks
│   ├── public/             # Static assets
│   └── package.json
│
└── README.md
```

## 🔐 Authentication

### Default Admin Account
- **Email**: `admin@intraview.ai`
- **Password**: `Admin@123`

### User Roles
- **Admin**: Full access to all features
- **Candidate**: Access to interview practice and profile management

## 📚 API Documentation

Once the backend server is running, API documentation is available at:
- **Swagger UI**: `http://localhost:8000/docs`
- **ReDoc**: `http://localhost:8000/redoc`

### Key Endpoints

#### Authentication
- `POST /auth/signup` - Register new candidate
- `POST /auth/login` - Login and get JWT token
- `POST /auth/forgot-password` - Request password reset OTP
- `POST /auth/reset-password` - Reset password with OTP

#### Questions (Admin Only)
- `GET /questions` - List questions with pagination
- `POST /questions` - Create new question
- `PUT /questions/{id}` - Update question
- `DELETE /questions/{id}` - Delete question
- `POST /questions/generate` - Generate questions using AI

#### Sessions
- `GET /admin/sessions/live` - Get active sessions
- `GET /admin/sessions` - List all sessions
- `POST /sessions` - Create new session

#### Test Cases (Admin Only)
- `GET /testcases/{question_id}` - Get test cases for question
- `POST /testcases` - Create test case
- `PUT /testcases/{id}` - Update test case

## 🧪 Importing Questions

### Import from CSV

```bash
cd backend
python -m scripts.import_python_questions
python -m scripts.import_newcode_questions
```

### Import Scripts Available
- `import_python_questions.py` - Import Python questions
- `import_newcode_questions.py` - Import coding problems
- `import_software_questions.py` - Import software engineering questions

## 🔒 Security Features

- **JWT Authentication**: Secure token-based authentication
- **Password Hashing**: PBKDF2-SHA256 password encryption
- **Role-Based Access Control**: Admin and candidate roles
- **Input Validation**: Pydantic models for data validation
- **CORS Protection**: Configured CORS middleware
- **Password Requirements**: Strong password enforcement

## 📊 Database Collections

- **users** - User accounts (admins and candidates)
- **questions** - Interview questions
- **test_cases** - Test cases for coding questions
- **sessions** - Interview sessions
- **activity_logs** - Admin activity tracking
- **password_reset_otps** - OTP codes for password reset
- **invited_candidates** - Candidate invitations

## 🤖 AI Integration

The platform integrates with Google Gemini AI for:
- **Question Generation**: Generate interview questions based on prompts
- **Context-Aware Generation**: Category and difficulty-specific questions
- **Bulk Generation**: Generate multiple questions at once

## 📝 Development

### Running in Development Mode

Both frontend and backend support hot-reload in development mode.

### Code Structure
- **Backend**: Follows FastAPI best practices with async/await
- **Frontend**: Built with React 18 and Vite for lightning-fast HMR
- **Components**: Reusable UI components with Shadcn UI

## 🐛 Troubleshooting

### MongoDB Connection Issues
- Ensure MongoDB is running
- Check `MONGODB_URI` in `.env` file
- Verify database name matches `MONGODB_DB_NAME`

### Authentication Issues
- Clear browser localStorage
- Check JWT token expiration
- Verify backend is running on correct port

### Import Errors
- Check CSV file encoding (UTF-8)
- Verify file paths in import scripts
- Ensure database connection is active

## 📄 License

This project is licensed under the MIT License.

## 👥 Contributors

- **Akram Usman** - Initial development

## 🙏 Acknowledgments

- FastAPI for the excellent web framework
- Vite and React teams for the frontend architecture
- MongoDB for the database solution
- Google Gemini for AI capabilities
- Shadcn for UI components

## 📞 Support

For issues and questions, please open an issue on GitHub.

---

**Built with ❤️ for better interview preparation**

