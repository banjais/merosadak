import React from "react";

export const TrafficGovernmentPanel = ({ actions }: any) => {
  return (
    <div className="fixed top-0 right-0 w-[350px] h-full bg-gray-900 text-white p-3 overflow-auto">
      <h2 className="text-xl font-bold">🏛 Traffic Government AI</h2>

      {actions.map((a: any, i: number) => (
        <div key={i} className="border-b border-gray-700 py-2">
          <div className="font-bold">🛣 {a.road}</div>
          <div>Decision: {a.decision}</div>
          <div className="text-xs text-gray-400">{a.message}</div>
          <div className="text-xs">Priority: {a.priority}</div>
        </div>
      ))}
    </div>
  );
};