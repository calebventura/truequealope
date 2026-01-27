export const nameRegex =
  /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+([ '\\-][A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)*$/;

export const phoneRegex = /^[0-9]{9}$/;
export const instagramRegex = /^[A-Za-z0-9._]{3,30}$/;

export function normalizeWhitespace(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function validateName(value: string) {
  const normalized = normalizeWhitespace(value);
  if (!normalized) return { normalized, error: "Ingresa tu nombre" };
  if (normalized.length < 2)
    return { normalized, error: "El nombre debe tener al menos 2 caracteres" };
  if (normalized.length > 60)
    return { normalized, error: "El nombre es demasiado largo" };
  if (!nameRegex.test(normalized))
    return {
      normalized,
      error: "Usa solo letras, espacios, guion o apóstrofo",
    };
  return { normalized, error: null };
}

export function validatePhone(value: string) {
  const normalized = value.trim();
  if (!normalized) return { normalized, error: null };
  if (!phoneRegex.test(normalized))
    return {
      normalized,
      error: "Debe tener 9 dígitos (solo números)",
    };
  return { normalized, error: null };
}

export function validateInstagram(value: string | null | undefined) {
  const normalized = (value ?? "").trim();
  if (!normalized) return { normalized, error: null };
  if (!instagramRegex.test(normalized))
    return { normalized, error: "Usuario de Instagram inválido" };
  return { normalized, error: null };
}

export function validateAbout(value: string | null | undefined) {
  const normalized = (value ?? "").trim();
  if (normalized.length > 300)
    return { normalized, error: "Máximo 300 caracteres" };
  return { normalized, error: null };
}

export function validateLocation(
  department?: string | null,
  province?: string | null,
  district?: string | null
) {
  const errors: Record<string, string> = {};
  if (!department) {
    errors.department = "Selecciona un departamento";
  } else {
    if (!province) errors.province = "Selecciona una provincia";
    if (!district) errors.district = "Selecciona un distrito";
  }
  return { errors };
}

export function validateContact(phone?: string, instagram?: string) {
  const hasPhone = Boolean(phone && phone.trim());
  const hasInstagram = Boolean(instagram && instagram.trim());
  if (!hasPhone && !hasInstagram) {
    return "Agrega tu teléfono o tu Instagram";
  }
  return null;
}
