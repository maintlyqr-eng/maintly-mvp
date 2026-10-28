"use client";

import { useEffect, useState } from "react";

// true/false según haya red. Escucha los eventos del navegador; el valor
// inicial es true para no mostrar "sin conexión" en el render del servidor.
export function useOnline(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); };
  }, []);
  return online;
}
