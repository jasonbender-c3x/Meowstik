import React from "react";
import { render } from "@testing-library/react";
import Settings from "../Settings";

describe("Settings Page", () => {
  it("renders without crashing", () => {
    render(<Settings />);
  });
});
