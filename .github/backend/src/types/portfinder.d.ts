// backend/src/types/portfinder.d.ts
declare module "portfinder" {
  interface PortFinderOptions {
    port?: number;
    stopPort?: number;
    host?: string;
    timeout?: number;
  }

  export function getPort(callback: (err: Error | null, port: number) => void): void;
  export function getPort(
    options: PortFinderOptions,
    callback: (err: Error | null, port: number) => void
  ): void;
  export function getPort(options?: PortFinderOptions): Promise<number>;

  export function getPorts(
    count: number,
    callback: (err: Error | null, ports: number[]) => void
  ): void;
  export function getPorts(
    count: number,
    options: PortFinderOptions,
    callback: (err: Error | null, ports: number[]) => void
  ): void;
  export function getPorts(count: number, options?: PortFinderOptions): Promise<number[]>;

  export const basePort: number;
}
