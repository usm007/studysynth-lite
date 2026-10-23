"""Drop-in alias for the StudySynth Lite coordinator.

The Lite implementation lives in ``pipeline_lite.py``. Keeping this alias means the
historical ``scripts/pipeline.py`` entry point behaves identically without maintaining
a second copy of the pipeline.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib_common import run_main
from pipeline_lite import main


if __name__ == "__main__":
    sys.exit(run_main(main, sys.argv[1:]))
