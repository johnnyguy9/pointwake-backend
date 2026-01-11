#!/usr/bin/env python3
"""Wake Analyzer Service Entry Point"""

from app.main import app
import os

if __name__ == '__main__':
    port = int(os.getenv('WAKE_ANALYZER_PORT', 5000))
    debug = os.getenv('FLASK_ENV') == 'development'

    print(f"🚀 Starting Wake Analyzer Service on port {port}")
    print(f"📊 Upload folder: {os.getenv('UPLOAD_FOLDER', '/tmp/wake-analyzer-uploads')}")
    print(f"🔍 Debug mode: {debug}")

    app.run(
        host='0.0.0.0',
        port=port,
        debug=debug
    )
