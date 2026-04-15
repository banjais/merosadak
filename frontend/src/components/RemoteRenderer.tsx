import React from "react";
import { UIElement } from "../services/remoteUIEngine";

export const RemoteRenderer: React.FC<{ layout: UIElement[] }> = ({ layout }) => {
  return (
    <div className="flex flex-col gap-3 p-3">
      {layout.map((el, i) => {
        switch (el.type) {
          case "header":
            return (
              <h1
                key={i}
                style={{ color: el.props.color || "black" }}
                className="text-2xl font-bold"
              >
                {el.props.title}
              </h1>
            );

          case "button":
            return (
              <button
                key={i}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg"
                onClick={() => {
                  if (el.props.action === "openSearch") {
                    alert("Open Search Triggered");
                  }
                }}
              >
                {el.props.text}
              </button>
            );

          case "text":
            return <p key={i}>{el.props.text}</p>;

          case "card":
            return (
              <div key={i} className="p-3 rounded-xl shadow bg-white">
                {el.props.content}
              </div>
            );

          default:
            return null;
        }
      })}
    </div>
  );
};