# course-service

NestJS + Prisma 7 service for LearnUP.

Database: `course_db`
Port: `8083`

The Prisma schema follows `LearnUP_Database_Guide.docx`:
- organization_quota_locks
- course_chains
- courses
- modules
- lessons
- materials
- media_files
- content_reports (phase 2)
- platform_settings
- outbox_events

The previous demo Course/Curriculum CRUD was removed because it did not match the finalized database guide.
