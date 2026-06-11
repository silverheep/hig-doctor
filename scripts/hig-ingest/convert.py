#!/usr/bin/env python3
"""
Convert a cached HIG DocC JSON page into the repo's reference-markdown format.

Unlike the original generator (which kept only headings + bold guideline
statements as a "structured index"), this renders Apple's full prose:
intro paragraphs, guideline statements, lists, asides, code, and links.

Mitigations retained from the repo's legal posture:
  - images are skipped (never reproduced)
  - every file carries the attribution block + canonical-footer

Inline model (DocC):  text / strong / emphasis / codeVoice / reference / link / image
Block model (DocC):   paragraph / heading / unorderedList / orderedList /
                       aside / codeListing / row+column / termList / table
"""
import json
import os

APPLE = "https://developer.apple.com"
HIG_URL = APPLE + "/design/human-interface-guidelines"


def resolve_ref(identifier, refs):
    """Return (title, url) for a reference identifier, or (None, None)."""
    r = refs.get(identifier)
    if not r:
        return None, None
    title = r.get("title") or r.get("name") or identifier
    url = r.get("url", "")
    if url.startswith("/"):
        url = APPLE + url
    return title, url


def render_inline(nodes, refs):
    out = []
    for n in nodes or []:
        t = n.get("type")
        if t == "text":
            out.append(n.get("text", ""))
        elif t == "strong":
            out.append("**" + render_inline(n.get("inlineContent", []), refs) + "**")
        elif t == "emphasis":
            out.append("*" + render_inline(n.get("inlineContent", []), refs) + "*")
        elif t == "codeVoice":
            out.append("`" + n.get("code", "") + "`")
        elif t == "reference":
            title, url = resolve_ref(n.get("identifier", ""), refs)
            if title and url:
                out.append(f"[{title}]({url})")
            elif title:
                out.append(title)
        elif t == "link":
            dest = n.get("destination", "")
            if dest.startswith("/"):
                dest = APPLE + dest
            out.append(f"[{n.get('title', dest)}]({dest})")
        elif t == "image":
            # Legal hardening: never reproduce Apple imagery.
            continue
        elif t == "inlineContent" or "inlineContent" in n:
            out.append(render_inline(n.get("inlineContent", []), refs))
    return "".join(out)


def render_blocks(blocks, refs, depth=0):
    """Render a list of content blocks to markdown lines."""
    lines = []
    for b in blocks or []:
        t = b.get("type")
        if t == "paragraph":
            txt = render_inline(b.get("inlineContent", []), refs).strip()
            if txt:  # skip image-only paragraphs (render to empty)
                lines.append(txt)
                lines.append("")
        elif t == "heading":
            level = min(max(b.get("level", 2), 2), 6)
            lines.append("#" * level + " " + b.get("text", "").strip())
            lines.append("")
        elif t == "aside":
            name = b.get("name") or b.get("style", "note").title()
            inner = render_blocks(b.get("content", []), refs, depth + 1)
            body = "\n".join(inner).strip().splitlines() or [""]
            lines.append(f"> **{name}:** {body[0]}")
            for extra in body[1:]:
                lines.append(f"> {extra}")
            lines.append("")
        elif t in ("unorderedList", "orderedList"):
            ordered = t == "orderedList"
            for i, item in enumerate(b.get("items", []), 1):
                inner = render_blocks(item.get("content", []), refs, depth + 1)
                inner_lines = [ln for ln in "\n".join(inner).strip().splitlines()]
                marker = f"{i}." if ordered else "*"
                if inner_lines:
                    lines.append(f"{marker} {inner_lines[0]}")
                    for extra in inner_lines[1:]:
                        lines.append(f"  {extra}")
            lines.append("")
        elif t == "codeListing":
            syntax = b.get("syntax", "")
            lines.append("```" + (syntax or ""))
            lines.extend(b.get("code", []))
            lines.append("```")
            lines.append("")
        elif t == "row":
            for col in b.get("columns", []):
                lines.extend(render_blocks(col.get("content", []), refs, depth))
        elif t == "termList":
            for item in b.get("items", []):
                term = render_inline(item.get("term", {}).get("inlineContent", []), refs)
                definition = render_blocks(item.get("definition", {}).get("content", []), refs)
                lines.append(f"* **{term}** — " + " ".join(definition).strip())
            lines.append("")
        elif t == "table":
            rows = b.get("rows", [])
            for ri, row in enumerate(rows):
                cells = [render_inline(c[0].get("inlineContent", []), refs)
                         if c and isinstance(c[0], dict) else "" for c in row]
                lines.append("| " + " | ".join(cells) + " |")
                if ri == 0:
                    lines.append("| " + " | ".join("---" for _ in cells) + " |")
            lines.append("")
    return lines


def convert(json_path, slug, snapshot_date):
    data = json.load(open(json_path))
    refs = data.get("references", {})
    title = data.get("metadata", {}).get("title", slug)
    page_url = f"{HIG_URL}/{slug}"

    body = []
    for sec in data.get("primaryContentSections", []):
        if sec.get("kind") == "content":
            body.extend(render_blocks(sec.get("content", []), refs))

    md = []
    md.append("---")
    md.append(f'title: "{title} | Apple Developer Documentation"')
    md.append(f"source: {page_url}")
    md.append("---")
    md.append("")
    md.append("<!-- hig-doctor:attribution -->")
    md.append(f"> **Source**: Apple Inc. Canonical content at {page_url}.")
    md.append(f"> This file reproduces that content for AI agent reference, snapshot {snapshot_date}.")
    md.append("> Apple HIG text is © Apple Inc.; imagery is omitted. This repository provides "
              "organization and cross-referencing for AI agent consumption only.")
    md.append("")
    md.append(f"# {title}")
    md.append("")
    md.extend(body)
    md.append("---")
    md.append("")
    md.append("<!-- hig-doctor:canonical-footer -->")
    md.append("For the complete guidance, including worked examples and illustrations, "
              f"see the canonical page: {page_url}")
    md.append("")

    # Collapse 3+ blank lines to 2
    text = "\n".join(md)
    while "\n\n\n" in text:
        text = text.replace("\n\n\n", "\n\n")
    return text.rstrip() + "\n"


if __name__ == "__main__":
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("slug")
    ap.add_argument("--cache", default=".hig-cache/json")
    ap.add_argument("--snapshot", default="2026-06-11")
    args = ap.parse_args()
    print(convert(os.path.join(args.cache, args.slug + ".json"), args.slug, args.snapshot))
