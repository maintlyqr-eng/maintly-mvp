"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

// Campo de contraseña con el "ojito" para mostrar/ocultar lo escrito.
// Facu (21/10/2026): "en cada lugar que vayamos a poner una contraseña
// necesito el ojito". Usar este componente en vez de <input type="password">
// así ninguna pantalla nueva se lo olvida. Acepta las mismas props que un
// <input> normal; `className` es la del input (se le agrega padding a la
// derecha para que el botón no tape el texto).

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> & {
  showLabel?: string;
  hideLabel?: string;
  /** Clases del contenedor (márgenes, ancho), para que el ojito quede centrado respecto del input. */
  wrapperClassName?: string;
};

export default function PasswordInput({ className = "", wrapperClassName = "", showLabel = "Mostrar", hideLabel = "Ocultar", ...rest }: Props) {
  const [show, setShow] = useState(false);
  return (
    <div className={`relative ${wrapperClassName}`}>
      <input type={show ? "text" : "password"} className={`${className} pr-10`} {...rest} />
      <button
        type="button"
        tabIndex={-1}
        aria-label={show ? hideLabel : showLabel}
        title={show ? hideLabel : showLabel}
        onClick={() => setShow((v) => !v)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
      >
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}
