# Hope Church Management System

A university FYP for managing church members, inactive membership records, Life Groups, Units, Subdistricts, analytics, and email communications.

## Technology and structure

- `client/`: React 19 frontend using Vite, React Router, Axios, Recharts, and Leaflet.
- `server/`: Node.js and Express API with JWT authentication and Mailjet email delivery through Axios. Source is organized into routes, controllers, repositories, services, and permission helpers.
- `database/`: MySQL schema in `database_creation.txt`, test seed data in `seeds.sql`, and the master-admin promotion script.

## Local setup

Install Node.js/npm and have a MySQL server available. From the project root, install each application's dependencies:

```sh
cd client
npm ci
cd ../server
npm ci
```

For a fresh database, execute `database/database_creation.txt` in MySQL; it creates and selects `church_db`. The optional `database/seeds.sql` contains test data.

Create `client/.env` with the API base URL (including `/api`). For the server's default port:

```dotenv
VITE_API_URL=http://localhost:5000/api
```

Create `server/.env` with your database connection settings and JWT signing secret:

```dotenv
DB_HOST=localhost
DB_PORT=3306
DB_USER=your_mysql_user
DB_PASSWORD=your_mysql_password
DB_NAME=church_db
JWT_SECRET=replace_with_your_own_secret
```

The server also reads these optional settings:

- `PORT`: defaults to `5000`.
- `CLIENT_URL`: allowed frontend origin; defaults to `http://localhost:5173`.
- `JWT_EXPIRES_IN`: defaults to `7d`.
- `NODE_ENV`: shown in the startup log; defaults to `development` there.

Email sending requires `MAILJET_API_KEY`, `MAILJET_SECRET_KEY`, `MAILJET_FROM_EMAIL`, and `MAILJET_FROM_NAME` in the server environment.

## RAG database security setup

Before using the AI assistant against a new database environment, run the RAG setup from `server/`:

```sh
npm run rag:setup
```

The setup script creates a dedicated `church_rag` MySQL account with read-only access to approved church-data columns. Generated RAG queries use this restricted account instead of the application's write-enabled database account, so MySQL rejects attempts to insert, update, delete, or alter data even if an unsafe query reaches the database.

The script also:

- Generates a password for the restricted account and saves `RAG_DB_USER` and `RAG_DB_PASSWORD` in `server/.env`.
- Creates the `RAGQueryLog` table from `database/rag_schema.sql`.
- Verifies that `SELECT` succeeds and `DELETE` is denied.

Run this once for each new database environment using a `DB_USER` that has permission to create MySQL users and grant access. Do not replace the generated RAG credentials with the normal application database credentials, because doing so removes the database-level read-only protection.

After setup, build the semantic indexes needed by the enabled RAG architectures:

```sh
npm run rag:index
npm run rag:lpg:index
npm run rag:rdf:index
```

## Run locally

Use two terminals, starting from the project root.

Frontend:

```sh
cd client
npm run dev
```

Backend with automatic restart:

```sh
cd server
npm run dev
```

The backend checks its MySQL connection before starting. Use `npm start` from `server/` to run without automatic restart.

## Checks

Run the existing Node backend tests from `server/`:

```sh
npm test
```

From `client/`, use `npm run lint` for ESLint and `npm run build` for a production frontend build.
