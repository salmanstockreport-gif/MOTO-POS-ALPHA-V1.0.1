# Auth testing
- Login: POST /api/auth/login {email,password} -> {token, user}; send `Authorization: Bearer <token>`.
- GET /api/auth/me returns user without password_hash.
- Admin: ncsasar@gmail.com / Admin@123 (see /app/memory/test_credentials.md)
- 5 failed logins per ip+email => 15 min lockout (429).
