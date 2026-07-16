import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import pagesSource from "./pages.tsx?raw";

const styles = readFileSync(join(process.cwd(), "src", "styles.css"), "utf8");

describe("Memories hero", () => {
  it("keeps the heading copy intact without a forced line break", () => {
    expect(pagesSource).toContain(
      "<h2>Our story, one adventure at a time.</h2>",
    );
    expect(pagesSource).not.toMatch(
      /Our story, one[\s\S]*?<br\s*\/?>(?:[\s\S]*?)adventure at a time\./,
    );
  });

  it("balances and centers the text independently from the sparkle", () => {
    expect(styles).toMatch(
      /\.memory-intro\s*{[^}]*position:\s*relative;[^}]*text-align:\s*center;/s,
    );
    expect(styles).toMatch(
      /\.memory-intro > svg\s*{[^}]*position:\s*absolute;[^}]*left:\s*50%;[^}]*translateX\(-50%\);/s,
    );
    expect(styles).toMatch(
      /\.memory-intro h2\s*{[^}]*max-width:\s*350px;[^}]*text-wrap:\s*balance;/s,
    );
    expect(styles).toMatch(
      /\.memory-intro p\s*{[^}]*max-width:\s*500px;[^}]*margin:\s*auto;/s,
    );
  });
});
