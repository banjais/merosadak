export type UIElement =
  | { type: "header"; props: any }
  | { type: "button"; props: any }
  | { type: "card"; props: any }
  | { type: "text"; props: any };

export type UIScreen = {
  type: "SCREEN";
  name: string;
  layout: UIElement[];
};

class RemoteUIEngineClass {
  private screen: UIScreen | null = null;

  setScreen(screen: UIScreen) {
    this.screen = screen;
  }

  getScreen() {
    return this.screen;
  }
}

export const RemoteUIEngine = new RemoteUIEngineClass();