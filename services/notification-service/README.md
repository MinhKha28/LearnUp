# Notification Service (`services/notification-service`)

## 1. Overview
The **Notification Service** is one of the 3 finalized LearnUP Supporting/Platform Services. It manages in-app user notifications, system alert broadcasts, direct email delivery integrations (SMTP / notification provider), and user notification preferences across all organizations and roles.

---

## 2. Technology Stack & Runtime
* **Framework**: Spring Boot (Java 21) or NestJS (TypeScript)
* **Database**: PostgreSQL (`notification_db`)
* **Eureka Service Name**: `NOTIFICATION-SERVICE`
* **Messaging**: Apache Kafka Consumer (listens to cross-domain events) & Transactional Outbox

---

## 3. Key Responsibilities
* **In-App Notification Center**: Persisting and querying user notifications, marking notifications as read/unread, unread count queries.
* **Direct Email Dispatching**: Generating and delivering transactional emails (invitations, password resets, enrollment notices, overdue alerts, certificate awards) without needing a standalone email microservice.
* **Notification Templates**: Rendering localized message templates for both in-app banners and emails.
* **Event Consumption**: Consuming domain events from Kafka (e.g. `learnup.tenant.user-invited`, `learnup.learning.course-completed`, `learnup.assessment.passed`) and dispatching corresponding notifications.

---

## 4. Database Entities (`notification_db`)
* `Notification` (`id`, `organizationId`, `recipientUserId`, `title`, `message`, `type`, `channel`, `isRead`, `readAt`, `createdAt`)
* `NotificationTemplate` (`id`, `templateCode`, `subjectTemplate`, `bodyTemplate`, `channel`, `createdAt`)
* `EmailLog` (`id`, `recipientEmail`, `subject`, `status`, `errorMessage`, `sentAt`)

---

## 5. Non-Responsibilities (Strict Service Boundaries)
* **User Credential / Password Management**: Owned by **Identity Service** (`identity_db`).
* **Tenant & Account Master**: Owned by **Tenant Service** (`tenant_db`).
* **Course / Learning / Assessment Domain Rules**: Owned by respective business services.
* **Audit Trail Storage**: Immutable compliance and action logging is owned by **Audit Service** (`audit_db`).

---

## 6. Event Interactions
* **Consumed Events**:
  * `learnup.tenant.user-invited`
  * `learnup.tenant.user-created`
  * `learnup.course.published`
  * `learnup.course.disabled`
  * `learnup.learning.course-completed`
  * `learnup.assessment.passed`
  * `learnup.certificate.issued`
