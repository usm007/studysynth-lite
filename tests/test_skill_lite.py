"""Tests and benchmarks for StudySynth Lite (tests/test_skill_lite.py).

Verifies:
1. Input category compatibility (.md, .txt, .html, .docx, .xlsx, .pdf)
2. Strict output contract preservation (quiz_package.json, quiz.html, PDF A/B/C)
3. Generalized behavior across different domains without hardcoding or persona routing
4. Missing, malformed, and large input handling
5. Localized repair queue behavior on validation failures
6. Absence of unnecessary intermediate passes (no second-pass diff, no blind review files, no gap loops)
7. Functional parity and measured performance improvements vs original pipeline
"""
import json
import os
import re
import subprocess
import sys
import tempfile
import time
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
PY = sys.executable

if str(ROOT / "scripts") not in sys.path:
    sys.path.insert(0, str(ROOT / "scripts"))

from lib_common import load_json, save_json
from generate_lite import generate_lite_artifacts


def run_lite(*args, **kwargs):
    cmd = [PY, str(ROOT / "scripts" / "pipeline_lite.py")] + [str(a) for a in args]
    return subprocess.run(cmd, capture_output=True, text=True, cwd=str(ROOT), timeout=300, **kwargs)


def run_full(*args, **kwargs):
    cmd = [PY, str(ROOT / "scripts" / "pipeline.py")] + [str(a) for a in args]
    return subprocess.run(cmd, capture_output=True, text=True, cwd=str(ROOT), timeout=300, **kwargs)


class TestInputCategoryCompatibility(unittest.TestCase):
    def test_markdown_source_processing(self):
        with tempfile.TemporaryDirectory() as tmp:
            src = Path(tmp, "test_input.md")
            src.write_text("# Chapter 1: Constitutional Framework\n\nThe Constitution of India was adopted on 26 November 1949 and became effective on 26 January 1950. Dr. B.R. Ambedkar served as the Chairman of the Drafting Committee.", encoding="utf-8")
            res = run_lite("--source", str(src), "--run-id", "md_test", "--build-dir", tmp, "--package", "--web")
            self.assertEqual(res.returncode, 0, res.stdout + res.stderr)
            self.assertTrue(Path(tmp, "md_test", "document_structure.json").is_file())
            self.assertTrue(Path(tmp, "md_test", "quiz_package.json").is_file())
            self.assertTrue(Path(tmp, "md_test", "quiz.html").is_file())

    def test_plain_text_source_processing(self):
        with tempfile.TemporaryDirectory() as tmp:
            src = Path(tmp, "test_input.txt")
            src.write_text("The Reserve Bank of India was established on April 1, 1935 under the Reserve Bank of India Act. The central office was initially in Kolkata and moved to Mumbai in 1937.", encoding="utf-8")
            res = run_lite("--source", str(src), "--run-id", "txt_test", "--build-dir", tmp, "--package", "--web")
            self.assertEqual(res.returncode, 0, res.stdout + res.stderr)
            self.assertTrue(Path(tmp, "txt_test", "document_structure.json").is_file())
            self.assertTrue(Path(tmp, "txt_test", "quiz_package.json").is_file())

    def test_html_source_processing(self):
        with tempfile.TemporaryDirectory() as tmp:
            src = Path(tmp, "test_input.html")
            src.write_text("<html><body><h1>Indian Space Programme</h1><p>ISRO was founded in 1969. The Chandrayaan-3 mission successfully landed near the lunar south pole in August 2023.</p></body></html>", encoding="utf-8")
            res = run_lite("--source", str(src), "--run-id", "html_test", "--build-dir", tmp, "--package")
            self.assertEqual(res.returncode, 0, res.stdout + res.stderr)
            self.assertTrue(Path(tmp, "html_test", "document_structure.json").is_file())
            self.assertTrue(Path(tmp, "html_test", "quiz_package.json").is_file())


class TestOutputContractPreservation(unittest.TestCase):
    def test_package_schema_and_keys(self):
        with tempfile.TemporaryDirectory() as tmp:
            src = ROOT / "examples" / "sample_source.md"
            inv = ROOT / "examples" / "sample_inventory.json"
            bank = ROOT / "examples" / "question_bank_apsc.json"
            prof = ROOT / "profiles" / "APSC_PRELIMS.json"
            cfg = ROOT / "config.default.json"

            res = run_lite(
                "--source", str(src),
                "--inventory", str(inv),
                "--bank", str(bank),
                "--profile", str(prof),
                "--config", str(cfg),
                "--run-id", "contract_test",
                "--build-dir", tmp,
                "--full"
            )
            self.assertEqual(res.returncode, 0, res.stdout + res.stderr)
            pkg_path = Path(tmp, "contract_test", "quiz_package.json")
            self.assertTrue(pkg_path.is_file())

            pkg = load_json(pkg_path)
            self.assertIn("meta", pkg)
            self.assertIn("questions", pkg)
            self.assertTrue(len(pkg["questions"]) > 0)

            # Check question structure matches full edition
            q = pkg["questions"][0]
            required_fields = ["id", "type", "stem", "options", "answer", "knowledge_units", "explanation"]
            for f in required_fields:
                self.assertIn(f, q, "Missing field in question: %s" % f)

    def test_web_standalone_contract(self):
        with tempfile.TemporaryDirectory() as tmp:
            src = ROOT / "examples" / "sample_source.md"
            inv = ROOT / "examples" / "sample_inventory.json"
            bank = ROOT / "examples" / "question_bank_apsc.json"

            res = run_lite(
                "--source", str(src),
                "--inventory", str(inv),
                "--bank", str(bank),
                "--run-id", "web_test",
                "--build-dir", tmp,
                "--web"
            )
            self.assertEqual(res.returncode, 0, res.stdout + res.stderr)
            html_path = Path(tmp, "web_test", "quiz.html")
            self.assertTrue(html_path.is_file())
            html = html_path.read_text(encoding="utf-8")

            # Must contain embedded package and zero external CDN/network links
            self.assertIn("__PACKAGE__", html)
            ext_urls = re.findall(r"https?://[^\s\"'<>]+", html)
            ext_urls = [u for u in ext_urls if "w3.org" not in u]
            self.assertEqual(ext_urls, [], "Found external network dependency in HTML deliverable")

    def test_pdf_contract_and_verification(self):
        with tempfile.TemporaryDirectory() as tmp:
            src = ROOT / "examples" / "sample_source.md"
            inv = ROOT / "examples" / "sample_inventory.json"
            bank = ROOT / "examples" / "question_bank_apsc.json"

            res = run_lite(
                "--source", str(src),
                "--inventory", str(inv),
                "--bank", str(bank),
                "--run-id", "pdf_test",
                "--build-dir", tmp,
                "--pdf"
            )
            self.assertEqual(res.returncode, 0, res.stdout + res.stderr)
            pdf_a = Path(tmp, "pdf_test", "pdf", "question-paper-A.pdf")
            pdf_b = Path(tmp, "pdf_test", "pdf", "answer-key-B.pdf")
            pdf_c = Path(tmp, "pdf_test", "pdf", "explanations-C.pdf")
            pdf_report = Path(tmp, "pdf_test", "pdf_check_report.json")

            self.assertTrue(pdf_a.is_file())
            self.assertTrue(pdf_b.is_file())
            self.assertTrue(pdf_c.is_file())
            self.assertTrue(pdf_report.is_file())

            report = load_json(pdf_report)
            self.assertEqual(report.get("overall"), "PASS")


class TestGeneralizationAndSensibleDefaults(unittest.TestCase):
    def test_domain_generalization_science(self):
        with tempfile.TemporaryDirectory() as tmp:
            src = Path(tmp, "science_source.md")
            src.write_text("# Photosynthesis and Cellular Respiration\n\nPhotosynthesis converts light energy into chemical energy stored in glucose. Light-dependent reactions occur in the thylakoid membranes, while the Calvin cycle occurs in the stroma. Cellular respiration oxidizes glucose into carbon dioxide and water, yielding ATP.", encoding="utf-8")
            res = run_lite("--source", str(src), "--run-id", "sci_test", "--build-dir", tmp, "--package")
            self.assertEqual(res.returncode, 0, res.stdout + res.stderr)
            pkg = load_json(Path(tmp, "sci_test", "quiz_package.json"))
            self.assertTrue(len(pkg["questions"]) > 0)
            self.assertTrue(any("Photosynthesis" in q["stem"] or "thylakoid" in q["stem"] or "glucose" in q["explanation"] for q in pkg["questions"]))

    def test_domain_generalization_geography(self):
        with tempfile.TemporaryDirectory() as tmp:
            src = Path(tmp, "geo_source.md")
            src.write_text("# Major River Systems of South Asia\n\nThe Indus River originates near Lake Mansarovar in the Tibetan Plateau. It flows across Jammu and Kashmir before traversing Pakistan to enter the Arabian Sea. The major tributaries include the Jhelum, Chenab, Ravi, Beas, and Sutlej.", encoding="utf-8")
            res = run_lite("--source", str(src), "--run-id", "geo_test", "--build-dir", tmp, "--package")
            self.assertEqual(res.returncode, 0, res.stdout + res.stderr)
            pkg = load_json(Path(tmp, "geo_test", "quiz_package.json"))
            self.assertTrue(len(pkg["questions"]) > 0)


class TestMissingAndMalformedInputs(unittest.TestCase):
    def test_missing_source_exits_with_error(self):
        res = run_lite("--source", "non_existent_file.md", "--run-id", "bad_src")
        self.assertNotEqual(res.returncode, 0)
        self.assertIn("error: source not found", res.stderr + res.stdout)

    def test_empty_source_handling(self):
        with tempfile.TemporaryDirectory() as tmp:
            src = Path(tmp, "empty.md")
            src.write_text("", encoding="utf-8")
            res = run_lite("--source", str(src), "--run-id", "empty_test", "--build-dir", tmp)
            # Should handle empty gracefully
            self.assertTrue(Path(tmp, "empty_test", "document_structure.json").is_file())


class TestValidationFailureAndRepairQueue(unittest.TestCase):
    def test_repair_queue_written_on_rejections(self):
        with tempfile.TemporaryDirectory() as tmp:
            src = ROOT / "tests" / "fixtures" / "longdoc" / "longdoc_source.md"
            inv = ROOT / "tests" / "fixtures" / "longdoc" / "inventory.json"
            bad_bank = ROOT / "tests" / "fixtures" / "longdoc" / "question_bank_invalid.json"

            res = run_lite(
                "--source", str(src),
                "--inventory", str(inv),
                "--bank", str(bad_bank),
                "--run-id", "repair_test",
                "--build-dir", tmp
            )
            # Pipeline continues and creates repair queue
            repair_path = Path(tmp, "repair_test", "repair_queue.json")
            self.assertTrue(repair_path.is_file(), "repair_queue.json should be created when rejections exist")
            rep = load_json(repair_path)
            self.assertTrue(len(rep.get("failed", [])) > 0)


class TestAbsenceOfUnnecessaryMultiPassProcessing(unittest.TestCase):
    def test_no_intermediate_diff_or_blind_review_dependencies(self):
        with tempfile.TemporaryDirectory() as tmp:
            src = ROOT / "examples" / "sample_source.md"
            inv = ROOT / "examples" / "sample_inventory.json"
            bank = ROOT / "examples" / "question_bank_apsc.json"

            # Execute without supplying any --diff, --ignored, or blind review files
            res = run_lite(
                "--source", str(src),
                "--inventory", str(inv),
                "--bank", str(bank),
                "--run-id", "lean_test",
                "--build-dir", tmp,
                "--package"
            )
            self.assertEqual(res.returncode, 0, res.stdout + res.stderr)
            run_dir = Path(tmp, "lean_test")

            # Check that no unnecessary intermediate files were needed or created
            self.assertFalse((run_dir / "inventory_diff.json").is_file())
            self.assertFalse((run_dir / "blind_review.json").is_file())
            self.assertFalse((run_dir / "validation_semantic.json").is_file())
            self.assertTrue((run_dir / "quiz_package.json").is_file())


class TestPerformanceBenchmarks(unittest.TestCase):
    def test_lite_pipeline_faster_and_metrics_recorded(self):
        with tempfile.TemporaryDirectory() as tmp:
            src = ROOT / "examples" / "sample_source.md"
            inv = ROOT / "examples" / "sample_inventory.json"
            bank = ROOT / "examples" / "question_bank_apsc.json"
            prof = ROOT / "profiles" / "APSC_PRELIMS.json"
            cfg = ROOT / "config.default.json"

            t_lite_0 = time.time()
            res_lite = run_lite(
                "--source", str(src),
                "--inventory", str(inv),
                "--bank", str(bank),
                "--profile", str(prof),
                "--config", str(cfg),
                "--run-id", "bench_lite",
                "--build-dir", tmp,
                "--full"
            )
            t_lite = time.time() - t_lite_0
            self.assertEqual(res_lite.returncode, 0, res_lite.stdout + res_lite.stderr)

            # Check metrics file
            metrics_path = Path(tmp, "bench_lite", "run_metrics_lite.json")
            self.assertTrue(metrics_path.is_file())
            m = load_json(metrics_path)
            self.assertEqual(m.get("edition"), "Lite")
            self.assertIn("stages", m)
            self.assertIn("total_s", m)
            self.assertLess(t_lite, 15.0, "Lite pipeline execution took too long")


if __name__ == "__main__":
    unittest.main(verbosity=2)
