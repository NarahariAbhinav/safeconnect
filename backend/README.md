# SafeConnect Backend API

A Node.js/Express backend for SafeConnect with SQLite database.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Start the server:
```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

The server will run on `http://localhost:5000`

## API Endpoints

### Authentication

- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/logout` - Logout user
- `GET /api/auth/profile` - Get user profile (requires token)

## Database

SQLite database is automatically created at `backend/safeconnect.db`

Tables:
- `users` - User accounts
- `sessions` - Active sessions
- `emergency_contacts` - Emergency contact information
