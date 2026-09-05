import sys
import os

# Ensure site-packages are loaded for Python environment
_site_pkg = r"C:\Users\wabi_sabi\AppData\Local\Programs\Python\Python314\Lib\site-packages"
if _site_pkg not in sys.path and os.path.exists(_site_pkg):
    sys.path.insert(0, _site_pkg)

import re
import io
import csv
from flask import Flask, render_template, request, jsonify  # type: ignore

# Biopython for standard GenBank & EMBL files
try:
    from Bio import SeqIO  # type: ignore
    BIOPYTHON_AVAILABLE = True
except ImportError:
    BIOPYTHON_AVAILABLE = False

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 32 * 1024 * 1024  # 32 MB limit

# ----------------------------------------------------------------------
# HELPER PARSERS
# ----------------------------------------------------------------------

def extract_label(qualifiers, feature_type, index):
    """Extracts a clean label from GenBank feature qualifiers."""
    for key in ['gene', 'product', 'locus_tag', 'label', 'standard_name', 'name', 'ID', 'note']:
        if key in qualifiers and qualifiers[key]:
            val = qualifiers[key][0] if isinstance(qualifiers[key], list) else qualifiers[key]
            return re.sub(r'\s+', '_', str(val).strip())
    return f"{feature_type}_{index}"


def parse_genbank_embl(content):
    """Parses GenBank and EMBL formatted text using BioPython."""
    if not BIOPYTHON_AVAILABLE:
        return None

    for fmt in ["genbank", "embl"]:
        try:
            records = list(SeqIO.parse(io.StringIO(content), fmt))
            if records and any(len(r.features) > 0 for r in records):
                mvista_lines = []
                stats = {"CDS": 0, "gene": 0, "exon": 0, "tRNA": 0, "rRNA": 0, "other": 0}
                total = 0

                for record in records:
                    feat_idx = 1
                    for feat in record.features:
                        if feat.type in ["source", "ORIGIN"]:
                            continue

                        # Strand: +1 -> '>', -1 -> '<'
                        strand_symbol = ">" if feat.location.strand != -1 else "<"
                        
                        # 1-based coordinates for mVISTA
                        start = int(feat.location.start) + 1
                        end = int(feat.location.end)
                        feat_type = feat.type.strip()
                        label = extract_label(feat.qualifiers, feat_type, feat_idx)

                        mvista_lines.append(f"{strand_symbol} {start} {end} {feat_type} {label}")
                        
                        if feat_type in stats:
                            stats[feat_type] += 1
                        else:
                            stats["other"] += 1

                        total += 1
                        feat_idx += 1

                if total > 0:
                    return {
                        "format": fmt.upper(),
                        "lines": mvista_lines,
                        "stats": stats,
                        "total": total
                    }
        except Exception:
            continue
    return None


def parse_gff_gtf(content):
    """Parses GFF3 / GTF / GFF format lines."""
    lines = content.splitlines()
    mvista_lines = []
    stats = {"CDS": 0, "gene": 0, "exon": 0, "tRNA": 0, "rRNA": 0, "other": 0}
    total = 0

    for idx, raw_line in enumerate(lines, start=1):
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue

        parts = line.split("\t")
        if len(parts) >= 8:
            feat_type = parts[2].strip()
            try:
                start = int(parts[3].strip())
                end = int(parts[4].strip())
            except ValueError:
                continue

            strand_char = parts[6].strip()
            strand_symbol = "<" if strand_char == "-" else ">"

            label = f"{feat_type}_{idx}"
            if len(parts) >= 9:
                attrs = parts[8].strip()
                match = re.search(r'(?:Name|gene|ID|gene_name|gene_id)=["\']?([^;\s"\']+)["\']?', attrs, re.IGNORECASE)
                if match:
                    label = match.group(1)

            mvista_lines.append(f"{strand_symbol} {start} {end} {feat_type} {label}")

            if feat_type in stats:
                stats[feat_type] += 1
            else:
                stats["other"] += 1
            total += 1

    if total > 0:
        return {
            "format": "GFF/GTF",
            "lines": mvista_lines,
            "stats": stats,
            "total": total
        }
    return None


def parse_generic_text_table(content):
    """
    Intelligently parses any plain text table (.txt, .tsv, .csv, whitespace-separated).
    Detects coordinates, feature types, strand symbols, and gene labels.
    """
    lines = content.splitlines()
    mvista_lines = []
    stats = {"CDS": 0, "gene": 0, "exon": 0, "tRNA": 0, "rRNA": 0, "other": 0}
    total = 0

    known_types = {"CDS", "GENE", "EXON", "TRNA", "RRNA", "MRNA", "UTR", "MISC_FEATURE", "INTRON", "PROMOTER"}

    for idx, raw_line in enumerate(lines, start=1):
        line = raw_line.strip()
        if not line or line.startswith("#") or line.startswith("//"):
            continue

        # Case 1: Already in mVISTA format (e.g. '> 100 500 CDS geneA')
        mvista_match = re.match(r'^([><])\s*(\d+)\s+(\d+)\s+([A-Za-z0-9_\-]+)(?:\s+(.*))?$', line)
        if mvista_match:
            strand = mvista_match.group(1)
            start = int(mvista_match.group(2))
            end = int(mvista_match.group(3))
            ftype = mvista_match.group(4)
            label = mvista_match.group(5).strip() if mvista_match.group(5) else f"{ftype}_{idx}"
            label = re.sub(r'\s+', '_', label)
            mvista_lines.append(f"{strand} {start} {end} {ftype} {label}")
            
            ft_key = ftype.upper()
            if ft_key in stats:
                stats[ft_key] += 1
            else:
                stats["other"] += 1
            total += 1
            continue

        # Case 2: Delimited row (CSV, TSV, or arbitrary whitespace)
        tokens = re.split(r'[,;\t\s]+', line)
        tokens = [t.strip() for t in tokens if t.strip()]

        if len(tokens) < 2:
            continue

        numbers = []
        non_numbers = []
        strand_symbol = ">"

        for tok in tokens:
            if tok in ["-", "-1", "reverse", "rev", "R", "<"]:
                strand_symbol = "<"
            elif tok in ["+", "1", "+1", "forward", "for", "F", ">"]:
                strand_symbol = ">"
            elif re.match(r'^\d+$', tok):
                numbers.append(int(tok))
            else:
                non_numbers.append(tok)

        if len(numbers) >= 2:
            start, end = numbers[0], numbers[1]
            if start > end:
                start, end = end, start
                strand_symbol = "<"

            feat_type = "CDS"
            label = f"feature_{idx}"

            for item in non_numbers:
                if item.upper() in known_types:
                    feat_type = item.upper()
                    break

            remaining_labels = [item for item in non_numbers if item.upper() != feat_type.upper()]
            if remaining_labels:
                label = re.sub(r'\s+', '_', remaining_labels[0])

            mvista_lines.append(f"{strand_symbol} {start} {end} {feat_type} {label}")

            if feat_type in stats:
                stats[feat_type] += 1
            else:
                stats["other"] += 1
            total += 1

    if total > 0:
        return {
            "format": "TXT / Tabular",
            "lines": mvista_lines,
            "stats": stats,
            "total": total
        }
    return None


def convert_to_mvista_engine(raw_text):
    """Cascading converter that automatically identifies file format."""
    # 1. Try GenBank / EMBL
    result = parse_genbank_embl(raw_text)
    if result and result["total"] > 0:
        return result

    # 2. Try GFF3 / GTF
    result = parse_gff_gtf(raw_text)
    if result and result["total"] > 0:
        return result

    # 3. Try plain text / CSV / TSV / Coordinate tables
    result = parse_generic_text_table(raw_text)
    if result and result["total"] > 0:
        return result

    return None

# ----------------------------------------------------------------------
# ROUTES
# ----------------------------------------------------------------------

@app.route('/')
def index():
    return render_template('index.html')


@app.route('/convert-mvista', methods=['POST'])
def convert_mvista():
    raw_content = ""

    if 'file' in request.files:
        uploaded_file = request.files['file']
        if uploaded_file.filename != '':
            raw_content = uploaded_file.read().decode('utf-8', errors='replace')

    if not raw_content and 'text' in request.form:
        raw_content = request.form['text']
    elif not raw_content and request.is_json:
        data = request.get_json()
        raw_content = data.get('text', '')

    if not raw_content.strip():
        return jsonify({
            'success': False,
            'error': 'No file or data provided. Please upload a GenBank, EMBL, GFF, or TXT file.'
        }), 400

    parsed = convert_to_mvista_engine(raw_content)

    if not parsed or parsed["total"] == 0:
        return jsonify({
            'success': False,
            'error': 'Unable to parse coordinate features. Please ensure your file contains valid GenBank records or tabular coordinates (Start, End, Feature, Label).'
        }), 422

    mvista_output = "\n".join(parsed["lines"])

    return jsonify({
        'success': True,
        'format_detected': parsed["format"],
        'total_count': parsed["total"],
        'stats': parsed["stats"],
        'mvista_data': mvista_output
    })


@app.route('/extract', methods=['POST'])
def extract_coordinates():
    raw_content = ""
    if 'file' in request.files:
        uploaded_file = request.files['file']
        if uploaded_file.filename != '':
            raw_content = uploaded_file.read().decode('utf-8', errors='replace')
    elif 'text' in request.form:
        raw_content = request.form['text']
    elif request.is_json:
        raw_content = request.get_json().get('text', '')

    if not raw_content.strip():
        return jsonify({'success': False, 'error': 'No file content received.'}), 400

    parsed = convert_to_mvista_engine(raw_content)
    if not parsed:
        return jsonify({'success': False, 'error': 'No genomic features found.'}), 422

    features = []
    for line in parsed["lines"]:
        parts = line.split()
        if len(parts) >= 4:
            strand = "+" if parts[0] == ">" else "-"
            features.append({
                "strand": strand,
                "start": int(parts[1]),
                "end": int(parts[2]),
                "type": parts[3],
                "label": parts[4] if len(parts) > 4 else parts[3]
            })

    return jsonify({
        'success': True,
        'features': features,
        'count': len(features),
        'stats': parsed["stats"]
    })


if __name__ == '__main__':
    print("🚀 Genomic Insights & mVISTA Converter Server running at http://127.0.0.1:5000")
    app.run(debug=True, port=5000)
