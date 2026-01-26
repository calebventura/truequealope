import {
  validateAbout,
  validateInstagram,
  validateLocation,
  validateName,
  validatePhone,
  validateContact,
} from "@/lib/userValidation";

export type ProfileInput = {
  displayName?: string | null;
  phoneNumber?: string | null;
  instagramUser?: string | null;
  aboutMe?: string | null;
  department?: string | null;
  province?: string | null;
  district?: string | null;
};

export function validateProfile(input: ProfileInput) {
  const errors: Record<string, string> = {};

  const nameCheck = validateName(input.displayName ?? "");
  if (nameCheck.error) errors.displayName = nameCheck.error;

  const phoneCheck = validatePhone(input.phoneNumber ?? "");
  if (phoneCheck.error) errors.phoneNumber = phoneCheck.error;

  const instagramCheck = validateInstagram(input.instagramUser);
  if (instagramCheck.error) errors.instagramUser = instagramCheck.error;

  const aboutCheck = validateAbout(input.aboutMe);
  if (aboutCheck.error) errors.aboutMe = aboutCheck.error;

  const contactError = validateContact(phoneCheck.normalized, instagramCheck.normalized);
  if (contactError) {
    errors.phoneNumber = errors.phoneNumber || contactError;
    if (!errors.instagramUser) errors.instagramUser = contactError;
  }

  const locationCheck = validateLocation(
    input.department,
    input.province,
    input.district
  );
  Object.assign(errors, locationCheck.errors);

  return {
    errors,
    normalized: {
      name: nameCheck.normalized,
      phone: phoneCheck.normalized,
      instagram: instagramCheck.normalized,
      aboutMe: aboutCheck.normalized,
    },
  };
}
