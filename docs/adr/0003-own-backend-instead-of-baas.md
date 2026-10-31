# Own TypeScript backend instead of a BaaS

The backend is our own TypeScript service with its own Postgres, auth and sync endpoints, run as one Deployment on Railway (ADR 0063) and locally in Docker. We chose this over Supabase or Firebase to get full control of the sync protocol and the data model, and to avoid lock-in to a hosted provider. The cost: auth, email codes and sync are code we write and maintain.

## Considered Options

- **Supabase**: least code, with ready-made auth and Postgres. Rejected by the owner in favour of control and learning.
- **Firebase**: rejected because of the NoSQL model and Google lock-in.
