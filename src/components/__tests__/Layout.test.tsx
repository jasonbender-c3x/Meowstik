import React from "react";
import { render } from "@testing-library/react";
import Layout from "../Layout";

describe("Layout Component", () => {
  it("renders without crashing", () => {
    render(<Layout><div>Child</div></Layout>);
  });
});
