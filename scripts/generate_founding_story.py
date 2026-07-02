"""
Generates the final integrated Founding Story in two languages:
  - MaintlyQR_Founding_Story_ES.pdf  (Spanish — Facu's own words + vision)
  - MaintlyQR_Founding_Story_EN.pdf  (English — adapted for investors / About page)
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

def build_doc(filename, title, subtitle, lang_note, sections):
    path = os.path.join(OUTPUT_DIR, filename)
    doc = SimpleDocTemplate(path, pagesize=A4,
        rightMargin=2*cm, leftMargin=2*cm, topMargin=2*cm, bottomMargin=2*cm)

    brand  = ParagraphStyle("Brand",  fontName="Helvetica-Bold",    fontSize=13, textColor=RED,   spaceAfter=6)
    h1     = ParagraphStyle("H1",     fontName="Helvetica-Bold",    fontSize=26, textColor=DARK,  spaceAfter=4, leading=32)
    sub    = ParagraphStyle("Sub",    fontName="Helvetica-Oblique", fontSize=11, textColor=GRAY,  spaceAfter=4, leading=16)
    meta   = ParagraphStyle("Meta",   fontName="Helvetica",         fontSize=9,  textColor=GRAY,  spaceAfter=16)
    h2     = ParagraphStyle("H2",     fontName="Helvetica-Bold",    fontSize=12, textColor=RED,   spaceBefore=20, spaceAfter=7)
    body   = ParagraphStyle("Body",   fontName="Helvetica",         fontSize=10, textColor=DARK,  leading=17, spaceAfter=7)
    quote  = ParagraphStyle("Quote",  fontName="Helvetica-Oblique", fontSize=12, textColor=RED,   leading=20, spaceAfter=12, leftIndent=24, rightIndent=24, spaceBefore=10)
    bullet = ParagraphStyle("Bullet", fontName="Helvetica",         fontSize=10, textColor=DARK,  leading=16, leftIndent=18, spaceAfter=4)
    closer = ParagraphStyle("Closer", fontName="Helvetica-Bold",    fontSize=14, textColor=DARK,  leading=22, spaceAfter=6, spaceBefore=10)
    tag    = ParagraphStyle("Tag",    fontName="Helvetica-Bold",    fontSize=16, textColor=RED,   spaceAfter=0, spaceBefore=8, leading=22)
    ftr    = ParagraphStyle("Ftr",    fontName="Helvetica",         fontSize=8,  textColor=GRAY,  alignment=TA_CENTER)

    story = [
        Paragraph("MaintlyQR™", brand),
        Paragraph(title, h1),
        Paragraph(subtitle, sub),
        Paragraph(f"www.maintlyqr.com  ·  Queensland, Australia  ·  July 2026  ·  {lang_note}", meta),
        HRFlowable(width="100%", thickness=2, color=RED, spaceAfter=20),
    ]

    for section in sections:
        t = section.get("type", "section")

        if t == "quote":
            story.append(Paragraph(f'"{section["content"]}"', quote))

        elif t == "closer":
            story.append(Spacer(1, 8))
            for line in section["lines"]:
                story.append(Paragraph(line, closer))

        elif t == "tagline":
            story.append(Spacer(1, 6))
            story.append(HRFlowable(width="100%", thickness=1, color=LIGHT_HR, spaceAfter=14))
            story.append(Paragraph(section["content"], tag))
            story.append(Spacer(1, 4))

        elif t == "spacer":
            story.append(Spacer(1, section.get("height", 10)))

        else:
            if section.get("heading"):
                story.append(Paragraph(section["heading"], h2))
            for para in section.get("content", []):
                if para.startswith("- "):
                    story.append(Paragraph("•  " + para[2:], bullet))
                else:
                    story.append(Paragraph(para, body))
            story.append(Spacer(1, 2))

    story += [
        HRFlowable(width="100%", thickness=1, color=LIGHT_HR, spaceBefore=28, spaceAfter=8),
        Paragraph("www.maintlyqr.com  ·  support@maintlyqr.com  ·  Queensland, Australia", ftr),
    ]

    doc.build(story)
    print(f"  [OK] {filename}")


# =============================================================================
# SPANISH VERSION
# =============================================================================
build_doc(
    "MaintlyQR_Founding_Story_ES.pdf",
    "La Historia de MaintlyQR",
    "Cómo una vida entre máquinas se convirtió en una plataforma de identidad digital para el mundo físico.",
    "Versión en Español",
    [
        {"type": "quote", "content": "Las empresas no nacen el día en que se registra un dominio. Nacen años antes, en los valores que heredamos y en las experiencias que nos forman."},

        {"heading": "Los cimientos", "content": [
            "Tuve la enorme fortuna de crecer rodeado de personas trabajadoras, honestas y humildes. Mis abuelos, mis padres y mis hermanos fueron mi primera escuela. Ellos me enseñaron que el trabajo bien hecho siempre tiene valor, que la palabra de una persona es un compromiso, que el respeto se gana con hechos y que las oportunidades no llegan por casualidad, sino como consecuencia del esfuerzo y la perseverancia.",
            "Si hoy puedo adaptarme a distintos países, empezar de cero una y otra vez y enfrentar desafíos que parecían imposibles, es porque ellos me dieron las herramientas para hacerlo.",
        ]},

        {"heading": "La escuela que me formó", "content": [
            "Mi formación continuó en la Escuela Industrial N.º 4 José Menéndez, en Río Gallegos, Santa Cruz. Allí no solamente aprendí una profesión; aprendí una manera de pensar. Aprendí que un buen técnico nunca deja de hacerse preguntas, nunca deja de aprender y nunca entrega un trabajo del que no pueda sentirse orgulloso. Esa escuela despertó una curiosidad que todavía me acompaña: entender cómo funcionan las cosas para poder mejorarlas.",
        ]},

        {"heading": "Los maestros", "content": [
            "Hubo personas que marcaron profundamente mi desarrollo profesional. Carlos Soler y Manuel Garcés ocuparon un lugar muy especial. Ellos fueron mucho más que compañeros de trabajo o supervisores; fueron maestros. Me enseñaron que detrás de cada reparación hay una responsabilidad, que un mantenimiento no consiste solamente en cambiar una pieza sino en cuidar aquello que otra persona necesita para vivir o trabajar.",
            "Observándolos entendí que el verdadero profesionalismo no se mide solamente por el conocimiento técnico, sino por la forma en que uno enfrenta cada problema y por el respeto con el que trata a las personas.",
        ]},

        {"heading": "Una carrera entre máquinas y países", "content": [
            "Mi carrera me llevó por distintos caminos. Trabajé en electricidad, petróleo, mantenimiento industrial, talleres, construcción y minería. Viví y trabajé en Argentina, Italia, Suiza y finalmente Australia. En cada país aprendí nuevas técnicas, nuevas formas de trabajar y nuevas maneras de resolver problemas.",
            "Sin embargo, había algo que permanecía igual sin importar el lugar o la industria: las máquinas siempre terminaban perdiendo su historia.",
            "Veía vehículos con cientos de miles de kilómetros cuyos mantenimientos estaban repartidos entre talleres, facturas y cuadernos. Generadores que habían recorrido minas enteras sin un historial accesible. Equipos industriales cuyo conocimiento desaparecía cuando un técnico cambiaba de empresa. Cada propietario conocía solamente un pequeño fragmento de la historia de la máquina. El resto se perdía para siempre.",
            "Durante mucho tiempo acepté esa realidad como algo normal. Hasta que un día dejé de hacerlo.",
        ]},

        {"type": "quote", "content": "¿Por qué el historial pertenece a las personas y no a la máquina?"},

        {"heading": "La pregunta que lo cambió todo", "content": [
            "Si una máquina puede pasar por diez propietarios diferentes durante su vida útil, ¿por qué su historia desaparece cada vez que cambia de manos? ¿Por qué un mantenimiento realizado con dedicación deja de tener valor simplemente porque el papel se perdió o el taller cerró? ¿Por qué algo tan importante depende de la memoria de las personas?",
            "En ese momento entendí que el verdadero problema no era tecnológico. Era un problema de confianza y de memoria. El mundo físico no tenía una forma permanente de recordar su propia historia.",
        ]},

        {"heading": "El insight: identidad digital permanente", "content": [
            "La primera solución que apareció fue un código QR. Pero muy rápidamente comprendí que el QR nunca fue el producto. El QR era solamente la puerta de entrada.",
            "Lo realmente importante era crear una identidad digital permanente para cada activo físico. Una identidad que acompañara al vehículo, a la motocicleta, al generador, a la excavadora, al barco o a cualquier máquina durante toda su vida útil. Una identidad que sobreviviera a los cambios de propietario, de empresa, de país o de taller.",
            "Así nació el Asset Passport: la idea de que una máquina, como una persona, tiene una historia que merece ser preservada. No porque lo diga el propietario actual. Sino porque le pertenece a ella.",
        ]},

        {"heading": "La plataforma", "content": [
            "MaintlyQR fue construida desde cero con un principio de diseño claro: sin fricción. Escanear un QR debe mostrar el historial de forma instantánea, sin descargar una aplicación, sin crear una cuenta. El registro de un mantenimiento debe tomar segundos.",
            "La plataforma está construida sobre Next.js 16, Supabase y Vercel — tecnología de escala global desde el primer día. Cada registro es almacenado con seguridad a nivel de fila. Cada historial es accesible públicamente mediante el código QR, desde cualquier lugar del mundo.",
            "Desde el principio, MaintlyQR fue diseñada para ser una empresa seria y duradera. Eso significó construir no solo el producto, sino también la infraestructura legal que lo sostiene: un paquete legal completo de 10 documentos que protegen las innovaciones centrales de la plataforma y establecen el marco para el programa Verified Mechanic.",
        ]},

        {"heading": "El Verified Mechanic", "content": [
            "Una de las características más importantes de MaintlyQR es lo que significa cuando un mecánico firma un registro de mantenimiento.",
            "Cualquier usuario puede registrar su propio cambio de aceite. Pero un registro firmado por un Verified Mechanic — un profesional con matrícula cuya identidad fue confirmada por MaintlyQR — tiene un peso real. Es la diferencia entre una nota en un cuaderno y una factura firmada.",
            "El programa Verified Mechanic fue diseñado para darle a los mecánicos profesionales algo que nunca tuvieron: una reputación pública y portable. Cada trabajo registrado en MaintlyQR queda permanentemente asociado a su identidad verificada. Su trabajo sigue al activo — y construye su reputación profesional — para siempre.",
        ]},

        {"heading": "La visión", "content": [
            "MaintlyQR está construida para un mundo donde los activos físicos — desde motocicletas y barcos hasta excavadoras y turbinas — tienen la misma identidad digital verificable que las personas y las empresas dan por sentada.",
            "La visión a largo plazo es una red global de registros de mantenimiento: una capa estándar de confianza para el mundo físico, donde el historial de servicio de cualquier activo sea tan accesible y verificable como los estados financieros de una empresa pública.",
            "Esto tiene implicaciones que van mucho más allá de la conveniencia. Cambia cómo se valoran los activos en la reventa. Crea responsabilidad para la industria del mantenimiento. Permite que los seguros se calculen en base a historiales verificados. Le da a los operadores de flotas, gobiernos y reguladores acceso a datos de mantenimiento reales.",
            "Comenzamos con los activos que más le importan a la gente: sus vehículos. Pero la arquitectura es agnóstica al tipo de activo. Cualquier objeto físico puede tener un Asset Passport.",
        ]},

        {"type": "quote", "content": "No estamos construyendo una app de mantenimiento. Estamos construyendo la capa de identidad para el mundo físico."},

        {"heading": "La fe", "content": [
            "Nunca vi mi vida como una sucesión de casualidades. Siempre sentí que cada oportunidad, cada viaje, cada cambio de país y también cada dificultad tenían un propósito. Hubo momentos de incertidumbre, momentos donde parecía que todo debía empezar nuevamente. Pero mirando hacia atrás puedo ver que cada desafío terminó preparándome para el siguiente.",
            "Siempre encontré la fortaleza necesaria para continuar y creo profundamente que esa fortaleza nunca vino solamente de mí. Dios puso delante de mí las oportunidades correctas y también me dio la templanza, el coraje y la paciencia para aprovecharlas.",
            "Hoy entiendo que MaintlyQR no es solamente el resultado de una buena idea. Es el resultado de una vida entera rodeada de máquinas, personas extraordinarias, trabajo, esfuerzo, aprendizaje y fe.",
        ]},

        {"type": "closer", "lines": [
            "Cada persona tiene una historia.",
            "¿Por qué las máquinas que construyen nuestro mundo no la tienen también?",
            "Ellas también trabajan.",
            "Ellas también envejecen.",
            "Ellas también merecen ser recordadas.",
            "MaintlyQR nació para que esa historia nunca vuelva a perderse.",
            "Para darle memoria al mundo físico.",
        ]},

        {"type": "tagline", "content": "Every Machine Has a Story."},

        {"type": "spacer", "height": 6},
        {"content": [
            "Facundo Ledesma — Founder, MaintlyQR™",
            "support@maintlyqr.com  ·  www.maintlyqr.com  ·  Queensland, Australia",
        ]},
    ]
)


# =============================================================================
# ENGLISH VERSION
# =============================================================================
build_doc(
    "MaintlyQR_Founding_Story_EN.pdf",
    "The MaintlyQR Story",
    "How a life among machines became a digital identity platform for the physical world.",
    "English Version",
    [
        {"type": "quote", "content": "Companies aren't born the day you register a domain. They're born years earlier — in the values you inherit and the experiences that shape how you see the world."},

        {"heading": "The Foundation", "content": [
            "I had the great fortune of growing up surrounded by hardworking, honest, and humble people. My grandparents, my parents, my siblings — they were my first school. They taught me that work done well always has value. That a person's word is a commitment. That respect is earned through actions, not words. That opportunities don't arrive by chance — they come as a result of effort and perseverance.",
            "If I can adapt to new countries, start over again and again, and face challenges that once seemed impossible, it's because they gave me the tools to do it.",
        ]},

        {"heading": "The School That Formed Me", "content": [
            "My technical education began at Escuela Industrial N.º 4 José Menéndez in Río Gallegos, Santa Cruz — Patagonia, Argentina. There I didn't just learn a trade; I learned a way of thinking. I learned that a good technician never stops asking questions, never stops learning, and never delivers work they can't be proud of. That school ignited a curiosity that still drives me today: understanding how things work so I can make them better.",
        ]},

        {"heading": "The Mentors", "content": [
            "Some people left a permanent mark on my professional development. Carlos Soler and Manuel Garcés hold a very special place. They were far more than colleagues or supervisors — they were teachers. They showed me that behind every repair there is a responsibility. That maintenance isn't just replacing a part — it's taking care of something that another person depends on to live and work.",
            "Watching them, I understood that true professionalism is measured not only by technical knowledge, but by how you face each problem and the respect with which you treat people.",
        ]},

        {"heading": "A Career Among Machines and Countries", "content": [
            "My career took me through many paths. I worked in electrical systems, oil and gas, industrial maintenance, workshops, construction, and mining. I lived and worked in Argentina, Italy, Switzerland, and finally Australia. In every country I learned new techniques, new ways of working, and new ways of solving problems.",
            "But there was one thing that stayed the same regardless of the place or industry: machines always ended up losing their history.",
            "I saw vehicles with hundreds of thousands of kilometres whose maintenance was scattered across workshops, receipts, and notebooks. Generators that had worked through entire mine sites with no accessible service record. Industrial equipment whose operational knowledge vanished the moment a technician changed companies. Each owner knew only a small fragment of the machine's story. The rest was lost forever.",
            "For a long time I accepted that as normal. Then one day I stopped.",
        ]},

        {"type": "quote", "content": "Why does the history belong to the people — and not to the machine?"},

        {"heading": "The Question That Changed Everything", "content": [
            "If a machine can pass through ten different owners during its working life, why does its history disappear every time it changes hands? Why does a maintenance job done with real care lose its value simply because the paper got lost or the workshop closed? Why does something so important depend entirely on human memory?",
            "In that moment I understood that the real problem wasn't technological. It was a problem of trust and memory. The physical world had no permanent way of remembering its own history.",
        ]},

        {"heading": "The Insight: Permanent Digital Identity", "content": [
            "The first solution I saw was a QR code. But I quickly understood that the QR was never the product — it was the door.",
            "What really mattered was creating a permanent digital identity for each physical asset. An identity that would travel with the vehicle, the motorcycle, the generator, the excavator, the boat — for its entire working life. An identity that would survive changes of owner, company, country, or workshop.",
            "That's how the Asset Passport was born: the idea that a machine, like a person, has a history worth preserving. Not because the current owner says so. But because it belongs to the machine itself.",
        ]},

        {"heading": "The Platform", "content": [
            "MaintlyQR was built from the ground up with one design principle: zero friction. Scanning a QR code should show the history instantly — no app download, no account required. Logging a maintenance record should take seconds.",
            "The platform runs on Next.js 16, Supabase, and Vercel — built for global scale from day one. Every record is stored with row-level security. Every Maintenance Ledger is publicly accessible via QR code, from anywhere in the world.",
            "From the beginning, MaintlyQR was designed to be a serious, durable company. That meant building not just the product, but the legal infrastructure to support it: a complete 10-document legal package protecting the platform's core innovations — the QR Assignment System, the Maintenance Ledger architecture, the Asset Passport concept — and establishing the foundation for the Verified Mechanic program.",
        ]},

        {"heading": "The Verified Mechanic", "content": [
            "One of the most important features of MaintlyQR is what it means when a mechanic signs a maintenance record.",
            "Anyone can log their own oil change. But a record signed by a Verified Mechanic — a trade-registered professional whose identity has been confirmed by MaintlyQR — carries real weight. It's the difference between a note in a notebook and a signed invoice.",
            "The Verified Mechanic program gives professional mechanics something they have never had: a portable, public reputation. Every job recorded on MaintlyQR is permanently linked to their verified identity. Their work follows the asset — and builds their professional standing — forever.",
        ]},

        {"heading": "The Vision", "content": [
            "MaintlyQR is built for a world where physical assets — from motorcycles and boats to excavators and turbines — have the same kind of verifiable digital identity that people and companies already take for granted.",
            "The long-term vision is a global maintenance ledger network: a standard trust layer for the physical world, where the service history of any asset is as accessible and verifiable as a public company's financial filings.",
            "The implications go far beyond convenience. It changes how assets are valued at resale. It creates accountability in the maintenance industry. It enables insurance underwriting based on verified service records. It gives fleet operators, governments, and regulators access to real maintenance data — not self-reported estimates.",
            "We start with the assets people care most about: their vehicles. But the architecture is asset-agnostic. Any physical object can have an Asset Passport. The only question is how quickly we can get there.",
        ]},

        {"type": "quote", "content": "We're not building a maintenance app. We're building the identity layer for the physical world."},

        {"heading": "Faith and Purpose", "content": [
            "I have never seen my life as a series of coincidences. I have always felt that every opportunity, every move, every new country — and every difficulty — had a purpose. There were moments of uncertainty, moments where everything seemed to need to start over. But looking back, I can see that every challenge ended up preparing me for the next one.",
            "I always found the strength to continue, and I believe deeply that strength never came from me alone. MaintlyQR is not simply the result of a good idea. It is the result of an entire life surrounded by machines, extraordinary people, work, persistence, learning — and faith.",
        ]},

        {"type": "closer", "lines": [
            "Every person has a story.",
            "Why shouldn't the machines that build our world have one too?",
            "They work.",
            "They age.",
            "They deserve to be remembered.",
            "MaintlyQR was built so that story is never lost again.",
        ]},

        {"type": "tagline", "content": "Every Machine Has a Story."},

        {"type": "spacer", "height": 6},
        {"content": [
            "Facundo Ledesma — Founder, MaintlyQR™",
            "support@maintlyqr.com  ·  www.maintlyqr.com  ·  Queensland, Australia",
        ]},
    ]
)


print("\n========================================")
print("  Founding Story ES + EN — DONE")
print("========================================")
