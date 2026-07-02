"""Regenerates Doc 02 with entity language fix (v1.1)."""
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, HRFlowable
from reportlab.lib.enums import TA_CENTER
import os

OUTPUT_DIR = "/home/claude/legal_package"
RED      = colors.HexColor("#dc2626")
DARK     = colors.HexColor("#111111")
GRAY     = colors.HexColor("#666666")
LIGHT_HR = colors.HexColor("#e4e4e7")

def build_doc(filename, doc_number, title, tagline, sections):
    path = os.path.join(OUTPUT_DIR, filename)
    doc = SimpleDocTemplate(path, pagesize=A4,
        rightMargin=2*cm, leftMargin=2*cm, topMargin=2*cm, bottomMargin=2*cm)
    brand  = ParagraphStyle("Brand",  fontName="Helvetica-Bold",    fontSize=13, textColor=RED,  spaceAfter=6)
    h1     = ParagraphStyle("H1",     fontName="Helvetica-Bold",    fontSize=22, textColor=DARK, spaceAfter=4)
    meta   = ParagraphStyle("Meta",   fontName="Helvetica",         fontSize=9,  textColor=GRAY, spaceAfter=2)
    dated  = ParagraphStyle("Date",   fontName="Helvetica",         fontSize=10, textColor=GRAY, spaceAfter=12)
    tagl   = ParagraphStyle("Tag",    fontName="Helvetica-Oblique", fontSize=9,  textColor=GRAY, spaceAfter=14)
    h2     = ParagraphStyle("H2",     fontName="Helvetica-Bold",    fontSize=12, textColor=RED,  spaceBefore=16, spaceAfter=6)
    body   = ParagraphStyle("Body",   fontName="Helvetica",         fontSize=10, textColor=DARK, leading=16, spaceAfter=6)
    bullet = ParagraphStyle("Bullet", fontName="Helvetica",         fontSize=10, textColor=DARK, leading=16, leftIndent=16, spaceAfter=4)
    note   = ParagraphStyle("Note",   fontName="Helvetica-Oblique", fontSize=9,  textColor=GRAY, leading=14, spaceAfter=6, leftIndent=12)
    ftr    = ParagraphStyle("Ftr",    fontName="Helvetica",         fontSize=8,  textColor=GRAY, alignment=TA_CENTER)

    story = [
        Paragraph("MaintlyQR", brand),
        Paragraph(title, h1),
        Paragraph(f"Document {doc_number} of 10  ·  MaintlyQR Legal Package v1.1", meta),
        Paragraph("Effective: July 2, 2026  ·  Revised: July 2, 2026", dated),
    ]
    if tagline:
        story.append(Paragraph(tagline, tagl))
    story.append(HRFlowable(width="100%", thickness=2, color=RED, spaceAfter=18))

    for section in sections:
        story.append(Paragraph(section["heading"], h2))
        for para in section["content"]:
            if para.startswith("- "):
                story.append(Paragraph("•  " + para[2:], bullet))
            elif para.startswith("[NOTE] "):
                story.append(Paragraph(para[7:], note))
            else:
                story.append(Paragraph(para, body))
        story.append(Spacer(1, 4))

    story += [
        HRFlowable(width="100%", thickness=1, color=LIGHT_HR, spaceBefore=20, spaceAfter=8),
        Paragraph("www.maintlyqr.com  ·  support@maintlyqr.com  ·  Queensland, Australia", ftr),
    ]
    doc.build(story)
    print(f"  [OK] {filename}")


build_doc(
    "MaintlyQR_02_Privacy_Policy.pdf", "02",
    "Privacy Policy",
    "How MaintlyQR collects, uses, stores, and protects your personal information.",
    [
        {"heading": "1. Who We Are", "content": [
            'MaintlyQR™ ("MaintlyQR", "we", "us", "our") is a technology platform providing QR-based digital identity and maintenance history tracking for physical assets. MaintlyQR is operated pending formal legal incorporation; upon incorporation, the operating entity will be MaintlyQR Pty Ltd (ACN pending), headquartered in Queensland, Australia. References to "MaintlyQR" apply equally to any successor legal entity.',
            "This Privacy Policy explains how we handle personal information collected through www.maintlyqr.com (the Platform). We comply with the Australian Privacy Act 1988, the Australian Privacy Principles (APPs), and where applicable, the EU General Data Protection Regulation (GDPR) and UK GDPR.",
        ]},
        {"heading": "2. Information We Collect", "content": [
            "Information you provide directly:",
            "- Name and email address (at registration)",
            "- Professional details (mechanic or business name, trade registration number)",
            "- Asset information (type, make, model, serial number, location)",
            "- Maintenance and service records (dates, descriptions, mileage, hours, parts used)",
            "- Photos of assets and service records (optional)",
            "- Communications you send to support@maintlyqr.com",
            "Information collected automatically:",
            "- IP address and approximate geographic location",
            "- Browser type, device type, and operating system",
            "- Pages visited, features used, and session duration",
            "- Authentication tokens and session identifiers",
        ]},
        {"heading": "3. How We Use Your Information", "content": [
            "We use your information to:",
            "- Create and manage your account",
            "- Display maintenance history on public QR pages",
            "- Generate PDF service reports",
            "- Operate, maintain, and improve the Platform",
            "- Send essential service communications (security alerts, account updates, policy changes)",
            "- Process Verified Mechanic applications",
            "- Comply with legal obligations",
            "- In anonymised or aggregated form: improve AI features and analyse Platform usage",
            "We do not sell your personal information to third parties. Ever.",
        ]},
        {"heading": "4. Public Information", "content": [
            "The maintenance records you add to any asset's Maintenance Ledger are publicly visible to anyone who scans the associated QR code — this is a core feature of MaintlyQR.",
            "By adding records, you acknowledge this information is publicly accessible. Do not include sensitive personal information in service records or asset descriptions.",
        ]},
        {"heading": "5. Third-Party Providers", "content": [
            "We share your information only with:",
            "- Supabase — database, authentication, and storage provider (data encrypted in transit and at rest)",
            "- Vercel — hosting and content delivery provider",
            "- Legal and regulatory authorities, when required by law",
            "We do not use third-party advertising networks, tracking pixels, or data brokers. All providers are bound by their own privacy policies and are selected for their high security standards.",
        ]},
        {"heading": "6. Data Storage and Security", "content": [
            "Your data is stored using Supabase, which provides:",
            "- Encryption in transit (TLS/SSL)",
            "- Encryption at rest (AES-256)",
            "- Row-level security ensuring users can only access their own data",
            "We apply industry-standard security practices. No system is 100% secure. In the event of a data breach affecting your rights, we will notify you as required by applicable law.",
        ]},
        {"heading": "7. Artificial Intelligence", "content": [
            "MaintlyQR may use AI to analyse patterns in anonymised, aggregated maintenance data to improve Platform features. Your personally identifiable information is not used to train external AI models. If AI features are applied directly to your records, you will be informed.",
        ]},
        {"heading": "8. Retention", "content": [
            "We retain your account data for as long as your account is active. Upon account deletion, we delete your personal information within 30 days, except where retention is legally required.",
            "Public QR maintenance records remain accessible until the asset owner removes them.",
        ]},
        {"heading": "9. Your Rights", "content": [
            "Depending on your location, you may have the right to:",
            "- Access the personal information we hold about you",
            "- Correct inaccurate information",
            "- Request deletion of your data",
            "- Object to or restrict how we process your data",
            "- Export your data in a portable format (JSON, CSV, or PDF)",
            "- Withdraw consent at any time where processing is consent-based",
            "To exercise any right, contact support@maintlyqr.com. We will respond within 30 days.",
            "Australian users: rights under the Privacy Act 1988 and Australian Privacy Principles.",
            "EU/UK users: rights under the GDPR/UK GDPR, including the right to lodge a complaint with your supervisory authority.",
        ]},
        {"heading": "10. Cookies", "content": [
            "We use essential cookies only: to maintain your login session and enable core Platform functionality. We do not use advertising cookies, tracking pixels, or third-party analytics cookies.",
            "Full details are in the Cookie Policy (Document 3).",
        ]},
        {"heading": "11. Children's Privacy", "content": [
            "MaintlyQR is not intended for anyone under 18. We do not knowingly collect personal information from minors. If you believe a minor has registered, contact us immediately and we will delete their account.",
        ]},
        {"heading": "12. International Transfers", "content": [
            "MaintlyQR serves users globally. Your data may be stored on servers located outside your country of residence. Where we transfer personal data internationally, we ensure appropriate safeguards are in place in compliance with applicable law.",
        ]},
        {"heading": "13. Changes to This Policy", "content": [
            "We may update this Policy from time to time. We will notify registered users by email of significant changes. Continued use constitutes acceptance.",
        ]},
        {"heading": "14. Contact and Complaints", "content": [
            "For privacy questions, requests, or complaints: support@maintlyqr.com",
            "If you are not satisfied with our response, you may escalate to the Office of the Australian Information Commissioner (OAIC) at www.oaic.gov.au, or to your national data protection authority.",
        ]},
    ]
)

print("\n  Doc 02 updated to v1.1 — DONE")
