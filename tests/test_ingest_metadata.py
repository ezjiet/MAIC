import unittest
from pathlib import Path

from src.ingest import load_source_metadata, metadata_for_source, process_text


class IngestMetadataTests(unittest.TestCase):
    def test_kwsp_9c_has_official_form_metadata(self):
        metadata = metadata_for_source(
            Path("KWSP_9C_AHL_D5.pdf"), "kwsp", load_source_metadata()
        )
        self.assertEqual(metadata["agency"], "KWSP")
        self.assertEqual(metadata["document_type"], "form")
        self.assertEqual(metadata["form_code"], "KWSP 9C (AHL) (D5)")
        self.assertTrue(metadata["source_url"].startswith("https://www.kwsp.gov.my/"))

    def test_official_text_snapshot_keeps_provenance_on_every_chunk(self):
        source = Path("data/raw/kwsp/KWSP_What_Is_EPF_About_Us.txt")
        metadata = metadata_for_source(source, "kwsp", load_source_metadata())
        chunks = process_text(source, "kwsp", metadata)
        self.assertGreaterEqual(len(chunks), 1)
        self.assertTrue(all(chunk["agency"] == "KWSP" for chunk in chunks))
        self.assertTrue(all(chunk["document_type"] == "guidance" for chunk in chunks))
        self.assertTrue(all(chunk["title"] == "What Is EPF? — About Us" for chunk in chunks))
        self.assertTrue(all(chunk["source_url"] == metadata["source_url"] for chunk in chunks))


if __name__ == "__main__":
    unittest.main()
