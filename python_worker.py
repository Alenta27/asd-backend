import os
import sys
import subprocess
import json

def main() -> int:
    """
    This script acts as a bridge to the actual prediction script.
    It ensures that the environment is set up correctly and calls
    the prediction script with the provided file path.
    """
    if len(sys.argv) < 2:
        print('{"error": "Missing file path argument"}')
        return 1

    file_path = sys.argv[1]
    if not os.path.exists(file_path):
        print(f'{{"error": "File not found: {file_path}"}}')
        return 1

    # Get the absolute path to the directory containing this script
    script_dir = os.path.dirname(os.path.abspath(__file__))
    
    # Construct the absolute path to the MRI prediction script
    predict_script_path = os.path.join(script_dir, 'asd_fmri', 'predict_mri.py')

    if not os.path.exists(predict_script_path):
        print(f'{{"error": "Prediction script not found: {predict_script_path}"}}')
        return 1

    # Get the Python executable path
    python_executable = sys.executable
    
    # Debug logging to stderr
    debug_info = {
        "python_executable": python_executable,
        "predict_script_path": predict_script_path,
        "file_path": file_path,
        "file_exists": os.path.exists(file_path),
        "predict_exists": os.path.exists(predict_script_path)
    }
    print(f"DEBUG: {json.dumps(debug_info)}", file=sys.stderr)

    # Launch the prediction script as a separate process
    # This is important for dependency and environment isolation
    try:
        process = subprocess.run(
            [python_executable, predict_script_path, file_path],
            capture_output=True,
            text=True,
            check=False  # Don't raise on non-zero exit - we'll handle it
        )
        
        # Log everything to stderr for debugging (Node.js will capture this)
        print(f"WORKER_DEBUG: returncode={process.returncode}, stdout_len={len(process.stdout)}, stderr_len={len(process.stderr)}", file=sys.stderr)
        if process.stderr:
            print(f"WORKER_STDERR: {process.stderr}", file=sys.stderr)
        
        # If there's stdout, print it (this is the actual prediction or error JSON)
        if process.stdout:
            print(process.stdout, end='')
        # If there's stderr and no stdout, wrap it as JSON error
        elif process.stderr:
            print(f'{{"error": "Python script error: {process.stderr}"}}')
        # If nothing was output and exit was non-zero, provide fallback error
        elif process.returncode != 0:
            print(f'{{"error": "Python script failed with exit code {process.returncode} and produced no output"}}')
        else:
            # This shouldn't happen - successful exit but no output
            print(f'{{"error": "Python script completed but produced no output"}}')
        
        return process.returncode
    except Exception as e:
        # Catch any other errors (e.g., file not found, permission denied)
        print(f'{{"error": "Worker error: {str(e)}"}}')
        return 1

if __name__ == "__main__":
    raise SystemExit(main())