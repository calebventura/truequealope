export const LOCATIONS = {
  LIMA: [
    "Lima",
    "Ancón",
    "Ate",
    "Barranco",
    "Breña",
    "Carabayllo",
    "Chaclacayo",
    "Chorrillos",
    "Cieneguilla",
    "Comas",
    "El Agustino",
    "Independencia",
    "Jesús María",
    "La Molina",
    "La Victoria",
    "Lince",
    "Los Olivos",
    "Lurigancho",
    "Lurin",
    "Magdalena del Mar",
    "Miraflores",
    "Pachacámac",
    "Pucusana",
    "Pueblo Libre",
    "Puente Piedra",
    "Punta Hermosa",
    "Punta Negra",
    "Rímac",
    "San Bartolo",
    "San Borja",
    "San Isidro",
    "San Juan de Lurigancho",
    "San Juan de Miraflores",
    "San Luis",
    "San Martín de Porres",
    "San Miguel",
    "Santa Anita",
    "Santa María del Mar",
    "Santa Rosa",
    "Santiago de Surco",
    "Surquillo",
    "Villa El Salvador",
    "Villa María del Triunfo",
  ],
  AREQUIPA: [
    "Arequipa",
    "Alto Selva Alegre",
    "Cayma",
    "Cerro Colorado",
    "Characato",
    "Chiguata",
    "Jacobo Hunter",
    "José Luis Bustamante y Rivero",
    "La Joya",
    "Mariano Melgar",
    "Miraflores",
    "Mollebaya",
    "Paucarpata",
    "Pocsi",
    "Polobaya",
    "Quequeña",
    "Sabandía",
    "Sachaca",
    "San Juan de Siguas",
    "San Juan de Tarucani",
    "Santa Isabel de Siguas",
    "Santa Rita de Siguas",
    "Socabaya",
    "Tiabaya",
    "Uchumayo",
    "Vitor",
    "Yanahuara",
    "Yarabamba",
    "Yura",
  ],
} as const;

export type Department = keyof typeof LOCATIONS;
export const DEPARTMENT_LABELS: Record<Department, string> = {
  LIMA: "Lima",
  AREQUIPA: "Arequipa",
};

export const PROVINCES_BY_DEPARTMENT: Record<Department, readonly string[]> = {
  LIMA: ["Lima"],
  AREQUIPA: ["Arequipa"],
};

const capitalizeLabel = (value: string) => {
  if (!value) return "";
  const needsNormalization = value === value.toUpperCase();
  if (needsNormalization) {
    return value
      .toLowerCase()
      .split(" ")
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }
  return value.charAt(0).toUpperCase() + value.slice(1);
};

export const formatDepartmentLabel = (department: Department) =>
  DEPARTMENT_LABELS[department] ?? capitalizeLabel(department);

export const formatLocationPart = (value: string) => capitalizeLabel(value);

export const normalizeDepartment = (
  value?: string | null
): Department | "" => {
  if (!value) return "";
  const normalized = value.trim().toLowerCase();
  const match = (Object.keys(LOCATIONS) as Department[]).find(
    (dept) => dept.toLowerCase() === normalized
  );
  return match ?? "";
};

export const normalizeProvince = (
  department: Department,
  value?: string | null
) => {
  const options = PROVINCES_BY_DEPARTMENT[department] ?? [];
  if (!value) return options[0] ?? "";
  const normalized = value.trim().toLowerCase();
  return options.find((opt) => opt.toLowerCase() === normalized) ?? options[0] ?? "";
};

export const normalizeDistrict = (
  department: Department,
  value?: string | null
) => {
  if (!value) return "";
  const normalized = value.trim().toLowerCase();
  return (
    LOCATIONS[department].find(
      (district) => district.toLowerCase() === normalized
    ) ?? ""
  );
};

export const buildLocationLabel = (
  district: string,
  province: string,
  department: Department
) => {
  const deptLabel = formatDepartmentLabel(department);
  return [district, province, deptLabel]
    .filter(Boolean)
    .map(capitalizeLabel)
    .join(", ");
};

export const parseLocationParts = (
  raw?: string | null
): { department: Department | ""; province: string; district: string } => {
  if (!raw) return { department: "", province: "", district: "" };
  const trimmed = raw.trim();
  if (!trimmed) return { department: "", province: "", district: "" };

  const tokens = trimmed
    .replace(" - ", ",")
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean);

  if (tokens.length === 0) return { department: "", province: "", district: "" };

  const department = normalizeDepartment(tokens[tokens.length - 1]);
  if (!department) return { department: "", province: "", district: "" };

  const provinceToken = tokens.length >= 2 ? tokens[tokens.length - 2] : "";
  const province = normalizeProvince(department, provinceToken);

  const districtToken =
    tokens.length >= 3
      ? tokens[tokens.length - 3]
      : tokens.length >= 2
      ? tokens[tokens.length - 2]
      : "";
  const district = normalizeDistrict(department, districtToken);

  return { department, province, district };
};
