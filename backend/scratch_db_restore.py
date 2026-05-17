import pymongo
from bson import json_util
import json
import os

def restore_to_atlas():
    atlas_uri = "mongodb+srv://akramusman350_db_user:4L0kw36TTXzeQ0tT@cluster0.to1czot.mongodb.net/?appName=Cluster0"
    
    print("Connecting to MongoDB Atlas...")
    try:
        client = pymongo.MongoClient(atlas_uri)
        db = client["intraview_ai"]
    except Exception as e:
        print(f"Error connecting: {e}")
        return
        
    # 1. Restore standard collections
    if os.path.exists("db_export.json"):
        print("Restoring personal data collections...")
        with open("db_export.json", "r", encoding="utf-8") as f:
            export_data = json_util.loads(f.read())
            
        for col_name, documents in export_data.items():
            if not documents:
                print(f" - Collection '{col_name}': 0 documents to restore")
                continue
            db[col_name].delete_many({})
            res = db[col_name].insert_many(documents)
            print(f" + Collection '{col_name}': Successfully restored {len(res.inserted_ids)} documents to Atlas")
    else:
        print("Error: 'db_export.json' not found!")
        
    # 2. Restore 100,000 questions collection
    if os.path.exists("questions_export.json"):
        print("Restoring 100,000 questions to Atlas...")
        with open("questions_export.json", "r", encoding="utf-8") as f:
            questions = json_util.loads(f.read())
            
        if questions:
            db["questions"].delete_many({})
            # Batch insertion in chunks of 5000 for high speed
            chunk_size = 5000
            for i in range(0, len(questions), chunk_size):
                chunk = questions[i:i+chunk_size]
                db["questions"].insert_many(chunk)
                print(f" -> Restored questions progress: {i + len(chunk)} / {len(questions)}")
            print(f" + Collection 'questions': Successfully restored {len(questions)} questions to Atlas!")
    else:
        print("Error: 'questions_export.json' not found!")
        
    print("\n🎉 MONGODB ATLAS RESTORATION SUCCESSFULLY COMPLETED!")

if __name__ == "__main__":
    restore_to_atlas()
