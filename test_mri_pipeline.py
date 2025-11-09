#!/usr/bin/env python
"""
Test script to verify MRI prediction pipeline is working correctly.
Run this to diagnose issues with the MRI screening feature.
"""

import os
import sys
import json

def test_imports():
    """Test if all required Python packages are installed."""
    print("\n📦 Testing Python imports...")
    packages = {
        'numpy': 'numpy',
        'joblib': 'joblib',
        'sklearn': 'scikit-learn',
        'nilearn': 'nilearn',
        'nibabel': 'nibabel'
    }
    
    all_ok = True
    for import_name, display_name in packages.items():
        try:
            __import__(import_name)
            print(f"   ✅ {display_name} installed")
        except ImportError:
            print(f"   ❌ {display_name} NOT installed")
            all_ok = False
    
    return all_ok

def test_model_files():
    """Test if model files exist."""
    print("\n🔍 Checking model files...")
    asd_fmri_dir = os.path.join(os.path.dirname(__file__), 'asd_fmri')
    
    required_files = {
        'asd_svm_model.pkl': os.path.join(asd_fmri_dir, 'asd_svm_model.pkl'),
        'scaler.pkl': os.path.join(asd_fmri_dir, 'scaler.pkl'),
    }
    
    all_exist = True
    for name, path in required_files.items():
        if os.path.exists(path):
            size = os.path.getsize(path)
            print(f"   ✅ {name} ({size} bytes)")
        else:
            print(f"   ❌ {name} NOT FOUND at {path}")
            all_exist = False
    
    return all_exist

def test_python_worker():
    """Test if python_worker.py is accessible."""
    print("\n⚙️ Testing python_worker.py...")
    worker_path = os.path.join(os.path.dirname(__file__), 'python_worker.py')
    if os.path.exists(worker_path):
        print(f"   ✅ Found at {worker_path}")
        return True
    else:
        print(f"   ❌ NOT FOUND at {worker_path}")
        return False

def test_predict_mri():
    """Test if predict_mri.py can be imported."""
    print("\n🧠 Testing predict_mri.py import...")
    asd_fmri_dir = os.path.join(os.path.dirname(__file__), 'asd_fmri')
    sys.path.insert(0, asd_fmri_dir)
    
    try:
        # Try importing the script
        predict_script = os.path.join(asd_fmri_dir, 'predict_mri.py')
        if os.path.exists(predict_script):
            print(f"   ✅ Found at {predict_script}")
            return True
        else:
            print(f"   ❌ NOT FOUND at {predict_script}")
            return False
    except Exception as e:
        print(f"   ❌ Error: {e}")
        return False

def main():
    print("=" * 60)
    print("MRI Prediction Pipeline Diagnostic Test")
    print("=" * 60)
    
    results = {
        'imports': test_imports(),
        'model_files': test_model_files(),
        'python_worker': test_python_worker(),
        'predict_mri': test_predict_mri(),
    }
    
    print("\n" + "=" * 60)
    print("Summary:")
    print("=" * 60)
    
    all_passed = all(results.values())
    
    for test_name, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{test_name.replace('_', ' ').title()}: {status}")
    
    print("\n" + "=" * 60)
    if all_passed:
        print("🎉 All tests PASSED! MRI pipeline is ready.")
        print("\nYou can now test the MRI screening feature in the UI.")
    else:
        print("⚠️  Some tests FAILED. Please fix the issues above.")
        if not results['model_files']:
            print("\n   ACTION: Ensure model files exist in asd_fmri directory")
        if not results['imports']:
            print("\n   ACTION: Run 'pip install -r asd_fmri/requirements.txt'")
    
    print("=" * 60)

if __name__ == '__main__':
    main()