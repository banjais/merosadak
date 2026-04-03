// backend/src/types/sentry.d.ts
declare module "@sentry/node" {
  const Sentry: any;
  export = Sentry;
}

declare module "@sentry/profiling-node" {
  const nodeProfilingIntegration: any;
  export { nodeProfilingIntegration };
}
