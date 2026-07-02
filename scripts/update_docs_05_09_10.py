"""
Updates Docs 05, 09, 10:
  Doc 05 — adds proprietary concepts & terminology clause
  Doc 09 — adds paid API plans / quotas clause
  Doc 10 — removes Maintly™ as standalone trademark, keeps MaintlyQR™ only
"""
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


# =============================================================================
# DOCUMENT 05 — INTELLECTUAL PROPERTY POLICY  (v1.1)
# =============================================================================
build_doc(
    "MaintlyQR_05_Intellectual_Property_Policy.pdf", "05",
    "Intellectual Property Policy",
    "What MaintlyQR owns, what you own, and how to report infringement.",
    [
        {"heading": "1. Overview", "content": [
            "This policy defines the intellectual property (\"IP\") owned by MaintlyQR and sets out the rules governing IP on the Platform. It supplements the Terms of Service (Document 1). MaintlyQR takes the protection of its intellectual property seriously and will act against infringement.",
        ]},
        {"heading": "2. MaintlyQR Intellectual Property", "content": [
            "The following constitute the exclusive intellectual property of MaintlyQR:",
            "Brand and Identity: The MaintlyQR™ name and wordmark; all logos and visual identity elements; brand colours, typography, and design language; QR label artwork and physical label designs; the Verified Mechanic badge design.",
            "Proprietary Concepts and Terminology: The concept and system of 'Digital Identity' for physical assets as implemented in the MaintlyQR Platform; the 'Maintenance Ledger' system and its data architecture; the 'QR Assignment System'; the 'Asset Passport' concept; and all related terminology as embodied in the Platform's design, architecture, and documentation. MaintlyQR does not claim exclusive rights to these words in isolation, but asserts exclusive rights over the specific system, implementation, and combined expression of these concepts as constituted within the MaintlyQR Platform.",
            "QR Assignment System: The method and system for assigning unique QR codes to physical assets; the concept and implementation of the permanent digital identity for physical assets; the Maintenance Ledger system and its data architecture.",
            "Software and Technology: All Platform source code (front-end and back-end); database schema and architecture; application programming interfaces (APIs), present and future; any mobile application code.",
            "Design System: User interface layouts and component designs; icon systems and visual elements; design tokens, style guides, and UI kits.",
            "Content and Documentation: All website copy; help articles, tutorials, and support documentation; marketing and promotional materials; all legal documentation in this Legal Package.",
            "Data and Intelligence: Aggregated and anonymised maintenance data insights; AI and machine learning models trained on Platform data; Platform usage analytics.",
        ]},
        {"heading": "3. Trademarks", "content": [
            "MaintlyQR™ is the registered trademark of MaintlyQR (registration in progress). All logos and brand marks are trademarks or service marks of MaintlyQR.",
            "Nothing in these Terms grants you any right to use MaintlyQR's trademarks without prior written consent. Full brand usage rules are in the Trademark & Brand Usage Guidelines (Document 10).",
        ]},
        {"heading": "4. User-Owned Content", "content": [
            "You retain ownership of all original content you create and upload: maintenance records, asset descriptions, notes, and photographs.",
            "You grant MaintlyQR a non-exclusive, worldwide, royalty-free licence to store, display, process, and — in anonymised form only — analyse your content for Platform operations. This licence ends when you delete your content or close your account, subject to any legal retention requirements.",
        ]},
        {"heading": "5. Restrictions", "content": [
            "Without MaintlyQR's prior written consent, you may not:",
            "- Copy, reproduce, or distribute any part of the Platform",
            "- Create derivative works based on MaintlyQR's IP",
            "- Use MaintlyQR's brand, logos, or design assets outside the Platform",
            "- Use the Platform's source code or architecture in any other product",
            "- Claim ownership of, or attempt to register, any MaintlyQR trademark or domain",
        ]},
        {"heading": "6. Copyright Infringement — DMCA Notice", "content": [
            "MaintlyQR respects intellectual property rights and expects users to do the same. To report copyright infringement, send a written notice to support@maintlyqr.com including:",
            "- Identification of the copyrighted work claimed to be infringed",
            "- Identification of the infringing material and its location on the Platform",
            "- Your contact information (full name, address, email)",
            "- A statement of good-faith belief that the use is not authorised",
            "- A declaration, under penalty of perjury, that the information is accurate and that you are the rights owner or authorised agent",
            "We will investigate all credible notices and remove infringing content where appropriate. Accounts of repeat infringers will be terminated.",
        ]},
        {"heading": "7. User-Uploaded Content and Copyright", "content": [
            "You must not upload to the Platform any content — including manuals, technical documentation, photographs, or PDFs — that you do not own or have the right to share. Uploading copyrighted material without authorisation violates the Acceptable Use Policy and may expose you to legal liability.",
        ]},
        {"heading": "8. Other IP Complaints", "content": [
            "For trademark, patent, or other IP-related complaints, contact support@maintlyqr.com with full details of the alleged infringement.",
        ]},
        {"heading": "9. Contact", "content": [
            "Intellectual property matters: support@maintlyqr.com",
        ]},
    ]
)


# =============================================================================
# DOCUMENT 09 — API TERMS OF USE  (v1.1)
# =============================================================================
build_doc(
    "MaintlyQR_09_API_Terms_of_Use.pdf", "09",
    "API Terms of Use",
    "The terms governing programmatic access to the MaintlyQR Platform.",
    [
        {"heading": "1. About the MaintlyQR API", "content": [
            "MaintlyQR may offer an Application Programming Interface (\"API\") enabling developers, businesses, and partners to programmatically access and interact with Platform data and functionality.",
            "These API Terms supplement the Terms of Service (Document 1). In the event of conflict, these API Terms prevail with respect to API use.",
            "[NOTE] The MaintlyQR API is currently in development. These terms establish the governance framework that will apply when API access becomes available.",
        ]},
        {"heading": "2. API Access and Authentication", "content": [
            "API access requires: (a) a registered MaintlyQR account in good standing; and (b) a valid API key issued by MaintlyQR.",
            "API keys are issued at MaintlyQR's sole discretion. We may decline, restrict, or revoke API access at any time.",
            "You are responsible for keeping your API key confidential. Do not embed keys in client-side code, public repositories, or any publicly accessible location. Report a compromised key to us immediately.",
        ]},
        {"heading": "3. Permitted API Use", "content": [
            "Subject to these terms, you may use the API to:",
            "- Access and display data from your own assets and Maintenance Ledgers",
            "- Submit maintenance records to assets you manage",
            "- Build internal tools or integrations for your own business operations",
            "- Build third-party applications that have been approved in writing by MaintlyQR",
        ]},
        {"heading": "4. Prohibited API Use", "content": [
            "You may not use the API to:",
            "- Access or aggregate data belonging to other users without their consent",
            "- Build competing products that replicate MaintlyQR's core functionality",
            "- Sell or resell API access to third parties",
            "- Exceed rate limits or circumvent API throttling mechanisms",
            "- Submit false or fraudulent maintenance records at scale",
            "- Introduce malicious code through API calls",
            "- Degrade Platform performance for other users",
        ]},
        {"heading": "5. Rate Limits", "content": [
            "MaintlyQR enforces rate limits to ensure fair access and Platform stability. Specific limits will be published in the API documentation at launch.",
            "Exceeding rate limits may result in temporary suspension. Persistent violations may result in permanent revocation of API access.",
        ]},
        {"heading": "6. Attribution", "content": [
            "Applications that display MaintlyQR data must include a visible attribution statement, such as: 'Powered by MaintlyQR' or 'Maintenance data provided by MaintlyQR'. Exact format requirements will be in the API documentation.",
        ]},
        {"heading": "7. Data Rights", "content": [
            "Data accessed through the API is subject to the same ownership and licence terms as data accessed through the Platform. You may not: (a) claim ownership of MaintlyQR data; (b) redistribute raw API data to third parties without authorisation; or (c) use API data to train AI models without MaintlyQR's written consent.",
        ]},
        {"heading": "8. API Pricing and Plans", "content": [
            "MaintlyQR currently offers API access at no charge during the early access phase. We reserve the right to introduce paid API plans, tiered access levels, and usage-based quotas at any time.",
            "API users will receive at least 30 days' advance notice of any pricing changes affecting their existing access tier. Continued use of the API after a pricing change takes effect constitutes acceptance of the new terms.",
        ]},
        {"heading": "9. Service Level and Availability", "content": [
            "MaintlyQR does not guarantee API uptime, availability, or response times. The API may be modified, deprecated, or discontinued at any time. We will provide reasonable advance notice of breaking changes.",
        ]},
        {"heading": "10. Termination of API Access", "content": [
            "MaintlyQR may terminate your API access at any time for violation of these terms, the Terms of Service, or the Acceptable Use Policy. Upon termination, all associated API keys are immediately invalidated.",
        ]},
        {"heading": "11. Contact", "content": [
            "API access requests and developer enquiries: support@maintlyqr.com",
        ]},
    ]
)


# =============================================================================
# DOCUMENT 10 — TRADEMARK & BRAND USAGE GUIDELINES  (v1.1)
# =============================================================================
build_doc(
    "MaintlyQR_10_Trademark_Brand_Guidelines.pdf", "10",
    "Trademark & Brand Usage Guidelines",
    "How MaintlyQR's name, trademark, and visual identity may be used.",
    [
        {"heading": "1. Our Trademark", "content": [
            "The following constitute the trademarks and brand assets of MaintlyQR (registration in progress in key markets):",
            "- MaintlyQR™ — the platform and brand name",
            "- The MaintlyQR logo (red gear combined with QR motif)",
            "- The MaintlyQR wordmark",
            "- The Verified Mechanic badge design",
            "[NOTE] MaintlyQR is the single registered brand. 'Maintly' may be used informally as a short form in casual contexts, but is not a separately registered trademark and should not be used alone in formal, legal, marketing, or commercial contexts.",
            "These marks represent MaintlyQR's goodwill, reputation, and quality standards. Unauthorised use is prohibited and may constitute trademark infringement. Common law trademark rights exist from the date of first commercial use, regardless of registration status.",
        ]},
        {"heading": "2. How to Refer to MaintlyQR", "content": [
            "Use the full name 'MaintlyQR' on first reference in any document, communication, or published material. 'Maintly' may be used as an informal spoken or conversational short form, but should not replace 'MaintlyQR' in formal or public-facing contexts.",
            "Correct: 'I manage my workshop's service history using MaintlyQR.'",
            "Incorrect: 'I use MQR' or using 'Maintly' as a standalone brand name in formal contexts.",
            "MaintlyQR is a proper noun — not a verb, adjective, or generic term for QR-based maintenance tracking.",
        ]},
        {"heading": "3. Permitted Uses (No Permission Required)", "content": [
            "You may use MaintlyQR's name without written permission when:",
            "- Accurately describing your use of the Platform in editorial, journalistic, or educational content",
            "- Saying 'My workshop uses MaintlyQR for digital service records'",
            "- Linking to www.maintlyqr.com",
            "These uses must not imply endorsement, sponsorship, or official affiliation with MaintlyQR.",
        ]},
        {"heading": "4. Prohibited Uses", "content": [
            "Without MaintlyQR's prior written consent, you may not:",
            "- Use MaintlyQR's name or logo in your product name, company name, or domain name",
            "- Display MaintlyQR's logo in advertising, signage, or merchandise",
            "- Create modified or derivative versions of any MaintlyQR brand element",
            "- Suggest affiliation, partnership, or endorsement by MaintlyQR without a current written agreement",
            "- Register any domain, social handle, or business name containing 'MaintlyQR' or 'Maintly'",
            "- Use our marks in any manner that could damage our reputation or mislead the public",
        ]},
        {"heading": "5. Visual Identity Standards", "content": [
            "Where MaintlyQR grants brand usage permission, these standards apply:",
            "Primary brand colour: #dc2626 (MaintlyQR Red) — use exactly, no approximations",
            "Dark colour: #111111 — used for headings and body text",
            "The logo must not be stretched, distorted, recoloured, rotated, or altered in any way",
            "Minimum clear space: equal to the cap-height of the 'M' in the wordmark on all sides",
            "Do not place the logo on low-contrast backgrounds that reduce legibility",
        ]},
        {"heading": "6. Press and Media", "content": [
            "Journalists and content creators may use MaintlyQR's name and logo in editorial coverage. We ask that you:",
            "- Spell the name correctly: MaintlyQR",
            "- Use the most current logo version (available at www.maintlyqr.com)",
            "- Not imply that MaintlyQR has reviewed or endorsed your content",
            "For interviews, demos, or high-resolution brand assets: support@maintlyqr.com",
        ]},
        {"heading": "7. Partnership and Reseller Branding", "content": [
            "Partners and resellers with a current written agreement with MaintlyQR may use approved co-branding assets as specified in that agreement. Written partnership agreements take precedence over these guidelines to the extent they are inconsistent.",
        ]},
        {"heading": "8. Reporting Brand Misuse", "content": [
            "If you observe unauthorised or misleading use of the MaintlyQR brand, report it to support@maintlyqr.com with a description or link. We will investigate promptly.",
        ]},
        {"heading": "9. Contact", "content": [
            "Brand licensing, partnership enquiries, and trademark matters: support@maintlyqr.com",
        ]},
    ]
)


print("\n========================================")
print("  Docs 05, 09, 10 updated to v1.1 — DONE")
print("========================================")
