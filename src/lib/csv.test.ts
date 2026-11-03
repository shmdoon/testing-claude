import { describe, expect, it } from "vitest";
import { csvCell, toCsv } from "./csv";

describe("csv", () => {
  it("quotes and escapes", () => expect(csvCell('a "b", c')).toBe('"a ""b"", c"'));
  it("neutralises formulas", () => {
    expect(csvCell("=HYPERLINK(\"x\")")).toBe("\"'=HYPERLINK(\"\"x\"\")\"");
    expect(csvCell("+91 99")).toBe("'+91 99");
    expect(csvCell("@cmd")).toBe("'@cmd");
  });
  it("builds rows", () => expect(toCsv(["a", "b"], [[1, null]])).toBe("a,b\r\n1,\r\n"));
});
