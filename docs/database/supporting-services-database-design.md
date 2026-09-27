# LearnUP Supporting Services Database Design Overview

## 1. Scope & Architecture Summary
This document provides a consolidated technical reference for the physical database schemas implemented and verified for the three Supporting Services of the LearnUP platform:

1. **`identity-service`** $\rightarrow$ `identity_db`
2. **`notification-service`** $\rightarrow$ `notification_db`
3. **`audit-service`** $\rightarrow$ `audit_db`

---

## 2. Supporting Services Database Inventory

| Service Name | Dedicated Database | Technology | Port | Verification Status | Main Persistence Responsibility |
|:---|:---|:---|:---|:---|:---|
| **`identity-service`** | `identity_db` | PostgreSQL 16 | 8081 | **Verified Live + Flyway** | User credentials, password hashing, JWT tokens, refresh token rotation |
| **`notification-service`** | `notification_db` | PostgreSQL 16 | 8082 | **Verified Live + Flyway** | In-app user notifications, read states, email dispatch logs, templates |
| **`audit-service`** | `audit_db` | PostgreSQL 16 | 8083 | **Verified Live + Flyway** | Durable append-only security and governance event trail |

---

## 3. Comprehensive Table Inventory & Cross-Reference

| Database | Table Name | PK | FK Constraints | Unique Constraints | Key Secondary Indexes | Flyway Migration | Purpose |
|:---|:---|:---|:---|:---|:---|:---|:---|
| `identity_db` | `users` | `id` (UUID) | *None* | `username`, `email` | `idx_users_username`<br>`idx_users_email`<br>`idx_users_organization_id` | `V1__init_identity_schema.sql` | User credentials and auth foundation |
| `identity_db` | `refresh_tokens` | `id` (UUID) | `user_id` $\rightarrow$ `users(id)` | `token_hash` | `idx_refresh_tokens_token_hash`<br>`idx_refresh_tokens_user_id` | `V1__init_identity_schema.sql` | Hashed refresh tokens for rotation |
| `notification_db` | `notifications` | `id` (UUID) | *None* | *None* | `idx_notifications_recipient`<br>`idx_notifications_org`<br>`idx_notifications_is_read`<br>`idx_notifications_created_at` | `V1__create_notifications_tables.sql` | In-app notification center |
| `notification_db` | `notification_templates` | `id` (UUID) | *None* | `template_code` | `notification_templates_template_code_key` | `V1__create_notifications_tables.sql` | Multi-channel templates |
| `notification_db` | `email_logs` | `id` (UUID) | *None* | *None* | `idx_email_logs_recipient`<br>`idx_email_logs_status`<br>`idx_email_logs_sent_at` | `V1__create_notifications_tables.sql` | Email dispatch log ledger |
| `audit_db` | `audit_logs` | `id` (UUID) | *None* | *None* | `idx_audit_logs_org_id`<br>`idx_audit_logs_actor_id`<br>`idx_audit_logs_action`<br>`idx_audit_logs_resource`<br>`idx_audit_logs_created_at` | `V1__create_audit_logs_table.sql` | Append-only governance audit trail |

---

## 4. Architectural Rules & Data Isolation

### 4.1 Strict Database-per-Service Isolation
- Each service connects strictly to its own logical PostgreSQL database.
- Direct cross-database queries (`SELECT ... FROM identity_db.users ...`), joins, and cross-database foreign keys are prohibited.

### 4.2 Cross-Service Relationships
- Cross-boundary entity references are represented solely by scalar logical identifiers:
  - `organization_id` (UUID)
  - `user_id` / `recipient_user_id` / `actor_user_id` (UUID)
  - `target_resource_id` (VARCHAR)
- Data composition across boundaries is performed via synchronous REST APIs through API Gateway or asynchronous Kafka domain event projections.

### 4.3 Sensitive Credential Protection
- Plaintext passwords and plaintext refresh tokens are never persisted.
- Cryptographic hash functions (BCrypt for passwords, SHA-256 for token rotation) protect persistent credentials.

---

## 5. Schema Consistency & Verification Classification
All elements documented have been cross-checked and classified:

1. **`identity_db`**: `VERIFIED MATCH` (Live PostgreSQL 16 schema matches `V1__init_identity_schema.sql` and JPA entities).
2. **`notification_db`**: `VERIFIED MATCH` (Live PostgreSQL 16 schema matches `V1__create_notifications_tables.sql` and JPA entities).
3. **`audit_db`**: `VERIFIED MATCH` (Live PostgreSQL 16 schema matches `V1__create_audit_logs_table.sql` and JPA entity).
