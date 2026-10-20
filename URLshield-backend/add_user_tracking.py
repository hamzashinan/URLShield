from sqlalchemy import inspect, text
from URLshield.database import engine, Base
from URLshield import db_models

inspector = inspect(engine)

# Create the new users table.
Base.metadata.create_all(bind=engine)

# Add user_id to the existing scan_jobs table if needed.
columns = {column["name"] for column in inspect(engine).get_columns("scan_jobs")}

if "user_id" not in columns:
    with engine.begin() as connection:
        connection.execute(text(
            "ALTER TABLE scan_jobs ADD COLUMN user_id INTEGER NULL"
        ))
        connection.execute(text(
            "CREATE INDEX ix_scan_jobs_user_id ON scan_jobs (user_id)"
        ))

print("Tables:", inspect(engine).get_table_names())
print("Scan columns:", [
    column["name"] for column in inspect(engine).get_columns("scan_jobs")
])
print("Migration completed.")
