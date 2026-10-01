-- Dev seed for testing UC19.2 (run against course_db). Ids match frontend/.env.development.local.
INSERT INTO
    course_chains (
        id,
        organization_id,
        instructor_id,
        created_at,
        updated_at
    )
VALUES (
        '00000000-0000-4000-8000-000000000003',
        '00000000-0000-4000-8000-000000000001',
        '00000000-0000-4000-8000-000000000002',
        now(),
        now()
    )
ON CONFLICT (id) DO NOTHING;

INSERT INTO
    courses (
        id,
        organization_id,
        chain_id,
        version_number,
        name,
        learning_outcomes,
        expected_completion_days,
        course_type,
        status,
        assignment_minutes,
        created_at,
        updated_at
    )
VALUES (
        '00000000-0000-4000-8000-000000000004',
        '00000000-0000-4000-8000-000000000001',
        '00000000-0000-4000-8000-000000000003',
        1,
        'Workplace Safety (dev)',
        '{}',
        14,
        'PUBLIC',
        'Draft',
        0,
        now(),
        now()
    )
ON CONFLICT (id) DO NOTHING;

-- To test BR-318 (Locked), run:
UPDATE courses
SET
    locked_at = now()
WHERE
    id = '00000000-0000-4000-8000-000000000004';

UPDATE courses
SET
    locked_at = NULL
WHERE
    id = '00000000-0000-4000-8000-000000000004';

UPDATE courses
SET
    locked_at = NULL
WHERE
    id = '00000000-0000-4000-8000-000000000004';