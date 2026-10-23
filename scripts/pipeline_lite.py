"""StudySynth Lite — Agent-Driven, Drop-in Pipeline Coordinator (scripts/pipeline_lite.py).

Implements the lean Lite execution model:
1. Receive: Accept the same inputs and options as the full pipeline.
2. Prepare: Deterministic ingest and anchor extraction (no persona/profile routing).
3. Generate: Hand off to one combined agent pass that writes the knowledge inventory and
   question bank from prompts/lite-generate.md. The deterministic generator is only used
   when the explicit --offline-engine demo/test flag is set.
4. Validate: Inexpensive deterministic checks (validate_questions, quality, dedupe, coverage, audit, gate).
5. Repair: Write a localized repair queue; at most one targeted agent repair pass.
6. Return: Complete package delivery (quiz_package.json, quiz.html, print-ready PDFs, dashboard).
"""
import argparse
import concurrent.futures
import importlib.util
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib_common import load_json, save_json, ensure_dir, run_main
from cache import sha_file, sha_obj, load_manifest, save_manifest
from llm_trace import summarize_llm_trace, load_llm_trace

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
LITE_PROMPT = os.path.join(ROOT, "prompts", "lite-generate.md")


def _quote_cmd_arg(value):
    value = str(value)
    if not value or any(ch.isspace() for ch in value) or '"' in value:
        return '"%s"' % value.replace('"', '\\"')
    return value


def mod(name):
    spec = importlib.util.spec_from_file_location(name, os.path.join(HERE, name + ".py"))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def run_stage(fn, argv):
    try:
        res = fn(argv)
        return int(res) if isinstance(res, (int, bool)) else (0 if res is None else 1)
    except SystemExit as e:
        if isinstance(e.code, int):
            return e.code
        if e.code:
            print(str(e.code), file=sys.stderr)
            return 1
        return 0
    except Exception as e:
        print("stage exception: %s" % e, file=sys.stderr)
        return 1


def run_parallel(jobs, max_workers=3):
    results = {}
    if not jobs:
        return results
    with concurrent.futures.ThreadPoolExecutor(max_workers=min(max_workers, len(jobs))) as ex:
        futs = {ex.submit(fn): k for k, fn in jobs.items()}
        for fut in concurrent.futures.as_completed(futs):
            k = futs[fut]
            try:
                results[k] = fut.result()
            except Exception as e:
                print("parallel job %s raised: %s" % (k, e), file=sys.stderr)
                results[k] = 1
    return results


def main(argv):
    ap = argparse.ArgumentParser(description="StudySynth Lite — Lightweight Drop-in Pipeline")
    ap.add_argument("--source", required=True, help="Input source document")
    ap.add_argument("--run-id", required=True, help="Unique run identifier")
    ap.add_argument("--profile", default=os.path.join(ROOT, "profiles", "GENERAL_PSC.json"), help="Exam profile")
    ap.add_argument("--config", default=os.path.join(ROOT, "config.default.json"), help="Configuration file")
    ap.add_argument("--count", type=int, default=None, help="Target question count")
    ap.add_argument("--build-dir", default="build", help="Base build directory")
    ap.add_argument("--redo", default=None, help="Stage to invalidate and recompute")
    ap.add_argument("--mode", default=None, help="Fidelity mode (SOURCE_BOUND or ENHANCED)")
    ap.add_argument("--inventory", default=None, help="Path to knowledge_inventory.json")
    ap.add_argument("--bank", default=None, help="Path to question_bank.json")
    ap.add_argument(
        "--offline-engine",
        action="store_true",
        help="Use the deterministic offline/PWA fixture generator instead of the agent generation pass (demo/test only)",
    )
    ap.add_argument("--ignored", default=None, help="Path to ignored_anchors.json")
    ap.add_argument("--diff", default=None, help="Path to inventory_diff.json")
    ap.add_argument("--package", action="store_true", help="Assemble quiz_package.json")
    ap.add_argument("--web", action="store_true", help="Build standalone HTML quiz (implies --package)")
    ap.add_argument("--pdf", action="store_true", help="Build print-ready PDFs (implies --package)")
    ap.add_argument("--full", action="store_true", help="Run full pipeline including package, web, and pdf")
    ap.add_argument("--deliver", action="store_true", help="Generate final user delivery package (PDF + HTML only)")
    ap.add_argument("--delivery-dir", default=None, help="Directory for final user delivery deliverables")
    ap.add_argument("--delivery-mode", choices=["individual", "unified", "both"], default="individual", help="Delivery mode")
    ap.add_argument("--dashboard", default=None, help="Path to master index.html dashboard")
    ap.add_argument("--shortcut", action="store_true", help="Generate OS desktop shortcut to master dashboard")

    a = ap.parse_args(argv)
    t0 = time.time()
    metrics = {
        "run_id": a.run_id,
        "edition": "Lite",
        "stages": {},
        "model_calls": None,
        "llm_budget": {"generation_passes": 1, "repair_passes": 1},
        "generation_mode": "pre_generation",
        "cache": {"hits": 0, "misses": 0}
    }

    if not os.path.isfile(a.source):
        print("error: source not found: %s" % a.source, file=sys.stderr)
        return 1

    has_inventory = bool(a.inventory)
    has_bank = bool(a.bank)
    if has_inventory != has_bank:
        print("error: --inventory and --bank must be provided together", file=sys.stderr)
        return 1
    if has_inventory:
        if not os.path.isfile(a.inventory):
            print("error: inventory not found: %s" % a.inventory, file=sys.stderr)
            return 1
        if not os.path.isfile(a.bank):
            print("error: bank not found: %s" % a.bank, file=sys.stderr)
            return 1

    # Resolve paths
    R = a.run_id if os.path.basename(os.path.normpath(a.build_dir)) == a.run_id else os.path.join(a.build_dir, a.run_id)
    ensure_dir(R)

    profile_path = a.profile if os.path.isfile(a.profile) else os.path.join(ROOT, "profiles", "GENERAL_PSC.json")
    config_path = a.config if os.path.isfile(a.config) else os.path.join(ROOT, "config.default.json")
    cfg = load_json(config_path) if os.path.isfile(config_path) else {}
    mode = a.mode or cfg.get("fidelity_mode", "SOURCE_BOUND")

    F = {
        "struct": os.path.join(R, "document_structure.json"),
        "anchors": os.path.join(R, "anchors.json"),
        "inventory": a.inventory or os.path.join(R, "knowledge_inventory.json"),
        "bank": a.bank or os.path.join(R, "question_bank.json"),
        "trace": os.path.join(R, "llm_trace.jsonl"),
        "handoff": os.path.join(R, "lite_handoff.json"),
        "check": os.path.join(R, "inventory_check.json"),
        "validation": os.path.join(R, "validation_results.json"),
        "quality": os.path.join(R, "quality_report.json"),
        "coverage": os.path.join(R, "coverage_matrix.json"),
        "dedupe": os.path.join(R, "dedupe_report.json"),
        "audit": os.path.join(R, "audit_report.json"),
        "gate": os.path.join(R, "gate.json"),
        "pkg": os.path.join(R, "quiz_package.json"),
        "metrics": os.path.join(R, "run_metrics_lite.json"),
        "repair": os.path.join(R, "repair_queue.json")
    }

    sp = os.path.join(R, "pipeline_state_lite.json")
    state = {"run_id": a.run_id, "edition": "Lite", "stages": {}}

    def mark(stage, status, detail=""):
        state["stages"][stage] = {"status": status, "detail": detail}
        save_json(sp, state)

    def timed(stage, fn):
        s = time.time()
        rc = fn()
        dt = time.time() - s
        metrics["stages"][stage] = {"duration_s": round(dt, 3), "rc": rc}
        return rc

    def save_metrics():
        mode_now = metrics.get("generation_mode")
        if mode_now == "offline_engine":
            metrics["model_calls"] = 0
            metrics["llm_telemetry"] = {"status": "offline_engine"}
        elif mode_now == "provided":
            summary = summarize_llm_trace(F["trace"])
            if summary is not None:
                metrics["model_calls"] = summary["total_calls"]
                metrics["llm_telemetry"] = summary
            elif os.path.isfile(F["handoff"]):
                # This bank came through the Lite handoff, but the agent did not
                # record its pass. Do not silently claim zero model calls.
                metrics["model_calls"] = "unavailable (agent-driven; no llm_trace.jsonl)"
                metrics["llm_telemetry"] = {"status": "missing_trace"}
            else:
                metrics["model_calls"] = 0
                metrics["llm_telemetry"] = {"status": "no_trace"}
        # pending_agent_generation and pre_generation keep their explicit state.
        metrics["total_s"] = round(time.time() - t0, 3)
        save_json(F["metrics"], metrics)

    # 1. Ingest
    rc = timed("ingest", lambda: run_stage(mod("ingest").main, [a.source, "--out", R, "--run-id", a.run_id]))
    mark("ingest", "ok" if rc == 0 else "failed")
    if rc:
        save_metrics()
        return rc

    # 2. Anchors
    rc = timed("anchors", lambda: run_stage(mod("anchors").main, [F["struct"], "--out", F["anchors"]]))
    mark("anchors", "ok" if rc == 0 else "failed")
    if rc:
        save_metrics()
        return rc

    # 3. Generation
    # Default Lite path: one combined agent pass. The pipeline prepares the inputs and
    # stops with a handoff instead of silently substituting the deterministic engine.
    if has_inventory:
        F["inventory"] = a.inventory
        F["bank"] = a.bank
        metrics["generation_mode"] = "provided"
        mark("generate_lite", "skipped", "user provided inventory and bank")

    elif a.offline_engine:
        def do_generate():
            metrics["generation_mode"] = "offline_engine"
            gen_mod = mod("generate_lite")
            struct = load_json(F["struct"])
            anchors_data = load_json(F["anchors"]) if os.path.isfile(F["anchors"]) else None
            prof_data = load_json(profile_path) if os.path.isfile(profile_path) else None
            gen_mod.generate_lite_artifacts(struct, anchors_data, cfg, prof_data, R)
            metrics["model_calls"] = 0  # deterministic PWA/fixture engine; no model call
            return 0

        rc = timed("generate_lite", do_generate)
        mark(
            "generate_lite",
            "offline_engine" if rc == 0 else "failed",
            "explicit --offline-engine demo/test path",
        )
        F["inventory"] = os.path.join(R, "knowledge_inventory.json")
        F["bank"] = os.path.join(R, "question_bank.json")
        if rc:
            save_metrics()
            return rc

    else:
        inv_out = os.path.abspath(os.path.join(R, "knowledge_inventory.json"))
        bank_out = os.path.abspath(os.path.join(R, "question_bank.json"))
        next_tokens = [str(x) for x in argv]
        # Keep the rerun command usable from any working directory.
        for flag, value in (
            ("--source", os.path.abspath(a.source)),
            ("--build-dir", os.path.abspath(a.build_dir)),
            ("--profile", os.path.abspath(profile_path)),
            ("--config", os.path.abspath(config_path)),
        ):
            for i, token in enumerate(next_tokens[:-1]):
                if token == flag:
                    next_tokens[i + 1] = value
                    break
        next_argv = [sys.executable, os.path.abspath(__file__)] + next_tokens + [
            "--inventory", inv_out,
            "--bank", bank_out,
        ]
        next_command = " ".join(_quote_cmd_arg(x) for x in next_argv)
        record_argv = [
            sys.executable,
            os.path.join(HERE, "record_lite_pass.py"),
            "--run-dir", os.path.abspath(R),
            "--stage", "lite_generate",
            "--pass-number", "1",
        ]
        handoff = {
            "status": "pending_agent_generation",
            "edition": "Lite",
            "run_id": a.run_id,
            "source": os.path.abspath(a.source),
            "run_dir": os.path.abspath(R),
            "prompt": os.path.abspath(LITE_PROMPT),
            "inputs": {
                "document_structure": os.path.abspath(F["struct"]),
                "anchors": os.path.abspath(F["anchors"]),
                "profile": os.path.abspath(profile_path),
                "config": os.path.abspath(config_path),
            },
            "expected_outputs": {
                "inventory": inv_out,
                "bank": bank_out,
                "trace": os.path.abspath(F["trace"]),
                "repair_queue": os.path.abspath(F["repair"]),
            },
            "budget": {"generation_passes": 1, "repair_passes": 1},
            "record_command": " ".join(_quote_cmd_arg(x) for x in record_argv),
            "repair_record_command": " ".join(
                _quote_cmd_arg(x) for x in (
                    record_argv[:-4] + ["--stage", "lite_repair", "--pass-number", "1"]
                )
            ),
            "next_argv": next_argv,
            "next_command": next_command,
            "instructions": [
                "Read the prompt and perform exactly one combined generation pass.",
                "Write knowledge_inventory.json and question_bank.json as separate files.",
                "Record the pass with scripts/record_lite_pass.py so model_calls is truthful.",
                "Rerun the printed command with --inventory and --bank.",
                "If validation rejects items, repair only those items once, then rerun.",
            ],
        }
        save_json(F["handoff"], handoff)
        metrics["generation_mode"] = "pending_agent_generation"
        metrics["model_calls"] = "pending (agent generation)"
        metrics["llm_telemetry"] = {"status": "pending_agent_generation"}
        mark(
            "generate_lite",
            "pending_agent_generation",
            "one combined agent pass required; see lite_handoff.json",
        )
        save_metrics()
        print("pipeline_lite %s: source prepared; awaiting one agent generation pass" % a.run_id)
        print("  prompt: %s" % os.path.abspath(LITE_PROMPT))
        print("  write:  %s" % inv_out)
        print("          %s" % bank_out)
        print(
            "  record: %s %s --run-dir %s --stage lite_generate --pass-number 1"
            % (
                _quote_cmd_arg(sys.executable),
                _quote_cmd_arg(os.path.join(HERE, "record_lite_pass.py")),
                _quote_cmd_arg(os.path.abspath(R)),
            )
        )
        print("  rerun:  %s" % next_command)
        print("  note:   deterministic generation is disabled by default; --offline-engine is for demo/test fixtures only")
        return 0

    # 4. Inventory check (Deterministic Anchor Recall)
    ignored_path = a.ignored
    if not ignored_path or not os.path.isfile(ignored_path):
        inv_dir = os.path.dirname(os.path.abspath(F["inventory"]))
        src_dir = os.path.dirname(os.path.abspath(a.source))
        cands = [
            os.path.join(inv_dir, "ignored_anchors.json"),
            os.path.join(inv_dir, "e2e_ignored_anchors.json"),
            os.path.join(src_dir, "ignored_anchors.json"),
            os.path.join(src_dir, "e2e_ignored_anchors.json"),
            os.path.join(ROOT, "tests", "fixtures", "e2e_ignored_anchors.json"),
            os.path.join(ROOT, "tests", "fixtures", "longdoc", "ignored_anchors.json"),
        ]
        for cand in cands:
            if os.path.isfile(cand):
                ignored_path = cand
                break

    diff_path = a.diff
    if not diff_path or not os.path.isfile(diff_path):
        inv_dir = os.path.dirname(os.path.abspath(F["inventory"]))
        src_dir = os.path.dirname(os.path.abspath(a.source))
        cands = [
            os.path.join(inv_dir, "inventory_diff.json"),
            os.path.join(inv_dir, "e2e_inventory_diff.json"),
            os.path.join(src_dir, "inventory_diff.json"),
            os.path.join(src_dir, "e2e_inventory_diff.json"),
            os.path.join(ROOT, "tests", "fixtures", "e2e_inventory_diff.json"),
            os.path.join(ROOT, "tests", "fixtures", "longdoc", "inventory_diff.json"),
        ]
        for cand in cands:
            if os.path.isfile(cand):
                diff_path = cand
                break

    check_args = [F["inventory"], F["struct"], "--anchors", F["anchors"], "--config", config_path, "--out", F["check"]]
    if ignored_path and os.path.isfile(ignored_path):
        check_args += ["--ignored", ignored_path]
    if diff_path and os.path.isfile(diff_path):
        check_args += ["--diff", diff_path]

    rc = timed("check", lambda: run_stage(mod("inventory_check").main, check_args))
    mark("check", "ok" if rc == 0 else "failed")
    if rc:
        save_metrics()
        return rc

    # 5. Parallel Deterministic Verification: validate_questions, quality, dedupe
    def do_validate():
        s = time.time()
        rc_v = run_stage(mod("validate_questions").main, [
            F["bank"], F["inventory"], F["struct"],
            "--profile", profile_path, "--mode", mode, "--config", config_path, "--out", F["validation"]
        ])
        metrics["stages"]["validate"] = {"duration_s": round(time.time() - s, 3), "rc": rc_v}
        return rc_v

    def do_quality():
        s = time.time()
        rc_q = run_stage(mod("quality").main, [
            F["bank"], F["inventory"], F["struct"],
            "--profile", profile_path, "--mode", mode, "--config", config_path, "--out", F["quality"]
        ])
        metrics["stages"]["quality"] = {"duration_s": round(time.time() - s, 3), "rc": rc_q}
        return rc_q

    def do_dedupe():
        s = time.time()
        rc_d = run_stage(mod("dedupe").main, [
            F["bank"], "--threshold", str(cfg.get("duplicate_threshold", 0.85)), "--out", F["dedupe"]
        ])
        metrics["stages"]["dedupe"] = {"duration_s": round(time.time() - s, 3), "rc": rc_d}
        return rc_d

    par_jobs = {
        "validate": do_validate,
        "quality": do_quality,
        "dedupe": do_dedupe
    }
    par_results = run_parallel(par_jobs, max_workers=3)
    for k, vrc in par_results.items():
        mark(k, "ok" if vrc == 0 else ("flagged" if k == "quality" else "failed"))

    # Localized repair check
    if os.path.isfile(F["validation"]):
        vr = load_json(F["validation"])
        rej = [r for r in vr.get("results", []) if r.get("status") == "rejected"]
        if rej:
            repair_history = [
                r for r in load_llm_trace(F["trace"]) if r.get("stage") == "lite_repair"
            ]
            if repair_history:
                mark("repair", "exhausted", "one repair pass was already recorded")
                print("notice: one repair pass already recorded; no further repair queue written")
            else:
                save_json(F["repair"], {
                    "failed": rej,
                    "max_retries": 1,
                    "instruction": (
                        "Repair only these failed questions once, keep accepted questions unchanged, "
                        "record a lite_repair pass, then rerun with the same --inventory and --bank."
                    ),
                })
                mark("validate", "completed_with_rejections", "%d rejected" % len(rej))
                mark("repair", "pending", "one targeted agent repair pass allowed")

    # 6. Coverage, Audit, Gate, Report
    cov_args = [F["bank"], F["inventory"], F["validation"], "--out", F["coverage"], "--config", config_path]
    if os.path.isfile(F["quality"]):
        cov_args += ["--quality", F["quality"]]
    if os.path.isfile(F["dedupe"]):
        cov_args += ["--dedupe", F["dedupe"]]

    rc = timed("coverage", lambda: run_stage(mod("coverage").main, cov_args))
    mark("coverage", "ok" if rc == 0 else "failed")
    if rc:
        save_metrics()
        return rc

    audit_args = [
        F["inventory"], F["coverage"], F["validation"], F["anchors"],
        "--profile", profile_path, "--config", config_path, "--struct", F["struct"],
        "--quality", F["quality"], "--out", F["audit"], "--bank", F["bank"]
    ]
    if a.ignored and os.path.isfile(a.ignored):
        audit_args += ["--ignored", a.ignored]
    if a.diff and os.path.isfile(a.diff):
        audit_args += ["--diff", a.diff]

    rc = timed("audit", lambda: run_stage(mod("audit").main, audit_args))
    mark("audit", "ok" if rc == 0 else "failed")
    if rc:
        save_metrics()
        return rc

    rc = timed("gate", lambda: run_stage(mod("gate").main, [F["audit"], "--config", config_path, "--out", F["gate"]]))
    mark("gate", "ok" if rc == 0 else "failed")

    rc = timed("report", lambda: run_stage(mod("report").main, [F["audit"], F["gate"], F["bank"]]))
    mark("report", "ok" if rc == 0 else "failed")

    # 7. Packaging & Rendering
    do_pkg = a.package or a.web or a.pdf or a.full or a.deliver or bool(a.delivery_dir)
    do_web = a.web or a.full
    do_pdf = a.pdf or a.full

    if do_pkg:
        rc = timed("package", lambda: run_stage(mod("package").main, [
            F["bank"], F["audit"], F["gate"],
            "--profile", profile_path,
            "--inventory", F["inventory"],
            "--quality", F["quality"],
            "--out", F["pkg"]
        ]))
        mark("package", "ok" if rc == 0 else "failed")
        if rc:
            save_metrics()
            return rc

    def run_web():
        import shutil
        from naming import parse_clean_title, generate_slug
        clean_title = parse_clean_title(a.source)
        slug_file = generate_slug(a.source)
        slug_dest = os.path.join(R, slug_file)
        html_dest = os.path.join(R, "quiz.html")
        s = time.time()
        rc_w = run_stage(mod("build_web").main, [F["pkg"], "--out", slug_dest, "--title", clean_title])
        metrics["stages"]["build_web"] = {"duration_s": round(time.time() - s, 3), "rc": rc_w}
        if rc_w:
            return rc_w
        if slug_file != "quiz.html":
            try:
                shutil.copy2(slug_dest, html_dest)
            except Exception:
                pass
        root_out = a.delivery_dir or (a.build_dir if a.build_dir != "build" else "output")
        dash_dest = a.dashboard or os.path.join(root_out, "index.html")
        try:
            from dashboard import update_dashboard
            from desktop_shortcut import create_desktop_shortcut
            q_cnt = len(load_json(F["pkg"]).get("questions", []))
            update_dashboard(
                dashboard_path=dash_dest,
                module_path=slug_dest,
                title=clean_title,
                metadata={
                    "status": load_json(F["gate"]).get("status", "Comprehensive"),
                    "question_count": q_cnt,
                    "profile": profile_path,
                }
            )
            create_desktop_shortcut(dash_dest, "StudySynth Library")
        except Exception as e:
            print("notice: dashboard/shortcut automation: %s" % e, file=sys.stderr)
        return 0

    def run_pdf():
        pdf_dir = os.path.join(R, "pdf")
        s = time.time()
        rc_p = run_stage(mod("build_pdf").main, [F["pkg"], "--out", pdf_dir, "--profile", profile_path])
        if rc_p:
            metrics["stages"]["build_pdf"] = {"duration_s": round(time.time() - s, 3), "rc": rc_p}
            return rc_p
        pdf_check = os.path.join(R, "pdf_check_report.json")
        rc_chk = run_stage(mod("check_pdf").main, [
            os.path.join(pdf_dir, "question-paper-A.pdf"),
            os.path.join(pdf_dir, "answer-key-B.pdf"),
            os.path.join(pdf_dir, "explanations-C.pdf"),
            "--package", F["pkg"],
            "--report", pdf_check
        ])
        metrics["stages"]["build_pdf"] = {"duration_s": round(time.time() - s, 3), "rc": rc_chk}
        return rc_chk

    if (do_web or do_pdf) and os.path.isfile(F["pkg"]):
        render_jobs = {}
        if do_web:
            render_jobs["build_web"] = run_web
        if do_pdf:
            render_jobs["build_pdf"] = run_pdf
        if len(render_jobs) == 1:
            k, fn = next(iter(render_jobs.items()))
            timed(k, fn)
            mark(k, "ok")
        else:
            render_results = run_parallel(render_jobs, max_workers=2)
            for k, rrc in render_results.items():
                mark(k, "ok" if rrc == 0 else "failed")

    # 8. Final Delivery Packaging
    if (a.deliver or a.delivery_dir) and os.path.isfile(F["pkg"]):
        deliv_dir = a.delivery_dir or "output"
        rc = timed("delivery", lambda: run_stage(mod("package_delivery").main, [
            F["pkg"],
            "--out-dir", deliv_dir,
            "--mode", a.delivery_mode,
            "--profile", profile_path,
        ]))
        mark("delivery", "ok" if rc == 0 else "failed")

    save_metrics()
    print("pipeline_lite %s: completed in %.2fs -> %s" % (a.run_id, metrics["total_s"], R))
    return 0


if __name__ == "__main__":
    sys.exit(run_main(main, sys.argv[1:]))
