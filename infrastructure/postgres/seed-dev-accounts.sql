-- ==============================================================================
-- LearnUP Development & Demo Account Seeding Script (Idempotent)
-- ==============================================================================
--
-- Objective:
--   Provision canonical development/demo accounts across `identity_db` and `tenant_db`.
--   Ensures both databases share identical UUIDs, respecting service boundaries:
--     - tenant-service owns canonical user profiles, organizations, and subscriptions.
--     - identity-service owns authentication credentials and password hashes.
--
-- Default Credentials:
--   - Password: LearnUp@123
--   - Password Hash: $2a$10$qm9TrdFvzmpY5k/R9oi6gui0Kv6IPRhiyuyZTdeW4EPaZ1.tSeltO (BCrypt)
--
-- Demo Accounts:
--   1. ADMIN:      admin@learnup.local      / LearnUp@123 (Platform Admin, no Org)
--   2. ORGANIZER:  organizer@learnup.local  / LearnUp@123 (Công ty ABC, Org Owner)
--   3. INSTRUCTOR: instructor@learnup.local / LearnUp@123 (Công ty ABC, Teacher)
--   4. LEARNER:    learner@learnup.local    / LearnUp@123 (Công ty ABC, Student)
--
-- Usage:
--   psql -U postgres -d identity_db -f seed-dev-accounts.sql
--   psql -U postgres -d tenant_db   -f seed-dev-accounts.sql
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. PROVISION IDENTITY_DB (Runs if current database is identity_db)
-- ------------------------------------------------------------------------------
DO $$
BEGIN
    IF current_database() = 'identity_db' THEN
        RAISE NOTICE 'Provisioning development accounts into identity_db...';

        -- Admin
        INSERT INTO users (
            id, username, email, password_hash, full_name, role, organization_id, enabled, created_at, updated_at
        ) VALUES (
            '01900000-0000-7000-8000-000000000001',
            'admin',
            'admin@learnup.local',
            '$2a$10$qm9TrdFvzmpY5k/R9oi6gui0Kv6IPRhiyuyZTdeW4EPaZ1.tSeltO',
            'LearnUP Platform Administrator',
            'ADMIN',
            NULL,
            TRUE,
            NOW(),
            NOW()
        ) ON CONFLICT (id) DO UPDATE SET
            username = EXCLUDED.username,
            email = EXCLUDED.email,
            password_hash = EXCLUDED.password_hash,
            full_name = EXCLUDED.full_name,
            role = EXCLUDED.role,
            organization_id = EXCLUDED.organization_id,
            enabled = TRUE,
            updated_at = NOW();

        -- Organizer
        INSERT INTO users (
            id, username, email, password_hash, full_name, role, organization_id, enabled, created_at, updated_at
        ) VALUES (
            '01900000-0000-7000-8000-00000000a010',
            'organizer',
            'organizer@learnup.local',
            '$2a$10$qm9TrdFvzmpY5k/R9oi6gui0Kv6IPRhiyuyZTdeW4EPaZ1.tSeltO',
            'Nguyễn Thị Lan (Organizer)',
            'ORGANIZER',
            '01900000-0000-7000-8000-00000000a001',
            TRUE,
            NOW(),
            NOW()
        ) ON CONFLICT (id) DO UPDATE SET
            username = EXCLUDED.username,
            email = EXCLUDED.email,
            password_hash = EXCLUDED.password_hash,
            full_name = EXCLUDED.full_name,
            role = EXCLUDED.role,
            organization_id = EXCLUDED.organization_id,
            enabled = TRUE,
            updated_at = NOW();

        -- Instructor
        INSERT INTO users (
            id, username, email, password_hash, full_name, role, organization_id, enabled, created_at, updated_at
        ) VALUES (
            '01900000-0000-7000-8000-00000000a101',
            'instructor',
            'instructor@learnup.local',
            '$2a$10$qm9TrdFvzmpY5k/R9oi6gui0Kv6IPRhiyuyZTdeW4EPaZ1.tSeltO',
            'Trần Văn Minh (Instructor)',
            'INSTRUCTOR',
            '01900000-0000-7000-8000-00000000a001',
            TRUE,
            NOW(),
            NOW()
        ) ON CONFLICT (id) DO UPDATE SET
            username = EXCLUDED.username,
            email = EXCLUDED.email,
            password_hash = EXCLUDED.password_hash,
            full_name = EXCLUDED.full_name,
            role = EXCLUDED.role,
            organization_id = EXCLUDED.organization_id,
            enabled = TRUE,
            updated_at = NOW();

        -- Learner
        INSERT INTO users (
            id, username, email, password_hash, full_name, role, organization_id, enabled, created_at, updated_at
        ) VALUES (
            '01900000-0000-7000-8000-00000000a201',
            'learner',
            'learner@learnup.local',
            '$2a$10$qm9TrdFvzmpY5k/R9oi6gui0Kv6IPRhiyuyZTdeW4EPaZ1.tSeltO',
            'Nguyễn Văn An (Learner)',
            'LEARNER',
            '01900000-0000-7000-8000-00000000a001',
            TRUE,
            NOW(),
            NOW()
        ) ON CONFLICT (id) DO UPDATE SET
            username = EXCLUDED.username,
            email = EXCLUDED.email,
            password_hash = EXCLUDED.password_hash,
            full_name = EXCLUDED.full_name,
            role = EXCLUDED.role,
            organization_id = EXCLUDED.organization_id,
            enabled = TRUE,
            updated_at = NOW();

        RAISE NOTICE 'identity_db seeding complete.';
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 2. PROVISION TENANT_DB (Runs if current database is tenant_db)
-- ------------------------------------------------------------------------------
DO $$
BEGIN
    IF current_database() = 'tenant_db' THEN
        RAISE NOTICE 'Provisioning development accounts into tenant_db...';

        -- Platform Settings
        INSERT INTO platform_settings (id, updated_at)
        VALUES ('01900000-0000-7000-8000-000000000099', NOW())
        ON CONFLICT (id) DO NOTHING;

        -- Demo Organization: Công ty ABC
        INSERT INTO organizations (
            id, name, tax_code, address, contact_phone, contact_email, timezone, status, created_at, updated_at
        ) VALUES (
            '01900000-0000-7000-8000-00000000a001',
            'Công ty ABC',
            '0101234567',
            'Số 1 Đại Cồ Việt, Hai Bà Trưng, Hà Nội',
            '02438692000',
            'contact@abc.vn',
            'Asia/Ho_Chi_Minh',
            'Active',
            NOW(),
            NOW()
        ) ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            tax_code = EXCLUDED.tax_code,
            address = EXCLUDED.address,
            contact_phone = EXCLUDED.contact_phone,
            contact_email = EXCLUDED.contact_email,
            status = 'Active',
            updated_at = NOW();

        -- Demo Subscription Plans: Basic, Standard, Premium
        INSERT INTO subscription_plans (
            id, name, price, duration_days, max_learners, max_instructors, max_course_chains, max_storage_bytes, is_offered, created_at, updated_at
        ) VALUES (
            '01900000-0000-7000-8000-000000000011',
            'Basic',
            1000000,
            30,
            50,
            5,
            3,
            10737418240,
            TRUE,
            NOW(),
            NOW()
        ), (
            '01900000-0000-7000-8000-000000000012',
            'Standard',
            2000000,
            30,
            200,
            15,
            10,
            53687091200,
            TRUE,
            NOW(),
            NOW()
        ), (
            '01900000-0000-7000-8000-000000000013',
            'Premium',
            3000000,
            30,
            500,
            30,
            20,
            107374182400,
            TRUE,
            NOW(),
            NOW()
        ) ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            is_offered = TRUE,
            updated_at = NOW();

        -- Demo Active Subscription for Công ty ABC
        INSERT INTO subscriptions (
            id, organization_id, plan_id, source, status, price, duration_days,
            max_learners, max_instructors, max_course_chains, max_storage_bytes,
            starts_at, expires_at, grace_ends_at, created_at, updated_at
        ) VALUES (
            '01900000-0000-7000-8000-00000000a301',
            '01900000-0000-7000-8000-00000000a001',
            '01900000-0000-7000-8000-000000000013',
            'Direct',
            'Active',
            3000000,
            30,
            500,
            30,
            20,
            107374182400,
            NOW() - INTERVAL '5 days',
            NOW() + INTERVAL '25 days',
            NOW() + INTERVAL '32 days',
            NOW() - INTERVAL '5 days',
            NOW()
        ) ON CONFLICT (id) DO UPDATE SET
            status = 'Active',
            expires_at = NOW() + INTERVAL '25 days',
            grace_ends_at = NOW() + INTERVAL '32 days',
            updated_at = NOW();

        -- Admin
        INSERT INTO users (
            id, organization_id, email, full_name, role, department, status, activated_at, deleted_at, created_at, updated_at
        ) VALUES (
            '01900000-0000-7000-8000-000000000001',
            NULL,
            'admin@learnup.local',
            'LearnUP Platform Administrator',
            'Admin',
            'Ban Quản trị',
            'Active',
            NOW(),
            NULL,
            NOW(),
            NOW()
        ) ON CONFLICT (id) DO UPDATE SET
            email = EXCLUDED.email,
            full_name = EXCLUDED.full_name,
            role = 'Admin',
            status = 'Active',
            deleted_at = NULL,
            updated_at = NOW();

        -- Organizer (Lan)
        INSERT INTO users (
            id, organization_id, email, full_name, role, department, status, activated_at, deleted_at, created_at, updated_at
        ) VALUES (
            '01900000-0000-7000-8000-00000000a010',
            '01900000-0000-7000-8000-00000000a001',
            'organizer@learnup.local',
            'Nguyễn Thị Lan (Organizer)',
            'Organizer',
            'Ban Giám đốc',
            'Active',
            NOW(),
            NULL,
            NOW(),
            NOW()
        ) ON CONFLICT (id) DO UPDATE SET
            email = EXCLUDED.email,
            full_name = EXCLUDED.full_name,
            role = 'Organizer',
            organization_id = '01900000-0000-7000-8000-00000000a001',
            status = 'Active',
            deleted_at = NULL,
            updated_at = NOW();

        -- Instructor (Minh)
        INSERT INTO users (
            id, organization_id, email, full_name, role, department, status, activated_at, deleted_at, created_at, updated_at
        ) VALUES (
            '01900000-0000-7000-8000-00000000a101',
            '01900000-0000-7000-8000-00000000a001',
            'instructor@learnup.local',
            'Trần Văn Minh (Instructor)',
            'Instructor',
            'Đào tạo',
            'Active',
            NOW(),
            NULL,
            NOW(),
            NOW()
        ) ON CONFLICT (id) DO UPDATE SET
            email = EXCLUDED.email,
            full_name = EXCLUDED.full_name,
            role = 'Instructor',
            organization_id = '01900000-0000-7000-8000-00000000a001',
            status = 'Active',
            deleted_at = NULL,
            updated_at = NOW();

        -- Learner (An)
        INSERT INTO users (
            id, organization_id, email, full_name, role, department, status, activated_at, deleted_at, created_at, updated_at
        ) VALUES (
            '01900000-0000-7000-8000-00000000a201',
            '01900000-0000-7000-8000-00000000a001',
            'learner@learnup.local',
            'Nguyễn Văn An (Learner)',
            'Learner',
            'Kỹ thuật',
            'Active',
            NOW(),
            NULL,
            NOW(),
            NOW()
        ) ON CONFLICT (id) DO UPDATE SET
            email = EXCLUDED.email,
            full_name = EXCLUDED.full_name,
            role = 'Learner',
            organization_id = '01900000-0000-7000-8000-00000000a001',
            status = 'Active',
            deleted_at = NULL,
            updated_at = NOW();

        RAISE NOTICE 'tenant_db seeding complete.';
    END IF;
END $$;
