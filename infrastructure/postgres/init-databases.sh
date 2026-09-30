#!/bin/bash
set -e

function create_user_and_database() {
  local database=$1
  echo "Creating database '$database'"
  psql -v ON_ERROR_STOP=1 \
    --username "$POSTGRES_USER" \
    --dbname postgres <<-EOSQL
    CREATE DATABASE $database;
    GRANT ALL PRIVILEGES ON DATABASE $database TO $POSTGRES_USER;

EOSQL
}
if [ -n "$POSTGRES_MULTIPLE_DATABASES" ]; then
  echo "Multiple database creation requested: $POSTGRES_MULTIPLE_DATABASES"
  for db in $(echo "$POSTGRES_MULTIPLE_DATABASES" | tr ',' ' '); do
    create_user_and_database "$db"
  done
  echo "Multiple databases created"
else
  DATABASES=(
    "identity_db"
    "tenant_db"
    "course_db"
    "learning_db"
    "assessment_db"
    "achievement_reporting_db"
    "notification_db"
    "audit_db"
  )
  for db in "${DATABASES[@]}"; do
    echo "Checking and creating database: $db"
    psql -v ON_ERROR_STOP=1 \
      --username "$POSTGRES_USER" \
      --dbname postgres <<-EOSQL
      SELECT 'CREATE DATABASE $db'
      WHERE NOT EXISTS (
        SELECT FROM pg_database
        WHERE datname = '$db'
      )\gexec
EOSQL
  done
fi