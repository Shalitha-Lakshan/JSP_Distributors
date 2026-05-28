# JSP Distributors POS

Single-repo MERN scaffolding for a POS, billing, inventory, FIFO batch, credit, and reporting system.

## Quick Start

1. Install dependencies:
   - `npm run install:all`
2. Configure environment variables:
   - Copy `server/.env.example` to `server/.env`
   - Copy `client/.env.example` to `client/.env`
3. Seed admin user:
   - `npm run seed:admin`
4. Start development servers:
   - `npm run dev`

## Default Admin
- Email: admin@jsp.com
- Password: admin@123

## Scripts
- `npm run dev` - start client and server
- `npm run dev:server` - start backend
- `npm run dev:client` - start frontend
- `npm run seed:admin` - create admin user if missing
