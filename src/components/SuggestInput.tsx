"use client";

import { useEffect, useId, useRef, useState } from "react";

// Input de texto libre con lista de sugerencias (marca / modelo del
// catálogo en src/lib/vehicleCatalog.ts). No es un <select>: lo que no
// está en el catálogo se puede escribir igual. Teclado: ↓/↑ mueven,
// Enter elige la resaltada (o deja el texto si no hay resaltada), Esc
// cierra. En celular, tocar una opción la elige (onMouseDown para que
// gane al blur del input).
//
// `suggestions` lo calcula el padre a partir del valor actual; el
// componente solo se ocupa de mostrarlas y de la navegación.

type Props = {
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
  placeholder?: string;
  required?: boolean;
  className?: string;
  /** Mostrar la lista también con el campo vacío (p. ej. modelos de la marca ya elegida). */
  openOnFocus?: boolean;
  autoCapitalize?: string;
};

export default function SuggestInput({ value, onChange, suggestions, placeholder, required, className, openOnFocus, autoCapitalize }: Props) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const listId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);

  // Cuando cambian las sugerencias (porque cambió el texto), se resetea la resaltada.
  useEffect(() => { setActive(-1); }, [suggestions]);

  // Cerrar al tocar fuera.
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent | TouchEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("touchstart", onDoc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("touchstart", onDoc);
    };
  }, [open]);

  const visible = open && suggestions.length > 0 && (openOnFocus || value.trim().length > 0);

  function pick(s: string) {
    onChange(s);
    setOpen(false);
    setActive(-1);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!visible) {
      if (e.key === "ArrowDown" && suggestions.length > 0) { setOpen(true); e.preventDefault(); }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === "Enter") {
      if (active >= 0) {
        e.preventDefault(); // no mandar el form: solo elegir
        pick(suggestions[active]);
      } else {
        setOpen(false); // Enter sin resaltada: deja el texto y sigue el submit normal
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  }

  return (
    <div ref={wrapRef} className="relative">
      <input
        type="text"
        value={value}
        required={required}
        placeholder={placeholder}
        autoComplete="off"
        autoCapitalize={autoCapitalize}
        role="combobox"
        aria-expanded={visible}
        aria-controls={listId}
        aria-autocomplete="list"
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        className={className}
      />
      {visible && (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-full mt-1 z-20 max-h-56 overflow-y-auto bg-white border border-zinc-200 rounded-xl shadow-lg py-1"
        >
          {suggestions.map((s, i) => (
            <li
              key={s}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => { e.preventDefault(); pick(s); }}
              onMouseEnter={() => setActive(i)}
              className={`px-3 py-2 text-[13px] cursor-pointer ${i === active ? "bg-red-50 text-red-700" : "text-zinc-800 hover:bg-zinc-50"}`}
            >
              {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
