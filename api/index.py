import sys
import os

# Ensure the root directory of the repository is in Python's import search path
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(CURRENT_DIR)
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from backend.app.main import app

# Exported ASGI entrypoint for Vercel Serverless
__all__ = ["app"]
