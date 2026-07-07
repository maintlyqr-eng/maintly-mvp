// Shared across every place that shows or picks an asset type (Assets page,
// dashboard "Add Equipment" flow, asset detail pages) so the list of types
// and their icons can't drift out of sync between pages.

export const assetTypeOptions = [
  { value: "automotive", label: "Automotive" },
  { value: "motorcycle", label: "Motorcycle" },
  { value: "generator", label: "Generator" },
  { value: "machinery", label: "Machinery" },
  { value: "marine", label: "Marine" },
  { value: "aviation", label: "Aviation" },
];

export const fuelTypeOptions = ["Gasoline", "Diesel", "Electric", "Hybrid", "Other"];

export const assetTypeImg: Record<string, string> = {
  automotive: "/images/car.png",
  motorcycle: "/images/moto.png",
  generator: "/images/generador.png",
  machinery: "/images/excavator.png",
  marine: "/images/barco.png",
  aviation: "/images/avion.png",
};
