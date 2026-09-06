# ConnectHub

ConnectHub is a full-stack social media platform built for the CodeAlpha Task 2 college/internship project. It gives students and young creators a welcoming place to share short updates, discover people, follow communities, and keep up with conversations.

## Features

- Landing page with responsive sign in and registration flows
- Secure password hashing with Node.js `scrypt`
- Cookie-based sessions stored in PostgreSQL
- Personalized home feed with demo content
- Create, edit, and delete text or image posts
- Direct image uploads through Replit App Storage
- Like/unlike posts
- Read, create, and delete comments
- Follow/unfollow users
- User search and public profile pages
- Profile editing with bio and avatar URL support
- Notifications for likes, comments, and follows
- Responsive desktop rail and mobile navigation
- Loading, empty, error, and interaction feedback states
- REST API documented in `lib/api-spec/openapi.yaml`

## Technology stack

- Node.js 24 and Express 5
- React, Vite, TypeScript, and TanStack Query
- PostgreSQL with Drizzle ORM
- Replit App Storage for uploaded images
- OpenAPI + Orval-generated typed React Query hooks
- Tailwind CSS and Lucide icons

## Project structure

```text
artifacts/connecthub/       React + Vite frontend
artifacts/api-server/       Express API and session middleware
lib/api-spec/               OpenAPI source of truth
lib/api-client-react/       Generated frontend API hooks
lib/api-zod/                Generated server validation schemas
lib/db/                     Drizzle PostgreSQL schema
```

## Local setup

1. Install Node.js 24 and pnpm.
2. Clone the repository and install dependencies:

   ```bash
   pnpm install
   ```

3. Set the `DATABASE_URL` environment variable to a PostgreSQL database. Replit projects already provide this database.
4. Apply the schema:

   ```bash
   pnpm --filter @workspace/db run push
   ```

5. Start the API and frontend using the configured Replit workflows, or run them separately with the required `PORT` and `BASE_PATH` variables.

The API seeds three demo users and four posts on the first start.

## Demo account

```text
Email: maya@connecthub.demo
Password: DemoPass123!
```

Additional seeded accounts:

```text
jordan@connecthub.demo
aarav@connecthub.demo
Password for both: DemoPass123!
```

## API

The API is mounted at `/api` and includes:

- `/auth` for sessions, registration, login, and logout
- `/feed` and `/discover` for social discovery
- `/users` for profiles, search, and follow relationships
- `/posts` and `/comments` for post interactions
- `/notifications` for activity updates
- `/storage/uploads/request-url` for direct image upload URLs

Regenerate the typed clients after editing the OpenAPI contract:

```bash
pnpm --filter @workspace/api-spec run codegen
```

## Database structure

- `users` — account, profile, and password hash data
- `sessions` — hashed browser session tokens and expiry
- `posts` — post content and uploaded image paths
- `likes` — user-to-post likes
- `comments` — post discussions
- `follows` — follower relationships
- `notifications` — like, comment, and follow activity

## Screenshots

The running Replit preview is the source of truth for screenshots. Suggested screenshots for a presentation or GitHub README:

1. Home feed with the post composer
2. Discover page with trending posts and people suggestions
3. Public profile page
4. Notifications page
5. Mobile responsive view

## Security notes

- Passwords are never stored directly; only salted `scrypt` hashes are stored.
- Session tokens are random opaque values; only SHA-256 token hashes are stored in the database.
- Session cookies are HTTP-only and use `SameSite=Lax`.
- Uploaded images are sent directly to App Storage using a server-generated signed URL.
- `.env` files, secrets, dependencies, and generated build output are excluded from Git.