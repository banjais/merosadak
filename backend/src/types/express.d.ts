import { User } from "../types.js"; // Adjust path to your actual User interface

declare global {
  namespace Express {
    interface Request {
      user?: User; 
    }
  }
}