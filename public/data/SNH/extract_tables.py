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
page_start = int(sys.argv[2]) if len(sys.argv) > 2 else 10
page_end = int(sys.argv[3]) if len(sys.argv) > 3 else 25

reader = PdfReader(pdf_path)
print(f'Total pages: {len(reader.pages)}')
print(f'Extracting pages {page_start} to {page_end}')
print('='*80)

for i in range(page_start - 1, min(page_end, len(reader.pages))):
    page = reader.pages[i]
    text = page.extract_text() or ''
    if 'Table' in text or 'Distance' in text or 'Km' in text or 'km' in text:
        print(f'\n--- Page {i+1} ---')
        print(text)
        print('='*80)
