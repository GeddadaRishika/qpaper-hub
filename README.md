<<<<<<< HEAD
# QPaper Hub

QPaper Hub is a simple, responsive previous-year question paper repository for students and academic administrators. Students can search and filter papers, preview PDFs, download papers, save papers for later, and manage their profile. Administrators can upload, edit, and delete papers, view users, and monitor library statistics.

## Problem statement
Students often have to search multiple groups and websites to find previous question papers. QPaper Hub brings papers into one searchable library organised by department, semester, subject, year, and exam type.

## Features
- Student registration and login with bcrypt password hashing and JWT authentication.
- Role-based access control for student and administrator actions.
- Search, filters, sort order, and 10-paper pagination.
- PDF preview in the browser and authenticated downloads with download counts.
- Save/unsave papers and view a personal saved-paper list.
- Admin upload/edit/delete workflow, user list, library statistics, and department breakdown.
- SQLite database and indexes created automatically.
- Input validation, 10 MB upload limit, parameterized SQL, friendly API errors.
- Responsive React/Vite interface styled with Tailwind CSS utilities and custom CSS.

## Technology stack
- Frontend: React 18, Vite, React Router, Axios, Tailwind CSS.
- Backend: Node.js, Express, JWT, bcryptjs, Multer, express-validator, Helmet, CORS.
- Database: SQLite using better-sqlite3.
- Tests: Jest and Supertest.

## Database design
- `users`: identity, unique email, password hash, role, department, semester, creation timestamp.
- `papers`: paper metadata, relative PDF path, uploader, download count, creation timestamp.
- `saved_papers`: user-paper relationship with a unique `(user_id, paper_id)` constraint.
- Foreign keys cascade saved records when a user or paper is removed; paper uploader references are set null if the user is removed. Indexes support common paper filters and sorting.

## Project structure
```text
qpaper-hub/
├── backend/
│   ├── src/
│   │   ├── routes/       # auth, paper and admin APIs
│   │   ├── middleware/   # authentication and errors
│   │   ├── db/           # schema and seed script
│   │   └── server.js
│   ├── tests/
│   ├── uploads/          # uploaded/demo PDFs
│   ├── package.json
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── context/
│   │   ├── services/
│   │   └── App.jsx
│   ├── package.json
│   └── .env.example
├── .gitignore
└── README.md
```

## Requirements
- Node.js 18 or newer and npm.
- No separate database server is required.

## Setup

### 1. Backend
Open a terminal at the project root:

```bash
cd backend
cp .env.example .env
```

Edit `backend/.env`. Set `JWT_SECRET` to a long, random value before running the server. For example, generate one with `openssl rand -hex 32`. Keep `.env` private.

Install dependencies, seed the demo records, and start the API:

```bash
npm install
npm run seed
npm run dev
```

The API runs at `http://localhost:8000`. Check `http://localhost:8000/api/health`.

The SQLite database is created at `backend/data/qpaper-hub.sqlite` automatically. The seed script creates demo users and 12 small demo PDF files; these PDFs are illustrative sample documents, not actual institution exam papers. Running the seed script again does not duplicate the initial sample papers.

### 2. Frontend
In a second terminal, from the project root:

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Open `http://localhost:5173`. The frontend's `VITE_API_URL` should point to the backend API base URL, normally `http://localhost:8000/api`. Restart Vite after changing environment variables.

### Demo credentials (local development only)
- Admin: `admin@qpaperhub.local` / `Admin@12345`
- Student 1: `student1@qpaperhub.local` / `Student@123`
- Student 2: `student2@qpaperhub.local` / `Student@123`

These are public demo credentials. Do not use them in a deployed environment. The app intentionally does not offer public administrator registration; new registrations are students.

## API overview
All responses use JSON except PDF download/preview responses.

| Method | Endpoint | Purpose | Access |
|---|---|---|---|
| POST | `/api/auth/register` | Register student | Public |
| POST | `/api/auth/login` | Log in and receive JWT | Public |
| GET | `/api/users/me` | Current user profile | Authenticated |
| GET | `/api/papers` | Search/filter/sort/paginate papers | Public |
| GET | `/api/papers/:id` | Paper metadata | Public |
| GET | `/api/papers/:id/preview` | Inline PDF preview | Public |
| GET | `/api/papers/:id/download` | Download and increment count | Authenticated |
| POST | `/api/papers/:id/save` | Save paper | Authenticated |
| DELETE | `/api/papers/:id/save` | Unsave paper | Authenticated |
| GET | `/api/saved` | Current user's saved papers | Authenticated |
| POST | `/api/admin/papers` | Upload a PDF and metadata | Admin |
| PUT | `/api/admin/papers/:id` | Update metadata, optionally replace PDF | Admin |
| DELETE | `/api/admin/papers/:id` | Delete paper and PDF | Admin |
| GET | `/api/admin/users` | List users without password hashes | Admin |
| GET | `/api/admin/stats` | Library statistics | Admin |

`GET /api/papers` accepts `department`, `semester`, `subject`, `year`, `exam_type`, `q`, `sort=newest|downloads`, and `page`. Each page contains 10 papers. Uploads use multipart form data with metadata fields and a `pdf` file field. All protected requests use `Authorization: Bearer <token>`.

## Testing
From `backend/`:

```bash
npm install
npm test
```

The Jest/Supertest suite covers registration/login, protected route behavior, paper filters, student denial on admin routes, and save/unsave. Tests use a local test database file and clean it up after completion.

## Screenshots
Add screenshots of the landing page, paper browsing, paper preview, and admin dashboard here.

## Future improvements
- Add email verification and password reset.
- Add a richer audit log for admin changes.
- Add department/subject management and CSV import.
- Add more robust PDF content validation and malware scanning for production deployments.
- Add accessibility audits and end-to-end browser tests.
=======
# qpaper-hub
>>>>>>> 58ac32190a5adf5d82c9ebd69676e429c34050ab
