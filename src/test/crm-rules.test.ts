import { describe, expect, it } from "vitest";
import { limitClientFields, matchesClientSearch } from "@/lib/crm-rules";
import { emptyContact } from "@/lib/crm";

describe("CRM field rules", () => {
  it("limits special client notes to 50 characters", () => {
    expect(limitClientFields({ notes: "a".repeat(51) }).notes).toBe("a".repeat(50));
  });
  it("limits distinctive talent to 30 characters", () => {
    expect(limitClientFields({ notes: "", talent: "b".repeat(31) }).talent).toBe("b".repeat(30));
  });
  it("allows a contact without a date of birth", () => {
    expect(emptyContact().dob).toBe("");
  });
  it("matches religion and gender within the same search", () => {
    const client = { company: "Example", contacts: [{ religion: "Buddhism", gender: "Female" }] };
    expect(matchesClientSearch(client, "Buddhism Female")).toBe(true);
    expect(matchesClientSearch(client, "Buddhism Other")).toBe(false);
  });
  it("searches department, notes, talent and other contact fields", () => {
    const client = {
      departments: ["Engineering"],
      notes: "Renewal",
      talent: "Welding",
      contacts: [{ race: "Malay", dob: "1985-03-12" }],
    };
    for (const query of ["Engineering", "Renewal", "Welding", "Malay", "1985-03-12"])
      expect(matchesClientSearch(client, query)).toBe(true);
    expect(matchesClientSearch(client, "missing")).toBe(false);
  });
  it("starts a new contact with no relationship set", () => {
    expect(emptyContact().relationship).toBe("");
  });
  it("searches a contact's relationship", () => {
    const client = { company: "Example", contacts: [{ relationship: "Not Good" }] };
    expect(matchesClientSearch(client, "Not Good")).toBe(true);
    expect(matchesClientSearch(client, "Best")).toBe(false);
  });
});
