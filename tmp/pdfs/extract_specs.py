from pathlib import Path
import sys
from pypdf import PdfReader

SOURCE = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(r"C:\RPG\Infinita\infinita core engine")
OUTPUT = Path(__file__).parent

for pdf in sorted(SOURCE.glob("*.pdf")):
    reader = PdfReader(str(pdf))
    text = []
    for index, page in enumerate(reader.pages, start=1):
        text.append(f"\n\n===== PAGE {index} =====\n\n")
        text.append(page.extract_text() or "")
    target = OUTPUT / f"{pdf.stem}.txt"
    target.write_text("".join(text), encoding="utf-8")
    print(f"{pdf.name}\t{len(reader.pages)} pages\t{target.stat().st_size} bytes")
