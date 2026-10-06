import { describe, it, expect, vi, beforeEach } from "vitest";
import { updateHomeText } from "@/actions/page-content";
import { getHomeContent, savePageContent } from "@/lib/page-content";

vi.mock("@/lib/rbac", () => ({
  requireStaffArea: vi.fn().mockResolvedValue({ id: "admin-1", role: "ADMIN", staffMarketScope: null }),
  requireMarketAccess: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/page-content", async () => {
  const actual = await vi.importActual<typeof import("@/lib/page-content")>("@/lib/page-content");
  return { ...actual, getHomeContent: vi.fn(), savePageContent: vi.fn() };
});
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
}));

const textFields = {
  heroKicker: "", heroHeadingLine1: "", heroHeadingLine2: "", heroHeadingHighlight: "", heroSubtext: "",
  heritageKicker: "", heritageHeading: "", heritageBody: "",
  sourcingKicker: "", sourcingHeading: "", sourcingBody: "",
  editorialQuote: "", editorialQuoteHighlight: "", editorialAttribution: "",
  closingKicker: "", closingHeading: "", closingBody: "",
};

beforeEach(() => {
  vi.mocked(getHomeContent).mockResolvedValue({
    heroSlides: [], heritageImage: "", sourcingImage: "", showFeaturedGems: true, showFeaturedJewelry: true,
    ...textFields,
  } as never);
});

describe("updateHomeText — showFeaturedGems/showFeaturedJewelry checkboxes", () => {
  // The real form submits each of these twice (a hidden "false" input,
  // followed by the checkbox itself at "true" when checked) — see
  // GemstoneForm/JewelryForm's identical pattern. Build the FormData by
  // hand with .append() in DOM order to match what a real browser submits;
  // a plain object (via .set()) can't reproduce the duplicate submission.
  function formDataWithCheckboxes(gemsChecked: boolean, jewelryChecked: boolean): FormData {
    const fd = new FormData();
    for (const [k, v] of Object.entries(textFields)) fd.set(k, v);
    fd.append("showFeaturedGems", "false");
    if (gemsChecked) fd.append("showFeaturedGems", "true");
    fd.append("showFeaturedJewelry", "false");
    if (jewelryChecked) fd.append("showFeaturedJewelry", "true");
    return fd;
  }

  it("saves false for both when both checkboxes are unchecked (only the hidden fields submit)", async () => {
    const result = await updateHomeText(formDataWithCheckboxes(false, false));
    expect(result.ok).toBe(true);
    expect(savePageContent).toHaveBeenCalledWith("home", expect.objectContaining({ showFeaturedGems: false, showFeaturedJewelry: false }));
  });

  it("saves true for both when both checkboxes are checked", async () => {
    const result = await updateHomeText(formDataWithCheckboxes(true, true));
    expect(result.ok).toBe(true);
    expect(savePageContent).toHaveBeenCalledWith("home", expect.objectContaining({ showFeaturedGems: true, showFeaturedJewelry: true }));
  });

  it("tracks each checkbox independently", async () => {
    const result = await updateHomeText(formDataWithCheckboxes(true, false));
    expect(result.ok).toBe(true);
    expect(savePageContent).toHaveBeenCalledWith("home", expect.objectContaining({ showFeaturedGems: true, showFeaturedJewelry: false }));
  });
});
