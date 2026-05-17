import pymongo
from bson import json_util

def dump_dataset():
    client = pymongo.MongoClient("mongodb://localhost:27017/")
    db = client["intraview_ai"]
    
    # 1. Dump all other collections
    export_data = {}
    collections_to_dump = [
        "users", 
        "interview_sessions", 
        "coding_problems", 
        "test_cases", 
        "cv_uploads", 
        "activity_logs",
        "password_reset_otps"
    ]
    for col in collections_to_dump:
        export_data[col] = list(db[col].find({}))
        
    with open("db_export.json", "w", encoding="utf-8") as f:
        f.write(json_util.dumps(export_data, indent=2))
    print("Successfully exported user data!")

    # 2. Dump exactly 100,000 questions
    print("Exporting exactly 100,000 questions...")
    questions = list(db["questions"].find().limit(100000))
    with open("questions_export.json", "w", encoding="utf-8") as f:
        f.write(json_util.dumps(questions))
    print(f"Successfully exported {len(questions)} questions to 'questions_export.json'!")

if __name__ == "__main__":
    dump_dataset()
