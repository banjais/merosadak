import sys
from pathlib import Path

try:
    from pypdf import PdfReader
except ImportError:
    try:
        from PyPDF2 import PdfReader
    except ImportError:
        print('ERROR: No PDF library found')
        sys.exit(1)

pdf_path = sys.argv[1]
max_pages = int(sys.argv[2]) if len(sys.argv) > 2 else 5

reader = PdfReader(pdf_path)
print(f'Total pages: {len(reader.pages)}')
print('='*80)

for i in range(min(max_pages, len(reader.pages))):
    page = reader.pages[i]
    text = page.extract_text() or ''
    print(f'\n--- Page {i+1} ---')
    print(text[:4000])
    print('...')
