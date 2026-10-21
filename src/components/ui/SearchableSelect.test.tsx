import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Select } from "./SearchableSelect";

describe("Select (searchable combobox)", () => {
  it("shows the selected option's label when closed", () => {
    render(
      <Select value="b" onChange={() => {}}>
        <option value="a">Alpha</option>
        <option value="b">Beta</option>
      </Select>,
    );
    expect(screen.getByRole("combobox")).toHaveValue("Beta");
  });

  it("filters the option list as the user types", async () => {
    const user = userEvent.setup();
    render(
      <Select value="" onChange={() => {}}>
        <option value="a">Alpha</option>
        <option value="b">Beta</option>
        <option value="c">Gamma</option>
      </Select>,
    );

    await user.click(screen.getByRole("combobox"));
    await user.type(screen.getByRole("combobox"), "ga");

    expect(screen.getByRole("option", { name: "Gamma" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Alpha" })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Beta" })).not.toBeInTheDocument();
  });

  it("calls onChange with the picked option's value on click", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <Select value="" onChange={onChange} name="mineral">
        <option value="a">Alpha</option>
        <option value="b">Beta</option>
      </Select>,
    );

    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByRole("option", { name: "Beta" }));

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ target: expect.objectContaining({ value: "b", name: "mineral" }) }));
  });

  it("never lets a disabled option be selected", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <Select value="" onChange={onChange}>
        <option value="" disabled>Select…</option>
        <option value="a">Alpha</option>
      </Select>,
    );

    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByRole("option", { name: "Select…" }));

    expect(onChange).not.toHaveBeenCalled();
  });

  it("selects the highlighted option with the keyboard (ArrowDown + Enter)", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <Select value="" onChange={onChange}>
        <option value="a">Alpha</option>
        <option value="b">Beta</option>
      </Select>,
    );

    const combobox = screen.getByRole("combobox");
    await user.click(combobox);
    await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ target: expect.objectContaining({ value: "b" }) }));
  });

  it("works uncontrolled (defaultValue only, no value/onChange) — the plain-form-submission case", () => {
    render(
      <Select name="reason" defaultValue="b">
        <option value="a">Alpha</option>
        <option value="b">Beta</option>
      </Select>,
    );
    expect(screen.getByRole("combobox")).toHaveValue("Beta");
  });

  it("renders optgroup labels and still lets an option in either group be picked", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <Select value="" onChange={onChange}>
        <optgroup label="Faceted">
          <option value="round">Round</option>
        </optgroup>
        <optgroup label="Cabochon">
          <option value="oval-cab">Oval Cabochon</option>
        </optgroup>
      </Select>,
    );

    await user.click(screen.getByRole("combobox"));
    expect(screen.getByText("Faceted")).toBeInTheDocument();
    expect(screen.getByText("Cabochon")).toBeInTheDocument();
    await user.click(screen.getByRole("option", { name: "Oval Cabochon" }));

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ target: expect.objectContaining({ value: "oval-cab" }) }));
  });
});
