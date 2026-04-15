type Listener = (data: any) => void;

const listeners: Listener[] = [];

export const UpdateBus = {
  emit(data: any) {
    listeners.forEach((l) => l(data));
  },

  subscribe(fn: Listener) {
    listeners.push(fn);

    return () => {
      const index = listeners.indexOf(fn);
      if (index > -1) listeners.splice(index, 1);
    };
  }
};