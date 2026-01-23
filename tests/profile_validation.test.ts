import { validateProfile } from "../src/app/profile/validation";

describe("validateProfile", () => {
  it("requires name and phone", () => {
    const { errors } = validateProfile({
      displayName: "",
      phoneNumber: "",
    });
    expect(errors.displayName).toBeTruthy();
    expect(errors.phoneNumber).toBeTruthy();
  });

  it("accepts valid name and phone", () => {
    const { errors } = validateProfile({
      displayName: "Juan Páez",
      phoneNumber: "912345678",
      department: "LIMA",
      province: "Lima",
      district: "Lima",
    });
    expect(errors.displayName).toBeUndefined();
    expect(errors.phoneNumber).toBeUndefined();
  });

  it("rejects invalid name characters", () => {
    const { errors } = validateProfile({
      displayName: "sdads a$$%",
      phoneNumber: "912345678",
      department: "LIMA",
      province: "Lima",
      district: "Lima",
    });
    expect(errors.displayName).toBeTruthy();
  });

  it("validates instagram format", () => {
    const { errors } = validateProfile({
      displayName: "Ana",
      phoneNumber: "912345678",
      instagramUser: "bad user",
      department: "LIMA",
      province: "Lima",
      district: "Lima",
    });
    expect(errors.instagramUser).toBeTruthy();
  });

  it("enforces aboutMe length", () => {
    const longText = "a".repeat(301);
    const { errors } = validateProfile({
      displayName: "Luis",
      phoneNumber: "912345678",
      aboutMe: longText,
      department: "LIMA",
      province: "Lima",
      district: "Lima",
    });
    expect(errors.aboutMe).toBeTruthy();
  });

  it("requires full location when department is set", () => {
    const { errors } = validateProfile({
      displayName: "Maria",
      phoneNumber: "912345678",
      department: "LIMA",
    });
    expect(errors.department).toBeUndefined();
    expect(errors.province).toBeTruthy();
    expect(errors.district).toBeTruthy();
  });
});
