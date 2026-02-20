# MRS Server

Production-grade NestJS API with MongoDB, JWT, bcrypt, rate limiting, sanitization, and structured logging.

## Setup
- Copy `.env.example` to `.env` and set strong secrets.
- Install: `npm install`
- Run dev: `npm run start:dev`
- Build: `npm run build` then `npm start`
- Docs: Swagger available at `/docs`.

## Docker
- `docker compose up --build`
- Provide `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `PEPPER_SECRET` via environment.

## Modules
- Auth: register, login, refresh, logout.
- Users: basic profile endpoints.

## Security
- Helmet, CORS, Throttler, Mongo sanitize, validation whitelist, bcrypt with pepper.
