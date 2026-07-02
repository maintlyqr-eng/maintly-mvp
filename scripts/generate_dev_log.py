"""
Generates two branded PDFs:
  1. MaintlyQR — Founding Story
  2. MaintlyQR — Development Log v1.0
"""
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, HRFlowable
from reportlab.lib.enums import TA_CENTER, TA_LEFT
import os

OUTPUT_DIR = "/home/claude/legal_package"
RED      = colors.HexColor("#dc2626")
DARK     = colors.HexColor("#111111")
GRAY     = colors.HexColor("#666666")
LIGHT_HR = colors.HexColor("#e4e4e7")
LIGHT_BG = colors.HexColor("#fafafa")

def build_doc(filename, title, tagline, sections, subtitle=None):
    path = os.path.join(OUTPUT_DIR, filename)
    doc = SimpleDocTemplate(path, pagesize=A4,
        rightMargin=2*cm, leftMargin=2*cm, topMargin=2*cm, bottomMargin=2*cm)

    brand  = ParagraphStyle("Brand",  fontName="Helvetica-Bold",    fontSize=13, textColor=RED,  spaceAfter=6)
    h1     = ParagraphStyle("H1",     fontName="Helvetica-Bold",    fontSize=26, textColor=DARK, spaceAfter=4, leading=32)
    sub    = ParagraphStyle("Sub",    fontName="Helvetica",         fontSize=11, textColor=GRAY, spaceAfter=6, leading=16)
    meta   = ParagraphStyle("Meta",   fontName="Helvetica",         fontSize=9,  textColor=GRAY, spaceAfter=14)
    tagl   = ParagraphStyle("Tag",    fontName="Helvetica-Oblique", fontSize=10, textColor=GRAY, spaceAfter=14)
    h2     = ParagraphStyle("H2",     fontName="Helvetica-Bold",    fontSize=12, textColor=RED,  spaceBefore=18, spaceAfter=6)
    body   = ParagraphStyle("Body",   fontName="Helvetica",         fontSize=10, textColor=DARK, leading=17, spaceAfter=7)
    quote  = ParagraphStyle("Quote",  fontName="Helvetica-Oblique", fontSize=11, textColor=RED,  leading=18, spaceAfter=10, leftIndent=20, rightIndent=20)
    bullet = ParagraphStyle("Bullet", fontName="Helvetica",         fontSize=10, textColor=DARK, leading=16, leftIndent=16, spaceAfter=4)
    badge  = ParagraphStyle("Badge",  fontName="Helvetica-Bold",    fontSize=9,  textColor=RED,  spaceAfter=2, spaceBefore=4)
    note   = ParagraphStyle("Note",   fontName="Helvetica-Oblique", fontSize=9,  textColor=GRAY, leading=14, spaceAfter=6, leftIndent=12)
    ftr    = ParagraphStyle("Ftr",    fontName="Helvetica",         fontSize=8,  textColor=GRAY, alignment=TA_CENTER)

    story = [
        Paragraph("MaintlyQR", brand),
        Paragraph(title, h1),
    ]
    if subtitle:
        story.append(Paragraph(subtitle, sub))
    story += [
        Paragraph("www.maintlyqr.com  ·  Queensland, Australia  ·  July 2026", meta),
    ]
    if tagline:
        story.append(Paragraph(tagline, tagl))
    story.append(HRFlowable(width="100%", thickness=2, color=RED, spaceAfter=20))

    for section in sections:
        if section.get("type") == "quote":
            story.append(Paragraph(f'"{section["content"]}"', quote))
            continue
        if section.get("type") == "spacer":
            story.append(Spacer(1, 12))
            continue
        if section.get("heading"):
            story.append(Paragraph(section["heading"], h2))
        for para in section.get("content", []):
            if para.startswith("- "):
                story.append(Paragraph("•  " + para[2:], bullet))
            elif para.startswith("[NOTE] "):
                story.append(Paragraph(para[7:], note))
            elif para.startswith("[BADGE] "):
                story.append(Paragraph(para[8:], badge))
            else:
                story.append(Paragraph(para, body))
        story.append(Spacer(1, 4))

    story += [
        HRFlowable(width="100%", thickness=1, color=LIGHT_HR, spaceBefore=24, spaceAfter=8),
        Paragraph("www.maintlyqr.com  ·  support@maintlyqr.com  ·  Queensland, Australia", ftr),
    ]
    doc.build(story)
    print(f"  [OK] {filename}")


# =============================================================================
# DOCUMENT A — FOUNDING STORY
# =============================================================================
build_doc(
    "MaintlyQR_Founding_Story.pdf",
    "The Founding Story",
    "How a simple frustration became a global platform for physical asset identity.",
    subtitle="MaintlyQR™ — Maintenance. Tracked.",
    sections=[

        {"type": "quote", "content": "Every physical asset has a life story. Until now, that story was lost."},

        {"heading": "The Problem", "content": [
            "Every day, millions of vehicles, machines, and pieces of industrial equipment change hands — and their maintenance history disappears with them.",
            "A used motorcycle with 40,000 km on the clock. Has the chain been replaced? The brake pads? The oil? The buyer has no way to know. The seller might not remember. The mechanic who did the work is long gone.",
            "This isn't just inconvenient — it's a trust problem baked into the fabric of how physical assets are bought, sold, and maintained. Paper service books get lost. Digital records stay locked in workshop software that no one can access. Photos fade from phone storage. The history of an asset, accumulated over years of ownership, vanishes the moment it changes hands.",
            "The result: buyers pay blind, sellers can't prove value, and mechanics' work goes unrecognised the moment the customer drives away.",
        ]},

        {"type": "quote", "content": "What if every machine could carry its own verified history — permanently, publicly, and without depending on any single owner?"},

        {"heading": "The Insight", "content": [
            "The idea behind MaintlyQR came from a simple realisation: a QR code is permanent. It can be physically attached to any asset. It can be scanned by anyone, anywhere in the world, at any time — without an app, without an account, without permission.",
            "If that QR code pointed not to a static page, but to a living, tamper-resistant Maintenance Ledger — a running log of every service, inspection, repair, and modification ever performed — you'd have something genuinely new: a permanent digital identity for a physical object.",
            "Not owned by the current owner. Not locked in a workshop's system. Not dependent on anyone remembering to transfer it. Just there. Permanently. Attached to the asset itself.",
            "That's the core of MaintlyQR: the Asset Passport. The idea that a machine, like a person, should have a verifiable identity that travels with it through its entire life.",
        ]},

        {"heading": "The Build", "content": [
            "MaintlyQR was built from the ground up with one design principle: no friction. Scanning a QR code should show you the history instantly — no app download, no account required. Adding a maintenance record should take seconds.",
            "The platform is built on a modern technology stack — Next.js 16, Supabase, and Vercel — chosen for global scalability from day one. Every service record is stored with row-level security. Every Maintenance Ledger is publicly accessible via its QR code, worldwide.",
            "From the beginning, MaintlyQR was designed to be a serious, durable platform. That meant building not just the product, but the legal infrastructure to support it: a complete 10-document legal package covering Terms of Service, Privacy Policy, Intellectual Property, the Verified Mechanic Program, API terms, and trademark guidelines.",
            "The legal framework protects the platform's core innovations — the QR Assignment System, the Maintenance Ledger architecture, the Asset Passport concept — and establishes the foundation for the Verified Mechanic badge program, which brings professional credibility to the records on the platform.",
        ]},

        {"heading": "The Verified Mechanic", "content": [
            "One of the most important features of MaintlyQR is what it means when a mechanic signs a maintenance record.",
            "Any user can log their own oil change. But a record signed by a Verified Mechanic — a trade-registered professional whose identity has been confirmed by MaintlyQR — carries real weight. It's the difference between a note in a notebook and a signed service invoice.",
            "The Verified Mechanic program is designed to give professional mechanics something they've never had before: a portable, public reputation. Every job they record on MaintlyQR is permanently associated with their verified identity. Their work follows the asset — and builds their professional standing — forever.",
        ]},

        {"heading": "The Vision", "content": [
            "MaintlyQR is built for a world where physical assets — from motorcycles and boats to excavators and turbines — have the same kind of verifiable digital identity that people and companies take for granted.",
            "The long-term vision is a global maintenance ledger network: a standard layer of trust for the physical world, where the service history of any asset is as accessible and verifiable as a public company's financial filings.",
            "This has implications far beyond convenience. It changes how assets are valued at resale. It creates accountability for the maintenance industry. It enables insurance underwriting based on verified service history. It gives fleet operators, governments, and regulators access to real maintenance data — not self-reported estimates.",
            "We are starting with the assets people care most about: their vehicles. But the architecture is asset-agnostic. Any physical object can have an Asset Passport. The question is simply: how quickly can we get there?",
        ]},

        {"type": "quote", "content": "We're not building a maintenance app. We're building the identity layer for the physical world."},

        {"heading": "Status & Foundation", "content": [
            "MaintlyQR launched in July 2026, operated from Queensland, Australia, pending formal incorporation as MaintlyQR Pty Ltd.",
            "The platform is live at www.maintlyqr.com, with the full legal framework in place, the core product built and deployed, and the Verified Mechanic program ready to launch.",
            "[NOTE] Sections marked [PERSONAL] below are placeholders for the founder to complete with their own story.",
            "[BADGE] [PERSONAL] — Your Story",
            "What specific moment made you realise this had to exist? What did you try before building it yourself? What do you know about this problem that nobody else does? Add that here — it's the most important part of any founding story.",
        ]},

        {"heading": "Contact", "content": [
            "support@maintlyqr.com  ·  www.maintlyqr.com  ·  Queensland, Australia",
        ]},
    ]
)


# =============================================================================
# DOCUMENT B — DEVELOPMENT LOG v1.0
# =============================================================================
build_doc(
    "MaintlyQR_Development_Log_v1.0.pdf",
    "Development Log",
    "A technical record of every decision, build, and milestone in MaintlyQR's construction.",
    subtitle="v1.0 — July 2026",
    sections=[

        {"heading": "Overview", "content": [
            "This document records the technical development of the MaintlyQR platform from initial build through the completion of the legal framework and legal pages. It is intended as an internal reference for the founding team, future hires, and technical due diligence.",
            "All work described here was completed in June–July 2026.",
        ]},

        {"heading": "Phase 0 — Concept & Architecture Decisions", "content": [
            "Core concept defined: QR-based permanent digital identity for physical assets.",
            "Key architectural decision: public-by-default Maintenance Ledger — anyone who scans the QR sees the history, no account required.",
            "Technology stack selected:",
            "- Next.js 16 (App Router) — chosen for SSR/SSG flexibility, Vercel compatibility, and React ecosystem",
            "- TypeScript — type safety across the entire codebase",
            "- Tailwind CSS — utility-first styling for rapid UI development",
            "- Supabase — Postgres database, Auth, and Storage in one platform; row-level security built-in",
            "- Vercel — deployment and CDN; automatic deploys from GitHub",
            "- Lucide React — consistent icon system",
            "Domain: www.maintlyqr.com registered and connected to Vercel.",
            "Brand identity established: MaintlyQR™ name, wordmark, red gear + QR logo (qr-gear.png + Maintly.png two-image composition), primary colour #dc2626.",
        ]},

        {"heading": "Phase 1 — Platform Foundation", "content": [
            "Home page (src/app/page.tsx) built:",
            "- Navbar with two-image logo composition (qr-gear.png + Maintly.png, -20px negative margin overlap)",
            "- Full-screen background image (fondo.png) with white overlay",
            "- Hero section with QR code lookup input",
            "- Feature grid (Digital Identity, Verified History, Global Access, Instant Scan, etc.)",
            "- Auth-aware navbar: shows Dashboard + Logout when logged in, Sign In + Get Started when logged out",
            "- Footer with Maintly® · Maintenance. Tracked. · All Rights Reserved",
            "Dashboard page (src/app/dashboard/page.tsx) built:",
            "- Sidebar navigation with same logo composition (72px / 152px, -18px margin)",
            "- Asset management interface",
            "- Asset type icons mapping (vehicles, boats, industrial equipment, etc.)",
            "Supabase Auth integrated throughout:",
            "- onAuthStateChange listener on home page for session management",
            "- Row-level security on all database tables",
            "- Secure sign-in / sign-out flows",
            "Asset QR page (src/app/asset/[code]/page.tsx) — public Maintenance Ledger view.",
            "Push workflow: developer runs push.bat → GitHub → Vercel auto-deploys to www.maintlyqr.com.",
        ]},

        {"heading": "Phase 2 — Legal Framework (v1.0)", "content": [
            "Decision: build a complete, professional legal package from scratch rather than using generic templates. Rationale: the platform's core concepts (Maintenance Ledger, Asset Passport, QR Assignment System, Verified Mechanic) required custom IP protection not available in off-the-shelf documents.",
            "Tooling: Python + reportlab library used to generate all PDFs programmatically, ensuring consistency across all 10 documents.",
            "Brand applied to all PDFs: MaintlyQR Red (#dc2626), dark (#111111), gray (#666666), A4 format, 2cm margins.",
            "10-document Legal Package v1.0 generated (generate_legal_package.py):",
            "- Doc 01: Terms of Service — master agreement, 19 sections",
            "- Doc 02: Privacy Policy — Australian Privacy Act 1988 + GDPR compliant",
            "- Doc 03: Cookie Policy — essential cookies only (Supabase auth tokens)",
            "- Doc 04: Acceptable Use Policy — prohibited conduct and enforcement",
            "- Doc 05: Intellectual Property Policy — ownership, DMCA process",
            "- Doc 06: QR Assignment System — permanent digital identity concept",
            "- Doc 07: Verified Mechanic Program — eligibility, badge rules, disclaimer",
            "- Doc 08: Asset Ownership & Transfer — how records follow assets",
            "- Doc 09: API Terms of Use — developer access governance",
            "- Doc 10: Trademark & Brand Usage Guidelines — MaintlyQR™ usage rules",
        ]},

        {"heading": "Phase 3 — Legal Framework (v1.1 Revisions)", "content": [
            "After thorough founder review, a comprehensive set of revisions was identified and implemented across multiple update scripts.",
            "Doc 01 (Terms of Service) — major revision (update_docs_01_07.py):",
            "- All personal name references removed; replaced with entity language: 'MaintlyQR Pty Ltd (ACN pending), Queensland, Australia'",
            "- Section 2 rewritten: 'belongs to the asset' changed to 'forms part of the asset's permanent digital identity' (legal precision — assets cannot own things, only persons/entities can)",
            "- Added: Force Majeure clause",
            "- Added: Severability clause",
            "- Added: Entire Agreement clause",
            "- Added: Waiver clause",
            "- Added: Dispute Resolution clause (Queensland, Australia; 30-day good-faith negotiation before arbitration)",
            "- Strengthened disclaimers and limitation of liability",
            "- Section count: 19 → 27 sections",
            "Doc 02 (Privacy Policy) — entity language fix (update_doc_02.py):",
            "- 'Facundo Ledesma' references removed",
            "- Replaced with MaintlyQR Pty Ltd entity language with succession clause",
            "Doc 05 (IP Policy) — proprietary concepts clause added:",
            "- New clause explicitly protects: 'Digital Identity' system, 'Maintenance Ledger' system and data architecture, 'QR Assignment System', 'Asset Passport' concept, and all related terminology as embodied in the Platform",
            "- Note: does not claim exclusive rights to words in isolation, only to the specific system and implementation",
            "Doc 07 (Verified Mechanic) — disclaimer strengthened:",
            "- Made clear that the Verified Mechanic badge is identity verification only, not an endorsement or quality guarantee",
            "Doc 09 (API Terms) — pricing clause added:",
            "- Section 8: API Pricing and Plans — establishes right to introduce paid tiers; 30-day advance notice required for pricing changes",
            "Doc 10 (Trademark Guidelines) — trademark scope corrected:",
            "- Removed 'Maintly™' as a standalone registered trademark",
            "- MaintlyQR™ is the single registered mark",
            "- 'Maintly' remains permitted as an informal spoken/conversational short form only; not to be used alone in formal, legal, marketing, or commercial contexts",
            "All 10 PDFs regenerated and versioned as v1.1. Effective date: July 2, 2026.",
        ]},

        {"heading": "Phase 4 — Legal Pages in Platform", "content": [
            "All 10 legal PDFs deployed to public/legal/ in the Next.js project.",
            "New component: src/components/LegalLayout.tsx",
            "- Sticky navbar with logo (52px / 108px composition) linking back to home",
            "- Nav links: Legal Hub · Terms · Privacy · Cookies",
            "- Dark hero header (zinc-950) with document title, subtitle, doc number, and effective date",
            "- Consistent red-on-zinc section heading style",
            "- Footer with links to all legal pages + copyright",
            "New pages created:",
            "- src/app/legal/page.tsx — Legal Hub: grid of all 10 documents, each with description, 'Download PDF' button, and 'Read online' link (for docs with web pages)",
            "- src/app/terms/page.tsx — Terms of Service: 19 sections, full content, PDF download banner",
            "- src/app/privacy/page.tsx — Privacy Policy: 14 sections, full content, PDF download banner",
            "- src/app/cookies/page.tsx — Cookie Policy: 8 sections + cookies table (sb-access-token, sb-refresh-token), PDF download banner",
            "Home page footer updated (src/app/page.tsx):",
            "- Added: Terms · Privacy · Cookies links with hover:text-red-500 transition",
            "- Existing brand text and separators preserved",
        ]},

        {"heading": "Key Technical Decisions — Rationale", "content": [
            "Public Maintenance Ledger: Records are public by design (scannable without account). Privacy Policy explicitly warns users not to include personal info in records. This is a core product decision, not an oversight.",
            "Supabase over Firebase: Row-level security at the database layer is non-negotiable for a platform where one user's assets must never be visible to another user's account.",
            "reportlab for PDFs: Gives full programmatic control over styling, ensures every document is pixel-perfect consistent, and makes future revisions easy (just run the Python script).",
            "No separate Maintly™ trademark: After legal review, the decision was made to register only MaintlyQR™. 'Maintly' as a standalone mark would be weaker and potentially harder to defend. MaintlyQR™ includes the QR element that is central to the product identity.",
            "'Asset Passport' concept: Named explicitly in the IP Policy (Doc 05) to establish legal protection before the term is used publicly. This is a forward-looking protective move.",
            "LegalLayout as a shared component: All legal pages share one component for the navbar and footer. When the brand evolves, one file changes and all legal pages update.",
        ]},

        {"heading": "Infrastructure & Operations", "content": [
            "Hosting: Vercel (auto-deploy from GitHub main branch)",
            "Database: Supabase (Postgres, row-level security, AES-256 at rest, TLS in transit)",
            "Auth: Supabase Auth (JWT, session management via HTTP-only cookies)",
            "Storage: Supabase Storage (asset photos, service record attachments)",
            "Domain: www.maintlyqr.com",
            "Email: support@maintlyqr.com",
            "Legal jurisdiction: Queensland, Australia",
            "Entity status: Pre-incorporation (MaintlyQR Pty Ltd, ACN pending)",
            "Trademark: MaintlyQR™ (registration in progress, AU IP Australia + USPTO)",
        ]},

        {"heading": "Open Items & Next Steps", "content": [
            "- Trademark registration: AU IP Australia (~AUD $500) + USPTO (~USD $350)",
            "- PTY LTD incorporation: to be completed when generating revenue",
            "- Registration flow: add Terms + Privacy acceptance checkbox",
            "- Dashboard sidebar: add legal footer links",
            "- Verified Mechanic program: public launch + badge issuance workflow",
            "- API: build and launch developer API (governance framework already in place via Doc 09)",
            "- QR label design: physical labels for affixing to assets",
            "- Mobile app: native iOS/Android for mechanic record entry",
            "- Pricing tiers: define free vs. paid plans",
            "[NOTE] This log will be updated as new phases are completed.",
        ]},

        {"heading": "Build Stats", "content": [
            "Legal documents generated: 10 (v1.0) + 6 revised (v1.1)",
            "Total legal sections across all documents: 127",
            "Legal pages in the platform: 4 (/legal, /terms, /privacy, /cookies)",
            "Python scripts written for PDF generation: 4",
            "Platform pages (total): Home, Dashboard, Asset (public), Sign In, Sign Up, /legal, /terms, /privacy, /cookies",
            "Estimated total lines of code in platform: 1,500+",
            "Time from blank repo to full legal framework + legal pages: [PERSONAL — add your build timeline here]",
        ]},
    ]
)


print("\n========================================")
print("  Founding Story + Dev Log — DONE")
print("========================================")
