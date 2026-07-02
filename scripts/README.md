# MaintlyQR — Scripts

Scripts de generación de documentos legales y documentos fundacionales.
Todos los PDFs de salida usan reportlab con el branding oficial de MaintlyQR.

## Requisitos

```bash
pip install reportlab
```

## Archivos

| Script | Descripción | Output |
|--------|-------------|--------|
| `generate_legal_package.py` | Genera los 10 documentos legales v1.0 | `legal_package/*.pdf` |
| `update_docs_01_07.py` | Actualiza Doc 01 (ToS) y Doc 07 (Verified Mechanic) a v1.1 | Sobreescribe los PDFs |
| `update_doc_02.py` | Actualiza Doc 02 (Privacy Policy) a v1.1 | Sobreescribe el PDF |
| `update_docs_05_09_10.py` | Actualiza Docs 05, 09, 10 a v1.1 | Sobreescribe los PDFs |
| `generate_founding_story.py` | Genera la Founding Story en español e inglés | `legal_package/MaintlyQR_Founding_Story_*.pdf` |
| `generate_dev_log.py` | Genera el Development Log v1.0 | `legal_package/MaintlyQR_Development_Log_v1.0.pdf` |

## Uso

```bash
# Generar el paquete legal completo (v1.1)
python generate_legal_package.py
python update_docs_01_07.py
python update_doc_02.py
python update_docs_05_09_10.py

# Generar documentos fundacionales
python generate_founding_story.py
python generate_dev_log.py
```

Los PDFs se generan en la carpeta `legal_package/`.
Copiar los PDFs legales a `public/legal/` para que estén disponibles en la plataforma.

## Versiones

- v1.0 — Paquete legal inicial (10 documentos)
- v1.1 — Revisiones: entity language, cláusulas adicionales en ToS, Asset Passport en IP Policy, API pricing, trademark scope
- Fecha efectiva: 2 de julio de 2026
