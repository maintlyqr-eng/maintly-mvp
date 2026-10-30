// Capa animada sobre el mapa de la portada (desktop). La foto de fondo
// (fondo.jpg, 1536×1024) ya tiene los puntos rojos pintados; acá van, en
// esas mismas posiciones, un pulso suave y un destello que recorre alguna
// conexión cada tanto. El SVG usa el mismo encuadre que la foto
// (preserveAspectRatio "slice" = object-cover), así los puntos quedan
// clavados sobre los del dibujo en cualquier tamaño de pantalla.
// Sin JavaScript: todo CSS + SMIL. Se apaga con "reducir movimiento".

const DOTS: [number, number][] = [
  [203, 205], [241, 169], [343, 179], [450, 118], [548, 150], [634, 220], [474, 271], [538, 274],
  [826, 195], [874, 192], [957, 177], [969, 234], [1018, 154], [1137, 167], [1111, 285], [1241, 237], [1171, 394],
];
// Conexiones (curvas) que recorre el destello, una por vez.
const ARCS = [
  "M203,205 Q330,40 450,118",
  "M343,179 Q500,90 634,220",
  "M957,177 Q1100,100 1241,237",
  "M969,234 Q1080,250 1171,394",
];

export default function HeroMapPulse() {
  return (
    <svg className="mly-map-pulse absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 1536 1024" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <radialGradient id="mlyGlow"><stop offset="0" stopColor="#ff2d2d" stopOpacity="0.9" /><stop offset="1" stopColor="#ff2d2d" stopOpacity="0" /></radialGradient>
      </defs>
      {DOTS.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="9" fill="none" stroke="#e11d1d" strokeWidth="1.5" className="mly-dot" style={{ animationDelay: `${(i * 0.7) % 5}s`, transformOrigin: `${x}px ${y}px` }} />
      ))}
      {ARCS.map((d, i) => (
        <circle key={`g${i}`} r="7" fill="url(#mlyGlow)" opacity="0">
          <animateMotion dur="2.6s" begin={`${i * 7 + 2}s`} repeatCount="indefinite" path={d} />
          <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.15;0.85;1" dur="2.6s" begin={`${i * 7 + 2}s`} repeatCount="indefinite" />
        </circle>
      ))}
    </svg>
  );
}
