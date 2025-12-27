import { LOCATIONS } from "../src/lib/locations";

describe("Release 1.1 - Location Data", () => {
  test("LOCATIONS should contain LIMA and AREQUIPA", () => {
    expect(LOCATIONS).toHaveProperty("LIMA");
    expect(LOCATIONS).toHaveProperty("AREQUIPA");
  });

  test("LIMA should have districts", () => {
    expect(Array.isArray(LOCATIONS.LIMA)).toBe(true);
    expect(LOCATIONS.LIMA.length).toBeGreaterThan(0);
    expect(LOCATIONS.LIMA).toContain("Miraflores");
    expect(LOCATIONS.LIMA).toContain("San Isidro");
  });

  test("AREQUIPA should have districts", () => {
    expect(Array.isArray(LOCATIONS.AREQUIPA)).toBe(true);
    expect(LOCATIONS.AREQUIPA.length).toBeGreaterThan(0);
    expect(LOCATIONS.AREQUIPA).toContain("Yanahuara");
    expect(LOCATIONS.AREQUIPA).toContain("Cayma");
  });
});
