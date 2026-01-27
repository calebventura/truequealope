import locationsData from "../../docs/locations.json";

type LocationsJson = Record<
  string,
  { provinces: string[]; districts: Record<string, string[]> }
>;

const RAW_LOCATIONS = locationsData as LocationsJson;

const PRIORITY_DEPARTMENTS = ["Lima", "Arequipa", "Callao"] as const;

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const departmentOrder = Object.keys(RAW_LOCATIONS).sort((a, b) => {
  const pa = PRIORITY_DEPARTMENTS.indexOf(a as (typeof PRIORITY_DEPARTMENTS)[number]);
  const pb = PRIORITY_DEPARTMENTS.indexOf(b as (typeof PRIORITY_DEPARTMENTS)[number]);
  if (pa !== -1 || pb !== -1) {
    return (pa === -1 ? Number.MAX_SAFE_INTEGER : pa) -
      (pb === -1 ? Number.MAX_SAFE_INTEGER : pb);
  }
  return a.localeCompare(b, "es", { sensitivity: "base" });
});

export type Department = string;

export const DEPARTMENTS: readonly Department[] = departmentOrder;

export const DEPARTMENT_LABELS: Record<Department, string> = departmentOrder.reduce(
  (acc, dept) => {
    acc[dept] = dept;
    return acc;
  },
  {} as Record<string, string>
);

export const PROVINCES_BY_DEPARTMENT: Record<Department, readonly string[]> =
  departmentOrder.reduce((acc, dept) => {
    const provinces = RAW_LOCATIONS[dept]?.provinces ?? [];
    const sorted = [...provinces].sort((a, b) =>
      a.localeCompare(b, "es", { sensitivity: "base" })
    );
    acc[dept] = sorted;
    return acc;
  }, {} as Record<string, readonly string[]>);

export const DISTRICTS_BY_PROVINCE: Record<
  Department,
  Record<string, readonly string[]>
> = departmentOrder.reduce((acc, dept) => {
  const provinces = RAW_LOCATIONS[dept]?.provinces ?? [];
  const districtsByProvince: Record<string, readonly string[]> = {};
  provinces.forEach((prov) => {
    const provDistricts =
      RAW_LOCATIONS[dept]?.districts?.[prov] ??
      RAW_LOCATIONS[dept]?.districts?.[prov.toUpperCase()] ??
      [];
    districtsByProvince[prov] = [...provDistricts].sort((a, b) =>
      a.localeCompare(b, "es", { sensitivity: "base" })
    );
  });
  acc[dept] = districtsByProvince;
  return acc;
}, {} as Record<Department, Record<string, readonly string[]>>);

export const LOCATIONS: Record<Department, readonly string[]> = departmentOrder.reduce(
  (acc, dept) => {
    const provinces = RAW_LOCATIONS[dept]?.provinces ?? [];
    const districtsSet = new Set<string>();
    provinces.forEach((prov) => {
      const provDistricts =
        RAW_LOCATIONS[dept]?.districts?.[prov] ??
        RAW_LOCATIONS[dept]?.districts?.[prov.toUpperCase()] ??
        [];
      provDistricts.forEach((d) => districtsSet.add(d));
    });
    const sortedDistricts = Array.from(districtsSet).sort((a, b) =>
      a.localeCompare(b, "es", { sensitivity: "base" })
    );
    acc[dept] = sortedDistricts;
    return acc;
  },
  {} as Record<string, readonly string[]>
);

// Backward-compatibility aliases with uppercase keys (e.g., LOCATIONS.LIMA)
departmentOrder.forEach((dept) => {
  const upper = dept.toUpperCase();
  if (!(upper in PROVINCES_BY_DEPARTMENT)) {
    PROVINCES_BY_DEPARTMENT[upper] = PROVINCES_BY_DEPARTMENT[dept];
  }
  if (!(upper in DISTRICTS_BY_PROVINCE)) {
    DISTRICTS_BY_PROVINCE[upper] = DISTRICTS_BY_PROVINCE[dept];
  }
  if (!(upper in LOCATIONS)) {
    LOCATIONS[upper] = LOCATIONS[dept];
  }
});

const normalizeDepartmentMap = new Map<string, Department>(
  departmentOrder.map((dept) => [normalize(dept), dept] as [string, Department])
);

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
  const match = normalizeDepartmentMap.get(normalize(value));
  return match ?? "";
};

export const normalizeProvince = (
  department: Department,
  value?: string | null
) => {
  const options = PROVINCES_BY_DEPARTMENT[department] ?? [];
  if (!value) return options[0] ?? "";
  const normalized = normalize(value);
  return (
    options.find((opt) => normalize(opt) === normalized) ??
    options[0] ??
    ""
  );
};

export const normalizeDistrict = (
  department: Department,
  value?: string | null,
  province?: string | null
) => {
  const provKey = province ?? "";
  const byProvince = provKey
    ? DISTRICTS_BY_PROVINCE[department]?.[provKey]
    : undefined;
  const districts: readonly string[] = byProvince ?? LOCATIONS[department] ?? [];
  if (!value) return "";
  const normalized = normalize(value);
  return (
    districts.find((district) => normalize(district) === normalized) ?? ""
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
  const district = normalizeDistrict(department, districtToken, province);

  return { department, province, district };
};

export const getDistrictsFor = (
  department?: Department | null,
  province?: string | null
): readonly string[] => {
  if (!department) return [];
  if (province && DISTRICTS_BY_PROVINCE[department]?.[province]) {
    return DISTRICTS_BY_PROVINCE[department][province];
  }
  return LOCATIONS[department] ?? [];
};
