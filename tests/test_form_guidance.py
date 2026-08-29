"""Regression tests for temporary attachments and the canonical chat contract."""
from __future__ import annotations

import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

from src import attachments
from src.attachments import AttachmentProcessingError, AttachmentRecord
from src.generate import citation_payloads_from_chunks
from src.retrieve import (
    build_recommended_forms,
    expand_query,
    filter_context_for_intent,
    _is_agency_definition_query,
    identify_official_form,
    normalize_form_metadata,
    rerank_document_text,
    retrieve_exact_form,
    select_reranked_chunks,
    title_ranked_candidates,
)


EXTRACTED = "KUMPULAN WANG SIMPANAN PEKERJA KWSP 9F AHL PERMOHONAN PENGELUARAN\nD3 Amount requested"
IDENTITY = {"document_type": "government_form", "agency": "KWSP", "form_name": "KWSP 9F Withdrawal", "form_code": "KWSP 9F"}


class AttachmentServiceTests(unittest.TestCase):
    def setUp(self):
        attachments.clear_attachment_store()

    def create(self, name: str, content_type: str, data: bytes):
        with patch("src.attachments._extract_text", return_value=EXTRACTED), patch(
            "src.attachments._identify_from_official_corpus", return_value=IDENTITY
        ):
            return attachments.create_attachment(name, content_type, data)

    def test_pdf_is_accepted(self):
        self.assertEqual(self.create("form.pdf", "application/pdf", b"%PDF-1.7 test").content_type, "application/pdf")

    def test_jpeg_is_accepted(self):
        self.assertEqual(self.create("form.jpg", "image/jpeg", b"\xff\xd8\xfftest").content_type, "image/jpeg")

    def test_png_is_accepted(self):
        self.assertEqual(self.create("form.png", "image/png", b"\x89PNG\r\n\x1a\ntest").content_type, "image/png")

    def test_unsupported_type_is_rejected(self):
        with self.assertRaises(AttachmentProcessingError) as caught:
            self.create("notes.txt", "text/plain", b"plain text")
        self.assertEqual(caught.exception.status_code, 415)

    def test_mismatched_content_is_rejected(self):
        with self.assertRaises(AttachmentProcessingError) as caught:
            self.create("form.pdf", "application/pdf", b"\x89PNG\r\n\x1a\ntest")
        self.assertEqual(caught.exception.status_code, 400)

    def test_oversize_is_rejected(self):
        with self.assertRaises(AttachmentProcessingError) as caught:
            self.create("form.pdf", "application/pdf", b"%PDF-" + b"x" * attachments.MAX_ATTACHMENT_BYTES)
        self.assertEqual(caught.exception.status_code, 413)

    def test_ids_are_random_and_no_path_is_exposed(self):
        first = self.create("../private/form.pdf", "application/pdf", b"%PDF-1")
        second = self.create("form.pdf", "application/pdf", b"%PDF-2")
        self.assertNotEqual(first.attachment_id, second.attachment_id)
        self.assertEqual(first.filename, "form.pdf")
        self.assertFalse(any("path" in key for key in first.__dict__))


class RecommendationTests(unittest.TestCase):
    def test_recommendation_uses_retrieved_form_metadata(self):
        chunks = [{"source": "KWSP_9F_AHL_Borang_Pengeluaran.pdf.pdf", "agency": "KWSP", "text": "withdrawal application form", "page": 1}]
        forms = build_recommended_forms(chunks, "How do I apply for a withdrawal?")
        self.assertEqual(len(forms), 1)
        self.assertEqual(forms[0]["agency"], "KWSP")
        self.assertIn("KWSP_9F", forms[0]["download_url"])

    def test_non_form_source_is_never_recommended(self):
        chunks = [{"source": "Member_Guide.pdf.pdf", "agency": "KWSP", "text": "withdrawal application", "page": 1}]
        self.assertEqual(build_recommended_forms(chunks, "How do I apply for withdrawal?"), [])

    def test_less_relevant_retrieved_forms_are_filtered(self):
        chunks = [
            {"source": "KWSP_9FA_AHL_Borang_Pengeluaran_Akaun_Fleksibel.pdf.pdf", "agency": "KWSP", "text": "flexible account withdrawal", "page": 1},
            {"source": "KWSP_Form_Pindah_Akaun_2_Ke_Akaun_1.pdf.pdf", "agency": "KWSP", "text": "account withdrawal options including fleksibel", "page": 1},
        ]
        forms = build_recommended_forms(chunks, "How do I apply for Akaun Fleksibel withdrawal?")
        self.assertEqual(len(forms), 1)
        self.assertIn("Fleksibel", forms[0]["form_name"])

    def test_house_query_recommends_only_grounded_kwsp_9c_form(self):
        chunks = [
            {
                "source": "KWSP_9C_AHL_D5.pdf.pdf",
                "agency": "KWSP",
                "text": "SENARAI SEMAKAN DOKUMEN PERMOHONAN PENGELUARAN MEMBELI / MEMBINA RUMAH 3/6 KWSP 9C (AHL) (D5)",
                "page": 3,
            },
            {
                "source": "KWSP_9C_AHL_D5.pdf.pdf",
                "agency": "KWSP",
                "text": "Borang Permohonan Pengeluaran Membeli / Membina Rumah, KWSP 9C (AHL) (D5)",
                "page": 1,
            },
        ]
        forms = build_recommended_forms(chunks, "Which form do I need to use my KWSP savings to purchase a house?")
        self.assertEqual(len(forms), 1)
        self.assertEqual(forms[0]["form_name"], "Borang Permohonan Pengeluaran Membeli / Membina Rumah")
        self.assertEqual(forms[0]["form_code"], "KWSP 9C (AHL) (D5)")
        self.assertIsNone(forms[0]["source_url"])

    def test_general_kwsp_question_has_no_form_recommendation(self):
        chunks = [{
            "source": "KWSP_9C_AHL_D5.pdf.pdf",
            "agency": "KWSP",
            "text": "KWSP 9C (AHL) (D5)",
            "page": 1,
        }]
        self.assertEqual(build_recommended_forms(chunks, "What is KWSP?"), [])

    def test_renewal_query_does_not_recommend_non_renewal_licence_form(self):
        chunks = [{
            "source": "JPJ_Borang_Permohonan_Lesen_Memandu_JPJ_L1.pdf.pdf",
            "agency": "JPJ",
            "text": "New learner, probationary, class addition, copy, conversion and international permit",
            "page": 2,
        }]
        self.assertEqual(build_recommended_forms(chunks, "Which form do I need to renew my driving licence?"), [])

    def test_vague_agency_form_query_does_not_choose_random_form(self):
        chunks = [{
            "source": "KWSP_9C_AHL_D5.pdf.pdf",
            "agency": "KWSP",
            "text": "KWSP 9C house purchase form",
            "page": 1,
        }]
        self.assertEqual(build_recommended_forms(chunks, "Which KWSP form do I need?"), [])
        self.assertEqual(filter_context_for_intent("Which KWSP form do I need?", "KWSP", chunks), [])

    def test_metadata_does_not_fabricate_form_code_or_official_url(self):
        metadata = normalize_form_metadata({
            "source": "KWSP_Form_Example.pdf.pdf",
            "agency": "KWSP",
            "text": "Borang example without an official code or URL",
        })
        self.assertIsNotNone(metadata)
        self.assertIsNone(metadata["form_code"])
        self.assertIsNone(metadata["source_url"])
        self.assertTrue(metadata["download_url"].startswith("/pdfs/kwsp/"))

    def test_letter_prefixed_kwsp_code_is_preserved(self):
        metadata = normalize_form_metadata({
            "source": "KWSP_Form_KWSP_R1_AHL.pdf.pdf",
            "agency": "KWSP",
            "text": "PERMOHONAN BAYARAN TAMBAHAN PENGELUARAN KWSP R1 (AHL)",
        })
        self.assertEqual(metadata["form_code"], "KWSP R1 (AHL)")

    def test_upload_identity_prefers_exact_printed_code_from_corpus(self):
        corpus = [{
            "source": "KWSP_Form_KWSP_R1_AHL.pdf.pdf",
            "agency": "KWSP",
            "text": "PERMOHONAN BAYARAN TAMBAHAN PENGELUARAN KWSP R1 (AHL)",
            "page": 1,
        }]
        with patch("src.retrieve._load_bm25", return_value={"chunks": corpus}):
            identity = identify_official_form(
                "Kumpulan Wang Simpanan Pekerja PERMOHONAN BAYARAN TAMBAHAN PENGELUARAN KWSP R1 (AHL)"
            )
        self.assertEqual(identity["agency"], "KWSP")
        self.assertEqual(identity["form_code"], "KWSP R1 (AHL)")

    def test_house_query_expansion_contains_corpus_language(self):
        expanded = expand_query("purchase a house", "kwsp").lower()
        self.assertIn("pengeluaran membeli rumah", expanded)
        self.assertIn("home purchase", expanded)

    def test_malay_house_query_expands_to_english_housing_terms(self):
        expanded = expand_query("Saya nak beli rumah", "kwsp").lower()
        self.assertIn("house purchase", expanded)


class RetrievalGroundingTests(unittest.TestCase):
    def test_general_agency_overview_wording_is_detected(self):
        self.assertTrue(_is_agency_definition_query("What is KWSP?", "KWSP"))
        self.assertTrue(_is_agency_definition_query("What is KWSP and what does it do?", "KWSP"))
        self.assertFalse(
            _is_agency_definition_query("How do I withdraw money from KWSP?", "KWSP")
        )

    def test_reranking_uses_curated_title_before_filename(self):
        text = rerank_document_text({
            "source": "opaque.pdf",
            "title": "Buy or Build Home Withdrawal",
            "text": "official form body",
        })
        self.assertTrue(text.startswith("Buy or Build Home Withdrawal."))
        self.assertNotIn("opaque", text)

    def test_curated_title_match_enters_candidate_pool(self):
        chunks = [
            {"source": "generic.pdf", "title": "Foreign Tax Treatment", "id": "generic"},
            {
                "source": "relief.txt",
                "title": "Individual Tax Reliefs — Year of Assessment 2025",
                "id": "relief",
            },
        ]
        selected = title_ranked_candidates(
            chunks, "What tax relief can an individual claim?", [50.0, 1.0]
        )
        self.assertEqual(selected[0]["id"], "relief")

    def test_weaker_topic_adjacent_source_is_not_presented_as_evidence(self):
        chunks = [
            {"source": "direct-guidance.txt", "text": "direct answer", "page": 1},
            {"source": "topic-adjacent.pdf", "text": "same generic terms", "page": 4},
            {"source": "direct-guidance.txt", "text": "supporting detail", "page": 1},
        ]
        fused = [{"chunk": chunk, "score": 0.03} for chunk in chunks]
        selected = select_reranked_chunks(fused, [0.92, 0.80, 0.74])
        self.assertEqual({chunk["source"] for chunk in selected}, {"direct-guidance.txt"})

    def test_title_alignment_removes_generic_term_overlap(self):
        chunks = [
            {
                "source": "relief.txt",
                "title": "Individual Tax Reliefs — Year of Assessment 2025",
                "text": "direct answer",
            },
            {
                "source": "foreign.pdf",
                "title": "Tax Treatment of Foreign Nationals",
                "text": "mentions claim and relief",
            },
        ]
        fused = [{"chunk": chunk, "score": 0.03} for chunk in chunks]
        selected = select_reranked_chunks(
            fused, [0.91, 0.83], query="individual tax relief claim"
        )
        self.assertEqual([chunk["source"] for chunk in selected], ["relief.txt"])

    def test_exact_form_retrieval_cannot_be_displaced_by_another_form(self):
        corpus = [
            {
                "source": "KWSP_Form_KWSP_R1_AHL.pdf.pdf",
                "agency": "KWSP",
                "text": "C2 payment amount",
                "page": 4,
            },
            {
                "source": "KWSP_9C_AHL_D5.pdf.pdf",
                "agency": "KWSP",
                "text": "house purchase",
                "page": 1,
            },
        ]
        with patch("src.retrieve._load_bm25", return_value={"chunks": corpus}), patch(
            "src.retrieve._reranker.predict", return_value=[0.95]
        ):
            selected = retrieve_exact_form("Explain C2", "KWSP", "KWSP R1 (AHL)")
        self.assertEqual([chunk["source"] for chunk in selected], [
            "KWSP_Form_KWSP_R1_AHL.pdf.pdf"
        ])

    def test_bare_agency_definition_does_not_cite_transaction_forms(self):
        chunks = [{
            "source": "KWSP_Form_KWSP_15_Transf_Saving_from_Monetary_Groups.pdf.pdf",
            "agency": "KWSP",
            "text": "transfer form",
            "page": 1,
        }]
        self.assertEqual(filter_context_for_intent("What is KWSP?", "KWSP", chunks), [])

    def test_explicit_form_request_keeps_only_equally_strong_secondary_sources(self):
        chunks = [
            {"source": "JPJ_Borang_Permohonan_Lesen_Memandu_JPJ_L1.pdf.pdf", "_retrieval_score": 0.82},
            {"source": "JPJ_Borang_Permohonan_Lesen_Memandu_JPJ_L1.pdf.pdf", "_retrieval_score": 0.56},
            {"source": "JPJ_Borang_Permohonan_Pengecualian.pdf.pdf", "_retrieval_score": 0.73},
        ]
        selected = filter_context_for_intent("Which form do I need for a driving licence?", "JPJ", chunks)
        self.assertEqual({chunk["source"] for chunk in selected}, {
            "JPJ_Borang_Permohonan_Lesen_Memandu_JPJ_L1.pdf.pdf"
        })

    def test_process_guidance_does_not_cite_nearby_application_form(self):
        chunks = [
            {
                "source": "JPJ_Competent_Driving_Licence_CDL_Renewal.txt",
                "document_type": "guidance",
                "_retrieval_score": 0.91,
            },
            {
                "source": "JPJ_Borang_Permohonan_Lesen_Memandu_JPJ_L1.pdf.pdf",
                "document_type": "form",
                "_retrieval_score": 0.84,
            },
        ]
        selected = filter_context_for_intent(
            "How do I renew my Malaysian driving licence?", "JPJ", chunks
        )
        self.assertEqual([chunk["source"] for chunk in selected], [
            "JPJ_Competent_Driving_Licence_CDL_Renewal.txt"
        ])

    def test_malay_house_form_request_rejects_nearby_registration_form(self):
        chunks = [
            {"source": "KWSP_9C_AHL_D5.pdf.pdf", "_retrieval_score": 0.983},
            {"source": "KWSP_9C_AHL_D5.pdf.pdf", "_retrieval_score": 0.961},
            {"source": "KWSP_Form_KWSP_3_Daftar.pdf.pdf", "_retrieval_score": 0.934},
        ]
        selected = filter_context_for_intent(
            "Saya nak guna KWSP untuk beli rumah. Borang apa saya perlu?", "KWSP", chunks
        )
        self.assertEqual({chunk["source"] for chunk in selected}, {"KWSP_9C_AHL_D5.pdf.pdf"})

    def test_jpj_code_comes_from_source_boundary(self):
        metadata = normalize_form_metadata({
            "source": "JPJ_Borang_Permohonan_Lesen_Memandu_JPJ_L1.pdf.pdf",
            "agency": "JPJ",
            "text": "JPJ L1 ISI BORANG INI DENGAN HURUF BESAR",
        })
        self.assertEqual(metadata["form_code"], "JPJ L1")

    def test_weak_unrelated_forms_are_removed_after_reranking(self):
        chunks = [
            {"source": "KWSP_9C_AHL_D5.pdf.pdf", "agency": "KWSP", "text": "house purchase", "page": 3},
            {"source": "KWSP_9C_AHL_D5.pdf.pdf", "agency": "KWSP", "text": "buy a house", "page": 4},
            {"source": "KWSP_Form_15.pdf.pdf", "agency": "KWSP", "text": "contribution withdrawal", "page": 1},
            {"source": "KWSP_9FA_AHL.pdf.pdf", "agency": "KWSP", "text": "Akaun Fleksibel", "page": 3},
        ]
        fused = [{"chunk": chunk, "score": 0.03 - index / 1000} for index, chunk in enumerate(chunks)]
        selected = select_reranked_chunks(fused, [0.85, 0.59, 0.033, 0.018])
        self.assertEqual({chunk["source"] for chunk in selected}, {"KWSP_9C_AHL_D5.pdf.pdf"})

    def test_all_weak_results_produce_no_grounding_context(self):
        fused = [{"chunk": {
            "source": "KWSP_Form_KWSP_15_Transf_Saving_from_Monetary_Groups.pdf.pdf",
            "agency": "KWSP",
            "text": "unrelated transfer form",
            "page": 1,
        }, "score": 0.03}]
        self.assertEqual(select_reranked_chunks(fused, [0.04]), [])

    def test_topic_drift_is_removed_relative_to_strong_top_match(self):
        chunks = [
            {"source": "KWSP_9FA_(AHL)_BORANG_PERMOHONAN_PENGELUARAN_AKAUN_FLEKSIBEL.pdf.pdf", "text": "Akaun Fleksibel", "page": 1},
            {"source": "KWSP_9FA_(AHL)_BORANG_PERMOHONAN_PENGELUARAN_AKAUN_FLEKSIBEL.pdf.pdf", "text": "flexible withdrawal", "page": 2},
            {"source": "KWSP_Form_Pindah_Akaun_2_Ke_Akaun_1.pdf.pdf", "text": "account transfer", "page": 1},
        ]
        fused = [{"chunk": chunk, "score": 0.03} for chunk in chunks]
        selected = select_reranked_chunks(fused, [0.97, 0.53, 0.43])
        self.assertEqual({chunk["source"] for chunk in selected}, {
            "KWSP_9FA_(AHL)_BORANG_PERMOHONAN_PENGELUARAN_AKAUN_FLEKSIBEL.pdf.pdf"
        })

    def test_citations_are_derived_only_from_final_context(self):
        chunks = [
            {"source": "KWSP_9C_AHL_D5.pdf.pdf", "page": 3, "effective_date": None},
            {"source": "KWSP_9C_AHL_D5.pdf.pdf", "page": 4, "effective_date": None},
        ]
        self.assertEqual(citation_payloads_from_chunks(chunks), [{
            "source": "KWSP_9C_AHL_D5.pdf.pdf",
            "page": 3,
            "effective_date": None,
        }])


class ApiContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        from src.api import app
        cls.client = TestClient(app)

    def setUp(self):
        attachments.clear_attachment_store()

    def test_attachment_endpoint_accepts_pdf_jpeg_and_png(self):
        cases = [
            ("form.pdf", "application/pdf", b"%PDF-1.7 test"),
            ("form.jpg", "image/jpeg", b"\xff\xd8\xfftest"),
            ("form.png", "image/png", b"\x89PNG\r\n\x1a\ntest"),
        ]
        with patch("src.attachments._extract_text", return_value=EXTRACTED), patch(
            "src.attachments._identify_from_official_corpus", return_value=IDENTITY
        ):
            for filename, content_type, data in cases:
                with self.subTest(filename=filename):
                    response = self.client.post("/attachments", files={"file": (filename, data, content_type)})
                    self.assertEqual(response.status_code, 201)
                    self.assertEqual(response.json()["status"], "ready")
                    self.assertTrue(response.json()["attachment_id"].startswith("att_"))
                    self.assertNotIn("path", response.json())

    def test_attachment_endpoint_rejects_unsupported_and_oversized_files(self):
        unsupported = self.client.post("/attachments", files={"file": ("notes.txt", b"notes", "text/plain")})
        oversized = self.client.post("/attachments", files={"file": ("form.pdf", b"%PDF-" + b"x" * attachments.MAX_ATTACHMENT_BYTES, "application/pdf")})
        self.assertEqual(unsupported.status_code, 415)
        self.assertEqual(oversized.status_code, 413)

    def test_normal_chat_uses_canonical_response(self):
        response = self.client.post("/ask", json={"conversation_id": "chat-1", "message": "hi", "history": [], "attachments": []})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(set(response.json()), {"answer", "agency", "status", "citations", "recommended_forms", "suggested_follow_ups"})

    def test_missing_runtime_attachment_returns_410(self):
        response = self.client.post("/ask", json={"conversation_id": "chat-1", "message": "Explain D3", "attachments": [{"attachment_id": "att_missing"}]})
        self.assertEqual(response.status_code, 410)
        self.assertIn("upload", response.json()["detail"].lower())

    def test_attachment_context_reaches_answer_without_form_filling(self):
        record = AttachmentRecord("att_test123", "form.pdf", "application/pdf", EXTRACTED, "government_form", "KWSP", "KWSP 9F Withdrawal", "KWSP 9F")
        attachments._ATTACHMENTS[record.attachment_id] = record
        official = {"id": "1", "source": "KWSP_9F_AHL_Borang_Pengeluaran.pdf.pdf", "agency": "KWSP", "text": "D3 requested withdrawal amount", "page": 2}
        generated = {"answer": "D3 asks for the requested withdrawal amount.", "citations": [{"source": official["source"], "page": 2, "effective_date": None}], "refused": False}
        with patch("src.api._retrieve_for_agencies", return_value=[official]), patch("src.api.answer", return_value=generated) as mocked_answer:
            response = self.client.post("/ask", json={"conversation_id": "chat-1", "message": "What does D3 mean?", "attachments": [{"attachment_id": record.attachment_id}]})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["recommended_forms"], [])
        self.assertIn("D3", mocked_answer.call_args.kwargs["attachment_context"])

    def test_attachment_grounding_excludes_a_different_form_code(self):
        from src.api import _attachment_grounding_chunks

        record = AttachmentRecord(
            "att_r1", "form.pdf", "application/pdf", "KWSP R1 (AHL)",
            "government_form", "KWSP", "Additional Withdrawal Payment", "KWSP R1 (AHL)",
        )
        chunks = [
            {"source": "KWSP_Form_KWSP_R1_AHL.pdf.pdf", "agency": "KWSP", "text": "KWSP R1 (AHL)", "page": 1},
            {"source": "KWSP_Form_KWSP_9KM_AHL_BM.pdf.pdf", "agency": "KWSP", "text": "KWSP 9KM (AHL)", "page": 3},
        ]
        selected = _attachment_grounding_chunks(chunks, [record])
        self.assertEqual([chunk["source"] for chunk in selected], ["KWSP_Form_KWSP_R1_AHL.pdf.pdf"])

    def test_missing_field_code_is_refused_without_calling_ai(self):
        record = AttachmentRecord("att_test123", "form.pdf", "application/pdf", "KWSP 9F Section B", "government_form", "KWSP", "KWSP 9F Withdrawal", "KWSP 9F")
        attachments._ATTACHMENTS[record.attachment_id] = record
        with patch("src.api.answer") as mocked_answer:
            response = self.client.post("/ask", json={"conversation_id": "chat-1", "message": "What does D3 mean?", "attachments": [{"attachment_id": record.attachment_id}]})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "refused")
        mocked_answer.assert_not_called()

    def test_ambiguous_attachment_field_is_refused_without_guessing(self):
        record = AttachmentRecord(
            "att_test123", "form.pdf", "application/pdf", "KWSP R1 Section A C1 C2",
            "government_form", "KWSP", "KWSP R1", "KWSP R1 (AHL)",
        )
        attachments._ATTACHMENTS[record.attachment_id] = record
        with patch("src.api.answer") as mocked_answer:
            response = self.client.post("/ask", json={
                "conversation_id": "chat-1",
                "message": "What should I put here?",
                "attachments": [{"attachment_id": record.attachment_id}],
            })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "refused")
        self.assertIn("field name", response.json()["answer"].lower())
        mocked_answer.assert_not_called()

    def test_cors_is_limited_to_local_frontend(self):
        allowed = self.client.options("/ask", headers={"Origin": "http://localhost:3000", "Access-Control-Request-Method": "POST"})
        blocked = self.client.options("/ask", headers={"Origin": "https://example.com", "Access-Control-Request-Method": "POST"})
        self.assertEqual(allowed.headers.get("access-control-allow-origin"), "http://localhost:3000")
        self.assertNotEqual(blocked.headers.get("access-control-allow-origin"), "https://example.com")


if __name__ == "__main__":
    unittest.main()
