"""
Seed Database Script
- 50 interview questions
- 5 coding problems with test cases
- Admin user
"""
import asyncio
import os
import sys
from datetime import datetime

# Add parent directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))


async def seed():
    uri = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
    db_name = os.getenv("MONGODB_DB_NAME", "intraview_ai")
    client = AsyncIOMotorClient(uri)
    db = client[db_name]

    print("[SEED] Starting database seed...")

    # ── Admin User ──
    from app.core.security import get_password_hash
    admin = await db["users"].find_one({"email": "admin@intraview.ai"})
    if not admin:
        await db["users"].insert_one({
            "email": "admin@intraview.ai",
            "password_hash": get_password_hash("Admin@123"),
            "role": "admin",
            "name": "Admin",
            "created_at": datetime.utcnow(),
            "status": "active",
            "profile_info": {"name": "Admin"},
        })
        print("[SEED] Admin user created: admin@intraview.ai / Admin@123")
    else:
        print("[SEED] Admin user already exists")

    # ── Questions ──
    existing_q = await db["questions"].count_documents({})
    if existing_q < 10:
        questions = [
            # HR/Behavioral (10)
            {"question_text": "Tell me about yourself and your background in software development.", "difficulty": "easy", "category": "hr", "skill_tags": ["soft skills"], "expected_keywords": ["experience", "projects", "skills", "education", "passion"]},
            {"question_text": "Why are you interested in this position?", "difficulty": "easy", "category": "hr", "skill_tags": ["soft skills"], "expected_keywords": ["growth", "challenge", "company", "values", "opportunity"]},
            {"question_text": "Describe a challenging project you worked on. How did you overcome obstacles?", "difficulty": "medium", "category": "behavioral", "skill_tags": ["soft skills"], "expected_keywords": ["challenge", "solution", "team", "learned", "outcome"]},
            {"question_text": "How do you handle tight deadlines and pressure?", "difficulty": "medium", "category": "behavioral", "skill_tags": ["soft skills"], "expected_keywords": ["prioritize", "communicate", "plan", "adapt", "focus"]},
            {"question_text": "Tell me about a time you disagreed with a team member. How did you resolve it?", "difficulty": "medium", "category": "behavioral", "skill_tags": ["soft skills"], "expected_keywords": ["listen", "compromise", "communicate", "respect", "resolution"]},
            {"question_text": "What are your greatest strengths and weaknesses?", "difficulty": "easy", "category": "hr", "skill_tags": ["soft skills"], "expected_keywords": ["strength", "improvement", "self-aware", "growth", "example"]},
            {"question_text": "Where do you see yourself in 5 years?", "difficulty": "easy", "category": "hr", "skill_tags": ["soft skills"], "expected_keywords": ["growth", "leadership", "skills", "impact", "learning"]},
            {"question_text": "Describe your ideal work environment.", "difficulty": "easy", "category": "hr", "skill_tags": ["soft skills"], "expected_keywords": ["collaborative", "innovative", "supportive", "challenging", "growth"]},
            {"question_text": "How do you stay updated with new technologies?", "difficulty": "easy", "category": "behavioral", "skill_tags": ["soft skills"], "expected_keywords": ["reading", "courses", "community", "practice", "conferences"]},
            {"question_text": "Tell me about a time you mentored or helped a colleague.", "difficulty": "medium", "category": "behavioral", "skill_tags": ["soft skills"], "expected_keywords": ["teaching", "patience", "knowledge", "growth", "support"]},
            # Python (8)
            {"question_text": "Explain the difference between a list and a tuple in Python. When would you use each?", "difficulty": "easy", "category": "technical", "skill_tags": ["python"], "expected_keywords": ["mutable", "immutable", "performance", "hashable", "memory"]},
            {"question_text": "What are Python decorators and how do they work? Give an example.", "difficulty": "medium", "category": "technical", "skill_tags": ["python"], "expected_keywords": ["wrapper", "function", "@syntax", "closure", "reusable"]},
            {"question_text": "Explain Python's GIL (Global Interpreter Lock) and its impact on multi-threading.", "difficulty": "hard", "category": "technical", "skill_tags": ["python"], "expected_keywords": ["GIL", "threading", "multiprocessing", "CPU-bound", "concurrency"]},
            {"question_text": "What are generators in Python? How do they differ from regular functions?", "difficulty": "medium", "category": "technical", "skill_tags": ["python"], "expected_keywords": ["yield", "lazy", "memory", "iterator", "next"]},
            {"question_text": "Explain list comprehension vs map/filter in Python. Which is more Pythonic?", "difficulty": "easy", "category": "technical", "skill_tags": ["python"], "expected_keywords": ["comprehension", "readable", "functional", "performance", "pythonic"]},
            {"question_text": "What is the difference between __str__ and __repr__ in Python?", "difficulty": "medium", "category": "technical", "skill_tags": ["python"], "expected_keywords": ["str", "repr", "user-friendly", "developer", "debugging"]},
            {"question_text": "Explain Python's memory management and garbage collection.", "difficulty": "hard", "category": "technical", "skill_tags": ["python"], "expected_keywords": ["reference counting", "garbage collector", "memory pool", "generational", "circular references"]},
            {"question_text": "What are context managers in Python? Explain the 'with' statement.", "difficulty": "medium", "category": "technical", "skill_tags": ["python"], "expected_keywords": ["with", "__enter__", "__exit__", "resource", "cleanup"]},
            # JavaScript (8)
            {"question_text": "Explain the difference between var, let, and const in JavaScript.", "difficulty": "easy", "category": "technical", "skill_tags": ["javascript"], "expected_keywords": ["scope", "hoisting", "block", "reassign", "temporal dead zone"]},
            {"question_text": "What is the event loop in JavaScript? How does it handle async operations?", "difficulty": "medium", "category": "technical", "skill_tags": ["javascript"], "expected_keywords": ["call stack", "callback queue", "microtask", "macrotask", "non-blocking"]},
            {"question_text": "Explain closures in JavaScript with a practical example.", "difficulty": "medium", "category": "technical", "skill_tags": ["javascript"], "expected_keywords": ["scope", "function", "variable", "access", "encapsulation"]},
            {"question_text": "What are Promises and async/await? How do they improve async code?", "difficulty": "medium", "category": "technical", "skill_tags": ["javascript"], "expected_keywords": ["promise", "async", "await", "then", "error handling"]},
            {"question_text": "Explain prototypal inheritance in JavaScript.", "difficulty": "hard", "category": "technical", "skill_tags": ["javascript"], "expected_keywords": ["prototype", "chain", "__proto__", "Object.create", "constructor"]},
            {"question_text": "What is the difference between == and === in JavaScript?", "difficulty": "easy", "category": "technical", "skill_tags": ["javascript"], "expected_keywords": ["strict", "loose", "type coercion", "comparison", "identity"]},
            {"question_text": "Explain the concept of 'this' in JavaScript in different contexts.", "difficulty": "medium", "category": "technical", "skill_tags": ["javascript"], "expected_keywords": ["global", "method", "constructor", "arrow function", "bind"]},
            {"question_text": "What are Web Workers and when would you use them?", "difficulty": "hard", "category": "technical", "skill_tags": ["javascript"], "expected_keywords": ["thread", "parallel", "CPU-intensive", "message passing", "dedicated"]},
            # SQL (5)
            {"question_text": "Explain the difference between INNER JOIN, LEFT JOIN, and FULL OUTER JOIN.", "difficulty": "easy", "category": "technical", "skill_tags": ["sql"], "expected_keywords": ["inner", "left", "outer", "matching", "null"]},
            {"question_text": "What is database normalization? Explain 1NF, 2NF, and 3NF.", "difficulty": "medium", "category": "technical", "skill_tags": ["sql"], "expected_keywords": ["normal form", "redundancy", "dependency", "atomic", "key"]},
            {"question_text": "How would you optimize a slow SQL query?", "difficulty": "hard", "category": "technical", "skill_tags": ["sql"], "expected_keywords": ["index", "explain", "query plan", "denormalize", "caching"]},
            {"question_text": "Explain ACID properties in database transactions.", "difficulty": "medium", "category": "technical", "skill_tags": ["sql"], "expected_keywords": ["atomicity", "consistency", "isolation", "durability", "transaction"]},
            {"question_text": "What are indexes in SQL? When should you use them?", "difficulty": "easy", "category": "technical", "skill_tags": ["sql"], "expected_keywords": ["speed", "B-tree", "query", "overhead", "selective"]},
            # System Design (5)
            {"question_text": "How would you design a URL shortening service like bit.ly?", "difficulty": "hard", "category": "technical", "skill_tags": ["system design"], "expected_keywords": ["hash", "database", "redirect", "analytics", "scalability"]},
            {"question_text": "Explain the differences between monolithic and microservices architecture.", "difficulty": "medium", "category": "technical", "skill_tags": ["system design"], "expected_keywords": ["coupling", "scalability", "deployment", "communication", "complexity"]},
            {"question_text": "What is caching? Explain different caching strategies.", "difficulty": "medium", "category": "technical", "skill_tags": ["system design"], "expected_keywords": ["cache", "TTL", "LRU", "write-through", "invalidation"]},
            {"question_text": "How would you design a real-time chat application?", "difficulty": "hard", "category": "technical", "skill_tags": ["system design"], "expected_keywords": ["websocket", "message queue", "database", "presence", "scaling"]},
            {"question_text": "Explain load balancing and its common algorithms.", "difficulty": "medium", "category": "technical", "skill_tags": ["system design"], "expected_keywords": ["round robin", "least connections", "health check", "sticky sessions", "reverse proxy"]},
            # DSA (7)
            {"question_text": "Explain the time complexity of common sorting algorithms.", "difficulty": "easy", "category": "technical", "skill_tags": ["dsa"], "expected_keywords": ["O(n log n)", "bubble", "merge", "quick", "comparison"]},
            {"question_text": "What is a hash table? How does it handle collisions?", "difficulty": "medium", "category": "technical", "skill_tags": ["dsa"], "expected_keywords": ["hash function", "collision", "chaining", "open addressing", "O(1)"]},
            {"question_text": "Explain the difference between BFS and DFS. When would you use each?", "difficulty": "medium", "category": "technical", "skill_tags": ["dsa"], "expected_keywords": ["breadth", "depth", "queue", "stack", "shortest path"]},
            {"question_text": "What is dynamic programming? Give an example.", "difficulty": "hard", "category": "technical", "skill_tags": ["dsa"], "expected_keywords": ["subproblems", "memoization", "tabulation", "optimal", "overlapping"]},
            {"question_text": "Explain the difference between a stack and a queue.", "difficulty": "easy", "category": "technical", "skill_tags": ["dsa"], "expected_keywords": ["LIFO", "FIFO", "push", "pop", "enqueue"]},
            {"question_text": "What is a binary search tree? What are its properties?", "difficulty": "easy", "category": "technical", "skill_tags": ["dsa"], "expected_keywords": ["sorted", "left", "right", "search", "O(log n)"]},
            {"question_text": "Explain graph representations and their trade-offs.", "difficulty": "hard", "category": "technical", "skill_tags": ["dsa"], "expected_keywords": ["adjacency matrix", "adjacency list", "space", "dense", "sparse"]},
            # React (5)
            {"question_text": "Explain the React component lifecycle and hooks.", "difficulty": "medium", "category": "technical", "skill_tags": ["react"], "expected_keywords": ["useEffect", "useState", "mount", "unmount", "render"]},
            {"question_text": "What is the Virtual DOM in React? How does it improve performance?", "difficulty": "easy", "category": "technical", "skill_tags": ["react"], "expected_keywords": ["virtual", "diff", "reconciliation", "batch", "performance"]},
            {"question_text": "Explain React Context API vs Redux for state management.", "difficulty": "medium", "category": "technical", "skill_tags": ["react"], "expected_keywords": ["context", "global state", "reducer", "middleware", "re-render"]},
            {"question_text": "What are React hooks? Explain useState, useEffect, and custom hooks.", "difficulty": "easy", "category": "technical", "skill_tags": ["react"], "expected_keywords": ["state", "side effect", "custom", "rules", "functional"]},
            {"question_text": "How do you optimize React application performance?", "difficulty": "hard", "category": "technical", "skill_tags": ["react"], "expected_keywords": ["memo", "useMemo", "useCallback", "lazy", "code splitting"]},
            # DevOps (2)
            {"question_text": "Explain Docker containers and how they differ from virtual machines.", "difficulty": "medium", "category": "technical", "skill_tags": ["devops"], "expected_keywords": ["container", "image", "lightweight", "kernel", "isolation"]},
            {"question_text": "What is CI/CD? Describe a typical pipeline.", "difficulty": "medium", "category": "technical", "skill_tags": ["devops"], "expected_keywords": ["continuous", "integration", "delivery", "automation", "testing"]},
        ]

        for q in questions:
            q["created_at"] = datetime.utcnow()
            q["auto_generated"] = False

        result = await db["questions"].insert_many(questions)
        print(f"[SEED] Inserted {len(result.inserted_ids)} questions")
    else:
        print(f"[SEED] Questions already exist ({existing_q} found)")

    # ── Coding Problems ──
    existing_cp = await db["coding_problems"].count_documents({})
    if existing_cp < 3:
        problems = [
            {
                "title": "FizzBuzz",
                "description": "Write a function that returns an array of strings from 1 to n.\nFor multiples of 3, use 'Fizz'.\nFor multiples of 5, use 'Buzz'.\nFor multiples of both, use 'FizzBuzz'.\nOtherwise, use the number as a string.\n\nExample:\nInput: n = 5\nOutput: ['1', '2', 'Fizz', '4', 'Buzz']",
                "difficulty": "easy",
                "skill_tags": ["arrays", "loops"],
                "template_code": {
                    "python": "def fizzbuzz(n):\n    # Write your solution\n    pass\n\n# Read input\nn = int(input())\nprint(fizzbuzz(n))\n",
                    "javascript": "function fizzbuzz(n) {\n    // Write your solution\n}\n\nconst n = parseInt(require('fs').readFileSync('/dev/stdin', 'utf8'));\nconsole.log(JSON.stringify(fizzbuzz(n)));\n",
                },
            },
            {
                "title": "Palindrome Check",
                "description": "Write a function that checks if a given string is a palindrome.\nIgnore case and non-alphanumeric characters.\n\nExample:\nInput: 'A man, a plan, a canal: Panama'\nOutput: true",
                "difficulty": "easy",
                "skill_tags": ["strings", "two pointers"],
                "template_code": {
                    "python": "def is_palindrome(s):\n    # Write your solution\n    pass\n\ns = input()\nprint(is_palindrome(s))\n",
                    "javascript": "function isPalindrome(s) {\n    // Write your solution\n}\n\nconst s = require('fs').readFileSync('/dev/stdin', 'utf8').trim();\nconsole.log(isPalindrome(s));\n",
                },
            },
            {
                "title": "Two Sum",
                "description": "Given an array of integers and a target, return indices of two numbers that add up to target.\nEach input has exactly one solution.\n\nExample:\nInput: nums = [2,7,11,15], target = 9\nOutput: [0,1]",
                "difficulty": "medium",
                "skill_tags": ["arrays", "hash table"],
                "template_code": {
                    "python": "def two_sum(nums, target):\n    # Write your solution\n    pass\n\nimport json\nline1 = input()\nline2 = input()\nnums = json.loads(line1)\ntarget = int(line2)\nprint(json.dumps(two_sum(nums, target)))\n",
                    "javascript": "function twoSum(nums, target) {\n    // Write your solution\n}\n",
                },
            },
            {
                "title": "Valid Parentheses",
                "description": "Given a string containing just '(', ')', '{', '}', '[' and ']', determine if the input string is valid.\nA string is valid if:\n- Open brackets are closed by same type.\n- Open brackets are closed in correct order.\n\nExample:\nInput: '([])'\nOutput: true",
                "difficulty": "medium",
                "skill_tags": ["stack", "strings"],
                "template_code": {
                    "python": "def is_valid(s):\n    # Write your solution\n    pass\n\ns = input()\nprint(is_valid(s))\n",
                    "javascript": "function isValid(s) {\n    // Write your solution\n}\n",
                },
            },
            {
                "title": "LRU Cache",
                "description": "Design a data structure for Least Recently Used (LRU) cache.\nImplement get(key) and put(key, value) in O(1) time.\nWhen cache reaches capacity, evict the least recently used item.\n\nExample:\ncache = LRUCache(2)\ncache.put(1, 1)\ncache.put(2, 2)\ncache.get(1) -> 1\ncache.put(3, 3) -> evicts key 2\ncache.get(2) -> -1",
                "difficulty": "hard",
                "skill_tags": ["design", "hash table", "linked list"],
                "template_code": {
                    "python": "class LRUCache:\n    def __init__(self, capacity):\n        # Initialize\n        pass\n\n    def get(self, key):\n        # Return value or -1\n        pass\n\n    def put(self, key, value):\n        # Insert/update\n        pass\n",
                    "javascript": "class LRUCache {\n    constructor(capacity) {\n        // Initialize\n    }\n    get(key) {\n        // Return value or -1\n    }\n    put(key, value) {\n        // Insert/update\n    }\n}\n",
                },
            },
        ]

        for p in problems:
            p["created_at"] = datetime.utcnow()
            res = await db["coding_problems"].insert_one(p)
            pid = res.inserted_id

            # Create test cases for each problem
            if p["title"] == "FizzBuzz":
                test_cases = [
                    {"problem_id": pid, "input": "5", "expected_output": "['1', '2', 'Fizz', '4', 'Buzz']", "is_hidden": False, "time_limit_ms": 5000},
                    {"problem_id": pid, "input": "3", "expected_output": "['1', '2', 'Fizz']", "is_hidden": False, "time_limit_ms": 5000},
                    {"problem_id": pid, "input": "15", "expected_output": "['1', '2', 'Fizz', '4', 'Buzz', 'Fizz', '7', '8', 'Fizz', 'Buzz', '11', 'Fizz', '13', '14', 'FizzBuzz']", "is_hidden": True, "time_limit_ms": 5000},
                ]
            elif p["title"] == "Palindrome Check":
                test_cases = [
                    {"problem_id": pid, "input": "racecar", "expected_output": "True", "is_hidden": False, "time_limit_ms": 5000},
                    {"problem_id": pid, "input": "hello", "expected_output": "False", "is_hidden": False, "time_limit_ms": 5000},
                    {"problem_id": pid, "input": "A man a plan a canal Panama", "expected_output": "True", "is_hidden": True, "time_limit_ms": 5000},
                ]
            elif p["title"] == "Two Sum":
                test_cases = [
                    {"problem_id": pid, "input": "[2,7,11,15]\n9", "expected_output": "[0, 1]", "is_hidden": False, "time_limit_ms": 5000},
                    {"problem_id": pid, "input": "[3,2,4]\n6", "expected_output": "[1, 2]", "is_hidden": False, "time_limit_ms": 5000},
                    {"problem_id": pid, "input": "[3,3]\n6", "expected_output": "[0, 1]", "is_hidden": True, "time_limit_ms": 5000},
                ]
            elif p["title"] == "Valid Parentheses":
                test_cases = [
                    {"problem_id": pid, "input": "()", "expected_output": "True", "is_hidden": False, "time_limit_ms": 5000},
                    {"problem_id": pid, "input": "([{}])", "expected_output": "True", "is_hidden": False, "time_limit_ms": 5000},
                    {"problem_id": pid, "input": "(]", "expected_output": "False", "is_hidden": False, "time_limit_ms": 5000},
                    {"problem_id": pid, "input": "{[]}", "expected_output": "True", "is_hidden": True, "time_limit_ms": 5000},
                ]
            else:  # LRU Cache
                test_cases = [
                    {"problem_id": pid, "input": "2\nput 1 1\nput 2 2\nget 1\nput 3 3\nget 2", "expected_output": "1\n-1", "is_hidden": False, "time_limit_ms": 10000},
                ]

            if test_cases:
                await db["test_cases"].insert_many(test_cases)

        print(f"[SEED] Inserted {len(problems)} coding problems with test cases")
    else:
        print(f"[SEED] Coding problems already exist ({existing_cp} found)")

    print("[SEED] Database seeding complete!")
    client.close()


if __name__ == "__main__":
    asyncio.run(seed())
