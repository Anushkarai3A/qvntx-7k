import { render, screen } from "@testing-library/react";
import { Wind } from "lucide-react";
import { describe, expect, it } from "vitest";

import { KpiCard } from "./KpiCard";

describe("KpiCard", () => {
  it("renders a metric with units and context", () => {
    render(
      <KpiCard
        label="Mean absolute error"
        value="1,234"
        unit="MW"
        subtitle="744 matched observations"
        icon={Wind}
      />,
    );
    expect(screen.getByText("Mean absolute error")).toBeInTheDocument();
    expect(screen.getByText("1,234")).toBeInTheDocument();
    expect(screen.getByText("MW")).toBeInTheDocument();
    expect(screen.getByText("744 matched observations")).toBeInTheDocument();
  });

  it("shows unavailable values in a muted state", () => {
    render(
      <KpiCard
        label="WAPE"
        value="Unavailable"
        icon={Wind}
        unavailable
      />,
    );
    expect(screen.getByText("Unavailable")).toBeInTheDocument();
  });
});
