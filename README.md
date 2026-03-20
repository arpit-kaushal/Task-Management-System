# Task Management System (Next.js + Prisma + JWT)

Backend API implemented with:
- Next.js (App Router) using route handlers in `app/api/*`
- Node.js + TypeScript
- Prisma ORM (MySQL)
- JWT Access Token + Refresh Token
- bcrypt password hashing

## 🌐 Live Demo
[https://task-mgmt-systm.vercel.app/](https://task-mgmt-systm.vercel.app/)

## Setup
1. Update environment variables in `.env`:
   - `DATABASE_URL` (MySQL connection string)
   - `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`
2. Create the database tables:
   - `npx prisma migrate dev --name init`
3. Run the server:
   - `npm run dev`

## Authentication (JWT)
- `POST /api/auth/register`
- `POST /api/auth/login`
  - Sets `refreshToken` as an HttpOnly cookie
  - Returns `{ accessToken }`
- `POST /api/auth/refresh`
  - Uses the HttpOnly refresh cookie
  - Returns `{ accessToken }` and rotates the refresh token
- `POST /api/auth/logout`
  - Clears the refresh cookie and revokes the refresh token

For protected routes, send:
- `Authorization: Bearer <accessToken>`

## Tasks CRUD
All tasks belong to the logged-in user.

- `GET /api/tasks`
  - Query params:
    - `page` (default `1`)
    - `limit` (default `20`, max `50`)
    - `status` (`pending` | `completed`)
    - `q` (search substring in title)
- `POST /api/tasks`
  - Body: `{ "title": string, "status"?: "pending" | "completed" }`
- `GET /api/tasks/:id`
- `PATCH /api/tasks/:id`
  - Body: `{ "title"?: string, "status"?: "pending" | "completed" }`
- `DELETE /api/tasks/:id`
- `POST /api/tasks/:id/toggle`
  - Toggles `pending` <-> `completed`

## Frontend UI (Responsive)
- `GET /login` : login page
- `GET /register` : registration page
- `/` : task dashboard (add/edit/delete/toggle, filter/search, pagination)

Run:
- `npm run dev`
