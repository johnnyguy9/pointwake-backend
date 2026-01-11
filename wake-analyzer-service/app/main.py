"""
Wake Analyzer Service - Flask Application
Provides REST API for execution plan validation and analytics execution.
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import json
from pathlib import Path

from .plan_validator import PlanValidator
from .execution_engine import ExecutionEngine

app = Flask(__name__)
CORS(app)

# Configuration
UPLOAD_FOLDER = Path(os.getenv('UPLOAD_FOLDER', '/tmp/wake-analyzer-uploads'))
UPLOAD_FOLDER.mkdir(parents=True, exist_ok=True)

# Service instances
validator = PlanValidator()
engine = ExecutionEngine()

# Active session data (in production, use Redis or database)
sessions = {}


@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'wake-analyzer',
        'version': '1.0.0'
    })


@app.route('/upload', methods=['POST'])
def upload_csv():
    """
    Upload CSV file and get metadata.

    Returns column names, types, row count, and preview.
    """
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400

    file = request.files['file']

    if file.filename == '':
        return jsonify({'error': 'Empty filename'}), 400

    if not file.filename.endswith('.csv'):
        return jsonify({'error': 'Only CSV files are allowed'}), 400

    try:
        # Generate session ID
        session_id = request.form.get('session_id') or os.urandom(16).hex()

        # Save file
        file_path = UPLOAD_FOLDER / f"{session_id}.csv"
        file.save(str(file_path))

        # Load and analyze CSV
        result = engine.load_csv(str(file_path))

        if result['success']:
            # Store session info
            sessions[session_id] = {
                'file_path': str(file_path),
                'columns': result['columns'],
                'column_types': result['column_types'],
                'row_count': result['row_count']
            }

            return jsonify({
                'success': True,
                'session_id': session_id,
                'metadata': {
                    'columns': result['columns'],
                    'column_types': result['column_types'],
                    'row_count': result['row_count'],
                    'preview': result['preview']
                }
            })
        else:
            return jsonify({
                'success': False,
                'error': result['error']
            }), 400

    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'Upload failed: {str(e)}'
        }), 500


@app.route('/validate', methods=['POST'])
def validate_plan():
    """
    Validate an execution plan without executing it.

    Request body: JSON execution plan
    Returns: Validation result with errors/warnings
    """
    try:
        plan = request.get_json()

        if not plan:
            return jsonify({'error': 'No plan provided'}), 400

        # Validate plan structure
        validation = validator.validate_plan(plan)

        return jsonify({
            'valid': validation.valid,
            'errors': validation.errors,
            'warnings': validation.warnings
        })

    except Exception as e:
        return jsonify({
            'valid': False,
            'errors': [f'Validation error: {str(e)}']
        }), 500


@app.route('/execute', methods=['POST'])
def execute_plan():
    """
    Execute a validated analytics plan.

    Request body:
    {
        "session_id": "string",
        "plan": { execution plan object }
    }

    Returns: Execution results with numerical outputs and optional chart
    """
    try:
        data = request.get_json()

        if not data:
            return jsonify({'error': 'No data provided'}), 400

        session_id = data.get('session_id')
        plan = data.get('plan')

        if not session_id:
            return jsonify({'error': 'session_id required'}), 400

        if not plan:
            return jsonify({'error': 'plan required'}), 400

        # Check session exists
        if session_id not in sessions:
            return jsonify({'error': 'Invalid session_id'}), 404

        # Validate plan first
        validation = validator.validate_plan(plan)

        if not validation.valid:
            return jsonify({
                'success': False,
                'error': 'Plan validation failed',
                'validation_errors': validation.errors
            }), 400

        # Check for clarification requirement
        if plan.get('requires_clarification'):
            return jsonify({
                'success': False,
                'requires_clarification': True,
                'clarification_question': plan.get('clarification_question')
            }), 400

        # Load CSV for this session
        session = sessions[session_id]
        load_result = engine.load_csv(session['file_path'])

        if not load_result['success']:
            return jsonify({
                'success': False,
                'error': f"Failed to load CSV: {load_result['error']}"
            }), 500

        # Execute the plan
        result = engine.execute_plan(plan)

        if result['success']:
            # Log execution (in production, save to database)
            return jsonify(result)
        else:
            return jsonify(result), 400

    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'Execution error: {str(e)}'
        }), 500


@app.route('/session/<session_id>', methods=['GET'])
def get_session_info(session_id):
    """Get metadata for a session"""
    if session_id not in sessions:
        return jsonify({'error': 'Session not found'}), 404

    return jsonify({
        'success': True,
        'session': sessions[session_id]
    })


@app.route('/session/<session_id>', methods=['DELETE'])
def delete_session(session_id):
    """Delete a session and its associated file"""
    if session_id not in sessions:
        return jsonify({'error': 'Session not found'}), 404

    try:
        # Delete file
        session = sessions[session_id]
        file_path = Path(session['file_path'])
        if file_path.exists():
            file_path.unlink()

        # Remove session
        del sessions[session_id]

        return jsonify({'success': True})

    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
