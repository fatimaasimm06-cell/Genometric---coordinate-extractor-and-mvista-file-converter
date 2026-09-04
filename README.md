# NexusVista 🧬

**NexusVista** is a bioinformatics web utility designed to streamline genomic sequence annotation workflows. It processes GenBank files and converts feature data—including CDS, exons, genes, and non-coding RNA—into official mVISTA coordinate formats ready for immediate alignment and visualization.

---

## 🌟 Key Features

* **GenBank to mVISTA Conversion:** Formats genomic feature annotations directly into official mVISTA guidelines (`> start end type label`).
* **Coordinate Extractor:** Tooling designed for rapid extraction and isolation of precise sequence coordinates.
* **Feature Support:** Handles various genomic elements including CDS, exons, genes, and ncRNA annotations.
* **Instant Export:** Generates standardized, clean output files formatted specifically for immediate upload to the mVISTA comparative genomics platform.
* **Modern Interface:** Futuristic cyberpunk-inspired UI equipped with interactive audio feedback and fast client-side switching between processing modes.

---

## 🛠️ Tech Stack

* **Backend:** Python / Flask
* **Frontend:** HTML5, CSS3, JavaScript (Tailwind CSS / Custom Styling)
* **Parsing Engine:** Biopython / Custom GenBank Regex Parsers

---

## 🚀 Quick Start

### Prerequisites

Ensure you have Python 3.8 or higher installed on your system.

```bash
python --version
