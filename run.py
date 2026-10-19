import uvicorn
import os
import sys

# Add backend directory to sys.path
backend_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "backend")
sys.path.insert(0, backend_dir)

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    print(f"============================================================")
    print(f" Justapedia Article Research, Update & Creation Studio")
    print(f" Running at: http://localhost:{port}")
    print(f" API Documentation: http://localhost:{port}/docs")
    print(f"============================================================")
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, reload=True)
