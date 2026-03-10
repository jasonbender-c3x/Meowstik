import React from "react";
import { render } from "@testing-library/react";
import Login from "../Login";

describe("Login Page", () => {
  it("renders without crashing", () => {
    render(<Login />);
  });
});
