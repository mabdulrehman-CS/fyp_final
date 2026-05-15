import ijson
import json
import pymongo
from pymongo import InsertOne
from datetime import datetime

MONGO_URI = "mongodb://localhost:27017/"
DB_NAME = "intraview_ai"
COLLECTION_NAME = "questions"
FILE_PATH = "data/raw/hr_interview_questions_dataset.json"

def ingest():
    client = pymongo.MongoClient(MONGO_URI)
    db = client[DB_NAME]
    collection = db[COLLECTION_NAME]

    print(f"Dropping collection {COLLECTION_NAME}...")
    collection.drop()

    print("Creating indexes...")
    collection.create_index([("category", 1), ("difficulty", 1)])
    collection.create_index([("created_at", -1)])
    collection.create_index([
        ("title", "text"),
        ("question_text", "text"),
        ("description", "text")
    ])

    batch = []
    batch_size = 10000
    count = 0

    print("Starting ingestion...")
    with open(FILE_PATH, 'rb') as f:
        # Assuming the top-level is a list of objects
        objects = ijson.items(f, 'item')
        for obj in objects:
            question_text = obj.get("question", "")
            doc = {
                "question_text": question_text,
                "title": question_text[:100] + ("..." if len(question_text) > 100 else ""),
                "description": obj.get("ideal_answer", ""),
                "category": obj.get("source_type", "General").title(),
                "difficulty": obj.get("difficulty", "Medium").title(),
                "skill_tags": obj.get("keywords", []),
                "auto_generated": False,
                "created_at": datetime.utcnow()
            }
            batch.append(InsertOne(doc))
            count += 1
            if len(batch) >= batch_size:
                collection.bulk_write(batch)
                batch = []
                print(f"Ingested {count} records...")
        
        if batch:
            collection.bulk_write(batch)
            print(f"Ingested {count} records...")

    print("Ingestion completed successfully.")

if __name__ == "__main__":
    ingest()
