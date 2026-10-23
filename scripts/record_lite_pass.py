"""Record one agent-driven StudySynth Lite generation or repair pass.

Usage:
    python scripts/record_lite_pass.py --run-dir build/my_run \
        --stage lite_generate --pass-number 1 \
        --model <model-name> --provider <provider-name>

The pipeline treats each trace entry as one model call. Record exactly one entry per
combined generation pass and, if needed, one entry for the single targeted repair pass.
"""
import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib_common import run_main
from llm_trace import record_llm_call


def main(argv):
    ap = argparse.ArgumentParser(description="Record an agent-driven Lite pass")
    ap.add_argument("--run-dir", required=True, help="Run directory containing or receiving llm_trace.jsonl")
    ap.add_argument("--stage", required=True, choices=["lite_generate", "lite_repair"])
    ap.add_argument("--pass-number", type=int, default=1)
    ap.add_argument("--model", default=None)
    ap.add_argument("--provider", default=None)
    ap.add_argument("--duration-s", type=float, default=None)
    ap.add_argument("--fingerprint", default="", help="Optional non-secret run/source fingerprint")
    ap.add_argument("--failed", action="store_true", help="Mark the pass as unsuccessful")
    a = ap.parse_args(argv)

    trace_path = os.path.join(a.run_dir, "llm_trace.jsonl")
    record_llm_call(
        trace_path,
        stage=a.stage,
        batch_id="%s-%d" % (a.stage, a.pass_number),
        batch_fingerprint=a.fingerprint,
        processing_mode="LITE",
        model=a.model,
        provider=a.provider,
        duration_s=a.duration_s,
        success=not a.failed,
    )
    print("recorded %s pass %d -> %s" % (a.stage, a.pass_number, trace_path))
    return 0


if __name__ == "__main__":
    sys.exit(run_main(main, sys.argv[1:]))
