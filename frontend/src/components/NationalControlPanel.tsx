import React from "react";

export const NationalControlPanel = ({ data }: any) => {
  return (
    <div className="fixed top-0 right-0 w-[320px] h-full bg-black text-white p-3 overflow-auto">
      <h2 className="text-xl font-bold">🌍 National Road AI</h2>

      {data.map((d: any, i: number) => (
        <div key={i} className="border-b border-gray-700 py-2">
          <div>🛣 {d.name}</div>
          <div>Risk: {d.risk}</div>
          <div className="text-xs text-gray-400">
            Actions: {d.actions.join(", ")}
          </div>
        </div>
      ))}
    </div>
  );
};