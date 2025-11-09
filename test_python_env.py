#!/usr/bin/env python3
"""
Quick diagnostic to check Python environment and dependencies
"""
import sys
import json

print(json.dumps({"step": "1_python_version", "python": sys.version}), file=sys.stderr)

try:
    import numpy
    print(json.dumps({"step": "2_numpy_ok", "version": numpy.__version__}), file=sys.stderr)
except Exception as e:
    print(json.dumps({"step": "2_numpy_failed", "error": str(e)}), file=sys.stderr)
    sys.exit(1)

try:
    import pandas
    print(json.dumps({"step": "3_pandas_ok", "version": pandas.__version__}), file=sys.stderr)
except Exception as e:
    print(json.dumps({"step": "3_pandas_failed", "error": str(e)}), file=sys.stderr)
    sys.exit(1)

try:
    from sklearn import __version__ as sklearn_version
    print(json.dumps({"step": "4_sklearn_ok", "version": sklearn_version}), file=sys.stderr)
except Exception as e:
    print(json.dumps({"step": "4_sklearn_failed", "error": str(e)}), file=sys.stderr)
    sys.exit(1)

try:
    import joblib
    print(json.dumps({"step": "5_joblib_ok", "version": joblib.__version__}), file=sys.stderr)
except Exception as e:
    print(json.dumps({"step": "5_joblib_failed", "error": str(e)}), file=sys.stderr)
    sys.exit(1)

try:
    from nilearn import __version__ as nilearn_version
    print(json.dumps({"step": "6_nilearn_ok", "version": nilearn_version}), file=sys.stderr)
except Exception as e:
    print(json.dumps({"step": "6_nilearn_failed", "error": str(e)}), file=sys.stderr)
    sys.exit(1)

try:
    import nibabel
    print(json.dumps({"step": "7_nibabel_ok", "version": nibabel.__version__}), file=sys.stderr)
except Exception as e:
    print(json.dumps({"step": "7_nibabel_failed", "error": str(e)}), file=sys.stderr)
    sys.exit(1)

print(json.dumps({"status": "ALL_OK", "message": "All dependencies installed correctly"}), file=sys.stderr)