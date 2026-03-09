import React from "react";
import { render } from "@testing-library/react";
import Footer from "../Footer";

describe("Footer Component", () => {
  it("renders without crashing", () => {
    render(<Footer />);
  });
});
