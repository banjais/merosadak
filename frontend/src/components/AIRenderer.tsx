import React from "react";

export const AIRenderer = ({ ui }: any) => {
  if (!ui) return null;

  return (
    <div className={ui.theme === "dark" ? "dark" : ""}>
      {ui.layout.map((el: any, i: number) => {
        switch (el.type) {
          case "alertBanner":
            return (
              <div key={i} className="bg-red-600 text-white p-3 rounded">
                {el.props.text}
              </div>
            );

          case "button":
            return (
              <button
                key={i}
                className="bg-blue-600 text-white px-4 py-2 rounded m-2"
                onClick={() => console.log(el.props.action)}
              >
                {el.props.text}
              </button>
            );

          case "mapFocus":
            return (
              <div key={i}>
                Map zoom: {el.props.zoom} | Traffic: ON
              </div>
            );

          default:
            return null;
        }
      })}
    </div>
  );
};