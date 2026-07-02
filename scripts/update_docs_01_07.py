"""
Regenerates Doc 01 and Doc 07 with v1.1 improvements:
  Doc 01 — entity language, stronger disclaimers, 5 new standard legal clauses
  Doc 07 — stronger Verified Mechanic disclaimers
"""
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, HRFlowable
from reportlab.lib.enums import TA_CENTER
import os

OUTPUT_DIR = "/home/claude/legal_package"
os.makedirs(OUTPUT_DIR, exist_ok=True)

RED      = colors.HexColor("#dc2626")
DARK     = colors.HexColor("#111111")
GRAY     = colors.HexColor("#666666")
LIGHT_HR = colors.HexColor("#e4e4e7")


def build_doc(filename, doc_number, title, tagline, sections):
    path = os.path.join(OUTPUT_DIR, filename)
    doc = SimpleDocTemplate(
        path, pagesize=A4,
        rightMargin=2*cm, leftMargin=2*cm,
        topMargin=2*cm, bottomMargin=2*cm
    )
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
        Paragraph(
            "www.maintlyqr.com  ·  support@maintlyqr.com  ·  Queensland, Australia",
            ftr
        ),
    ]
    doc.build(story)
    print(f"  [OK] {filename}")


# =============================================================================
# DOCUMENT 01 — TERMS OF SERVICE  (v1.1)
# =============================================================================
build_doc(
    "MaintlyQR_01_Terms_of_Service.pdf", "01",
    "Terms of Service",
    "The agreement that governs your use of the MaintlyQR Platform.",
    [
        # ── 1. The Platform ──────────────────────────────────────────────────
        {"heading": "1. The MaintlyQR Platform", "content": [
            'MaintlyQR™ ("MaintlyQR", "we", "us", "our") is a technology platform providing permanent digital identity and maintenance history tracking for physical assets through the use of QR codes. MaintlyQR is operated pending formal legal incorporation; upon incorporation, the operating entity will be MaintlyQR Pty Ltd (ACN pending), headquartered in Queensland, Australia. References to "MaintlyQR" throughout this document apply equally to any successor legal entity.',
            'By accessing or using MaintlyQR at www.maintlyqr.com (the "Platform"), you agree to be bound by these Terms of Service and all supplementary policies that form the MaintlyQR Legal Package. If you do not agree, please do not use the Platform.',
        ]},
        # ── 2. The Digital Identity Principle ────────────────────────────────
        {"heading": "2. The Digital Identity Principle", "content": [
            "At the core of MaintlyQR is a foundational concept: every physical asset — vehicle, machine, vessel, aircraft, or piece of equipment — deserves a permanent digital identity.",
            "Each QR code issued by MaintlyQR constitutes a unique digital identity assigned to a specific physical asset. This identity is designed to persist throughout the operational lifetime of the asset, surviving changes in ownership, location, and service provider.",
            "The maintenance history attached to that QR code forms part of the asset's permanent digital identity — a living record that follows the physical asset, not any individual user or business. This principle underpins every feature, policy, and decision of the Platform.",
        ]},
        # ── 3. Eligibility ───────────────────────────────────────────────────
        {"heading": "3. Eligibility", "content": [
            "You must be at least 18 years of age to register for an account. By registering, you confirm that: (a) you are at least 18; (b) all information you provide is accurate; and (c) you have the legal authority to bind yourself or your business to these Terms.",
            "MaintlyQR is available globally to individuals, sole traders, businesses, and organisations.",
        ]},
        # ── 4. Account ───────────────────────────────────────────────────────
        {"heading": "4. Account Registration and Security", "content": [
            "You must create an account to access the Platform's core features. You agree to provide accurate, complete, and current registration information and to keep it updated.",
            "You are solely responsible for maintaining the confidentiality of your login credentials and for all activity that occurs under your account.",
            "Notify us immediately at support@maintlyqr.com if you suspect unauthorised access. MaintlyQR may suspend or terminate any account that violates these Terms.",
        ]},
        # ── 5. QR Codes ──────────────────────────────────────────────────────
        {"heading": "5. QR Codes — Licence, Not Sale", "content": [
            "QR codes issued by MaintlyQR are licensed to users, not sold. You receive a limited, non-exclusive, non-transferable licence to use a QR code solely in connection with the single physical asset to which it has been assigned.",
            "QR codes may not be: (a) resold or transferred to a third party; (b) reassigned to a different physical asset without MaintlyQR's prior written approval; (c) sublicensed; or (d) used to represent more than one asset.",
            "The digital identity associated with a QR code — including the unique identifier, asset profile, and Maintenance Ledger — is the property of MaintlyQR. Maintenance records within the Ledger belong to the users who created them, subject to the content licence in Section 11.",
            "Full QR assignment, transfer, and termination rules are in the QR Assignment Policy (Document 6).",
        ]},
        # ── 6. Maintenance Records ───────────────────────────────────────────
        {"heading": "6. Maintenance Records — Records, Not Certifications", "content": [
            "Registered users may add maintenance and service records to any asset linked to a QR code. These records collectively constitute the asset's Maintenance Ledger.",
            "[NOTE] CRITICAL DISCLAIMER: MaintlyQR does not inspect, certify, validate, or guarantee that any maintenance activity recorded on the Platform actually occurred. MaintlyQR maintains a digital log of information submitted by registered users — nothing more. The accuracy, completeness, and truthfulness of all records are the sole responsibility of the submitting user. MaintlyQR has no means to independently verify, and expressly disclaims all responsibility for, the factual accuracy of any maintenance claim.",
            "By submitting a maintenance record, you warrant that the information is, to the best of your knowledge, accurate and truthful.",
            "This distinction is fundamental: MaintlyQR is a digital record-keeping platform, not a certification authority, inspection body, verification service, or professional assessor of any kind.",
        ]},
        # ── 7. Public QR Pages ───────────────────────────────────────────────
        {"heading": "7. Public QR Pages", "content": [
            "The public display of maintenance history via QR code scan is an intentional, core feature of MaintlyQR. When any person scans a QR code, the associated Maintenance Ledger is displayed publicly — without requiring login or payment.",
            "By adding records to an asset's Maintenance Ledger, you expressly consent to that information being publicly accessible to anyone with access to the QR code.",
            "Do not enter information you do not wish to be publicly visible — including personal contact details, addresses, or commercially sensitive data.",
        ]},
        # ── 8. Verified Mechanic ─────────────────────────────────────────────
        {"heading": "8. Verified Mechanic Status", "content": [
            'MaintlyQR distinguishes between "Verified" professionals and standard users. A Verified badge indicates that MaintlyQR has reviewed the user\'s professional credentials and confirmed their identity.',
            "[NOTE] Verified status means: identity reviewed, credentials checked. It does NOT mean: better quality work, superior service, a guarantee of competence, or any endorsement of work performed. Full details are in the Verified Mechanic Policy (Document 7).",
        ]},
        # ── 9. PDF Reports ───────────────────────────────────────────────────
        {"heading": "9. PDF Service Reports", "content": [
            "MaintlyQR generates downloadable PDF reports summarising an asset's Maintenance Ledger. These reports are intended to assist asset owners, prospective buyers, insurers, financiers, and fleet managers.",
            "A MaintlyQR PDF report is NOT any of the following:",
            "- A professional mechanical or engineering assessment",
            "- A certificate of roadworthiness, airworthiness, or seaworthiness",
            "- A substitute for manufacturer service documentation or logbooks",
            "- An official inspection report issued by a regulatory authority",
            "- A legal or compliance document for any regulatory purpose",
            "PDF reports display records exactly as submitted by users. They should not be relied upon for any purpose requiring professional certification or regulatory compliance, without independent verification by a qualified professional.",
            "The MaintlyQR name, logo, and formatting on PDF reports are protected intellectual property. You may not alter, falsify, or misrepresent MaintlyQR-generated reports.",
        ]},
        # ── 10. Acceptable Use ───────────────────────────────────────────────
        {"heading": "10. Acceptable Use", "content": [
            "You agree not to:",
            "- Enter false, fabricated, or misleading maintenance records",
            "- Register assets you do not own or are not authorised to manage",
            "- Impersonate any mechanic, business, or individual",
            "- Use automated tools to scrape or extract Platform data without authorisation",
            "- Attempt to hack, reverse-engineer, or disrupt the Platform",
            "- Upload content that infringes intellectual property rights",
            "- Use the Platform for any unlawful purpose",
            "Full rules are in the Acceptable Use Policy (Document 4).",
        ]},
        # ── 11. Content ──────────────────────────────────────────────────────
        {"heading": "11. Your Content", "content": [
            "You retain ownership of all content you upload, including asset information, service records, notes, and photos.",
            "By uploading content, you grant MaintlyQR a non-exclusive, worldwide, royalty-free licence to store, display, transmit, and — in anonymised or aggregated form only — analyse your content for Platform operations and improvement.",
            "You warrant that you hold all rights necessary to grant this licence and that your content does not violate any applicable law or third-party rights.",
        ]},
        # ── 12. IP ───────────────────────────────────────────────────────────
        {"heading": "12. Intellectual Property", "content": [
            "All intellectual property in and relating to MaintlyQR — including the brand, logos, QR label designs, software, database architecture, user interface, design system, API, documentation, and the QR Assignment System — is owned exclusively by MaintlyQR.",
            "Full details: Intellectual Property Policy (Document 5). Brand and trademark rules: Trademark & Brand Usage Guidelines (Document 10).",
        ]},
        # ── 13. AI ───────────────────────────────────────────────────────────
        {"heading": "13. Artificial Intelligence Features", "content": [
            "MaintlyQR may incorporate AI-powered features including maintenance recommendations, anomaly detection, predictive alerts, and natural language processing of service records.",
            "AI-generated outputs are informational only and do not constitute professional mechanical or engineering advice. MaintlyQR is not liable for decisions made in reliance on AI-generated content.",
        ]},
        # ── 14. API ──────────────────────────────────────────────────────────
        {"heading": "14. API Access", "content": [
            "MaintlyQR may offer a programmatic API enabling third-party access to Platform data and functionality. API access is governed by the API Terms of Use (Document 9). Unauthorised programmatic access — including scraping or automated data extraction — is strictly prohibited.",
        ]},
        # ── 15. Pricing ──────────────────────────────────────────────────────
        {"heading": "15. Pricing and Payments", "content": [
            "MaintlyQR is currently free during its early access phase. We may introduce paid plans at any time, with at least 30 days' advance notice to registered users of any changes affecting their existing access.",
        ]},
        # ── 16. Availability ─────────────────────────────────────────────────
        {"heading": "16. Platform Availability", "content": [
            "We aim for maximum availability but do not guarantee uninterrupted service. Features may be updated, modified, or discontinued at any time. We will make reasonable efforts to notify users of significant changes.",
        ]},
        # ── 17. Disclaimers ──────────────────────────────────────────────────
        {"heading": "17. Disclaimers", "content": [
            'The Platform is provided "as is" and "as available." MaintlyQR disclaims all warranties, express or implied. In particular: MaintlyQR does not warrant that any maintenance record is accurate; does not warrant that Verified Mechanics are currently licensed, insured, or performing competent work; and does not warrant that PDF reports are suitable for regulatory, legal, or professional purposes without independent verification.',
        ]},
        # ── 18. Limitation of Liability ──────────────────────────────────────
        {"heading": "18. Limitation of Liability", "content": [
            "To the fullest extent permitted by Australian law, MaintlyQR is not liable for:",
            "- Loss or corruption of data",
            "- Inaccurate or fraudulent records submitted by users",
            "- Decisions made in reliance on Platform content or PDF reports",
            "- Business losses due to Platform unavailability",
            "- Indirect, incidental, or consequential damages",
            "Our total aggregate liability shall not exceed the greater of: amounts paid by you to MaintlyQR in the preceding 12 months; or AUD $100.",
        ]},
        # ── 19. Indemnification ──────────────────────────────────────────────
        {"heading": "19. Indemnification", "content": [
            "You agree to indemnify and hold harmless MaintlyQR, its officers, employees, agents, and successors from any claims, losses, and costs (including legal fees) arising from: (a) your use of the Platform; (b) content you submit; (c) your breach of these Terms; or (d) your violation of any third party's rights.",
        ]},
        # ── 20. Governing Law ────────────────────────────────────────────────
        {"heading": "20. Governing Law", "content": [
            "These Terms are governed by the laws of Queensland, Australia. Nothing limits rights you may hold under the Australian Consumer Law (Competition and Consumer Act 2010) or other mandatory consumer protection legislation.",
        ]},
        # ── 21. Changes ──────────────────────────────────────────────────────
        {"heading": "21. Changes to These Terms", "content": [
            "We may update these Terms at any time. We will notify registered users by email of material changes. Continued use after changes take effect constitutes acceptance.",
        ]},
        # ── 22. Force Majeure ────────────────────────────────────────────────
        {"heading": "22. Force Majeure", "content": [
            "MaintlyQR will not be liable for any failure or delay in performance of its obligations caused by circumstances beyond its reasonable control, including but not limited to: natural disasters, fire, flood, storm, earthquake; acts of government or regulatory authority; pandemic or public health emergency; cyberattack or malicious interference by third parties; telecommunications or internet infrastructure failure; or failure of third-party service providers on whom MaintlyQR depends.",
            "In such circumstances, MaintlyQR's obligations are suspended for the duration of the event. We will notify affected users as soon as reasonably practicable and resume normal performance as soon as circumstances allow.",
        ]},
        # ── 23. Dispute Resolution ───────────────────────────────────────────
        {"heading": "23. Dispute Resolution", "content": [
            "In the event of a dispute arising out of or in connection with these Terms or the Platform, the parties agree to attempt resolution in the following sequence before commencing litigation:",
            "Step 1 — Negotiation: Contact MaintlyQR at support@maintlyqr.com describing the nature of the dispute. We will respond within 14 business days. Both parties agree to negotiate in good faith for at least 30 days before escalating.",
            "Step 2 — Mediation: If direct negotiation fails, either party may refer the dispute to mediation administered by the Resolution Institute (or another mutually agreed body) in Queensland, Australia. The costs of mediation are shared equally unless otherwise agreed.",
            "Step 3 — Litigation: Only if mediation is unsuccessful or a party refuses to participate may either party commence legal proceedings in the courts of Queensland, Australia.",
            "Nothing in this clause prevents either party from seeking urgent interlocutory or injunctive relief from a court where necessary to protect its rights.",
        ]},
        # ── 24. Severability ─────────────────────────────────────────────────
        {"heading": "24. Severability", "content": [
            "If any provision of these Terms is found to be invalid, illegal, or unenforceable by a court of competent jurisdiction, that provision will be modified to the minimum extent necessary to make it valid and enforceable. If modification is not possible, it will be severed. The remaining provisions will continue in full force and effect.",
        ]},
        # ── 25. Entire Agreement ─────────────────────────────────────────────
        {"heading": "25. Entire Agreement", "content": [
            "These Terms of Service, together with all supplementary documents in the MaintlyQR Legal Package (Documents 1–10), constitute the entire agreement between you and MaintlyQR regarding your use of the Platform. They supersede all prior agreements, representations, warranties, and understandings, whether oral or written, relating to the same subject matter.",
        ]},
        # ── 26. Waiver ───────────────────────────────────────────────────────
        {"heading": "26. Waiver", "content": [
            "No failure or delay by MaintlyQR in exercising any right, power, or remedy under these Terms will operate as a waiver thereof. A single or partial exercise of any right does not preclude further exercise of the same right or any other right. All rights and remedies under these Terms are cumulative and not exclusive of any rights or remedies available at law.",
        ]},
        # ── 27. Contact ──────────────────────────────────────────────────────
        {"heading": "27. Contact", "content": [
            "MaintlyQR  —  support@maintlyqr.com  —  www.maintlyqr.com  —  Queensland, Australia",
        ]},
    ]
)


# =============================================================================
# DOCUMENT 07 — VERIFIED MECHANIC POLICY  (v1.1)
# =============================================================================
build_doc(
    "MaintlyQR_07_Verified_Mechanic_Policy.pdf", "07",
    "Verified Mechanic Policy",
    "What Verified status means on MaintlyQR, how to obtain it, and what it requires.",
    [
        {"heading": "1. What Is Verified Status?", "content": [
            "MaintlyQR's Verified Mechanic program recognises registered users who have demonstrated professional credentials in mechanical, technical, or maintenance fields.",
            'When a Verified Mechanic adds a record to an asset\'s Maintenance Ledger, that record is displayed with a "Verified" badge — visible to anyone who scans the QR code. This signals to asset owners and prospective buyers that the record was logged by a professional whose identity and credentials have been reviewed by MaintlyQR.',
            "[NOTE] Verified means two things and two things only: (1) identity confirmed; (2) professional documentation reviewed by MaintlyQR. Nothing else.",
        ]},
        {"heading": "2. What Verified Status Does NOT Mean", "content": [
            "Verified status is explicitly NOT:",
            "- An endorsement of the quality of work performed",
            "- A guarantee that the mechanic performs good or acceptable work",
            "- Evidence that the mechanic is currently licensed, insured, or in good standing",
            "- A professional certification, trade qualification, or regulatory approval",
            "- A roadworthiness, airworthiness, or safety assessment",
            "- A warranty of any kind regarding the accuracy of submitted records",
            "- A guarantee that any maintenance listed actually occurred",
            "[NOTE] MaintlyQR does not certify that any maintenance activity recorded by a Verified Mechanic actually took place. Verified status is an identity indicator only. The responsibility for the truthfulness of every record rests entirely with the user who submitted it.",
        ]},
        {"heading": "3. Eligibility", "content": [
            "To be eligible for Verified status, you must:",
            "- Hold a registered MaintlyQR account in good standing",
            "- Be a professional mechanic, technician, engineer, fleet manager, or equivalent",
            "- Provide verifiable evidence of professional credentials (trade certificate, business registration, professional association membership, or equivalent)",
            "- Agree to the Verified Mechanic Code of Conduct (Section 5 below)",
        ]},
        {"heading": "4. Application Process", "content": [
            "To apply for Verified status:",
            "- Email support@maintlyqr.com with the subject line: Verified Mechanic Application",
            "- Provide: your full name, account email, professional role, and country of operation",
            "- Attach documentary evidence of your credentials",
            "MaintlyQR will review your application within 14 business days. We reserve the right to accept or decline any application at our sole discretion.",
        ]},
        {"heading": "5. Verified Mechanic Code of Conduct", "content": [
            "By obtaining Verified status, you agree to:",
            "- Submit only truthful, accurate maintenance records for work you performed or directly supervised",
            "- Never fabricate, exaggerate, or manipulate service records",
            "- Notify MaintlyQR if your professional credentials lapse, expire, or are revoked",
            "- Not misrepresent the scope or nature of work performed",
            "- Not use Verified status to defame competitors or mislead asset owners",
        ]},
        {"heading": "6. Display of Verified Badge", "content": [
            "Verified Mechanics may display the MaintlyQR Verified badge only in the context of their MaintlyQR profile and service records. You may not:",
            "- Claim Verified status in external advertising in a way that implies third-party certification or professional endorsement",
            "- Transfer or share Verified status with other users or accounts",
            "- Imply that Verified status constitutes a guarantee, warranty, or professional qualification",
        ]},
        {"heading": "7. Suspension and Revocation", "content": [
            "MaintlyQR may suspend or revoke Verified status at any time if:",
            "- Professional credentials have lapsed, been revoked, or were falsified at application",
            "- The user submits fraudulent or misleading service records",
            "- The user violates the Code of Conduct or the Acceptable Use Policy",
            "- A credible complaint is received and substantiated by our investigation",
            "Revocation of Verified status does not affect your standard MaintlyQR account.",
        ]},
        {"heading": "8. Future Verification Tiers", "content": [
            "MaintlyQR may in the future introduce tiered Verified levels — such as Verified Business, OEM-Certified, or Fleet Inspector. Additional requirements and benefits for each tier will be published in an updated version of this policy.",
        ]},
        {"heading": "9. Contact", "content": [
            "Verified Mechanic applications and enquiries: support@maintlyqr.com",
        ]},
    ]
)


print("\n========================================")
print("  Docs 01 & 07 updated to v1.1 — DONE")
print("========================================")
