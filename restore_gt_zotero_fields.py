"""Turn the raw Zotero JSON text in the GT DOCX back into Word Zotero fields."""
from __future__ import annotations

import copy
import re
import sys
import tempfile
import zipfile
from pathlib import Path

from lxml import etree

W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
NS = {"w": W}
Q = lambda name: f"{{{W}}}{name}"


def read_document(path: Path) -> etree._Element:
    with zipfile.ZipFile(path) as archive:
        return etree.fromstring(archive.read("word/document.xml"))


def source_codes(path: Path) -> dict[str, str]:
    codes = {}
    root = read_document(path)
    for node in root.xpath("//w:instrText", namespaces=NS):
        code = "".join(node.itertext())
        if "ADDIN ZOTERO_ITEM CSL_CITATION " not in code:
            continue
        citation_id = re.search(r'"citationID":"([^"]+)', code).group(1)
        codes[citation_id] = code.split("ADDIN ZOTERO_", 1)[1].strip()
    return codes


def existing_field_codes(root: etree._Element) -> dict[str, str]:
    codes = {}
    for node in root.xpath("//w:instrText", namespaces=NS):
        code = "".join(node.itertext())
        if "ADDIN ZOTERO_ITEM CSL_CITATION " in code:
            citation_id = re.search(r'"citationID":"([^"]+)', code).group(1)
            codes[citation_id] = code.split("ADDIN ZOTERO_", 1)[1].strip()
    return codes


def formatted_citation(code: str) -> str:
    import json
    payload = code.split("CSL_CITATION ", 1)[1]
    return json.JSONDecoder().raw_decode(payload)[0]["properties"]["formattedCitation"]


def run_with_text(style_run: etree._Element, text: str, instr: bool = False) -> etree._Element:
    run = etree.Element(Q("r"))
    properties = style_run.find(Q("rPr"))
    if properties is not None:
        run.append(copy.deepcopy(properties))
    child = etree.SubElement(run, Q("instrText") if instr else Q("t"))
    child.set("{http://www.w3.org/XML/1998/namespace}space", "preserve")
    child.text = text
    return run


def field_runs(style_run: etree._Element, code: str) -> list[etree._Element]:
    begin = etree.Element(Q("r"))
    etree.SubElement(begin, Q("fldChar"), {Q("fldCharType"): "begin"})
    separate = etree.Element(Q("r"))
    etree.SubElement(separate, Q("fldChar"), {Q("fldCharType"): "separate"})
    end = etree.Element(Q("r"))
    etree.SubElement(end, Q("fldChar"), {Q("fldCharType"): "end"})
    return [begin, run_with_text(style_run, " ADDIN ZOTERO_" + code + " ", instr=True), separate,
            run_with_text(style_run, formatted_citation(code)), end]


def main(gt_file: Path, complete_file: Path, output: Path) -> None:
    codes = source_codes(complete_file)
    root = read_document(gt_file)
    existing = existing_field_codes(root)
    runs = root.xpath("//w:body//w:r", namespaces=NS)
    active = None
    cursor = 0
    inserted: set[str] = set()
    remove: list[etree._Element] = []
    insertions: list[tuple[etree._Element, list[etree._Element]]] = []

    for run in runs:
        value = "".join(run.xpath("w:t/text()", namespaces=NS))
        start = re.search(r'ITEM CSL_CITATION \{"citationID":"([^"]+)', value)
        if start:
            citation_id = start.group(1)
            if citation_id not in codes:
                raise RuntimeError(f"No complete code found for {citation_id}")
            active = citation_id
            cursor = 0
            if citation_id in existing:
                # Its field code survived; only its raw display result needs replacing.
                insertions.append((run, [run_with_text(run, formatted_citation(existing[citation_id]))]))
                codes[citation_id] = existing[citation_id]
            else:
                insertions.append((run, field_runs(run, codes[citation_id])))
                inserted.add(citation_id)
            # Even when the old text differs from the exported source (the three
            # truncated citations), its marker is raw metadata, never manuscript text.
            remove.append(run)
        if active and value:
            expected = codes[active]
            offset = expected.find(value, cursor)
            if offset >= 0:
                remove.append(run)
                cursor = offset + len(value)
                if cursor >= len(expected):
                    active = None
    if active:
        # The three known damaged source strings end early; all matching fragments were removed.
        active = None
    if len(inserted) != 53 or len(existing) != 3:
        raise RuntimeError(f"Expected 53 new and 3 existing fields, found {len(inserted)} new and {len(existing)} existing")

    # Insert complete hidden fields before deleting matching raw-JSON fragments.
    for old, replacements in insertions:
        parent = old.getparent()
        index = parent.index(old)
        for replacement in replacements:
            parent.insert(index, replacement)
            index += 1
    for run in remove:
        parent = run.getparent()
        if parent is not None:
            parent.remove(run)

    # The GT file contains this one citation as ordinary text rather than raw JSON.
    missing_id = "9h3210N2"
    target_text = formatted_citation(codes[missing_id])
    plain_nodes = root.xpath("//w:t[contains(., 'Deppe and Rotenberry 2008')]", namespaces=NS)
    if len(plain_nodes) != 1:
        raise RuntimeError(f"Expected one plain-text location for {missing_id}, found {len(plain_nodes)}")
    node = plain_nodes[0]
    run = node.getparent()
    value = node.text or ""
    before, after = value.split(target_text, 1)
    parent = run.getparent()
    position = parent.index(run)
    replacements = []
    if before:
        replacements.append(run_with_text(run, before))
    replacements.extend(field_runs(run, codes[missing_id]))
    if after:
        replacements.append(run_with_text(run, after))
    for replacement in replacements:
        parent.insert(position, replacement)
        position += 1
    parent.remove(run)
    inserted.add(missing_id)

    with tempfile.TemporaryDirectory() as temp_dir:
        stage = Path(temp_dir)
        with zipfile.ZipFile(gt_file) as archive:
            archive.extractall(stage)
        etree.ElementTree(root).write(stage / "word/document.xml", encoding="UTF-8", xml_declaration=True, standalone=True)
        with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as archive:
            for path in stage.rglob("*"):
                if path.is_file():
                    archive.write(path, path.relative_to(stage))
    print(f"Restored {len(inserted)} citations as Zotero Word fields; removed {len(remove)} raw-JSON runs.")


if __name__ == "__main__":
    if len(sys.argv) != 4:
        raise SystemExit("Usage: restore_gt_zotero_fields.py GT.docx COMPLETE.docx OUTPUT.docx")
    main(Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3]))
