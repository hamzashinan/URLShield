from URLshield.database import Base, engine
from URLshield import db_models


print("Creating URLShield database tables...")

Base.metadata.create_all(bind=engine)

print("Database tables created successfully.")