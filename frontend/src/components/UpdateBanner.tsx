import React from "react";

type Props = {
  visible: boolean;
  onUpdate: () => void;
  onLater: () => void;
};

export const UpdateBanner: React.FC<Props> = ({ visible, onUpdate, onLater }) => {
  if (!visible) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[9999] animate-in slide-in-from-bottom-6">
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 shadow-2xl rounded-2xl p-4 flex items-center justify-between backdrop-blur-xl">
        
        <div className="flex items-center gap-3">
          <div className="text-2xl">🚀</div>
          <div>
            <p className="font-bold text-gray-900 dark:text-white">
              New update available
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Improved performance & features added
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onLater}
            className="px-3 py-2 text-sm rounded-lg bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300"
          >
            Later
          </button>

          <button
            onClick={onUpdate}
            className="px-3 py-2 text-sm rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700"
          >
            Update
          </button>
        </div>
      </div>
    </div>
  );
};