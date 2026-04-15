import React from "react";

export const RiskOverlay = ({ predictions }: any) => {
  return (
    <>
      {predictions.map((p: any, i: number) => (
        <div
          key={i}
          style={{
            position: "absolute",
            top: 100 + i * 50,
            left: 20,
            padding: 10,
            borderRadius: 10,
            background:
              p.riskLevel === "critical"
                ? "red"
                : p.riskLevel === "high"
                ? "orange"
                : "yellow",
            color: "white",
          }}
        >
          🛣 {p.highway}
          <br />
          Risk: {p.riskLevel}
          <br />
          ⏱ {p.predictedInMinutes} min warning
        </div>
      ))}
    </>
  );
};