"""Truthful LLM Call Trace Instrumentation for StudySynth Lite.

Appends structured, non-secret telemetry for each agent-driven generation or repair
pass to ``llm_trace.jsonl`` in the run directory. The Lite pipeline reads this file to
report an honest ``model_calls`` value instead of guessing zero.

This module is intentionally dependency-free and never records source text, prompts,
API keys, or generated content.
"""
import json
import os
import threading
import time

_TRACE_LOCK = threading.Lock()


def record_llm_call(
    trace_path,
    stage,
    batch_id,
    batch_fingerprint,
    processing_mode="LITE",
    model=None,
    provider=None,
    duration_s=None,
    cache_hit=False,
    retry_count=0,
    success=True,
    input_tokens=None,
    output_tokens=None,
    error_category=None,
):
    """Append one truthful trace record to ``llm_trace.jsonl``."""
    rec = {
        "timestamp": time.time(),
        "processing_mode": processing_mode,
        "stage": stage,
        "batch_id": batch_id,
        "batch_fingerprint": batch_fingerprint,
        "cache_hit": bool(cache_hit),
        "success": bool(success),
        "retry_count": int(retry_count or 0),
    }
    if duration_s is not None:
        rec["duration_s"] = round(float(duration_s), 4)
    if model:
        rec["model"] = str(model)
    if provider:
        rec["provider"] = str(provider)
    if input_tokens is not None:
        rec["input_tokens"] = int(input_tokens)
    if output_tokens is not None:
        rec["output_tokens"] = int(output_tokens)
    if error_category:
        rec["error_category"] = str(error_category)

    line = json.dumps(rec, sort_keys=True) + "\n"
    with _TRACE_LOCK:
        parent = os.path.dirname(os.path.abspath(trace_path))
        if parent and not os.path.exists(parent):
            os.makedirs(parent, exist_ok=True)
        with open(trace_path, "a", encoding="utf-8") as f:
            f.write(line)
            f.flush()
    return rec


class LLMCallTimer:
    """Context manager that records one agent pass with a measured duration."""

    def __init__(
        self,
        trace_path,
        stage,
        batch_id,
        batch_fingerprint,
        processing_mode="LITE",
        model=None,
        provider=None,
        retry_count=0,
    ):
        self.trace_path = trace_path
        self.stage = stage
        self.batch_id = batch_id
        self.batch_fingerprint = batch_fingerprint
        self.processing_mode = processing_mode
        self.model = model
        self.provider = provider
        self.retry_count = retry_count
        self._start = None
        self.duration_s = None
        self.input_tokens = None
        self.output_tokens = None
        self.cache_hit = False

    def __enter__(self):
        self._start = time.monotonic()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if self._start is not None:
            self.duration_s = time.monotonic() - self._start
        success = exc_type is None
        err = exc_type.__name__ if exc_type else None
        record_llm_call(
            self.trace_path,
            stage=self.stage,
            batch_id=self.batch_id,
            batch_fingerprint=self.batch_fingerprint,
            processing_mode=self.processing_mode,
            model=self.model,
            provider=self.provider,
            duration_s=self.duration_s,
            cache_hit=self.cache_hit,
            retry_count=self.retry_count,
            success=success,
            input_tokens=self.input_tokens,
            output_tokens=self.output_tokens,
            error_category=err,
        )
        return False


def load_llm_trace(trace_path):
    """Load trace entries from ``llm_trace.jsonl``."""
    if not trace_path or not os.path.isfile(trace_path):
        return []
    records = []
    with open(trace_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                records.append(json.loads(line))
            except Exception:
                pass
    return records


def summarize_llm_trace(trace_path):
    """Return a truthful summary, or ``None`` when no trace exists."""
    records = load_llm_trace(trace_path)
    if not records:
        return None

    total_calls = len(records)
    cache_hits = sum(1 for r in records if r.get("cache_hit"))
    has_in_tokens = any("input_tokens" in r for r in records)
    has_out_tokens = any("output_tokens" in r for r in records)

    summary = {
        "total_calls": total_calls,
        "cache_hits": cache_hits,
        "cache_misses": total_calls - cache_hits,
        "total_duration_s": round(sum(r.get("duration_s", 0.0) for r in records), 3),
        "retries": sum(r.get("retry_count", 0) for r in records),
        "failures": sum(1 for r in records if not r.get("success")),
    }
    summary["input_tokens"] = (
        sum(r.get("input_tokens", 0) for r in records) if has_in_tokens else "unavailable"
    )
    summary["output_tokens"] = (
        sum(r.get("output_tokens", 0) for r in records) if has_out_tokens else "unavailable"
    )
    return summary
