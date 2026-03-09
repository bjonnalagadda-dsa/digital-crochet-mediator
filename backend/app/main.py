import re
import fitz
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from .stitch_library import lookup_stitch

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

TERM_RE = re.compile(
    r"\b(ch|sc|dc|hdc|tr|sl\s*st|rnd|round|row|rows|st|sts|inc|dec|tog|rep|repeat|sc2tog|hdc2tog|dc2tog|tr2tog|yo|sk|blo|flo)\b",
    re.IGNORECASE,
)

STEP_RE = re.compile(r"^(round|rnd|row|rows)\s*\d+[:\)]", re.IGNORECASE)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/parse-file")
async def parse_file(file: UploadFile = File(...)):
    data = await file.read()
    doc = fitz.open(stream=data, filetype="pdf")
    text = "\n".join([page.get_text() for page in doc])

    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]

    # Unique terms across full document
    found_terms = []
    for m in TERM_RE.finditer(text):
        term = re.sub(r"\s+", " ", m.group(0).lower().strip())
        found_terms.append(term)

    unique_terms = sorted(set(found_terms))

    # Add backend stitch metadata
    stitch_details = []
    for term in unique_terms:
        info = lookup_stitch(term)
        if info:
            stitch_details.append({
                "term": term,
                "title": info["title"],
                "definition": info["definition"],
                "tutorial_url": info["tutorial_url"],
            })
        else:
            stitch_details.append({
                "term": term,
                "title": term.upper(),
                "definition": "Definition not added yet.",
                "tutorial_url": "",
            })

    # Step extraction
    steps = []
    for ln in lines:
        if STEP_RE.search(ln):
            step_terms = []
            for m in TERM_RE.finditer(ln):
                term = re.sub(r"\s+", " ", m.group(0).lower().strip())
                step_terms.append(term)

            step_terms = sorted(set(step_terms))

            steps.append({
                "text": ln,
                "terms": step_terms,
                "term_details": [
                    {
                        "term": t,
                        **(
                            lookup_stitch(t)
                            if lookup_stitch(t)
                            else {
                                "title": t.upper(),
                                "definition": "Definition not added yet.",
                                "tutorial_url": "",
                            }
                        ),
                    }
                    for t in step_terms
                ],
            })

    return {
        "filename": file.filename,
        "unique_terms": unique_terms,
        "stitch_details": stitch_details,
        "steps": steps[:50],
        "text_preview": text[:800],
    }