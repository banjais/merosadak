export function verifyRole(role: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const userRole = req.headers["x-user-role"];
    if (userRole === role) next();
    else res.status(403).json({ error: `Access denied: ${role} only` });
  };
}

// Usage:
// app.use("/superadmin/accounts", verifyRole("superadmin"), superadminRouter);
