export class RouteAI {
  static findSafeRoute(routes: any[], predictions: any[]) {
    return routes.sort((a, b) => {
      const riskA =
        predictions.find((p) => p.highway === a.name)?.probability || 0;

      const riskB =
        predictions.find((p) => p.highway === b.name)?.probability || 0;

      return riskA - riskB;
    })[0]; // safest route
  }
}